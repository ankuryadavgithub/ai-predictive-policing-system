from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.audit import logger
from app.cache import get_cache, set_cache
from app.config import settings
from app.dependencies import get_current_user, get_db
from app.models import Crime, CrimeReport, EvidenceFile, User
from app.role_guard import require_role
from app.schemas import UserSummary


router = APIRouter(prefix="/admin", tags=["Admin"])


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
        "created_at": report.created_at,
        "updated_at": report.updated_at,
        "verification_notes": report.verification_notes,
        "evidence_count": len([item for item in report.evidence if not item.is_archived]),
        "evidence": [
            _serialize_evidence(item)
            for item in report.evidence
            if not item.is_archived
        ],
    }


def _serialize_evidence(file: EvidenceFile) -> dict:
    return {
        "id": file.id,
        "report_id": file.report_id,
        "file_type": file.file_type,
        "original_file_name": file.original_file_name,
        "content_type": file.content_type,
        "file_size": file.file_size,
        "access_count": file.access_count,
        "uploaded_at": file.uploaded_at,
        "is_archived": file.is_archived,
        "access_url": f"/reports/{file.report_id}/evidence/{file.id}",
    }


@router.get("/users")
def get_all_users(
    page: int = 1,
    page_size: int = 25,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_role(user, ["admin"])
    page = max(page, 1)
    page_size = min(max(page_size, 1), 100)

    users = (
        db.query(User)
        .order_by(User.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return [UserSummary.model_validate(item).model_dump(mode="json") for item in users]


@router.delete("/users/{id}")
def delete_user(
    id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_role(user, ["admin"])
    target = db.query(User).filter(User.id == id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.id == user.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")
    if target.role == "admin":
        raise HTTPException(status_code=400, detail="Admin users cannot be deleted from this endpoint")

    db.delete(target)
    db.commit()
    logger.info("Admin deleted user target_id=%s actor=%s", id, user.username)
    return {"message": "User deleted"}


@router.patch("/approve/{id}")
def approve_police(
    id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_role(user, ["admin"])
    officer = db.query(User).filter(User.id == id, User.role == "police").first()
    if not officer:
        raise HTTPException(status_code=404, detail="Police officer not found")

    officer.status = "approved"
    db.commit()
    logger.info("Admin approved police officer target_id=%s actor=%s", id, user.username)
    return {"message": "Officer approved"}


@router.patch("/suspend/{id}")
def suspend_user(
    id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_role(user, ["admin"])
    target = db.query(User).filter(User.id == id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.id == user.id:
        raise HTTPException(status_code=400, detail="You cannot suspend your own account")

    target.status = "suspended"
    db.commit()
    logger.info("Admin suspended user target_id=%s actor=%s", id, user.username)
    return {"message": "User suspended"}


@router.get("/analytics")
def get_admin_analytics(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_role(user, ["admin"])
    cache_key = "admin:analytics:summary"
    cached = get_cache(cache_key)
    if cached is not None:
        return cached

    total_users = db.query(User).count()
    pending_police = db.query(User).filter(User.role == "police", User.status == "pending").count()
    total_reports = db.query(CrimeReport).count()
    verified_reports = db.query(CrimeReport).filter(CrimeReport.status == "Verified").count()

    data = {
        "total_users": total_users,
        "pending_police": pending_police,
        "total_reports": total_reports,
        "verified_reports": verified_reports,
    }
    set_cache(cache_key, data, settings.redis_cache_ttl_seconds)
    return data


@router.get("/analytics/crimes-by-city")
def crimes_by_city(
    record_type: str = "all",
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_role(user, ["admin"])
    query = db.query(Crime.city, func.sum(Crime.crime_count)).group_by(Crime.city)
    if record_type != "all":
        query = query.filter(Crime.record_type == record_type)
    data = query.all()
    return [{"city": row[0], "count": row[1]} for row in data]


@router.get("/analytics/yearly-trend")
def yearly_trend(
    record_type: str = "all",
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_role(user, ["admin"])
    query = db.query(Crime.year, func.sum(Crime.crime_count).label("total"))
    if record_type != "all":
        query = query.filter(Crime.record_type == record_type)
    data = query.group_by(Crime.year).order_by(Crime.year).all()
    return [{"year": row[0], "total": row[1]} for row in data]


@router.get("/analytics/top-crime-types")
def top_crime_types(
    record_type: str = "all",
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_role(user, ["admin"])
    query = db.query(Crime.crime_type, func.sum(Crime.crime_count).label("total")).filter(
        Crime.crime_type != "Total_Estimated_Crimes"
    )
    if record_type != "all":
        query = query.filter(Crime.record_type == record_type)

    data = query.group_by(Crime.crime_type).order_by(func.sum(Crime.crime_count).desc()).limit(5).all()
    return [{"type": row[0], "total": row[1]} for row in data]


@router.get("/analytics/top-districts")
def top_districts(
    record_type: str = "all",
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_role(user, ["admin"])
    query = db.query(Crime.district, func.sum(Crime.crime_count).label("total"))
    if record_type != "all":
        query = query.filter(Crime.record_type == record_type)
    data = query.group_by(Crime.district).order_by(func.sum(Crime.crime_count).desc()).limit(5).all()
    return [{"district": row[0], "total": row[1]} for row in data]


@router.get("/reports")
def get_all_reports(
    page: int = 1,
    page_size: int = 25,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_role(user, ["admin"])
    page = max(page, 1)
    page_size = min(max(page_size, 1), 100)

    reports = (
        db.query(CrimeReport)
        .order_by(CrimeReport.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return [_serialize_report(report) for report in reports]


@router.patch("/reports/{id}/resolve")
def resolve_report(
    id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_role(user, ["admin"])
    report = db.query(CrimeReport).filter(CrimeReport.id == id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    report.status = "Resolved"
    report.reviewed_by = user.id
    report.reviewed_at = datetime.now(timezone.utc)
    db.commit()
    logger.info("Admin resolved report report_id=%s actor=%s", report.report_id, user.username)
    return {"message": "Report resolved"}


@router.patch("/reports/{id}/fake")
def mark_fake(
    id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_role(user, ["admin"])
    report = db.query(CrimeReport).filter(CrimeReport.id == id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    report.status = "Rejected"
    report.verification_notes = "Marked as fake by admin moderation"
    report.reviewed_by = user.id
    report.reviewed_at = datetime.now(timezone.utc)
    db.commit()
    logger.info("Admin marked report fake report_id=%s actor=%s", report.report_id, user.username)
    return {"message": "Report marked fake"}


@router.delete("/reports/{id}")
def delete_report(
    id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_role(user, ["admin"])
    report = db.query(CrimeReport).filter(CrimeReport.id == id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    db.delete(report)
    db.commit()
    logger.info("Admin deleted report report_id=%s actor=%s", report.report_id, user.username)
    return {"message": "Report deleted"}


@router.get("/evidence")
def get_all_evidence(
    page: int = 1,
    page_size: int = 25,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_role(user, ["admin"])
    page = max(page, 1)
    page_size = min(max(page_size, 1), 100)

    files = (
        db.query(EvidenceFile)
        .filter(EvidenceFile.is_archived.is_(False))
        .order_by(EvidenceFile.uploaded_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return [_serialize_evidence(file) for file in files]


@router.delete("/evidence/{id}")
def delete_evidence(
    id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_role(user, ["admin"])
    file = db.query(EvidenceFile).filter(EvidenceFile.id == id).first()
    if not file:
        raise HTTPException(status_code=404, detail="File not found")

    file.is_archived = True
    db.commit()
    logger.info("Admin archived evidence file_id=%s actor=%s", id, user.username)
    return {"message": "Evidence archived"}
