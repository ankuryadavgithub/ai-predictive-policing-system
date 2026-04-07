from __future__ import annotations

import argparse
import json
import pickle
import sys
from dataclasses import dataclass
from datetime import datetime, UTC
from pathlib import Path

import numpy as np
import pandas as pd


CURRENT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = CURRENT_DIR.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


METADATA_COLUMNS = {
    "State",
    "District",
    "City",
    "Latitude",
    "Longitude",
    "Year",
    "Population",
}
STATE_COLUMN = "State"
DISTRICT_COLUMN = "District"
CITY_COLUMN = "City"
LATITUDE_COLUMN = "Latitude"
LONGITUDE_COLUMN = "Longitude"
YEAR_COLUMN = "Year"
POPULATION_COLUMN = "Population"
DEFAULT_SEQUENCE_LENGTH = 4
DEFAULT_FORECAST_START_YEAR = 2026
DEFAULT_FORECAST_END_YEAR = 2030
DEFAULT_NEIGHBORS = 5
MODEL_NAME = "cnn_lstm_gcn"
MODEL_BATCH_PREFIX = "cnn_lstm_gcn_"


@dataclass
class TrainingBundle:
    input_sequences: "torch.Tensor"
    targets: "torch.Tensor"
    edge_index: "torch.Tensor"
    crime_columns: list[str]
    sequence_cities: list[str]
    city_metadata: pd.DataFrame
    scaler: "MinMaxScaler"
    sequence_length: int
    trained_on_years: list[int]


@dataclass
class DatasetSplit:
    train_indices: list[int]
    val_indices: list[int]
    test_indices: list[int]


def import_training_dependencies():
    try:
        import torch
        import torch.nn as nn
        from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score, confusion_matrix
        from sklearn.model_selection import train_test_split
        from sklearn.neighbors import NearestNeighbors
        from sklearn.preprocessing import MinMaxScaler
    except ImportError as exc:  # pragma: no cover - environment-specific
        raise RuntimeError(
            "Optional ML dependencies are missing. Install torch, torch-geometric, scikit-learn, pandas, and numpy "
            "before training or generating CNN-LSTM-GCN forecasts."
        ) from exc

    from app.ml_model import CNN_LSTM_GCN

    return (
        torch,
        nn,
        mean_absolute_error,
        mean_squared_error,
        r2_score,
        confusion_matrix,
        train_test_split,
        NearestNeighbors,
        MinMaxScaler,
        CNN_LSTM_GCN,
    )


def detect_crime_columns(df: pd.DataFrame) -> list[str]:
    return sorted(column for column in df.columns if column not in METADATA_COLUMNS)


def build_city_metadata(df: pd.DataFrame) -> pd.DataFrame:
    metadata = (
        df.sort_values(YEAR_COLUMN)
        .groupby(CITY_COLUMN)
        .agg(
            state=(STATE_COLUMN, "last"),
            district=(DISTRICT_COLUMN, "last"),
            latitude=(LATITUDE_COLUMN, "last"),
            longitude=(LONGITUDE_COLUMN, "last"),
            population=(POPULATION_COLUMN, "last"),
        )
    )
    return metadata


def build_city_year_matrix(df: pd.DataFrame, crime_columns: list[str]) -> pd.DataFrame:
    city_year_matrix = (
        df.groupby([CITY_COLUMN, YEAR_COLUMN], as_index=False)[crime_columns]
        .sum()
        .sort_values([CITY_COLUMN, YEAR_COLUMN])
    )
    return city_year_matrix


