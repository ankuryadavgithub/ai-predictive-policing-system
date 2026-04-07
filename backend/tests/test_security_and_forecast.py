from types import SimpleNamespace

from app.forecast import compute_risk
from app.role_guard import can_access_report
from app.security import validate_password_strength


def test_password_strength_requires_upper_lower_and_number():
    assert validate_password_strength("StrongPass1")
    assert not validate_password_strength("weakpass")
    assert not validate_password_strength("WEAKPASS1")
    assert not validate_password_strength("WeakOnly")


def test_compute_risk_uses_weighted_crime_inputs():
    risk = compute_risk(
        {
            "Murder": 10,
            "Rape": 5,
            "Robbery": 8,
            "Assault": 12,
            "Kidnapping_Abduction": 4,
            "Riots": 3,
            "Total_Estimated_Crimes": 100,
        }
    )
    assert risk > 0
    assert round(risk, 2) == 26.20


def test_police_can_access_explicitly_assigned_report():
    officer = SimpleNamespace(id=7, role="police", district="Central", station="Station A")
    report = SimpleNamespace(
        reporter_user_id=3,
        assigned_police_id=7,
        assigned_district="Other",
        assigned_station="Other",
    )

    assert can_access_report(officer, report)


def test_police_cannot_access_other_officers_assigned_report_even_same_district():
    officer = SimpleNamespace(id=7, role="police", district="Central", station="Station A")
    report = SimpleNamespace(
        reporter_user_id=3,
        assigned_police_id=9,
        assigned_district="Central",
        assigned_station="Station A",
    )

    assert not can_access_report(officer, report)
