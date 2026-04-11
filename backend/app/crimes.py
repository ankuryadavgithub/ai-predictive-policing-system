from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.cache import get_cache, set_cache
from app.config import settings
from app.dependencies import get_current_user, get_db
from app import models, schemas
from app.models import User
from app.prediction_source import (
    apply_record_scope_filter,
    resolve_effective_record_type,
    resolve_prediction_source,
)
from app.role_guard import require_role


router = APIRouter(prefix="/crimes", tags=["Crimes"])


def _apply_record_type(query, db: Session, year: int | None, record_type: str):
    return apply_record_scope_filter(query, db, year, record_type)


def _should_retry_predicted_without_batch(
    resolved_record_type: str,
    prediction_scope,
    results,
) -> bool:
    return (
        resolved_record_type == "predicted"
        and prediction_scope is not None
        and prediction_scope.prediction_batch is not None
        and not results
    )


@router.post("/", response_model=schemas.CrimeResponse)
def create_crime(
    crime: schemas.CrimeCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_role(user, ["admin"])
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
    query = _apply_record_type(query, db, None, record_type)
    return query.limit(1000).all()


@router.get("/year/{year}", response_model=list[schemas.CrimeResponse])
def get_crimes_by_year(
    year: int,
    record_type: schemas.RecordType = "all",
    db: Session = Depends(get_db),
):
    query = db.query(models.Crime).filter(models.Crime.year == year)
    query = _apply_record_type(query, db, year, record_type)
    return query.all()


@router.get("/yearly")
def get_yearly_totals(
    state: str = "All",
    city: str = "All",
    crime_type: str = "All",
    record_type: schemas.RecordType = "all",
    db: Session = Depends(get_db),
):
    resolved_record_type = resolve_effective_record_type(None, record_type)
    prediction_scope = None
    if resolved_record_type in {"all", "predicted"}:
        prediction_scope = resolve_prediction_source(db)
    cache_key = (
        f"crimes:yearly:{state}:{city}:{crime_type}:{record_type}:"
        f"{prediction_scope.prediction_batch if prediction_scope else 'none'}"
    )
    cached = get_cache(cache_key)
    if cached is not None:
        return cached

    query = db.query(models.Crime)
    query = _apply_record_type(query, db, None, record_type)

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
    resolved_record_type = resolve_effective_record_type(None, record_type)
    prediction_scope = None
    if resolved_record_type in {"all", "predicted"}:
        prediction_scope = resolve_prediction_source(db)
    cache_key = (
        f"crimes:city:{city.lower()}:{record_type}:"
        f"{prediction_scope.prediction_batch if prediction_scope else 'none'}"
    )
    cached = get_cache(cache_key)
    if cached is not None:
        return cached

    query = db.query(
        models.Crime.year,
        func.sum(models.Crime.crime_count).label("total"),
    ).filter(models.Crime.city.ilike(f"%{city}%"))
    query = _apply_record_type(query, db, None, record_type)

    results = query.group_by(models.Crime.year).order_by(models.Crime.year).all()
    data = [{"year": row.year, "total": row.total} for row in results]
    set_cache(cache_key, data, settings.redis_cache_ttl_seconds)
    return data


@router.get("/cities")
def get_cities(
    state: str = "All",
    record_type: schemas.RecordType = "all",
    db: Session = Depends(get_db),
):
    resolved_record_type = resolve_effective_record_type(None, record_type)
    prediction_scope = None
    if resolved_record_type in {"all", "predicted"}:
        prediction_scope = resolve_prediction_source(db)
    cache_key = (
        f"crimes:cities:{state}:{record_type}:"
        f"{prediction_scope.prediction_batch if prediction_scope else 'none'}"
    )
    cached = get_cache(cache_key)
    if cached is not None:
        return cached

    query = db.query(models.Crime.city)
    query = _apply_record_type(query, db, None, record_type)

    if state != "All":
        query = query.filter(models.Crime.state == state)

    results = query.distinct().order_by(models.Crime.city).all()
    data = [row.city for row in results if row.city]
    set_cache(cache_key, data, settings.redis_cache_ttl_seconds)
    return data


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
        resolved_record_type = resolve_effective_record_type(year, record_type)

    prediction_scope = None
    if resolved_record_type in {"all", "predicted"}:
        prediction_scope = resolve_prediction_source(db)

    cache_key = (
        f"crimes:heatmap:{year}:{state}:{city}:{crime_type}:{resolved_record_type}:{max_points}"
        f":{prediction_scope.prediction_batch if prediction_scope else 'none'}"
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
    query = _apply_record_type(query, db, year, resolved_record_type)

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

    if _should_retry_predicted_without_batch(resolved_record_type, prediction_scope, crimes):
        retry_query = db.query(
            models.Crime.latitude,
            models.Crime.longitude,
            func.sum(models.Crime.crime_count).label("intensity"),
            models.Crime.record_type,
        ).filter(
            models.Crime.year == year,
            models.Crime.record_type == "predicted",
            models.Crime.latitude.isnot(None),
            models.Crime.longitude.isnot(None),
        )

        if state != "All":
            retry_query = retry_query.filter(models.Crime.state == state)
        if city != "All":
            retry_query = retry_query.filter(models.Crime.city.ilike(f"%{city}%"))
        if crime_type != "All":
            retry_query = retry_query.filter(models.Crime.crime_type == crime_type)

        crimes = (
            retry_query.group_by(
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


@router.get("/incidents")
def get_incident_map_data(
    year: int,
    state: str = "All",
    city: str = "All",
    crime_type: str = "All",
    record_type: schemas.RecordType = "all",
    max_points: int = 10000,
    db: Session = Depends(get_db),
):
    if year < 1900 or year > 2100:
        return []

    max_points = min(max(max_points, 100), 50000)
    resolved_record_type = resolve_effective_record_type(year, record_type)
    prediction_scope = None
    if resolved_record_type in {"all", "predicted"}:
        prediction_scope = resolve_prediction_source(db)

    cache_key = (
        f"crimes:incidents:{year}:{state}:{city}:{crime_type}:{resolved_record_type}:{max_points}:"
        f"{prediction_scope.prediction_batch if prediction_scope else 'none'}"
    )
    cached = get_cache(cache_key)
    if cached is not None:
        return cached

    query = db.query(
        models.Crime.latitude,
        models.Crime.longitude,
        models.Crime.city,
        models.Crime.state,
        models.Crime.crime_type,
        models.Crime.year,
        models.Crime.record_type,
        func.sum(models.Crime.crime_count).label("intensity"),
    ).filter(
        models.Crime.year == year,
        models.Crime.latitude.isnot(None),
        models.Crime.longitude.isnot(None),
    )
    query = _apply_record_type(query, db, year, resolved_record_type)

    if state != "All":
        query = query.filter(models.Crime.state == state)
    if city != "All":
        query = query.filter(models.Crime.city.ilike(f"%{city}%"))
    if crime_type != "All":
        query = query.filter(models.Crime.crime_type == crime_type)

    results = (
        query.group_by(
            models.Crime.latitude,
            models.Crime.longitude,
            models.Crime.city,
            models.Crime.state,
            models.Crime.crime_type,
            models.Crime.year,
            models.Crime.record_type,
        )
        .having(func.sum(models.Crime.crime_count) > 0)
        .order_by(func.sum(models.Crime.crime_count).desc())
        .limit(max_points)
        .all()
    )

    if _should_retry_predicted_without_batch(resolved_record_type, prediction_scope, results):
        retry_query = db.query(
            models.Crime.latitude,
            models.Crime.longitude,
            models.Crime.city,
            models.Crime.state,
            models.Crime.crime_type,
            models.Crime.year,
            models.Crime.record_type,
            func.sum(models.Crime.crime_count).label("intensity"),
        ).filter(
            models.Crime.year == year,
            models.Crime.record_type == "predicted",
            models.Crime.latitude.isnot(None),
            models.Crime.longitude.isnot(None),
        )

        if state != "All":
            retry_query = retry_query.filter(models.Crime.state == state)
        if city != "All":
            retry_query = retry_query.filter(models.Crime.city.ilike(f"%{city}%"))
        if crime_type != "All":
            retry_query = retry_query.filter(models.Crime.crime_type == crime_type)

        results = (
            retry_query.group_by(
                models.Crime.latitude,
                models.Crime.longitude,
                models.Crime.city,
                models.Crime.state,
                models.Crime.crime_type,
                models.Crime.year,
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
            "city": row.city,
            "state": row.state,
            "crime_type": row.crime_type,
            "year": row.year,
            "record_type": row.record_type,
            "intensity": row.intensity,
        }
        for row in results
    ]
    set_cache(cache_key, data, settings.redis_cache_ttl_seconds)
    return data


@router.get("/areas")
def get_area_map_data(
    year: int,
    state: str = "All",
    city: str = "All",
    crime_type: str = "All",
    area_level: str = "city",
    record_type: schemas.RecordType = "all",
    max_areas: int = 500,
    db: Session = Depends(get_db),
):
    if year < 1900 or year > 2100:
        return []

    level = "district" if area_level == "district" else "city"
    max_areas = min(max(max_areas, 25), 2000)
    resolved_record_type = resolve_effective_record_type(year, record_type)
    prediction_scope = None
    if resolved_record_type in {"all", "predicted"}:
        prediction_scope = resolve_prediction_source(db)

    cache_key = (
        f"crimes:areas:{year}:{state}:{city}:{crime_type}:{level}:{resolved_record_type}:{max_areas}:"
        f"{prediction_scope.prediction_batch if prediction_scope else 'none'}"
    )
    cached = get_cache(cache_key)
    if cached is not None:
        return cached

    area_column = models.Crime.district if level == "district" else models.Crime.city
    query = db.query(
        area_column.label("area_name"),
        models.Crime.state.label("state"),
        func.avg(models.Crime.latitude).label("latitude"),
        func.avg(models.Crime.longitude).label("longitude"),
        func.sum(models.Crime.crime_count).label("total"),
        func.count(func.distinct(models.Crime.crime_type)).label("crime_types"),
    ).filter(
        models.Crime.year == year,
        models.Crime.latitude.isnot(None),
        models.Crime.longitude.isnot(None),
        area_column.isnot(None),
    )
    query = _apply_record_type(query, db, year, resolved_record_type)

    if state != "All":
        query = query.filter(models.Crime.state == state)
    if city != "All":
        query = query.filter(models.Crime.city.ilike(f"%{city}%"))
    if crime_type != "All":
        query = query.filter(models.Crime.crime_type == crime_type)

    results = (
        query.group_by(area_column, models.Crime.state)
        .having(func.sum(models.Crime.crime_count) > 0)
        .order_by(func.sum(models.Crime.crime_count).desc())
        .limit(max_areas)
        .all()
    )

    if _should_retry_predicted_without_batch(resolved_record_type, prediction_scope, results):
        retry_query = db.query(
            area_column.label("area_name"),
            models.Crime.state.label("state"),
            func.avg(models.Crime.latitude).label("latitude"),
            func.avg(models.Crime.longitude).label("longitude"),
            func.sum(models.Crime.crime_count).label("total"),
            func.count(func.distinct(models.Crime.crime_type)).label("crime_types"),
        ).filter(
            models.Crime.year == year,
            models.Crime.record_type == "predicted",
            models.Crime.latitude.isnot(None),
            models.Crime.longitude.isnot(None),
            area_column.isnot(None),
        )

        if state != "All":
            retry_query = retry_query.filter(models.Crime.state == state)
        if city != "All":
            retry_query = retry_query.filter(models.Crime.city.ilike(f"%{city}%"))
        if crime_type != "All":
            retry_query = retry_query.filter(models.Crime.crime_type == crime_type)

        results = (
            retry_query.group_by(area_column, models.Crime.state)
            .having(func.sum(models.Crime.crime_count) > 0)
            .order_by(func.sum(models.Crime.crime_count).desc())
            .limit(max_areas)
            .all()
        )

    data = [
        {
            "area_name": row.area_name,
            "state": row.state,
            "latitude": row.latitude,
            "longitude": row.longitude,
            "total": row.total,
            "crime_types": row.crime_types,
            "area_level": level,
            "record_type": resolved_record_type,
        }
        for row in results
        if row.latitude is not None and row.longitude is not None
    ]
    set_cache(cache_key, data, settings.redis_cache_ttl_seconds)
    return data


@router.get("/timeline")
def get_timeline_map_data(
    year_start: int,
    year_end: int,
    state: str = "All",
    city: str = "All",
    crime_type: str = "All",
    record_type: schemas.RecordType = "all",
    max_points_per_year: int = 4000,
    db: Session = Depends(get_db),
):
    if year_start > year_end:
        year_start, year_end = year_end, year_start
    if year_start < 1900 or year_end > 2100:
        return []

    max_points_per_year = min(max(max_points_per_year, 250), 10000)
    resolved_record_type = record_type
    prediction_scope = None
    if resolved_record_type in {"all", "predicted"}:
        prediction_scope = resolve_prediction_source(db)

    cache_key = (
        f"crimes:timeline:{year_start}:{year_end}:{state}:{city}:{crime_type}:{resolved_record_type}:"
        f"{max_points_per_year}:{prediction_scope.prediction_batch if prediction_scope else 'none'}"
    )
    cached = get_cache(cache_key)
    if cached is not None:
        return cached

    query = db.query(
        models.Crime.year,
        models.Crime.latitude,
        models.Crime.longitude,
        func.sum(models.Crime.crime_count).label("intensity"),
        models.Crime.record_type,
    ).filter(
        models.Crime.year >= year_start,
        models.Crime.year <= year_end,
        models.Crime.latitude.isnot(None),
        models.Crime.longitude.isnot(None),
    )
    query = _apply_record_type(query, db, None, resolved_record_type)

    if state != "All":
        query = query.filter(models.Crime.state == state)
    if city != "All":
        query = query.filter(models.Crime.city.ilike(f"%{city}%"))
    if crime_type != "All":
        query = query.filter(models.Crime.crime_type == crime_type)

    rows = (
        query.group_by(
            models.Crime.year,
            models.Crime.latitude,
            models.Crime.longitude,
            models.Crime.record_type,
        )
        .having(func.sum(models.Crime.crime_count) > 0)
        .order_by(models.Crime.year.asc(), func.sum(models.Crime.crime_count).desc())
        .all()
    )

    if _should_retry_predicted_without_batch(resolved_record_type, prediction_scope, rows):
        retry_query = db.query(
            models.Crime.year,
            models.Crime.latitude,
            models.Crime.longitude,
            func.sum(models.Crime.crime_count).label("intensity"),
            models.Crime.record_type,
        ).filter(
            models.Crime.year >= year_start,
            models.Crime.year <= year_end,
            models.Crime.record_type == "predicted",
            models.Crime.latitude.isnot(None),
            models.Crime.longitude.isnot(None),
        )

        if state != "All":
            retry_query = retry_query.filter(models.Crime.state == state)
        if city != "All":
            retry_query = retry_query.filter(models.Crime.city.ilike(f"%{city}%"))
        if crime_type != "All":
            retry_query = retry_query.filter(models.Crime.crime_type == crime_type)

        rows = (
            retry_query.group_by(
                models.Crime.year,
                models.Crime.latitude,
                models.Crime.longitude,
                models.Crime.record_type,
            )
            .having(func.sum(models.Crime.crime_count) > 0)
            .order_by(models.Crime.year.asc(), func.sum(models.Crime.crime_count).desc())
            .all()
        )

    counts_by_year: dict[int, int] = {}
    data = []
    for row in rows:
        current_count = counts_by_year.get(row.year, 0)
        if current_count >= max_points_per_year:
            continue
        counts_by_year[row.year] = current_count + 1
        data.append(
            {
                "year": row.year,
                "latitude": row.latitude,
                "longitude": row.longitude,
                "intensity": row.intensity,
                "record_type": row.record_type,
            }
        )

    set_cache(cache_key, data, settings.redis_cache_ttl_seconds)
    return data
