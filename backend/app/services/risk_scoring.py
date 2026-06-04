from __future__ import annotations

from dataclasses import dataclass


RISK_WEIGHTS: dict[str, float] = {
    "Murder": 0.25,
    "Rape": 0.15,
    "Robbery": 0.15,
    "Assault": 0.10,
    "Kidnapping_Abduction": 0.10,
    "Riots": 0.05,
    "Total_Estimated_Crimes": 0.20,
}

DECISION_SUPPORT_NOTICE = (
    "AI forecasts are decision-support signals based on historical aggregate patterns. "
    "They must not be used as the sole basis for enforcement action, individual targeting, "
    "or punitive decisions."
)


@dataclass(frozen=True)
class RiskContribution:
    crime_type: str
    count: int
    weight: float
    contribution: float


def compute_risk_score(predictions: dict[str, int | float | None]) -> float:
    return sum(
        weight * max(float(predictions.get(crime_type) or 0), 0.0)
        for crime_type, weight in RISK_WEIGHTS.items()
    )


def get_risk_band(score: float) -> str:
    if score >= 75:
        return "critical"
    if score >= 35:
        return "elevated"
    if score > 0:
        return "moderate"
    return "none"


def explain_risk_score(predictions: dict[str, int | float | None], limit: int = 3) -> dict[str, object]:
    contributions = [
        RiskContribution(
            crime_type=crime_type,
            count=int(max(float(predictions.get(crime_type) or 0), 0.0)),
            weight=weight,
            contribution=round(weight * max(float(predictions.get(crime_type) or 0), 0.0), 2),
        )
        for crime_type, weight in RISK_WEIGHTS.items()
    ]
    ranked = sorted(contributions, key=lambda item: item.contribution, reverse=True)
    top_drivers = [
        {
            "crime_type": item.crime_type,
            "count": item.count,
            "weight": item.weight,
            "contribution": item.contribution,
        }
        for item in ranked[:limit]
        if item.contribution > 0
    ]
    score = round(compute_risk_score(predictions), 2)

    return {
        "score": score,
        "risk_band": get_risk_band(score),
        "method": "weighted_aggregate_crime_forecast",
        "top_drivers": top_drivers,
        "weights": RISK_WEIGHTS,
        "decision_support_notice": DECISION_SUPPORT_NOTICE,
    }
