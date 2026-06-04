from __future__ import annotations

from app.services.risk_scoring import DECISION_SUPPORT_NOTICE, RISK_WEIGHTS


def get_ai_governance_summary() -> dict[str, object]:
    return {
        "system_role": "decision_support",
        "decision_support_notice": DECISION_SUPPORT_NOTICE,
        "allowed_uses": [
            "aggregate hotspot awareness",
            "resource planning with human review",
            "historical-vs-predicted comparison",
            "dashboard analytics for supervisory review",
        ],
        "prohibited_uses": [
            "individual-level prediction",
            "automated enforcement action",
            "punitive decisions without human verification",
            "treating forecasted hotspots as proof of crime",
        ],
        "human_review_required": True,
        "risk_score_method": {
            "name": "weighted_aggregate_crime_forecast",
            "weights": RISK_WEIGHTS,
            "interpretation": (
                "The score ranks aggregate area-level forecast intensity. It is not a probability "
                "of crime and should be interpreted alongside field intelligence and recent reports."
            ),
        },
        "recommended_controls": [
            "show source forecast batch in the UI",
            "audit sensitive report and patrol-assignment actions",
            "review model performance before promoting a new batch",
            "monitor regional error and bias before operational use",
        ],
    }
