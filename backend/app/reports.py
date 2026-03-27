import mimetypes
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.audit import logger
from app.config import UPLOADS_DIR, settings
from app.dependencies import get_current_user, get_db
from app.models import CrimeReport, EvidenceFile, User
from app.rate_limit import enforce_rate_limit
from app.role_guard import can_access_report, require_role


router = APIRouter(prefix="/reports", tags=["Crime Reports"])

ALLOWED_CONTENT_TYPES = {
    "image/jpeg": "image",
    "image/png": "image",
    "image/webp": "image",
    "video/mp4": "video",
    "video/webm": "video",
}


def _serialize_evidence(file: EvidenceFile) -> dict:
    return {
        "id": file.id,
        "file_type": file.file_type,
        "original_file_name": file.original_file_name,
        "content_type": file.content_type,
        "file_size": file.file_size,
        "uploaded_at": file.uploaded_at,
        "access_count": file.access_count,
        "access_url": f"/reports/{file.report_id}/evidence/{file.id}",
    }


def _serialize_report(report: CrimeReport) -> dict:
    return {
        "id": report.id,
        "report_id": report.report_id,
        "reporter_user_id": report.reporter_user_id,
        "reporter_name": report.reporter.full_name if report.reporter else None,
        "reporter_username": report.reporter.username if report.reporter else None,
        "crime_type": report.crime_type,
        "severity": report.severity,
        "description": report.description,
        "latitude": report.latitude,
        "longitude": report.longitude,
        "city": report.city,
        "state": report.state,
        "status": report.status,
        "assigned_station": report.assigned_station,
        "assigned_district": report.assigned_district,
        "assigned_police_id": report.assigned_police_id,
        "assigned_police_username": report.assigned_officer.username if report.assigned_officer else None,
        "assigned_police_name": report.assigned_officer.full_name if report.assigned_officer else None,
        "verification_notes": report.verification_notes,
        "created_at": report.created_at,
        "updated_at": report.updated_at,
        "evidence_count": len([item for item in report.evidence if not item.is_archived]),
        "evidence": [_serialize_evidence(item) for item in report.evidence if not item.is_archived],
    }


def _candidate_officers_for_report(db: Session, *, city: str | None, district: str | None):
    query = db.query(User).filter(
        User.role == "police",
        User.status == "approved",
    )

    if city:
        city_matches = query.filter(User.city.isnot(None), User.city.ilike(city)).all()
        if city_matches:
            return city_matches

    if district:
        district_matches = query.filter(User.district.isnot(None), User.district.ilike(district)).all()
        if district_matches:
            return district_matches

    return []


def _select_best_officer(db: Session, officers: list[User]) -> User | None:
    if not officers:
        return None

    best_officer = None
    best_open_count = None

    for officer in officers:
        open_count = (
            db.query(CrimeReport)
            .filter(
                CrimeReport.assigned_police_id == officer.id,
                CrimeReport.status.in_(["Assigned", "Submitted"]),
            )
            .count()
        )

        if best_open_count is None or open_count < best_open_count:
            best_open_count = open_count
            best_officer = officer

    return best_officer


def _assign_report_to_officer(report: CrimeReport, officer: User | None, notes: str | None = None) -> None:
    if officer is None:
        report.assigned_police_id = None
        if report.status == "Assigned":
            report.status = "Submitted"
        if notes:
            report.verification_notes = notes
        return

    report.assigned_police_id = officer.id
    report.assigned_district = officer.district
    report.assigned_station = officer.station
    if report.status not in {"Verified", "Rejected", "Resolved"}:
        report.status = "Assigned"
    if notes:
        report.verification_notes = notes


def _auto_assign_report(db: Session, report: CrimeReport) -> User | None:
    candidates = _candidate_officers_for_report(
        db,
        city=report.city,
        district=report.assigned_district,
    )
    selected_officer = _select_best_officer(db, candidates)
    if selected_officer:
        _assign_report_to_officer(report, selected_officer)
    return selected_officer


def _save_upload(file: UploadFile, report_id: str) -> tuple[Path, int, str]:
    content_type = (file.content_type or "").lower()
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {content_type or 'unknown'}")

    extension = Path(file.filename or "").suffix.lower()
    guessed_extension = mimetypes.guess_extension(content_type) or extension or ""
    safe_name = f"{uuid.uuid4().hex}{guessed_extension}"
    report_dir = UPLOADS_DIR / "reports" / report_id
    report_dir.mkdir(parents=True, exist_ok=True)

    destination = report_dir / safe_name
    total_size = 0
    chunk_size = 1024 * 1024
    try:
        with destination.open("wb") as buffer:
            while True:
                chunk = file.file.read(chunk_size)
                if not chunk:
                    break
                total_size += len(chunk)
                if total_size > settings.max_upload_size_bytes:
                    buffer.close()
                    destination.unlink(missing_ok=True)
                    raise HTTPException(status_code=400, detail="Uploaded file exceeds size limit")
                buffer.write(chunk)
    finally:
        file.file.close()

    return destination, total_size, ALLOWED_CONTENT_TYPES[content_type]


