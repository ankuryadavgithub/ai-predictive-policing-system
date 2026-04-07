from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path

import pandas as pd

from app.audit import logger
from app.database import SessionLocal
from app.models import Crime


APP_DIR = Path(__file__).resolve().parent
BACKEND_DIR = APP_DIR.parent
ML_DIR = BACKEND_DIR / "ml"
BASELINE_FORECAST_FILE = ML_DIR / "generated_baseline_forecasts.csv"
BASELINE_METADATA_FILE = ML_DIR / "baseline_metadata.json"
MODEL_FORECAST_FILE = ML_DIR / "generated_forecasts.csv"
MODEL_METADATA_FILE = ML_DIR / "model_metadata.json"
LEGACY_FORECAST_FILE = APP_DIR / "crime_predictions_2026_2030.csv"
BASE_COLUMNS = {"state", "district", "city", "latitude", "longitude", "population", "year"}


def determine_source_file(explicit_path: str | None) -> Path:
    if explicit_path:
        return Path(explicit_path).resolve()
    if BASELINE_FORECAST_FILE.exists():
        return BASELINE_FORECAST_FILE
    if MODEL_FORECAST_FILE.exists():
        return MODEL_FORECAST_FILE
    return LEGACY_FORECAST_FILE


def load_prediction_dataframe(source_file: Path) -> tuple[pd.DataFrame, list[str]]:
    if not source_file.exists():
        raise FileNotFoundError(f"Prediction file not found: {source_file}")

    df = pd.read_csv(source_file)
    crime_columns = [column for column in df.columns if column not in BASE_COLUMNS]
    if not crime_columns:
        raise ValueError(f"No crime columns found in prediction file {source_file}")
    return df, crime_columns


def resolve_prediction_batch(source_file: Path, explicit_batch: str | None) -> str:
    if explicit_batch:
        return explicit_batch

    if source_file == MODEL_FORECAST_FILE and MODEL_METADATA_FILE.exists():
        metadata = json.loads(MODEL_METADATA_FILE.read_text(encoding="utf-8"))
        batch_id = metadata.get("forecast_batch_id")
        if batch_id:
            return batch_id

    if source_file == BASELINE_FORECAST_FILE and BASELINE_METADATA_FILE.exists():
        metadata = json.loads(BASELINE_METADATA_FILE.read_text(encoding="utf-8"))
        batch_id = metadata.get("forecast_batch_id")
        if batch_id:
            return batch_id

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    if source_file == BASELINE_FORECAST_FILE:
        return f"baseline_prod_{timestamp}"
    if source_file == MODEL_FORECAST_FILE:
        return f"cnn_lstm_gcn_{timestamp}"
    return f"{source_file.stem}_{timestamp}"


def insert_predictions(source_file: Path, prediction_batch: str) -> int:
    df, crime_columns = load_prediction_dataframe(source_file)
    db = SessionLocal()
    rows_inserted = 0

    try:
        existing_batch = db.query(Crime.id).filter(Crime.prediction_batch == prediction_batch).first()
        if existing_batch:
            logger.info("Prediction batch %s already exists, skipping load.", prediction_batch)
            return 0

        for _, row in df.iterrows():
            for crime_column in crime_columns:
                crime_record = Crime(
                    state=row.get("state"),
                    district=row.get("district"),
                    city=row.get("city"),
                    latitude=float(row.get("latitude", 0) or 0),
                    longitude=float(row.get("longitude", 0) or 0),
                    year=int(row["year"]),
                    crime_type=crime_column,
                    crime_count=max(int(row.get(crime_column, 0) or 0), 0),
                    record_type="predicted",
                    prediction_batch=prediction_batch,
                )
                db.add(crime_record)
                rows_inserted += 1

        db.commit()
        logger.info("Inserted %s prediction rows from %s with batch %s", rows_inserted, source_file, prediction_batch)
        return rows_inserted
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def main() -> int:
    parser = argparse.ArgumentParser(description="Load prediction rows into the crimes table.")
    parser.add_argument("--source-file", default=None, help="CSV file to load. Defaults to model output, then legacy CSV.")
    parser.add_argument("--prediction-batch", default=None, help="Explicit prediction batch id to stamp onto inserted rows.")
    args = parser.parse_args()

    source_file = determine_source_file(args.source_file)
    prediction_batch = resolve_prediction_batch(source_file, args.prediction_batch)
    inserted = insert_predictions(source_file, prediction_batch)

    print("Prediction data inserted successfully")
    print(f"Source file: {source_file}")
    print(f"Prediction batch: {prediction_batch}")
    print(f"Total rows inserted: {inserted}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
