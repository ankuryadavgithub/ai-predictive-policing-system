from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.audit import logger
from app.cache import get_cache, set_cache
from app.config import settings
from app.dependencies import get_current_user, get_db
from app.identity_verification import (
    approve_identity_verification,
    reject_identity_verification,
    serialize_identity_verification,
)
from app.models import Crime, CrimeReport, EvidenceFile, IdentityVerification, User
from app.role_guard import require_role
from app.schemas import (
    IdentityVerificationDecisionRequest,
    PatrolAreaUpdateRequest,
    ReportAssignmentRequest,
    UserSummary,
)


router = APIRouter(prefix="/admin", tags=["Admin"])


def _validate_patrol_area(db: Session, payload: PatrolAreaUpdateRequest) -> None:
    if payload.patrol_city and not payload.patrol_state:
        raise HTTPException(status_code=400, detail="Patrol state is required when assigning a patrol city")

    if payload.patrol_district and not payload.patrol_state:
        raise HTTPException(status_code=400, detail="Patrol state is required when assigning a patrol district")

    if payload.patrol_city and not payload.patrol_district:
        raise HTTPException(status_code=400, detail="Patrol district is required when assigning a patrol city")

    if payload.patrol_state:
        state_exists = (
            db.query(Crime.id)
            .filter(Crime.state == payload.patrol_state)
            .first()
        )
        if not state_exists:
            raise HTTPException(status_code=400, detail="Selected patrol state was not found in crime data")

    if payload.patrol_district:
        district_exists = (
            db.query(Crime.id)
            .filter(
                Crime.state == payload.patrol_state,
                Crime.district == payload.patrol_district,
            )
            .first()
        )
        if not district_exists:
            raise HTTPException(
                status_code=400,
                detail="Selected patrol district does not belong to the selected patrol state",
            )

    if payload.patrol_city:
        city_exists = (
            db.query(Crime.id)
            .filter(
                Crime.state == payload.patrol_state,
                Crime.district == payload.patrol_district,
                Crime.city == payload.patrol_city,
            )
            .first()
        )
        if not city_exists:
            raise HTTPException(
                status_code=400,
                detail="Selected patrol city does not belong to the selected patrol district",
            )


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
    query: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_role(user, ["admin"])
    page = max(page, 1)
    page_size = min(max(page_size, 1), 1000)

    users_query = db.query(User)
    if query:
        search = f"%{query.strip()}%"
        users_query = users_query.filter(
            (User.username.ilike(search))
            | (User.email.ilike(search))
            | (User.full_name.ilike(search))
        )

    users = (
        users_query
        .order_by(User.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return [UserSummary.model_validate(item).model_dump(mode="json") for item in users]


@router.get("/identity-verifications")
def get_identity_verifications(
    status: str = "pending_manual_review",
    page: int = 1,
    page_size: int = 25,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_role(user, ["admin"])
    page = max(page, 1)
    page_size = min(max(page_size, 1), 100)

    query = db.query(IdentityVerification)
    if status != "all":
        query = query.filter(IdentityVerification.verification_status == status)

    records = (
        query.order_by(IdentityVerification.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return [serialize_identity_verification(record) for record in records]


@router.get("/identity-verifications/{id}/files/{kind}")
def get_identity_verification_file(
    id: int,
    kind: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_role(user, ["admin"])
    record = db.query(IdentityVerification).filter(IdentityVerification.id == id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Identity verification not found")

    if kind == "aadhaar":
        path = record.aadhaar_card_path
    elif kind == "selfie":
        path = record.live_selfie_path
    else:
        raise HTTPException(status_code=400, detail="Unsupported identity file type")

    file_path = Path(path)
    if not path or not file_path.exists():
        raise HTTPException(status_code=404, detail="Identity verification file unavailable")

    return FileResponse(file_path, filename=file_path.name)


@router.patch("/identity-verifications/{id}/approve")
def approve_identity_record(
    id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_role(user, ["admin"])
    record = db.query(IdentityVerification).filter(IdentityVerification.id == id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Identity verification not found")

    approved_user = approve_identity_verification(db, record, reviewer_id=user.id)
    db.commit()
    logger.info("Admin approved identity verification id=%s actor=%s", id, user.username)
    return {
        "message": "Citizen verification approved",
        "user_id": approved_user.id,
        "verification": serialize_identity_verification(record),
    }


@router.patch("/identity-verifications/{id}/reject")
def reject_identity_record(
    id: int,
    payload: IdentityVerificationDecisionRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_role(user, ["admin"])
    record = db.query(IdentityVerification).filter(IdentityVerification.id == id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Identity verification not found")

    reject_identity_verification(
        db,
        record,
        reviewer_id=user.id,
        reason=payload.reason or "Rejected by admin review",
    )
    db.commit()
    logger.info("Admin rejected identity verification id=%s actor=%s", id, user.username)
    return {
        "message": "Citizen verification rejected",
        "verification": serialize_identity_verification(record),
    }


@router.get("/officers")
def get_assignable_officers(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_role(user, ["admin"])
    officers = (
        db.query(User)
        .filter(User.role == "police", User.status == "approved")
        .order_by(User.full_name.asc())
        .all()
    )
    return [UserSummary.model_validate(item).model_dump(mode="json") for item in officers]


@router.get("/patrol/states")
def get_patrol_states(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_role(user, ["admin"])
    states = (
        db.query(Crime.state)
        .filter(Crime.state.isnot(None), Crime.state != "")
        .distinct()
        .order_by(Crime.state.asc())
        .all()
    )
    return [row[0] for row in states if row[0]]


@router.get("/patrol/districts")
def get_patrol_districts(
    state: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_role(user, ["admin"])
    query = db.query(Crime.district).filter(Crime.district.isnot(None), Crime.district != "")
    if state:
        query = query.filter(Crime.state == state)
    districts = query.distinct().order_by(Crime.district.asc()).all()
    return [row[0] for row in districts if row[0]]


@router.get("/patrol/cities")
def get_patrol_cities(
    state: str | None = None,
    district: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_role(user, ["admin"])
    query = db.query(Crime.city).filter(Crime.city.isnot(None), Crime.city != "")
    if state:
        query = query.filter(Crime.state == state)
    if district:
        query = query.filter(Crime.district == district)
    cities = query.distinct().order_by(Crime.city.asc()).all()
    return [row[0] for row in cities if row[0]]


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


@router.patch("/users/{id}/patrol-area")
def update_patrol_area(
    id: int,
    payload: PatrolAreaUpdateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_role(user, ["admin"])
    officer = db.query(User).filter(User.id == id, User.role == "police").first()
    if not officer:
        raise HTTPException(status_code=404, detail="Police officer not found")

    _validate_patrol_area(db, payload)

    officer.patrol_state = payload.patrol_state
    officer.patrol_district = payload.patrol_district
    officer.patrol_city = payload.patrol_city
    db.commit()

    logger.info(
        "Admin updated patrol area target_id=%s actor=%s patrol_city=%s patrol_district=%s",
        officer.id,
        user.username,
        officer.patrol_city,
        officer.patrol_district,
    )
    return {
        "message": "Patrol area updated",
        "user": UserSummary.model_validate(officer).model_dump(mode="json"),
    }


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
    cache_key = f"admin:analytics:top-districts:{record_type}"
    cached = get_cache(cache_key)
    if cached is not None:
        return cached

    query = db.query(Crime.district, func.sum(Crime.crime_count).label("total"))
    if record_type != "all":
        query = query.filter(Crime.record_type == record_type)
    data = query.group_by(Crime.district).order_by(func.sum(Crime.crime_count).desc()).limit(5).all()
    result = [{"district": row[0], "total": row[1]} for row in data]
    set_cache(cache_key, result, settings.redis_cache_ttl_seconds)
    return result


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


@router.patch("/reports/{id}/assign")
def assign_report(
    id: int,
    payload: ReportAssignmentRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_role(user, ["admin"])
    report = db.query(CrimeReport).filter(CrimeReport.id == id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    officer = None
    if payload.assigned_police_id is not None:
        officer = (
            db.query(User)
            .filter(
                User.id == payload.assigned_police_id,
                User.role == "police",
                User.status == "approved",
            )
            .first()
        )
        if officer is None:
            raise HTTPException(status_code=404, detail="Police officer not found")

    report.assigned_police_id = officer.id if officer else None
    report.assigned_station = officer.station if officer else report.assigned_station
    report.assigned_district = (officer.patrol_district or officer.district) if officer else report.assigned_district
    if report.status not in {"Verified", "Rejected", "Resolved"}:
        report.status = "Assigned" if officer else "Submitted"
    if payload.notes:
        report.verification_notes = payload.notes

    db.commit()
    logger.info(
        "Admin assigned report report_id=%s officer_id=%s actor=%s",
        report.report_id,
        officer.id if officer else None,
        user.username,
    )
    return {
        "message": "Report assignment updated",
        "assigned_police_id": report.assigned_police_id,
    }


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
