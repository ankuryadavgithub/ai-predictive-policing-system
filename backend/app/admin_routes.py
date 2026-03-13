from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models import User
from app.dependencies import get_current_user
from app.role_guard import require_role
from sqlalchemy import func
from app.models import CrimeReport
from app.models import Crime
from app.models import EvidenceFile

router = APIRouter(prefix="/admin", tags=["Admin"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("/users")
def get_all_users(
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):

    require_role(user, ["admin"])

    users = db.query(User).all()

    return users

@router.delete("/users/{id}")
def delete_user(
    id: int,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):

    require_role(user, ["admin"])

    target = db.query(User).filter(User.id == id).first()

    if not target:
        return {"error":"User not found"}

    db.delete(target)
    db.commit()

    return {"message":"User deleted"}

@router.patch("/approve/{id}")
def approve_police(
    id: int,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):

    require_role(user, ["admin"])

    officer = db.query(User).filter(User.id == id).first()

    officer.status = "approved"

    db.commit()

    return {"message":"Officer approved"}

@router.patch("/suspend/{id}")
def suspend_user(
    id: int,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):

    require_role(user, ["admin"])

    target = db.query(User).filter(User.id == id).first()

    if not target:
        return {"error": "User not found"}

    target.status = "suspended"

    db.commit()

    return {"message": "User suspended"}

@router.get("/analytics")
def get_admin_analytics(
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):

    require_role(user, ["admin"])

    total_users = db.query(User).count()

    pending_police = db.query(User).filter(
        User.role == "police",
        User.status == "pending"
    ).count()

    total_reports = db.query(CrimeReport).count()

    verified_reports = db.query(CrimeReport).filter(
        CrimeReport.status == "Verified"
    ).count()

    return {
        "total_users": total_users,
        "pending_police": pending_police,
        "total_reports": total_reports,
        "verified_reports": verified_reports
    }

@router.get("/analytics/crimes-by-city")
def crimes_by_city(
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):

    require_role(user, ["admin"])

    data = db.query(
        Crime.city,
        func.sum(Crime.crime_count)
    ).group_by(Crime.city).all()

    return [{"city": c[0], "count": c[1]} for c in data]

@router.get("/analytics/yearly-trend")
def yearly_trend(
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):

    require_role(user, ["admin"])

    data = db.query(
        Crime.year,
        func.sum(Crime.crime_count).label("total")
    ).group_by(Crime.year)\
     .order_by(Crime.year).all()

    return [{"year": d[0], "total": d[1]} for d in data]

@router.get("/analytics/top-crime-types")
def top_crime_types(
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):

    require_role(user, ["admin"])

    data = db.query(
        Crime.crime_type,
        func.sum(Crime.crime_count).label("total")
    ).filter(
        Crime.crime_type != "Total_Estimated_Crimes"
    ).group_by(Crime.crime_type)\
     .order_by(func.sum(Crime.crime_count).desc())\
     .limit(5).all()

    return [{"type": d[0], "total": d[1]} for d in data]

@router.get("/analytics/top-districts")
def top_districts(
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):

    require_role(user, ["admin"])

    data = db.query(
        Crime.district,
        func.sum(Crime.crime_count).label("total")
    ).group_by(Crime.district)\
     .order_by(func.sum(Crime.crime_count).desc())\
     .limit(5).all()

    return [{"district": d[0], "total": d[1]} for d in data]

@router.get("/analytics/monthly-trend")
def monthly_trend(
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):

    require_role(user, ["admin"])

    data = db.query(
        Crime.year,
        func.sum(Crime.crime_count)
    ).group_by(Crime.year).order_by(Crime.year).all()

    return [{"year": d[0], "total": d[1]} for d in data]

@router.get("/reports")
def get_all_reports(
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):

    require_role(user, ["admin"])

    reports = db.query(CrimeReport).all()

    return reports

@router.patch("/reports/{id}/resolve")
def resolve_report(
    id: int,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):

    require_role(user, ["admin"])

    report = db.query(CrimeReport).filter(CrimeReport.id == id).first()

    if not report:
        return {"error": "Report not found"}

    report.status = "Resolved"

    db.commit()

    return {"message": "Report resolved"}

@router.patch("/reports/{id}/fake")
def mark_fake(
    id: int,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):

    require_role(user, ["admin"])

    report = db.query(CrimeReport).filter(CrimeReport.id == id).first()

    if not report:
        return {"error": "Report not found"}

    report.status = "Fake"

    db.commit()

    return {"message": "Report marked fake"}

@router.delete("/reports/{id}")
def delete_report(
    id: int,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):

    require_role(user, ["admin"])

    report = db.query(CrimeReport).filter(CrimeReport.id == id).first()

    if not report:
        return {"error": "Report not found"}

    db.delete(report)
    db.commit()

    return {"message": "Report deleted"}

@router.get("/evidence")
def get_all_evidence(
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):

    require_role(user, ["admin"])

    files = db.query(EvidenceFile).all()

    return files

@router.delete("/evidence/{id}")
def delete_evidence(
    id: int,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):

    require_role(user, ["admin"])

    file = db.query(EvidenceFile).filter(EvidenceFile.id == id).first()

    if not file:
        return {"error": "File not found"}

    db.delete(file)
    db.commit()

    return {"message": "Evidence removed"}