def build_training_bundle(
    dataset_path: Path,
    scaler=None,
    crime_columns: list[str] | None = None,
    sequence_length: int = DEFAULT_SEQUENCE_LENGTH,
    neighbors: int = DEFAULT_NEIGHBORS,
) -> TrainingBundle:
    torch, _, _, _, _, _, _, NearestNeighbors, MinMaxScaler, _ = import_training_dependencies()

    df = pd.read_csv(dataset_path)
    crime_columns = crime_columns or detect_crime_columns(df)
    if not crime_columns:
        raise ValueError("No crime feature columns were detected in the dataset.")

    city_metadata = build_city_metadata(df)
    city_year_matrix = build_city_year_matrix(df, crime_columns)
    trained_on_years = sorted(city_year_matrix[YEAR_COLUMN].unique().tolist())

    resolved_scaler = scaler or MinMaxScaler()
    if scaler is None:
        city_year_matrix[crime_columns] = resolved_scaler.fit_transform(city_year_matrix[crime_columns])
    else:
        city_year_matrix[crime_columns] = resolved_scaler.transform(city_year_matrix[crime_columns])

    input_sequences = []
    targets = []
    sequence_cities = []

    for city, city_data in city_year_matrix.groupby(CITY_COLUMN):
        ordered_city_data = city_data.sort_values(YEAR_COLUMN)
        values = ordered_city_data[crime_columns].to_numpy(dtype=np.float32)

        if len(values) < sequence_length + 1:
            continue

        input_sequences.append(values[:sequence_length])
        targets.append(values[sequence_length])
        sequence_cities.append(city)

    if not input_sequences:
        raise ValueError("Dataset did not produce any trainable city sequences.")

    city_metadata = city_metadata.loc[sequence_cities]
    coordinates = np.radians(city_metadata[["latitude", "longitude"]].to_numpy(dtype=np.float32))

    effective_neighbors = min(neighbors + 1, len(sequence_cities))
    nbrs = NearestNeighbors(n_neighbors=effective_neighbors, metric="haversine")
    nbrs.fit(coordinates)
    _, indices = nbrs.kneighbors(coordinates)

    edge_pairs: list[list[int]] = []
    for source_index, neighbor_indexes in enumerate(indices):
        for neighbor_index in neighbor_indexes[1:]:
            edge_pairs.append([source_index, int(neighbor_index)])

    if not edge_pairs:
        edge_pairs = [[0, 0]]

    edge_index = torch.tensor(edge_pairs, dtype=torch.long).t().contiguous()

    return TrainingBundle(
        input_sequences=torch.tensor(np.array(input_sequences), dtype=torch.float32),
        targets=torch.tensor(np.array(targets), dtype=torch.float32),
        edge_index=edge_index,
        crime_columns=crime_columns,
        sequence_cities=sequence_cities,
        city_metadata=city_metadata,
        scaler=resolved_scaler,
        sequence_length=sequence_length,
        trained_on_years=trained_on_years,
    )


