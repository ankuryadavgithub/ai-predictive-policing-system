from fastapi import HTTPException

from app.models import CrimeReport, User


def require_role(user: User, allowed_roles: list[str]) -> None:
    if user.role not in allowed_roles:
        raise HTTPException(status_code=403, detail="Access denied")


def can_access_report(user: User, report: CrimeReport) -> bool:
    if user.role == "admin":
        return True

    if user.role == "citizen":
        return report.reporter_user_id == user.id

    if user.role == "police":
        patrol_district = getattr(user, "patrol_district", None) or user.district
        if report.assigned_police_id is not None:
            return report.assigned_police_id == user.id
        if report.assigned_district and patrol_district:
            return report.assigned_district == patrol_district
        return False

    return False