@router.post("/")
def create_report(
    request: Request,
    crime_type: str = Form(...),
    severity: str = Form(...),
    description: str = Form(...),
    latitude: float = Form(...),
    longitude: float = Form(...),
    evidence: list[UploadFile] | None = File(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    client_ip = request.client.host if request.client else "unknown"
    enforce_rate_limit(
        f"report:{client_ip}:{user.id}",
        settings.report_rate_limit,
        settings.rate_limit_window_seconds,
    )

    if not crime_type.strip():
        raise HTTPException(status_code=400, detail="Crime type is required")
    if not severity.strip():
        raise HTTPException(status_code=400, detail="Severity is required")
    if len(description.strip()) < 20:
        raise HTTPException(status_code=400, detail="Description must be at least 20 characters")

    if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
        raise HTTPException(status_code=400, detail="Invalid latitude or longitude")

    files = evidence or []
    if len(files) > settings.max_evidence_files:
        raise HTTPException(status_code=400, detail=f"Maximum {settings.max_evidence_files} files allowed")

    report_id = f"CR{uuid.uuid4().hex[:8].upper()}"

    new_report = CrimeReport(
        report_id=report_id,
        reporter_user_id=user.id,
        crime_type=crime_type.strip(),
        severity=severity.strip(),
        description=description.strip(),
        latitude=latitude,
        longitude=longitude,
        city=user.city,
        state=None,
        status="Submitted",
        assigned_station=user.station if user.role == "police" else None,
        assigned_district=user.district,
    )

    db.add(new_report)
    db.commit()
    db.refresh(new_report)

    assigned_officer = None
    if user.role != "police":
        assigned_officer = _auto_assign_report(db, new_report)
        db.commit()
        db.refresh(new_report)

    for upload in files:
        saved_path, size, file_type = _save_upload(upload, report_id)
        evidence_row = EvidenceFile(
            report_id=new_report.id,
            original_file_name=os.path.basename(upload.filename or "evidence"),
            stored_file_name=saved_path.name,
            file_path=str(saved_path),
            file_type=file_type,
            content_type=(upload.content_type or "application/octet-stream").lower(),
            file_size=size,
        )
        db.add(evidence_row)

    db.commit()
    logger.info(
        "Report submitted report_id=%s user_id=%s assigned_police_id=%s",
        report_id,
        user.id,
        assigned_officer.id if assigned_officer else None,
    )
    return {
        "message": "Report submitted successfully",
        "report_id": report_id,
        "assigned_police_id": new_report.assigned_police_id,
    }


@router.get("/")
def get_reports(
    status: str | None = None,
    page: int = 1,
    page_size: int = 25,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    page = max(page, 1)
    page_size = min(max(page_size, 1), 100)

    query = db.query(CrimeReport)
    if user.role == "citizen":
        query = query.filter(CrimeReport.reporter_user_id == user.id)
    elif user.role == "police":
        if not user.district and not user.station:
            raise HTTPException(status_code=403, detail="Police account missing station or district assignment")
        area_match = None
        if user.district:
            area_match = CrimeReport.assigned_district == user.district
        elif user.station:
            area_match = CrimeReport.assigned_station == user.station

        query = query.filter(
            (CrimeReport.assigned_police_id == user.id)
            | (
                (CrimeReport.assigned_police_id.is_(None))
                & area_match
            )
        )
    else:
        require_role(user, ["police", "admin"])

    if status:
        query = query.filter(CrimeReport.status == status)

    reports = (
        query.order_by(CrimeReport.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return [_serialize_report(report) for report in reports]


@router.patch("/{id}/verify")
def verify_report(
    id: int,
    notes: str | None = Form(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_role(user, ["police", "admin"])

    report = db.query(CrimeReport).filter(CrimeReport.id == id).first()
    if not report or not can_access_report(user, report):
        raise HTTPException(status_code=404, detail="Report not found")
    if report.status in {"Verified", "Rejected", "Resolved"}:
        raise HTTPException(status_code=400, detail="Report already processed")

    report.status = "Verified"
    report.verification_notes = notes
    report.reviewed_by = user.id
    report.reviewed_at = datetime.now(timezone.utc)
    db.commit()

    logger.info("Report verified report_id=%s reviewer=%s", report.report_id, user.username)
    return {"message": "Report verified successfully"}


@router.patch("/{id}/reject")
def reject_report(
    id: int,
    notes: str | None = Form(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_role(user, ["police", "admin"])

    report = db.query(CrimeReport).filter(CrimeReport.id == id).first()
    if not report or not can_access_report(user, report):
        raise HTTPException(status_code=404, detail="Report not found")
    if report.status in {"Rejected", "Resolved"}:
        raise HTTPException(status_code=400, detail="Report already processed")

    report.status = "Rejected"
    report.verification_notes = notes
    report.reviewed_by = user.id
    report.reviewed_at = datetime.now(timezone.utc)
    db.commit()

    logger.info("Report rejected report_id=%s reviewer=%s", report.report_id, user.username)
    return {"message": "Report rejected successfully"}


@router.get("/{report_id}/evidence/{file_id}")
def get_evidence(
    report_id: int,
    file_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    report = db.query(CrimeReport).filter(CrimeReport.id == report_id).first()
    if not report or not can_access_report(user, report):
        raise HTTPException(status_code=404, detail="Evidence not found")

    evidence = (
        db.query(EvidenceFile)
        .filter(
            EvidenceFile.id == file_id,
            EvidenceFile.report_id == report.id,
            EvidenceFile.is_archived.is_(False),
        )
        .first()
    )
    if evidence is None:
        raise HTTPException(status_code=404, detail="Evidence not found")

    path = Path(evidence.file_path)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Evidence file missing")

    evidence.access_count += 1
    db.commit()
    return FileResponse(
        path,
        media_type=evidence.content_type,
        filename=evidence.original_file_name,
    )
