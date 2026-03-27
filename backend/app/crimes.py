from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.cache import get_cache, set_cache
from app.config import settings
from app.dependencies import get_db
from app import models, schemas


router = APIRouter(prefix="/crimes", tags=["Crimes"])


def _apply_record_type(query, year: int | None, record_type: str):
    if record_type == "historical":
        query = query.filter(models.Crime.record_type == "historical")
    elif record_type == "predicted":
        query = query.filter(models.Crime.record_type == "predicted")
    elif year is not None:
        inferred = "historical" if year <= 2025 else "predicted"
        query = query.filter(models.Crime.record_type == inferred)
    return query


@router.post("/", response_model=schemas.CrimeResponse)
def create_crime(crime: schemas.CrimeCreate, db: Session = Depends(get_db)):
    new_crime = models.Crime(**crime.model_dump())
    db.add(new_crime)
    db.commit()
    db.refresh(new_crime)
    return new_crime


@router.get("/", response_model=list[schemas.CrimeResponse])
def get_all_crimes(
    record_type: schemas.RecordType = "all",
    db: Session = Depends(get_db),
):
    query = db.query(models.Crime)
    query = _apply_record_type(query, None, record_type)
    return query.limit(1000).all()


@router.get("/year/{year}", response_model=list[schemas.CrimeResponse])
def get_crimes_by_year(
    year: int,
    record_type: schemas.RecordType = "all",
    db: Session = Depends(get_db),
):
    query = db.query(models.Crime).filter(models.Crime.year == year)
    query = _apply_record_type(query, year, record_type)
    return query.all()


@router.get("/yearly")
def get_yearly_totals(
    state: str = "All",
    city: str = "All",
    crime_type: str = "All",
    record_type: schemas.RecordType = "all",
    db: Session = Depends(get_db),
):
    cache_key = f"crimes:yearly:{state}:{city}:{crime_type}:{record_type}"
    cached = get_cache(cache_key)
    if cached is not None:
        return cached

    query = db.query(models.Crime)
    query = _apply_record_type(query, None, record_type)

    if state != "All":
        query = query.filter(models.Crime.state == state)
    if city != "All":
        query = query.filter(models.Crime.city.ilike(f"%{city}%"))
    if crime_type != "All":
        query = query.filter(models.Crime.crime_type == crime_type)

    results = (
        query.with_entities(
            models.Crime.year,
            func.sum(models.Crime.crime_count).label("total"),
        )
        .group_by(models.Crime.year)
        .order_by(models.Crime.year)
        .all()
    )

    data = [
        {"year": row.year, "total": row.total}
        for row in results
    ]
    set_cache(cache_key, data, settings.redis_cache_ttl_seconds)
    return data


@router.get("/city/{city}")
def get_city_trend(
    city: str,
    record_type: schemas.RecordType = "all",
    db: Session = Depends(get_db),
):
    query = db.query(
        models.Crime.year,
        func.sum(models.Crime.crime_count).label("total"),
    ).filter(models.Crime.city.ilike(f"%{city}%"))
    query = _apply_record_type(query, None, record_type)

    results = query.group_by(models.Crime.year).order_by(models.Crime.year).all()
    return [{"year": row.year, "total": row.total} for row in results]


@router.get("/cities")
def get_cities(
    state: str = "All",
    record_type: schemas.RecordType = "all",
    db: Session = Depends(get_db),
):
    query = db.query(models.Crime.city)
    query = _apply_record_type(query, None, record_type)

    if state != "All":
        query = query.filter(models.Crime.state == state)

    results = query.distinct().order_by(models.Crime.city).all()
    return [row.city for row in results if row.city]


@router.get("/heatmap")
def get_heatmap_data(
    year: int,
    state: str = "All",
    city: str = "All",
    crime_type: str = "All",
    record_type: schemas.RecordType = "all",
    max_points: int = 50000,
    db: Session = Depends(get_db),
):
    if year < 1900 or year > 2100:
        return []

    max_points = min(max(max_points, 500), 200000)

    resolved_record_type = record_type
    if record_type == "all":
        resolved_record_type = "historical" if year <= 2025 else "predicted"

    cache_key = (
        f"crimes:heatmap:{year}:{state}:{city}:{crime_type}:{resolved_record_type}:{max_points}"
    )
    cached = get_cache(cache_key)
    if cached is not None:
        return cached

    query = db.query(
        models.Crime.latitude,
        models.Crime.longitude,
        func.sum(models.Crime.crime_count).label("intensity"),
        models.Crime.record_type,
    ).filter(
        models.Crime.year == year,
        models.Crime.latitude.isnot(None),
        models.Crime.longitude.isnot(None),
    )
    query = _apply_record_type(query, year, resolved_record_type)

    if state != "All":
        query = query.filter(models.Crime.state == state)
    if city != "All":
        query = query.filter(models.Crime.city.ilike(f"%{city}%"))
    if crime_type != "All":
        query = query.filter(models.Crime.crime_type == crime_type)

    crimes = (
        query.group_by(
            models.Crime.latitude,
            models.Crime.longitude,
            models.Crime.record_type,
        )
        .having(func.sum(models.Crime.crime_count) > 0)
        .order_by(func.sum(models.Crime.crime_count).desc())
        .limit(max_points)
        .all()
    )

    data = [
        {
            "latitude": row.latitude,
            "longitude": row.longitude,
            "intensity": row.intensity,
            "record_type": row.record_type,
        }
        for row in crimes
    ]
    set_cache(cache_key, data, settings.redis_cache_ttl_seconds)
    return data