def train_model(
    dataset_path: Path,
    output_dir: Path,
    epochs: int = 100,
    learning_rate: float = 0.001,
    sequence_length: int = DEFAULT_SEQUENCE_LENGTH,
    val_size: float = 0.15,
    test_size: float = 0.2,
    random_state: int = 42,
    patience: int = 20,
    weight_decay: float = 1e-4,
) -> dict[str, object]:
    (
        torch,
        nn,
        _mean_absolute_error,
        _mean_squared_error,
        _r2_score,
        _confusion_matrix,
        _train_test_split,
        _,
        _,
        CNN_LSTM_GCN,
    ) = import_training_dependencies()

    bundle = build_training_bundle(dataset_path, sequence_length=sequence_length)
    split = split_training_bundle(
        bundle,
        val_size=val_size,
        test_size=test_size,
        random_state=random_state,
    )
    model = CNN_LSTM_GCN(num_features=len(bundle.crime_columns))
    optimizer = torch.optim.Adam(model.parameters(), lr=learning_rate, weight_decay=weight_decay)
    criterion = nn.MSELoss()
    best_state_dict = None
    best_val_loss = float("inf")
    patience_counter = 0
    best_epoch = -1

    for epoch in range(epochs):
        model.train()
        optimizer.zero_grad()
        predictions = model(bundle.input_sequences, bundle.edge_index)
        loss = criterion(predictions[split.train_indices], bundle.targets[split.train_indices])
        loss.backward()
        optimizer.step()

        model.eval()
        with torch.no_grad():
            validation_predictions = model(bundle.input_sequences, bundle.edge_index)
            val_loss = criterion(
                validation_predictions[split.val_indices],
                bundle.targets[split.val_indices],
            ).item()

        if val_loss < best_val_loss:
            best_val_loss = val_loss
            best_epoch = epoch
            patience_counter = 0
            best_state_dict = {
                key: value.detach().cpu().clone()
                for key, value in model.state_dict().items()
            }
        else:
            patience_counter += 1

        if epoch % 10 == 0:
            print(
                f"Epoch {epoch:03d} | Train Loss={loss.item():.6f} | Val Loss={val_loss:.6f}"
            )

        if patience_counter >= patience:
            print(f"Early stopping at epoch {epoch:03d} with best val loss {best_val_loss:.6f}")
            break

    if best_state_dict is not None:
        model.load_state_dict(best_state_dict)

    model.eval()
    with torch.no_grad():
        full_output = model(bundle.input_sequences, bundle.edge_index).cpu().numpy()
        train_output = full_output[split.train_indices]
        val_output = full_output[split.val_indices]
        test_output = full_output[split.test_indices]
        train_target_scaled = bundle.targets[split.train_indices].cpu().numpy()
        val_target_scaled = bundle.targets[split.val_indices].cpu().numpy()
        test_target_scaled = bundle.targets[split.test_indices].cpu().numpy()

    train_evaluation = evaluate_scaled_predictions(bundle.scaler, train_target_scaled, train_output)
    val_evaluation = evaluate_scaled_predictions(bundle.scaler, val_target_scaled, val_output)
    test_evaluation = evaluate_scaled_predictions(bundle.scaler, test_target_scaled, test_output)
    baseline_test = build_persistence_baseline(bundle, split.test_indices)
    labels = test_evaluation["risk_band_labels"]
    confusion = np.array(test_evaluation["confusion_matrix"])
    low_threshold = test_evaluation["risk_band_thresholds"]["low_max"]
    high_threshold = test_evaluation["risk_band_thresholds"]["medium_max"]

    output_dir.mkdir(parents=True, exist_ok=True)
    torch.save(model.state_dict(), output_dir / "saved_model.pth")

    with (output_dir / "scaler.pkl").open("wb") as file_handle:
        pickle.dump(bundle.scaler, file_handle)

    with (output_dir / "crime_columns.pkl").open("wb") as file_handle:
        pickle.dump(bundle.crime_columns, file_handle)

    generated_at = datetime.now(UTC)
    metadata = {
        "model_name": MODEL_NAME,
        "sequence_length": bundle.sequence_length,
        "forecast_year_start": DEFAULT_FORECAST_START_YEAR,
        "forecast_year_end": DEFAULT_FORECAST_END_YEAR,
        "trained_on_years": bundle.trained_on_years,
        "crime_columns": bundle.crime_columns,
        "generated_at": generated_at.isoformat(),
        "forecast_batch_id": f"{MODEL_BATCH_PREFIX}{generated_at.strftime('%Y%m%d_%H%M%S')}",
        "training_rmse": train_evaluation["rmse"],
        "training_mae": train_evaluation["mae"],
        "training_r2": train_evaluation["r2"],
        "training_mape": train_evaluation["mape"],
        "validation_rmse": val_evaluation["rmse"],
        "validation_mae": val_evaluation["mae"],
        "validation_r2": val_evaluation["r2"],
        "validation_mape": val_evaluation["mape"],
        "test_rmse": test_evaluation["rmse"],
        "test_mae": test_evaluation["mae"],
        "test_r2": test_evaluation["r2"],
        "test_mape": test_evaluation["mape"],
        "baseline_test_rmse": baseline_test["rmse"],
        "baseline_test_mae": baseline_test["mae"],
        "baseline_test_r2": baseline_test["r2"],
        "baseline_test_mape": baseline_test["mape"],
        "risk_band_thresholds": {
            "low_max": low_threshold,
            "medium_max": high_threshold,
        },
        "best_epoch": best_epoch,
        "best_val_loss": best_val_loss,
        "train_sample_count": train_evaluation["sample_count"],
        "validation_sample_count": val_evaluation["sample_count"],
        "test_sample_count": test_evaluation["sample_count"],
    }
    (output_dir / "model_metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")

    evaluation = {
        "train": train_evaluation,
        "validation": val_evaluation,
        "test": test_evaluation,
        "baseline_test": baseline_test,
    }
    (output_dir / "evaluation_metrics.json").write_text(json.dumps(evaluation, indent=2), encoding="utf-8")
    pd.DataFrame(confusion, index=labels, columns=labels).to_csv(output_dir / "confusion_matrix.csv")

    return {**metadata, **evaluation}


