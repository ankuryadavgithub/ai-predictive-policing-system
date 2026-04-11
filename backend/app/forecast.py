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


@router.get("/areas-summary")
def get_forecast_area_summary(
    year: int = 2026,
    state: str = "All",
    city: str = "All",
    crime_type: str = "All",
    max_areas: int = 500,
    db: Session = Depends(get_db),
):
    max_areas = min(max(max_areas, 25), 2000)
    prediction_source = resolve_prediction_source(db)
    cache_key = (
        f"forecast:areas:{year}:{state}:{city}:{crime_type}:{max_areas}:"
        f"{prediction_source.prediction_batch or prediction_source.source or 'none'}"
    )
    cached = get_cache(cache_key)
    if cached is not None:
        return cached

    query = (
        db.query(models.Crime)
        .filter(models.Crime.record_type == "predicted")
        .filter(models.Crime.year == year)
        .filter(models.Crime.city.isnot(None))
        .filter(models.Crime.latitude.isnot(None))
        .filter(models.Crime.longitude.isnot(None))
    )
    query = apply_prediction_source_filter(query, db)

    if state != "All":
        query = query.filter(models.Crime.state == state)
    if city != "All":
        query = query.filter(models.Crime.city.ilike(f"%{city}%"))
    if crime_type != "All":
        query = query.filter(models.Crime.crime_type == crime_type)

    records = query.all()

    if not records and prediction_source.prediction_batch:
        records = (
            db.query(models.Crime)
            .filter(models.Crime.record_type == "predicted")
            .filter(models.Crime.year == year)
            .filter(models.Crime.city.isnot(None))
            .filter(models.Crime.latitude.isnot(None))
            .filter(models.Crime.longitude.isnot(None))
        )

        if state != "All":
            records = records.filter(models.Crime.state == state)
        if city != "All":
            records = records.filter(models.Crime.city.ilike(f"%{city}%"))
        if crime_type != "All":
            records = records.filter(models.Crime.crime_type == crime_type)

        records = records.all()

    by_city: dict[str, dict] = {}
    for record in records:
        key = f"{record.state or 'Unknown'}::{record.city}"
        if key not in by_city:
            by_city[key] = {
                "city": record.city,
                "state": record.state,
                "latitude_total": 0.0,
                "longitude_total": 0.0,
                "coordinate_count": 0,
                "predicted_total": 0,
                "crime_totals": {},
            }

        city_entry = by_city[key]
        city_entry["predicted_total"] += record.crime_count
        city_entry["crime_totals"][record.crime_type] = (
            city_entry["crime_totals"].get(record.crime_type, 0) + record.crime_count
        )
        if record.latitude is not None and record.longitude is not None:
            city_entry["latitude_total"] += record.latitude
            city_entry["longitude_total"] += record.longitude
            city_entry["coordinate_count"] += 1

    results = []
    for item in by_city.values():
        coordinate_count = item["coordinate_count"] or 1
        top_crime = max(item["crime_totals"], key=item["crime_totals"].get) if item["crime_totals"] else "N/A"
        results.append(
            {
                "city": item["city"],
                "state": item["state"],
                "latitude": item["latitude_total"] / coordinate_count,
                "longitude": item["longitude_total"] / coordinate_count,
                "predicted_total": item["predicted_total"],
                "risk_index": float(compute_risk(item["crime_totals"])),
                "top_crime": top_crime,
                "prediction_batch": prediction_source.prediction_batch,
                "source": prediction_source.source,
                "year": year,
            }
        )

    data = sorted(results, key=lambda value: value["risk_index"], reverse=True)[:max_areas]
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
