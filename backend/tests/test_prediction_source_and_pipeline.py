from __future__ import annotations

import numpy as np
import pandas as pd
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import models
from app.crimes import get_city_trend, get_yearly_totals
from app.forecast import forecast_city
from app.prediction_source import (
    MODEL_PREDICTION_BATCH_PREFIX,
    PRODUCTION_BASELINE_BATCH_PREFIX,
    resolve_prediction_source,
    select_latest_baseline_batch,
    select_latest_model_batch,
)
from ml.train_model import clamp_prediction_array, detect_crime_columns


def build_session():
    engine = create_engine("sqlite:///:memory:")
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    models.Base.metadata.create_all(bind=engine)
    return TestingSessionLocal()


def seed_crime(
    db,
    *,
    city: str,
    year: int,
    crime_type: str,
    crime_count: int,
    prediction_batch: str | None,
    record_type: str = "predicted",
):
    db.add(
        models.Crime(
            state="Test State",
            district="Test District",
            city=city,
            latitude=12.9,
            longitude=77.5,
            year=year,
            crime_type=crime_type,
            crime_count=crime_count,
            record_type=record_type,
            prediction_batch=prediction_batch,
        )
    )


def test_detect_crime_columns_ignores_metadata_fields():
    df = pd.DataFrame(
        [
            {
                "State": "Karnataka",
                "District": "Bengaluru",
                "City": "Bengaluru",
                "Latitude": 12.97,
                "Longitude": 77.59,
                "Year": 2024,
                "Population": 100,
                "Murder": 10,
                "Robbery": 5,
            }
        ]
    )

    assert detect_crime_columns(df) == ["Murder", "Robbery"]


def test_clamp_prediction_array_returns_safe_non_negative_integers():
    clamped = clamp_prediction_array(np.array([[12.8, -1.2, np.nan, np.inf]]))
    assert clamped.tolist() == [[13, 0, 0, 0]]


def test_select_latest_model_batch_prefers_highest_timestamp():
    latest = select_latest_model_batch(
        [
            None,
            "legacy_csv_20260301",
            f"{MODEL_PREDICTION_BATCH_PREFIX}20260406_110000",
            f"{MODEL_PREDICTION_BATCH_PREFIX}20260407_090000",
        ]
    )

    assert latest == f"{MODEL_PREDICTION_BATCH_PREFIX}20260407_090000"


def test_select_latest_baseline_batch_prefers_highest_timestamp():
    latest = select_latest_baseline_batch(
        [
            None,
            f"{PRODUCTION_BASELINE_BATCH_PREFIX}20260406_110000",
            f"{PRODUCTION_BASELINE_BATCH_PREFIX}20260407_090000",
        ]
    )

    assert latest == f"{PRODUCTION_BASELINE_BATCH_PREFIX}20260407_090000"


def test_resolve_prediction_source_prefers_baseline_batch_over_model_batch():
    db = build_session()
    seed_crime(db, city="Pune", year=2026, crime_type="Murder", crime_count=6, prediction_batch="legacy_csv_1")
    seed_crime(
        db,
        city="Pune",
        year=2026,
        crime_type="Murder",
        crime_count=8,
        prediction_batch=f"{MODEL_PREDICTION_BATCH_PREFIX}20260406_090000",
    )
    seed_crime(
        db,
        city="Pune",
        year=2027,
        crime_type="Murder",
        crime_count=9,
        prediction_batch=f"{MODEL_PREDICTION_BATCH_PREFIX}20260407_090000",
    )
    seed_crime(
        db,
        city="Pune",
        year=2027,
        crime_type="Murder",
        crime_count=11,
        prediction_batch=f"{PRODUCTION_BASELINE_BATCH_PREFIX}20260407_100000",
    )
    db.commit()

    source = resolve_prediction_source(db)

    assert source.source == "baseline_production"
    assert source.prediction_batch == f"{PRODUCTION_BASELINE_BATCH_PREFIX}20260407_100000"