def load_artifacts(output_dir: Path) -> dict[str, object]:
    torch, _, _, _, _, _, _, _, CNN_LSTM_GCN = import_training_dependencies()

    metadata_path = output_dir / "model_metadata.json"
    scaler_path = output_dir / "scaler.pkl"
    crime_columns_path = output_dir / "crime_columns.pkl"
    model_path = output_dir / "saved_model.pth"

    if not all(path.exists() for path in [metadata_path, scaler_path, crime_columns_path, model_path]):
        missing = [str(path.name) for path in [metadata_path, scaler_path, crime_columns_path, model_path] if not path.exists()]
        raise FileNotFoundError(f"Missing model artifacts: {', '.join(missing)}")

    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    with scaler_path.open("rb") as file_handle:
        scaler = pickle.load(file_handle)
    with crime_columns_path.open("rb") as file_handle:
        crime_columns = pickle.load(file_handle)

    model = CNN_LSTM_GCN(num_features=len(crime_columns))
    state_dict = torch.load(model_path, map_location="cpu")
    model.load_state_dict(state_dict)
    model.eval()

    return {
        "torch": torch,
        "model": model,
        "metadata": metadata,
        "scaler": scaler,
        "crime_columns": crime_columns,
    }


def clamp_prediction_array(values: np.ndarray) -> np.ndarray:
    safe_values = np.nan_to_num(values, nan=0.0, posinf=0.0, neginf=0.0)
    safe_values = np.maximum(safe_values, 0)
    return np.rint(safe_values).astype(int)


def split_training_bundle(
    bundle: TrainingBundle,
    val_size: float = 0.15,
    test_size: float = 0.2,
    random_state: int = 42,
) -> DatasetSplit:
    (
        _torch,
        _nn,
        _mean_absolute_error,
        _mean_squared_error,
        _r2_score,
        _confusion_matrix,
        train_test_split,
        _NearestNeighbors,
        _MinMaxScaler,
        _CNN_LSTM_GCN,
    ) = import_training_dependencies()

    all_indices = list(range(len(bundle.sequence_cities)))
    train_val_indices, test_indices = train_test_split(
        all_indices,
        test_size=test_size,
        random_state=random_state,
        shuffle=True,
    )
    adjusted_val_size = val_size / (1 - test_size)
    train_indices, val_indices = train_test_split(
        train_val_indices,
        test_size=adjusted_val_size,
        random_state=random_state,
        shuffle=True,
    )

    return DatasetSplit(
        train_indices=train_indices,
        val_indices=val_indices,
        test_indices=test_indices,
    )


def evaluate_predictions(true_actual: np.ndarray, pred_actual: np.ndarray) -> dict[str, object]:
    (
        _torch,
        _nn,
        mean_absolute_error,
        mean_squared_error,
        r2_score,
        confusion_matrix,
        _train_test_split,
        _NearestNeighbors,
        _MinMaxScaler,
        _CNN_LSTM_GCN,
    ) = import_training_dependencies()

    flattened_true = true_actual.reshape(-1)
    flattened_pred = pred_actual.reshape(-1)
    mse_value = float(mean_squared_error(flattened_true, flattened_pred))
    rmse_value = float(np.sqrt(mse_value))
    mae_value = float(mean_absolute_error(flattened_true, flattened_pred))
    r2_value = float(r2_score(flattened_true, flattened_pred))
    denominator = np.where(flattened_true == 0, 1, flattened_true)
    mape_value = float(np.mean(np.abs((flattened_true - flattened_pred) / denominator)) * 100)

    total_true = true_actual.sum(axis=1)
    total_pred = pred_actual.sum(axis=1)
    low_threshold, high_threshold = np.quantile(total_true, [0.33, 0.66]).tolist()

    def to_band(values: np.ndarray) -> np.ndarray:
        bands = np.full(values.shape, "medium", dtype=object)
        bands[values <= low_threshold] = "low"
        bands[values > high_threshold] = "high"
        return bands

    labels = ["low", "medium", "high"]
    confusion = confusion_matrix(to_band(total_true), to_band(total_pred), labels=labels)

    return {
        "rmse": rmse_value,
        "mae": mae_value,
        "mse": mse_value,
        "r2": r2_value,
        "mape": mape_value,
        "sample_count": int(true_actual.shape[0]),
        "feature_count": int(true_actual.shape[1]),
        "risk_band_labels": labels,
        "risk_band_thresholds": {
            "low_max": low_threshold,
            "medium_max": high_threshold,
        },
        "confusion_matrix": confusion.tolist(),
    }


def evaluate_scaled_predictions(
    scaler,
    true_scaled: np.ndarray,
    pred_scaled: np.ndarray,
) -> dict[str, object]:
    true_actual = scaler.inverse_transform(true_scaled)
    pred_actual = scaler.inverse_transform(pred_scaled)
    return evaluate_predictions(true_actual, pred_actual)


