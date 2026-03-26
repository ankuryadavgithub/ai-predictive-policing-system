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
        "verification_notes": report.verification_notes,
        "created_at": report.created_at,
        "updated_at": report.updated_at,
        "evidence_count": len([item for item in report.evidence if not item.is_archived]),
        "evidence": [_serialize_evidence(item) for item in report.evidence if not item.is_archived],
    }


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
    content = file.file.read()
    if len(content) > settings.max_upload_size_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file exceeds size limit")

    with destination.open("wb") as buffer:
        buffer.write(content)

    return destination, len(content), ALLOWED_CONTENT_TYPES[content_type]


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
    logger.info("Report submitted report_id=%s user_id=%s", report_id, user.id)
    return {"message": "Report submitted successfully", "report_id": report_id}


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
    elif user.role == "police" and user.district:
        query = query.filter(
            (CrimeReport.assigned_district == user.district)
            | (CrimeReport.assigned_district.is_(None))
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
