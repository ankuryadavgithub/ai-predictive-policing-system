from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.cache import get_cache, set_cache
from app.config import settings
from app.dependencies import get_db
from app import models, schemas
from app.prediction_source import (
    apply_prediction_source_filter,
    resolve_effective_record_type,
    resolve_prediction_source,
)


router = APIRouter(prefix="/forecast", tags=["Forecast"])


def compute_risk(predictions: dict[str, int]) -> float:
    return (
        0.25 * predictions.get("Murder", 0)
        + 0.15 * predictions.get("Rape", 0)
        + 0.15 * predictions.get("Robbery", 0)
        + 0.10 * predictions.get("Assault", 0)
        + 0.10 * predictions.get("Kidnapping_Abduction", 0)
        + 0.05 * predictions.get("Riots", 0)
        + 0.20 * predictions.get("Total_Estimated_Crimes", 0)
    )

@router.get("/kpis")
def get_kpis(
    state: str = "All",
    crime_type: str = "All",
    city: str = "All",
    year: int = 2024,
    record_type: schemas.RecordType = "all",
    db: Session = Depends(get_db),
):
    resolved_record_type = resolve_effective_record_type(year, record_type)
    prediction_source = resolve_prediction_source(db) if resolved_record_type == "predicted" else None
    cache_key = (
        f"forecast:kpis:{state}:{city}:{crime_type}:{year}:{resolved_record_type}:"
        f"{prediction_source.prediction_batch if prediction_source else 'none'}"
    )
    cached = get_cache(cache_key)
    if cached is not None:
        return cached

    query = db.query(models.Crime).filter(
        models.Crime.year == year,
        models.Crime.record_type == resolved_record_type,
    )
    if resolved_record_type == "predicted":
        query = apply_prediction_source_filter(query, db)
    if state != "All":
        query = query.filter(models.Crime.state == state)
    if city != "All":
        query = query.filter(models.Crime.city.ilike(f"%{city}%"))
    if crime_type != "All":
        query = query.filter(models.Crime.crime_type == crime_type)

    crimes = query.all()
    if not crimes:
        return {
            "total_crimes": 0,
            "risk_index": 0,
            "high_risk_city": "N/A",
            "crime_types": 0,
            "record_type": resolved_record_type,
            "source": prediction_source.source if prediction_source else None,
            "prediction_batch": prediction_source.prediction_batch if prediction_source else None,
        }

    total_crimes = sum(item.crime_count for item in crimes)
    crime_dict: dict[str, int] = {}
    city_dict: dict[str, int] = {}
    for crime in crimes:
        crime_dict[crime.crime_type] = crime_dict.get(crime.crime_type, 0) + crime.crime_count
        city_dict[crime.city] = city_dict.get(crime.city, 0) + crime.crime_count

    data = {
        "total_crimes": total_crimes,
        "risk_index": float(compute_risk(crime_dict)),
        "high_risk_city": max(city_dict, key=city_dict.get),
        "crime_types": len(crime_dict),
        "record_type": resolved_record_type,
        "source": prediction_source.source if prediction_source else None,
        "prediction_batch": prediction_source.prediction_batch if prediction_source else None,
    }
    set_cache(cache_key, data, settings.redis_cache_ttl_seconds)
    return data


@router.get("/{city}", response_model=schemas.ForecastResponse)
def forecast_city(
    city: str,
    db: Session = Depends(get_db),
):
    prediction_source = resolve_prediction_source(db)
    cache_key = (
        f"forecast:city:{city.lower()}:"
        f"{prediction_source.prediction_batch or prediction_source.source or 'none'}"
    )
    cached = get_cache(cache_key)
    if cached is not None:
        return cached

    records = (
        db.query(models.Crime)
        .filter(models.Crime.city.ilike(f"%{city}%"))
        .filter(models.Crime.record_type == "predicted")
    )
    records = apply_prediction_source_filter(records, db)
    records = (
        records
        .filter(models.Crime.year >= 2026)
        .all()
    )

    if not records:
        return {
            "city": city,
            "predicted_crimes": {},
            "crime_risk_index": 0,
            "record_type": "predicted",
            "source": prediction_source.source,
            "prediction_batch": prediction_source.prediction_batch,
        }

    crime_dict: dict[str, int] = {}
    for record in records:
        crime_dict[record.crime_type] = crime_dict.get(record.crime_type, 0) + record.crime_count

    data = {
        "city": city,
        "predicted_crimes": crime_dict,
        "crime_risk_index": float(compute_risk(crime_dict)),
        "record_type": "predicted",
        "source": prediction_source.source,
        "prediction_batch": prediction_source.prediction_batch,
    }
    set_cache(cache_key, data, settings.redis_cache_ttl_seconds)
    return data