def build_persistence_baseline(bundle: TrainingBundle, indices: list[int]) -> dict[str, object]:
    baseline_scaled = bundle.input_sequences[indices, -1, :].cpu().numpy()
    true_scaled = bundle.targets[indices].cpu().numpy()
    return evaluate_scaled_predictions(bundle.scaler, true_scaled, baseline_scaled)


def generate_forecast_rows(
    dataset_path: Path,
    output_dir: Path,
    forecast_start_year: int = DEFAULT_FORECAST_START_YEAR,
    forecast_end_year: int = DEFAULT_FORECAST_END_YEAR,
) -> pd.DataFrame:
    artifacts = load_artifacts(output_dir)
    torch = artifacts["torch"]
    model = artifacts["model"]
    metadata = artifacts["metadata"]
    scaler = artifacts["scaler"]
    crime_columns = artifacts["crime_columns"]
    sequence_length = int(metadata["sequence_length"])

    bundle = build_training_bundle(
        dataset_path,
        scaler=scaler,
        crime_columns=crime_columns,
        sequence_length=sequence_length,
    )
    rolling_sequences = bundle.input_sequences.clone()

    generated_rows: list[dict[str, object]] = []
    forecast_years = list(range(forecast_start_year, forecast_end_year + 1))

    with torch.no_grad():
        for forecast_year in forecast_years:
            predicted_scaled = model(rolling_sequences, bundle.edge_index).cpu().numpy()
            predicted_actual = scaler.inverse_transform(predicted_scaled)
            predicted_actual = clamp_prediction_array(predicted_actual)

            for row_index, city in enumerate(bundle.sequence_cities):
                city_meta = bundle.city_metadata.loc[city]
                row: dict[str, object] = {
                    "state": city_meta["state"],
                    "district": city_meta["district"],
                    "city": city,
                    "latitude": float(city_meta["latitude"]),
                    "longitude": float(city_meta["longitude"]),
                    "population": float(city_meta["population"]) if pd.notna(city_meta["population"]) else 0,
                    "year": forecast_year,
                }
                for column_index, crime_column in enumerate(crime_columns):
                    row[crime_column] = int(predicted_actual[row_index][column_index])
                generated_rows.append(row)

            next_sequence = torch.tensor(predicted_scaled, dtype=torch.float32).unsqueeze(1)
            rolling_sequences = torch.cat([rolling_sequences[:, 1:, :], next_sequence], dim=1)

    forecast_df = pd.DataFrame(generated_rows)
    if forecast_df.empty:
        raise ValueError("Model generation produced no forecast rows.")

    forecast_df.to_csv(output_dir / "generated_forecasts.csv", index=False)

    metadata["forecast_year_start"] = forecast_start_year
    metadata["forecast_year_end"] = forecast_end_year
    (output_dir / "model_metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    return forecast_df


def build_argument_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Train or generate CNN-LSTM-GCN crime forecasts.")
    parser.add_argument(
        "command",
        choices=["train", "generate", "train-and-generate"],
        default="train-and-generate",
        nargs="?",
        help="Use 'train' to create artifacts once, 'generate' to reuse saved artifacts, or 'train-and-generate' to do both.",
    )
    parser.add_argument(
        "--dataset",
        default=str(BACKEND_DIR / "india_cities_crime_2020_2025.csv"),
        help="Path to the historical crime dataset CSV.",
    )
    parser.add_argument(
        "--output-dir",
        default=str(CURRENT_DIR),
        help="Directory where model artifacts and generated forecasts will be stored.",
    )
    parser.add_argument("--epochs", type=int, default=100, help="Training epochs.")
    parser.add_argument(
        "--sequence-length",
        type=int,
        default=DEFAULT_SEQUENCE_LENGTH,
        help="Number of historical years used per city sequence.",
    )
    return parser


def main() -> int:
    parser = build_argument_parser()
    args = parser.parse_args()

    dataset_path = Path(args.dataset).resolve()
    output_dir = Path(args.output_dir).resolve()

    if args.command in {"train", "train-and-generate"}:
        metadata = train_model(
            dataset_path=dataset_path,
            output_dir=output_dir,
            epochs=args.epochs,
            sequence_length=args.sequence_length,
        )
        print(f"Saved artifacts for batch {metadata['forecast_batch_id']}")

    if args.command in {"generate", "train-and-generate"}:
        forecast_df = generate_forecast_rows(
            dataset_path=dataset_path,
            output_dir=output_dir,
        )
        print(f"Generated {len(forecast_df)} forecast rows in {output_dir / 'generated_forecasts.csv'}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
