from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd


PROJECT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = PROJECT_DIR / "backend"
ML_OUTPUT_DIR = BACKEND_DIR / "ml"

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


METADATA_COLUMNS = {
    "State",
    "District",
    "City",
    "Latitude",
    "Longitude",
    "Population",
    "Year",
}
STATE_COLUMN = "State"
DISTRICT_COLUMN = "District"
CITY_COLUMN = "City"
LATITUDE_COLUMN = "Latitude"
LONGITUDE_COLUMN = "Longitude"
POPULATION_COLUMN = "Population"
YEAR_COLUMN = "Year"
DEFAULT_DATASET = BACKEND_DIR / "india_cities_crime_2020_2025.csv"
DEFAULT_SEQUENCE_LENGTH = 4
DEFAULT_NEIGHBORS = 8
DEFAULT_EPOCHS = 100
DEFAULT_PATIENCE = 20
DEFAULT_RANDOM_STATE = 42
DEFAULT_VAL_SIZE = 0.15
DEFAULT_TEST_SIZE = 0.15
TOTAL_CRIME_COLUMN = "Total_Estimated_Crimes"


@dataclass
class SplitIndices:
    train: list[int]
    validation: list[int]
    test: list[int]


@dataclass
class CrimeScaler:
    scaler: "MinMaxScaler"
    crime_columns: list[str]
    use_log1p: bool = True

    def fit(self, frame: pd.DataFrame) -> None:
        values = frame[self.crime_columns].to_numpy(dtype=np.float32)
        if self.use_log1p:
            values = np.log1p(values)
        self.scaler.fit(values)

    def transform(self, values: np.ndarray) -> np.ndarray:
        transformed = np.array(values, dtype=np.float32, copy=True)
        if self.use_log1p:
            transformed = np.log1p(transformed)
        original_shape = transformed.shape
        flattened = transformed.reshape(-1, original_shape[-1])
        scaled = self.scaler.transform(flattened)
        return scaled.reshape(original_shape).astype(np.float32)

    def inverse_transform(self, values: np.ndarray) -> np.ndarray:
        original_shape = values.shape
        flattened = values.reshape(-1, original_shape[-1])
        actual = self.scaler.inverse_transform(flattened).reshape(original_shape)
        if self.use_log1p:
            actual = np.expm1(actual)
        return actual


@dataclass
class HistoricalBacktestBundle:
    crime_columns: list[str]
    city_names: list[str]
    city_metadata: pd.DataFrame
    target_years: list[int]
    edge_index: "torch.Tensor"
    inputs_by_year: dict[int, np.ndarray]
    targets_by_year: dict[int, np.ndarray]
    scaler: CrimeScaler


def import_dependencies():
    try:
        import torch
        import torch.nn as nn
        from sklearn.metrics import f1_score, mean_absolute_error, mean_squared_error, r2_score
        from sklearn.model_selection import train_test_split
        from sklearn.neighbors import NearestNeighbors
        from sklearn.preprocessing import MinMaxScaler
    except ImportError as exc:  # pragma: no cover - environment-specific
        raise RuntimeError(
            "Missing ML dependencies. Install numpy, pandas, scikit-learn, torch, and torch-geometric."
        ) from exc

    from torch_geometric.nn import GCNConv

    return (
        torch,
        nn,
        f1_score,
        mean_absolute_error,
        mean_squared_error,
        r2_score,
        train_test_split,
        NearestNeighbors,
        MinMaxScaler,
        GCNConv,
    )


def build_model_class():
    torch, nn, *_rest, GCNConv = import_dependencies()

    class AdvancedCNNLSTMGCN(nn.Module):
        def __init__(self, num_features: int):
            super().__init__()
            hidden_gcn = 48
            hidden_conv = 96
            hidden_lstm = 128
            self.gcn = GCNConv(num_features, hidden_gcn)
            self.conv1 = nn.Conv1d(hidden_gcn, hidden_conv, kernel_size=2)
            self.lstm = nn.LSTM(hidden_conv, hidden_lstm, batch_first=True)
            self.dropout = nn.Dropout(p=0.15)
            self.fc1 = nn.Linear(hidden_lstm, 64)
            self.fc2 = nn.Linear(64, num_features)
            self.delta_scale = nn.Parameter(torch.tensor(0.10))

        def forward(self, x, edge_index):
            gcn_outputs = []
            for timestep in range(x.size(1)):
                xt = self.gcn(x[:, timestep, :], edge_index)
                xt = torch.relu(xt)
                xt = self.dropout(xt)
                gcn_outputs.append(xt)

            features = torch.stack(gcn_outputs, dim=1)
            features = features.permute(0, 2, 1)
            features = torch.relu(self.conv1(features))
            features = self.dropout(features)
            features = features.permute(0, 2, 1)

            lstm_out, _ = self.lstm(features)
            last_hidden = self.dropout(lstm_out[:, -1, :])
            delta = torch.relu(self.fc1(last_hidden))
            delta = torch.tanh(self.fc2(delta))
            residual = x[:, -1, :]
            output = residual + self.delta_scale * delta
            return torch.clamp(output, 0.0, 1.0)

    return AdvancedCNNLSTMGCN


