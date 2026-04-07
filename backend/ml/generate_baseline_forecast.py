from __future__ import annotations

import argparse
import json
from datetime import datetime, UTC
from pathlib import Path

import pandas as pd


CURRENT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = CURRENT_DIR.parent
DATASET_PATH = BACKEND_DIR / "india_cities_crime_2020_2025.csv"
OUTPUT_FILE = CURRENT_DIR / "generated_baseline_forecasts.csv"
METADATA_FILE = CURRENT_DIR / "baseline_metadata.json"
BASELINE_BATCH_PREFIX = "baseline_prod_"
META_COLUMNS = {"State", "District", "City", "Latitude", "Longitude", "Year", "Population"}


def detect_crime_columns(df: pd.DataFrame) -> list[str]:
    return sorted(column for column in df.columns if column not in META_COLUMNS)


def build_baseline_forecasts(
    dataset_path: Path,
    forecast_start_year: int = 2026,
    forecast_end_year: int = 2030,
) -> tuple[pd.DataFrame, dict[str, object]]:
    df = pd.read_csv(dataset_path)
    crime_columns = detect_crime_columns(df)
    latest_year = int(df["Year"].max())

    latest_rows = (
        df.sort_values(["City", "Year"])
        .groupby("City", as_index=False)
        .tail(1)
        .copy()
    )

    forecast_rows: list[dict[str, object]] = []
    for _, row in latest_rows.iterrows():
        base_payload = {
            "state": row["State"],
            "district": row["District"],
            "city": row["City"],
            "latitude": float(row["Latitude"]),
            "longitude": float(row["Longitude"]),
            "population": float(row["Population"]) if pd.notna(row["Population"]) else 0,
        }

        for forecast_year in range(forecast_start_year, forecast_end_year + 1):
            output_row = {
                **base_payload,
                "year": forecast_year,
            }
            for crime_column in crime_columns:
                output_row[crime_column] = max(int(row[crime_column]), 0)
            forecast_rows.append(output_row)

    generated_at = datetime.now(UTC)
    metadata = {
        "model_name": "persistence_baseline",
        "forecast_method": "repeat_last_available_year",
        "trained_on_years": sorted(df["Year"].unique().tolist()),
        "source_year": latest_year,
        "forecast_year_start": forecast_start_year,
        "forecast_year_end": forecast_end_year,
        "crime_columns": crime_columns,
        "generated_at": generated_at.isoformat(),
        "forecast_batch_id": f"{BASELINE_BATCH_PREFIX}{generated_at.strftime('%Y%m%d_%H%M%S')}",
        "city_count": int(latest_rows.shape[0]),
    }
    return pd.DataFrame(forecast_rows), metadata


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate production baseline forecast rows from the latest historical year.")
    parser.add_argument("--dataset", default=str(DATASET_PATH), help="Path to the historical crime dataset CSV.")
    parser.add_argument("--output-file", default=str(OUTPUT_FILE), help="Path to the generated baseline forecast CSV.")
    parser.add_argument("--metadata-file", default=str(METADATA_FILE), help="Path to the generated baseline metadata JSON.")
    parser.add_argument("--forecast-start-year", type=int, default=2026)
    parser.add_argument("--forecast-end-year", type=int, default=2030)
    args = parser.parse_args()

    forecast_df, metadata = build_baseline_forecasts(
        dataset_path=Path(args.dataset).resolve(),
        forecast_start_year=args.forecast_start_year,
        forecast_end_year=args.forecast_end_year,
    )
    output_file = Path(args.output_file).resolve()
    metadata_file = Path(args.metadata_file).resolve()
    output_file.parent.mkdir(parents=True, exist_ok=True)
    metadata_file.parent.mkdir(parents=True, exist_ok=True)

    forecast_df.to_csv(output_file, index=False)
    metadata_file.write_text(json.dumps(metadata, indent=2), encoding="utf-8")

    print(f"Generated {len(forecast_df)} baseline rows in {output_file}")
    print(f"Batch: {metadata['forecast_batch_id']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
