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
        if report.assigned_district and user.district:
            return report.assigned_district == user.district
        if report.assigned_station and user.station:
            return report.assigned_station == user.station
        return False

    return False
