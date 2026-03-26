from app.forecast import compute_risk
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
    assert round(risk, 2) == 26.95
