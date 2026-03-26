from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.cache import get_cache, set_cache
from app.config import settings
from app.dependencies import get_db
from app import models, schemas


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


def _resolve_record_type(year: int, record_type: str) -> str:
    if record_type != "all":
        return record_type
    return "historical" if year <= 2025 else "predicted"


@router.get("/kpis")
def get_kpis(
    state: str = "All",
    crime_type: str = "All",
    city: str = "All",
    year: int = 2024,
    record_type: schemas.RecordType = "all",
    db: Session = Depends(get_db),
):
    resolved_record_type = _resolve_record_type(year, record_type)
    cache_key = f"forecast:kpis:{state}:{city}:{crime_type}:{year}:{resolved_record_type}"
    cached = get_cache(cache_key)
    if cached is not None:
        return cached

    query = db.query(models.Crime).filter(
        models.Crime.year == year,
        models.Crime.record_type == resolved_record_type,
    )
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
    }
    set_cache(cache_key, data, settings.redis_cache_ttl_seconds)
    return data


@router.get("/{city}", response_model=schemas.ForecastResponse)
def forecast_city(
    city: str,
    db: Session = Depends(get_db),
):
    cache_key = f"forecast:city:{city.lower()}"
    cached = get_cache(cache_key)
    if cached is not None:
        return cached

    records = (
        db.query(models.Crime)
        .filter(models.Crime.city.ilike(f"%{city}%"))
        .filter(models.Crime.record_type == "predicted")
        .filter(models.Crime.year >= 2026)
        .all()
    )

    if not records:
        return {
            "city": city,
            "predicted_crimes": {},
            "crime_risk_index": 0,
            "record_type": "predicted",
        }

    crime_dict: dict[str, int] = {}
    for record in records:
        crime_dict[record.crime_type] = crime_dict.get(record.crime_type, 0) + record.crime_count

    data = {
        "city": city,
        "predicted_crimes": crime_dict,
        "crime_risk_index": float(compute_risk(crime_dict)),
        "record_type": "predicted",
    }
    set_cache(cache_key, data, settings.redis_cache_ttl_seconds)
    return data
