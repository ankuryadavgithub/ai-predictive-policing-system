import json
import pickle
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
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
from app.services.ai_governance import get_ai_governance_summary
from app.services.forecast_service import get_city_forecast
from app.services.risk_scoring import DECISION_SUPPORT_NOTICE, compute_risk_score, explain_risk_score


router = APIRouter(prefix="/forecast", tags=["Forecast"])

ML_DIR = Path(__file__).resolve().parents[1] / "ml"
MODEL_METADATA_PATH = ML_DIR / "model_metadata.json"
DEFAULT_MODEL_WEIGHTS_PATH = ML_DIR / "saved_model.pth"
DEFAULT_SCALER_PATH = ML_DIR / "scaler.pkl"
TRAINING_CSV_PATH = Path(__file__).resolve().parents[1] / "india_cities_crime_2020_2025.csv"
ML_METADATA_COLUMNS = {
    "State",
    "District",
    "City",
    "Latitude",
    "Longitude",
    "Year",
    "Population",
}

_cached_live_forecast: dict[str, object] | None = None


def _load_json_file(path: Path) -> dict[str, object]:
    if not path.exists():
        raise FileNotFoundError(f"Missing ML metadata file: {path}")
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def _load_pickle_file(path: Path):
    if not path.exists():
        raise FileNotFoundError(f"Missing ML artifact file: {path}")
    with path.open("rb") as handle:
        return pickle.load(handle)


def _detect_crime_columns(df):
    return sorted(column for column in df.columns if column not in ML_METADATA_COLUMNS)


def _load_live_forecast_assets() -> dict[str, object]:
    global _cached_live_forecast
    if _cached_live_forecast is not None:
        return _cached_live_forecast

    import numpy as np
    import pandas as pd
    import torch
    from sklearn.neighbors import NearestNeighbors

    metadata = _load_json_file(MODEL_METADATA_PATH)
    model_checkpoint = metadata.get("model_checkpoint")
    scaler_checkpoint = metadata.get("scaler_checkpoint")

    if scaler_checkpoint:
        scaler_path = Path(scaler_checkpoint)
        if not scaler_path.is_absolute():
            scaler_path = ML_DIR / scaler_path.name
    else:
        scaler_path = DEFAULT_SCALER_PATH

    if model_checkpoint:
        model_path = Path(model_checkpoint)
        if not model_path.is_absolute():
            model_path = ML_DIR / model_path.name
    else:
        model_path = DEFAULT_MODEL_WEIGHTS_PATH

    scaler = _load_pickle_file(scaler_path)
    if not model_path.exists():
        raise FileNotFoundError(f"Missing ML model weights: {model_path}")
    crime_columns = metadata.get("crime_columns")
    if not crime_columns:
        raise ValueError("ML metadata does not include crime columns.")

    model = _build_live_model(len(crime_columns))
    model.load_state_dict(torch.load(model_path, map_location="cpu"))
    model.eval()

    df = pd.read_csv(TRAINING_CSV_PATH)
    input_sequences, location_metadata = _build_live_input_sequences(df, crime_columns, metadata.get("sequence_length", 4))

    coordinates = np.radians(location_metadata[["latitude", "longitude"]].to_numpy(dtype=np.float32))
    neighbor_count = min(6, len(location_metadata))
    nbrs = NearestNeighbors(n_neighbors=neighbor_count, metric="haversine")
    nbrs.fit(coordinates)
    _, neighbour_indexes = nbrs.kneighbors(coordinates)

    edge_pairs = []
    for source_index, source_neighbors in enumerate(neighbour_indexes):
        for neighbor_index in source_neighbors[1:]:
            edge_pairs.append([source_index, int(neighbor_index)])
    if not edge_pairs:
        edge_pairs = [[0, 0]]

    edge_index = torch.tensor(edge_pairs, dtype=torch.long).t().contiguous()

    _cached_live_forecast = {
        "metadata": metadata,
        "model": model,
        "scaler": scaler,
        "crime_columns": crime_columns,
        "location_metadata": location_metadata,
        "input_sequences": input_sequences,
        "edge_index": edge_index,
    }
    return _cached_live_forecast


def _build_live_model(num_features: int):
    import torch
    from app.ml_model import CNN_LSTM_GCN

    model = CNN_LSTM_GCN(num_features=num_features)
    return model


def _build_city_year_matrix(df, crime_columns):
    return (
        df.groupby(["City", "Year"], as_index=False)[crime_columns]
        .sum()
        .sort_values(["City", "Year"])
    )


def _build_city_metadata(df):
    return (
        df.sort_values("Year")
        .groupby("City", as_index=False)
        .agg(
            state=("State", "last"),
            district=("District", "last"),
            latitude=("Latitude", "last"),
            longitude=("Longitude", "last"),
        )
        .set_index("City")
    )