def test_forecast_city_uses_baseline_batch_when_present():
    db = build_session()
    seed_crime(db, city="Mumbai", year=2026, crime_type="Murder", crime_count=10, prediction_batch="legacy_csv_1")
    seed_crime(
        db,
        city="Mumbai",
        year=2026,
        crime_type="Murder",
        crime_count=14,
        prediction_batch=f"{MODEL_PREDICTION_BATCH_PREFIX}20260407_090000",
    )
    seed_crime(
        db,
        city="Mumbai",
        year=2026,
        crime_type="Murder",
        crime_count=12,
        prediction_batch=f"{PRODUCTION_BASELINE_BATCH_PREFIX}20260407_100000",
    )
    seed_crime(
        db,
        city="Mumbai",
        year=2026,
        crime_type="Total_Estimated_Crimes",
        crime_count=80,
        prediction_batch=f"{PRODUCTION_BASELINE_BATCH_PREFIX}20260407_100000",
    )
    db.commit()

    result = forecast_city("Mumbai", db=db)

    assert result["predicted_crimes"]["Murder"] == 12
    assert result["source"] == "baseline_production"
    assert result["prediction_batch"] == f"{PRODUCTION_BASELINE_BATCH_PREFIX}20260407_100000"


def test_forecast_city_falls_back_to_legacy_predicted_rows():
    db = build_session()
    seed_crime(db, city="Delhi", year=2026, crime_type="Robbery", crime_count=5, prediction_batch="csv_2026_2030")
    seed_crime(db, city="Delhi", year=2026, crime_type="Total_Estimated_Crimes", crime_count=30, prediction_batch="csv_2026_2030")
    db.commit()

    result = forecast_city("Delhi", db=db)

    assert result["predicted_crimes"]["Robbery"] == 5
    assert result["source"] == "db_fallback"
    assert result["prediction_batch"] is None


def test_forecast_city_returns_empty_safe_payload_when_no_predictions_exist():
    db = build_session()

    result = forecast_city("Noida", db=db)

    assert result["predicted_crimes"] == {}
    assert result["crime_risk_index"] == 0
    assert result["source"] is None


def test_yearly_and_city_queries_stay_bound_to_latest_model_batch():
    db = build_session()
    latest_batch = f"{PRODUCTION_BASELINE_BATCH_PREFIX}20260407_090000"

    seed_crime(db, city="Chennai", year=2026, crime_type="Murder", crime_count=2, prediction_batch="legacy_csv_1")
    seed_crime(db, city="Chennai", year=2027, crime_type="Murder", crime_count=4, prediction_batch="legacy_csv_1")
    seed_crime(db, city="Chennai", year=2026, crime_type="Murder", crime_count=7, prediction_batch=latest_batch)
    seed_crime(db, city="Chennai", year=2027, crime_type="Murder", crime_count=9, prediction_batch=latest_batch)
    db.commit()

    yearly = get_yearly_totals(city="Chennai", record_type="predicted", db=db)
    trend = get_city_trend(city="Chennai", record_type="predicted", db=db)

    assert yearly == [{"year": 2026, "total": 7}, {"year": 2027, "total": 9}]
    assert trend == [{"year": 2026, "total": 7}, {"year": 2027, "total": 9}]


def test_combined_yearly_query_includes_historical_plus_active_prediction_source_only():
    db = build_session()
    latest_batch = f"{PRODUCTION_BASELINE_BATCH_PREFIX}20260407_090000"

    seed_crime(
        db,
        city="Hyderabad",
        year=2025,
        crime_type="Murder",
        crime_count=3,
        prediction_batch=None,
        record_type="historical",
    )
    seed_crime(db, city="Hyderabad", year=2026, crime_type="Murder", crime_count=2, prediction_batch="legacy_csv_1")
    seed_crime(db, city="Hyderabad", year=2026, crime_type="Murder", crime_count=6, prediction_batch=latest_batch)
    db.commit()

    yearly = get_yearly_totals(city="Hyderabad", record_type="all", db=db)

    assert yearly == [{"year": 2025, "total": 3}, {"year": 2026, "total": 6}]