def detect_crime_columns(df: pd.DataFrame) -> list[str]:
    return [column for column in df.columns if column not in METADATA_COLUMNS]


def build_city_metadata(df: pd.DataFrame) -> pd.DataFrame:
    return (
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


def build_city_year_matrix(df: pd.DataFrame, crime_columns: list[str]) -> pd.DataFrame:
    return (
        df.groupby([CITY_COLUMN, YEAR_COLUMN], as_index=False)[crime_columns]
        .sum()
        .sort_values([CITY_COLUMN, YEAR_COLUMN])
    )


def infer_target_years(df: pd.DataFrame, sequence_length: int) -> list[int]:
    years = sorted(df[YEAR_COLUMN].unique().tolist())
    if len(years) <= sequence_length:
        raise ValueError("The dataset does not contain enough years for the requested sequence length.")
    return years[sequence_length:]


def eligible_cities_for_targets(
    city_year_matrix: pd.DataFrame,
    target_years: list[int],
    sequence_length: int,
) -> list[str]:
    eligible: list[str] = []
    for city, city_data in city_year_matrix.groupby(CITY_COLUMN):
        available_years = set(city_data[YEAR_COLUMN].tolist())
        is_valid = True
        for target_year in target_years:
            required_years = set(range(target_year - sequence_length, target_year + 1))
            if not required_years.issubset(available_years):
                is_valid = False
                break
        if is_valid:
            eligible.append(city)
    if not eligible:
        raise ValueError("No cities have enough continuous yearly history for historical backtesting.")
    return sorted(eligible)


def split_cities(city_names: list[str], val_size: float, test_size: float, random_state: int) -> SplitIndices:
    (
        _torch,
        _nn,
        _f1_score,
        _mean_absolute_error,
        _mean_squared_error,
        _r2_score,
        train_test_split,
        _NearestNeighbors,
        _MinMaxScaler,
        _GCNConv,
    ) = import_dependencies()

    indices = list(range(len(city_names)))
    train_val_indices, test_indices = train_test_split(
        indices,
        test_size=test_size,
        random_state=random_state,
        shuffle=True,
    )
    adjusted_val_size = val_size / (1 - test_size)
    train_indices, validation_indices = train_test_split(
        train_val_indices,
        test_size=adjusted_val_size,
        random_state=random_state,
        shuffle=True,
    )
    return SplitIndices(
        train=list(train_indices),
        validation=list(validation_indices),
        test=list(test_indices),
    )


def fit_scaler(df: pd.DataFrame, crime_columns: list[str], train_city_names: list[str]):
    (
        _torch,
        _nn,
        _f1_score,
        _mean_absolute_error,
        _mean_squared_error,
        _r2_score,
        _train_test_split,
        _NearestNeighbors,
        MinMaxScaler,
        _GCNConv,
    ) = import_dependencies()

    train_rows = df[df[CITY_COLUMN].isin(train_city_names)]
    if train_rows.empty:
        raise ValueError("No training rows available for scaler fitting.")

    scaler = CrimeScaler(scaler=MinMaxScaler(), crime_columns=crime_columns)
    scaler.fit(train_rows)
    return scaler


def build_backtest_bundle(
    dataset_path: Path,
    sequence_length: int,
    neighbors: int,
    val_size: float,
    test_size: float,
    random_state: int,
) -> tuple[HistoricalBacktestBundle, SplitIndices]:
    (
        torch,
        _nn,
        _f1_score,
        _mean_absolute_error,
        _mean_squared_error,
        _r2_score,
        _train_test_split,
        NearestNeighbors,
        _MinMaxScaler,
        _GCNConv,
    ) = import_dependencies()

    df = pd.read_csv(dataset_path)
    crime_columns = detect_crime_columns(df)
    if not crime_columns:
        raise ValueError("No crime columns were detected in the dataset.")

    city_metadata = build_city_metadata(df)
    city_year_matrix = build_city_year_matrix(df, crime_columns)
    target_years = infer_target_years(df, sequence_length)
    city_names = eligible_cities_for_targets(city_year_matrix, target_years, sequence_length)
    split = split_cities(city_names, val_size=val_size, test_size=test_size, random_state=random_state)
    scaler = fit_scaler(df, crime_columns, [city_names[index] for index in split.train])

    city_metadata = city_metadata.loc[city_names]
    coordinates = np.radians(city_metadata[["latitude", "longitude"]].to_numpy(dtype=np.float32))
    effective_neighbors = min(neighbors + 1, len(city_names))
    nbrs = NearestNeighbors(n_neighbors=effective_neighbors, metric="haversine")
    nbrs.fit(coordinates)
    _, neighbor_indices = nbrs.kneighbors(coordinates)

    edge_pairs: list[list[int]] = []
    for source_index, source_neighbors in enumerate(neighbor_indices):
        for neighbor_index in source_neighbors[1:]:
            edge_pairs.append([source_index, int(neighbor_index)])
    if not edge_pairs:
        edge_pairs = [[0, 0]]
    edge_index = torch.tensor(edge_pairs, dtype=torch.long).t().contiguous()

    inputs_by_year: dict[int, np.ndarray] = {}
    targets_by_year: dict[int, np.ndarray] = {}
    grouped = {
        city: city_data.sort_values(YEAR_COLUMN).set_index(YEAR_COLUMN)
        for city, city_data in city_year_matrix.groupby(CITY_COLUMN)
    }

    for target_year in target_years:
        yearly_inputs: list[np.ndarray] = []
        yearly_targets: list[np.ndarray] = []
        input_years = list(range(target_year - sequence_length, target_year))

        for city in city_names:
            city_frame = grouped[city]
            input_block = city_frame.loc[input_years, crime_columns].to_numpy(dtype=np.float32)
            target_row = city_frame.loc[target_year, crime_columns].to_numpy(dtype=np.float32)
            yearly_inputs.append(input_block)
            yearly_targets.append(target_row)

        inputs_by_year[target_year] = scaler.transform(np.array(yearly_inputs, dtype=np.float32))
        targets_by_year[target_year] = scaler.transform(np.array(yearly_targets, dtype=np.float32))

    bundle = HistoricalBacktestBundle(
        crime_columns=crime_columns,
        city_names=city_names,
        city_metadata=city_metadata,
        target_years=target_years,
        edge_index=edge_index,
        inputs_by_year=inputs_by_year,
        targets_by_year=targets_by_year,
        scaler=scaler,
    )
    return bundle, split


def clamp_predictions(values: np.ndarray) -> np.ndarray:
    safe_values = np.nan_to_num(values, nan=0.0, posinf=0.0, neginf=0.0)
    return np.rint(np.maximum(safe_values, 0)).astype(int)


def get_total_crime_values(values: np.ndarray, crime_columns: list[str]) -> np.ndarray:
    if TOTAL_CRIME_COLUMN in crime_columns:
        total_index = crime_columns.index(TOTAL_CRIME_COLUMN)
        return values[:, total_index]
    return values.sum(axis=1)


def classify_risk_bands(total_values: np.ndarray, low_threshold: float, medium_threshold: float) -> np.ndarray:
    labels = np.full(total_values.shape, "medium", dtype=object)
    labels[total_values <= low_threshold] = "low"
    labels[total_values > medium_threshold] = "high"
    return labels


def evaluate_predictions(true_actual: np.ndarray, pred_actual: np.ndarray, crime_columns: list[str], thresholds=None) -> dict[str, float]:
    (
        _torch,
        _nn,
        f1_score,
        mean_absolute_error,
        mean_squared_error,
        r2_score,
        _train_test_split,
        _NearestNeighbors,
        _MinMaxScaler,
        _GCNConv,
    ) = import_dependencies()

    flattened_true = true_actual.reshape(-1)
    flattened_pred = pred_actual.reshape(-1)
    rmse = float(np.sqrt(mean_squared_error(flattened_true, flattened_pred)))
    mae = float(mean_absolute_error(flattened_true, flattened_pred))
    r2 = float(r2_score(flattened_true, flattened_pred))
    denominator = np.where(flattened_true == 0, 1.0, flattened_true)
    mape = float(np.mean(np.abs((flattened_true - flattened_pred) / denominator)) * 100)
    within_20pct = float(np.mean((np.abs(flattened_true - flattened_pred) / denominator) <= 0.20))

    total_true = get_total_crime_values(true_actual, crime_columns)
    total_pred = get_total_crime_values(pred_actual, crime_columns)
    if thresholds is None:
        low_threshold, medium_threshold = np.quantile(total_true, [0.33, 0.66]).tolist()
    else:
        low_threshold = float(thresholds["low_max"])
        medium_threshold = float(thresholds["medium_max"])

    true_bands = classify_risk_bands(total_true, low_threshold, medium_threshold)
    pred_bands = classify_risk_bands(total_pred, low_threshold, medium_threshold)
    labels = ["low", "medium", "high"]
    risk_band_accuracy = float(np.mean(true_bands == pred_bands))
    risk_band_macro_f1 = float(f1_score(true_bands, pred_bands, labels=labels, average="macro"))
    total_crime_rmse = float(np.sqrt(mean_squared_error(total_true, total_pred)))
    total_crime_mae = float(mean_absolute_error(total_true, total_pred))

    return {
        "rmse": rmse,
        "mae": mae,
        "r2": r2,
        "mape": mape,
        "accuracy_within_20pct": within_20pct,
        "risk_band_accuracy": risk_band_accuracy,
        "risk_band_macro_f1": risk_band_macro_f1,
        "total_crime_rmse": total_crime_rmse,
        "total_crime_mae": total_crime_mae,
        "low_max": low_threshold,
        "medium_max": medium_threshold,
        "sample_count": int(true_actual.shape[0]),
    }


def collect_split_arrays(
    actual_by_year: dict[int, np.ndarray],
    predicted_by_year: dict[int, np.ndarray],
    indices: list[int],
) -> tuple[np.ndarray, np.ndarray]:
    true_rows: list[np.ndarray] = []
    pred_rows: list[np.ndarray] = []
    for target_year in sorted(actual_by_year):
        true_rows.append(actual_by_year[target_year][indices])
        pred_rows.append(predicted_by_year[target_year][indices])
    return np.vstack(true_rows), np.vstack(pred_rows)


def build_prediction_rows(
    bundle: HistoricalBacktestBundle,
    split: SplitIndices,
    actual_by_year: dict[int, np.ndarray],
    predicted_by_year: dict[int, np.ndarray],
) -> pd.DataFrame:
    split_lookup: dict[int, str] = {}
    for index in split.train:
        split_lookup[index] = "train"
    for index in split.validation:
        split_lookup[index] = "validation"
    for index in split.test:
        split_lookup[index] = "test"

    rows: list[dict[str, object]] = []
    for target_year in bundle.target_years:
        for city_index, city_name in enumerate(bundle.city_names):
            city_meta = bundle.city_metadata.loc[city_name]
            row = {
                "state": city_meta["state"],
                "district": city_meta["district"],
                "city": city_name,
                "latitude": float(city_meta["latitude"]),
                "longitude": float(city_meta["longitude"]),
                "population": float(city_meta["population"]) if pd.notna(city_meta["population"]) else 0.0,
                "year": int(target_year),
                "dataset_split": split_lookup[city_index],
            }
            actual_values = actual_by_year[target_year][city_index]
            predicted_values = predicted_by_year[target_year][city_index]
            for feature_index, crime_column in enumerate(bundle.crime_columns):
                row[f"actual_{crime_column}"] = int(actual_values[feature_index])
                row[f"predicted_{crime_column}"] = int(predicted_values[feature_index])
            rows.append(row)
    return pd.DataFrame(rows)


def format_metric_block(title: str, metrics: dict[str, float]) -> str:
    return "\n".join(
        [
            title,
            "-" * len(title),
            f"rmse: {metrics['rmse']:.4f}",
            f"mae: {metrics['mae']:.4f}",
            f"r2: {metrics['r2']:.4f}",
            f"mape: {metrics['mape']:.4f}",
            f"accuracy_within_20pct: {metrics['accuracy_within_20pct']:.4f}",
            f"risk_band_accuracy: {metrics['risk_band_accuracy']:.4f}",
            f"risk_band_macro_f1: {metrics['risk_band_macro_f1']:.4f}",
            f"total_crime_rmse: {metrics['total_crime_rmse']:.4f}",
            f"total_crime_mae: {metrics['total_crime_mae']:.4f}",
        ]
    )


def train_and_score(
    dataset_path: Path,
    output_dir: Path,
    sequence_length: int,
    neighbors: int,
    epochs: int,
    patience: int,
    random_state: int,
    val_size: float,
    test_size: float,
    learning_rate: float,
    weight_decay: float,
) -> dict[str, object]:
    (
        torch,
        nn,
        _f1_score,
        _mean_absolute_error,
        _mean_squared_error,
        _r2_score,
        _train_test_split,
        _NearestNeighbors,
        _MinMaxScaler,
        _GCNConv,
    ) = import_dependencies()
    ModelClass = build_model_class()

    bundle, split = build_backtest_bundle(
        dataset_path=dataset_path,
        sequence_length=sequence_length,
        neighbors=neighbors,
        val_size=val_size,
        test_size=test_size,
        random_state=random_state,
    )

    model = ModelClass(num_features=len(bundle.crime_columns))
    optimizer = torch.optim.Adam(model.parameters(), lr=learning_rate, weight_decay=weight_decay)
    criterion = nn.SmoothL1Loss(beta=0.05)

    yearly_inputs = {
        year: torch.tensor(values, dtype=torch.float32)
        for year, values in bundle.inputs_by_year.items()
    }
    yearly_targets = {
        year: torch.tensor(values, dtype=torch.float32)
        for year, values in bundle.targets_by_year.items()
    }

    best_state_dict = None
    best_val_loss = float("inf")
    best_epoch = -1
    patience_counter = 0

    for epoch in range(epochs):
        model.train()
        optimizer.zero_grad()
        train_losses = []
        for target_year in bundle.target_years:
            predictions = model(yearly_inputs[target_year], bundle.edge_index)
            train_losses.append(criterion(predictions[split.train], yearly_targets[target_year][split.train]))
        train_loss = torch.stack(train_losses).mean()
        train_loss.backward()
        optimizer.step()

        model.eval()
        with torch.no_grad():
            val_losses = []
            for target_year in bundle.target_years:
                validation_predictions = model(yearly_inputs[target_year], bundle.edge_index)
                val_losses.append(
                    criterion(validation_predictions[split.validation], yearly_targets[target_year][split.validation])
                )
            val_loss = float(torch.stack(val_losses).mean().item())

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
            print(f"Epoch {epoch:03d} | Train Loss={train_loss.item():.6f} | Val Loss={val_loss:.6f}")

        if patience_counter >= patience:
            print(f"Early stopping at epoch {epoch:03d} with best val loss {best_val_loss:.6f}")
            break

    if best_state_dict is not None:
        model.load_state_dict(best_state_dict)

    model.eval()
    predicted_scaled_by_year: dict[int, np.ndarray] = {}
    actual_scaled_by_year: dict[int, np.ndarray] = {}
    with torch.no_grad():
        for target_year in bundle.target_years:
            predicted_scaled_by_year[target_year] = model(yearly_inputs[target_year], bundle.edge_index).cpu().numpy()
            actual_scaled_by_year[target_year] = yearly_targets[target_year].cpu().numpy()

    actual_by_year = {
        year: clamp_predictions(bundle.scaler.inverse_transform(values))
        for year, values in actual_scaled_by_year.items()
    }
    predicted_by_year = {
        year: clamp_predictions(bundle.scaler.inverse_transform(values))
        for year, values in predicted_scaled_by_year.items()
    }

    train_true, train_pred = collect_split_arrays(actual_by_year, predicted_by_year, split.train)
    val_true, val_pred = collect_split_arrays(actual_by_year, predicted_by_year, split.validation)
    test_true, test_pred = collect_split_arrays(actual_by_year, predicted_by_year, split.test)

    train_metrics = evaluate_predictions(train_true, train_pred, bundle.crime_columns)
    thresholds = {
        "low_max": train_metrics["low_max"],
        "medium_max": train_metrics["medium_max"],
    }
    validation_metrics = evaluate_predictions(val_true, val_pred, bundle.crime_columns, thresholds=thresholds)
    test_metrics = evaluate_predictions(test_true, test_pred, bundle.crime_columns, thresholds=thresholds)

    output_dir.mkdir(parents=True, exist_ok=True)
    prediction_rows = build_prediction_rows(bundle, split, actual_by_year, predicted_by_year)
    prediction_path = output_dir / "historical_backtest_predictions.csv"
    metrics_path = output_dir / "historical_backtest_metrics.json"
    prediction_rows.to_csv(prediction_path, index=False)

    artifact = {
        "artifact_version": 2,
        "dataset_path": str(dataset_path),
        "sequence_length": sequence_length,
        "city_count": len(bundle.city_names),
        "neighbor_count": neighbors,
        "feature_dim": len(bundle.crime_columns),
        "target_dim": len(bundle.crime_columns),
        "years": sorted(pd.read_csv(dataset_path)[YEAR_COLUMN].unique().tolist()),
        "predicted_historical_years": bundle.target_years,
        "dataset_splits": {
            "train_cities": len(split.train),
            "validation_cities": len(split.validation),
            "test_cities": len(split.test),
        },
        "risk_band_thresholds": thresholds,
        "train": {key: value for key, value in train_metrics.items() if key not in {"low_max", "medium_max"}},
        "validation": {key: value for key, value in validation_metrics.items() if key not in {"low_max", "medium_max"}},
        "test": {key: value for key, value in test_metrics.items() if key not in {"low_max", "medium_max"}},
        "best_epoch": best_epoch,
        "best_val_loss": best_val_loss,
        "predictions_csv": str(prediction_path),
    }
    metrics_path.write_text(json.dumps(artifact, indent=2), encoding="utf-8")

    print("Advanced CNN-LSTM-GCN Model Scores")
    print("==================================")
    print(f"artifact_version: {artifact['artifact_version']}")
    print(f"sequence_length: {artifact['sequence_length']}")
    print(f"city_count: {artifact['city_count']}")
    print(f"neighbor_count: {artifact['neighbor_count']}")
    print(f"feature_dim: {artifact['feature_dim']}")
    print(f"target_dim: {artifact['target_dim']}")
    print(f"years: {artifact['years']}")
    print()
    print("Dataset Splits")
    print("--------------")
    print(f"train_cities: {artifact['dataset_splits']['train_cities']}")
    print(f"validation_cities: {artifact['dataset_splits']['validation_cities']}")
    print(f"test_cities: {artifact['dataset_splits']['test_cities']}")
    print()
    print(format_metric_block("Train Metrics", artifact["train"]))
    print()
    print(format_metric_block("Validation Metrics", artifact["validation"]))
    print()
    print(format_metric_block("Test Metrics", artifact["test"]))
    print()
    print(f"Saved historical predictions to: {prediction_path}")
    print(f"Saved historical metrics to: {metrics_path}")

    return artifact


def build_argument_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Train a real historical CNN-LSTM-GCN backtest on 2020-2025 data and score predictions."
    )
    parser.add_argument("--dataset", default=str(DEFAULT_DATASET), help="Path to the historical dataset CSV.")
    parser.add_argument("--output-dir", default=str(ML_OUTPUT_DIR), help="Directory for metrics and prediction outputs.")
    parser.add_argument("--sequence-length", type=int, default=DEFAULT_SEQUENCE_LENGTH, help="Historical years per input.")
    parser.add_argument("--neighbors", type=int, default=DEFAULT_NEIGHBORS, help="Neighbor count for the city graph.")
    parser.add_argument("--epochs", type=int, default=DEFAULT_EPOCHS, help="Training epochs.")
    parser.add_argument("--patience", type=int, default=DEFAULT_PATIENCE, help="Early stopping patience.")
    parser.add_argument("--random-state", type=int, default=DEFAULT_RANDOM_STATE, help="Random seed for split reproducibility.")
    parser.add_argument("--val-size", type=float, default=DEFAULT_VAL_SIZE, help="Validation city fraction.")
    parser.add_argument("--test-size", type=float, default=DEFAULT_TEST_SIZE, help="Test city fraction.")
    parser.add_argument("--learning-rate", type=float, default=0.001, help="Adam learning rate.")
    parser.add_argument("--weight-decay", type=float, default=1e-4, help="Adam weight decay.")
    return parser


def main() -> int:
    parser = build_argument_parser()
    args = parser.parse_args()

    train_and_score(
        dataset_path=Path(args.dataset).resolve(),
        output_dir=Path(args.output_dir).resolve(),
        sequence_length=args.sequence_length,
        neighbors=args.neighbors,
        epochs=args.epochs,
        patience=args.patience,
        random_state=args.random_state,
        val_size=args.val_size,
        test_size=args.test_size,
        learning_rate=args.learning_rate,
        weight_decay=args.weight_decay,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