def _build_live_input_sequences(df, crime_columns, sequence_length):
    import numpy as np
    city_year_matrix = _build_city_year_matrix(df, crime_columns)
    city_metadata = _build_city_metadata(df)

    sequences = []
    valid_cities = []
    for city, group in city_year_matrix.groupby("City"):
        ordered_values = group.sort_values("Year")[crime_columns].to_numpy(dtype=np.float32)
        if ordered_values.shape[0] < sequence_length:
            continue
        sequences.append(ordered_values[-sequence_length:])
        valid_cities.append(city)

    if not sequences:
        raise ValueError("Unable to build live forecast inputs: no city has enough history.")

    location_metadata = city_metadata.loc[valid_cities].reset_index()
    location_metadata = location_metadata.rename(columns={"index": "city"})
    return np.stack(sequences, axis=0), location_metadata


def _format_live_prediction(city_name: str, metadata_row, predictions, crime_columns):
    crime_counts = {
        crime: int(predictions[idx])
        for idx, crime in enumerate(crime_columns)
    }
    risk_index = float(compute_risk(crime_counts))
    return {
        "city": city_name,
        "state": metadata_row["state"],
        "district": metadata_row["district"],
        "predicted_crimes": crime_counts,
        "crime_risk_index": risk_index,
        "risk_explanation": explain_risk_score(crime_counts),
        "decision_support_notice": DECISION_SUPPORT_NOTICE,
    }


def _get_live_forecasts():
    assets = _load_live_forecast_assets()
    model = assets["model"]
    scaler = assets["scaler"]
    crime_columns = assets["crime_columns"]
    input_sequences = assets["input_sequences"]
    edge_index = assets["edge_index"]
    location_metadata = assets["location_metadata"]

    import numpy as np
    import torch

    scaled_inputs = scaler.transform(input_sequences.reshape(-1, len(crime_columns))).reshape(input_sequences.shape)
    with torch.no_grad():
        prediction_tensors = model(torch.tensor(scaled_inputs, dtype=torch.float32), edge_index)
    predicted_values = scaler.inverse_transform(prediction_tensors.cpu().numpy())
    predicted_values = np.nan_to_num(predicted_values, nan=0.0, posinf=0.0, neginf=0.0)
    predicted_values = np.rint(np.maximum(predicted_values, 0)).astype(int)

    forecasts = []
    for index, city_name in enumerate(location_metadata["City"].tolist()):
        metadata_row = location_metadata.iloc[index]
        forecasts.append(_format_live_prediction(city_name, metadata_row, predicted_values[index], crime_columns))
    return forecasts


def _find_live_forecast(state: str | None, district: str | None, city: str | None):
    forecasts = _get_live_forecasts()
    filters = []
    if city:
        filters.append(lambda item: item["city"].lower() == city.lower())
    if state:
        filters.append(lambda item: item["state"].lower() == state.lower())
    if district:
        filters.append(lambda item: item["district"].lower() == district.lower())

    matched = [item for item in forecasts if all(check(item) for check in filters)]
    if not matched:
        raise HTTPException(status_code=404, detail="No live forecast available for the requested location.")
    return matched[0]


def _get_live_forecast_cache_key(state: str | None, district: str | None, city: str | None, top_n: int) -> str:
    return (
        f"forecast:live:{state or 'all'}:{district or 'all'}:{city or 'all'}:{top_n}"
    )


def _find_top_live_forecasts(top_n: int):
    forecasts = _get_live_forecasts()
    return sorted(forecasts, key=lambda item: item["crime_risk_index"], reverse=True)[:top_n]


def compute_risk(predictions: dict[str, int]) -> float:
    return compute_risk_score(predictions)


@router.get("/governance")
def get_forecast_governance():
    return get_ai_governance_summary()

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


@router.get("/live")
def get_live_forecast(
    state: str | None = None,
    district: str | None = None,
    city: str | None = None,
    top_n: int = 10,
):
    if any([state, district, city]):
        cache_key = _get_live_forecast_cache_key(state, district, city, top_n)
        cached = get_cache(cache_key)
        if cached is not None:
            return cached

        result = _find_live_forecast(state=state, district=district, city=city)
        set_cache(cache_key, result, settings.redis_cache_ttl_seconds)
        return result

    cache_key = _get_live_forecast_cache_key(state, district, city, top_n)
    cached = get_cache(cache_key)
    if cached is not None:
        return cached

    result = {
        "top_predictions": _find_top_live_forecasts(top_n),
        "forecast_batch_id": _load_json_file(MODEL_METADATA_PATH).get("forecast_batch_id"),
    }
    set_cache(cache_key, result, settings.redis_cache_ttl_seconds)
    return result


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

    data = get_city_forecast(db, city)
    set_cache(cache_key, data, settings.redis_cache_ttl_seconds)
    return data
