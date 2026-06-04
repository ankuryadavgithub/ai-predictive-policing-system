from types import SimpleNamespace

from app.forecast import compute_risk
from app.role_guard import can_access_report
from app.security import validate_password_strength
from app.services.ai_governance import get_ai_governance_summary
from app.services.risk_scoring import explain_risk_score


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


def test_risk_explanation_includes_top_drivers_and_notice():
    explanation = explain_risk_score(
        {
            "Murder": 10,
            "Robbery": 8,
            "Total_Estimated_Crimes": 100,
        }
    )

    assert explanation["risk_band"] == "moderate"
    assert explanation["top_drivers"][0]["crime_type"] == "Total_Estimated_Crimes"
    assert "decision-support" in explanation["decision_support_notice"]


def test_ai_governance_summary_marks_human_review_required():
    summary = get_ai_governance_summary()

    assert summary["system_role"] == "decision_support"
    assert summary["human_review_required"] is True
    assert "individual-level prediction" in summary["prohibited_uses"]


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
