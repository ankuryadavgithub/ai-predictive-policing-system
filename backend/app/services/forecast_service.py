from __future__ import annotations

from sqlalchemy.orm import Session

from app import models
from app.prediction_source import apply_prediction_source_filter, resolve_prediction_source
from app.services.risk_scoring import DECISION_SUPPORT_NOTICE, compute_risk_score, explain_risk_score


def build_forecast_payload(
    *,
    city: str,
    crime_counts: dict[str, int],
    source: str | None,
    prediction_batch: str | None,
) -> dict[str, object]:
    risk_index = float(compute_risk_score(crime_counts))
    return {
        "city": city,
        "predicted_crimes": crime_counts,
        "crime_risk_index": risk_index,
        "risk_explanation": explain_risk_score(crime_counts),
        "decision_support_notice": DECISION_SUPPORT_NOTICE,
        "record_type": "predicted",
        "source": source,
        "prediction_batch": prediction_batch,
    }


def get_city_forecast(db: Session, city: str) -> dict[str, object]:
    prediction_source = resolve_prediction_source(db)
    records = (
        db.query(models.Crime)
        .filter(models.Crime.city.ilike(f"%{city}%"))
        .filter(models.Crime.record_type == "predicted")
    )
    records = apply_prediction_source_filter(records, db)
    records = records.filter(models.Crime.year >= 2026).all()

    if not records:
        return build_forecast_payload(
            city=city,
            crime_counts={},
            source=prediction_source.source,
            prediction_batch=prediction_source.prediction_batch,
        )

    crime_counts: dict[str, int] = {}
    for record in records:
        crime_counts[record.crime_type] = crime_counts.get(record.crime_type, 0) + record.crime_count

    return build_forecast_payload(
        city=city,
        crime_counts=crime_counts,
        source=prediction_source.source,
        prediction_batch=prediction_source.prediction_batch,
    )
