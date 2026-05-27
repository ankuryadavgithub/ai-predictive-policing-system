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
    "Month",
    "Quarter",
}
STATE_COLUMN = "State"
DISTRICT_COLUMN = "District"
CITY_COLUMN = "City"
LATITUDE_COLUMN = "Latitude"
LONGITUDE_COLUMN = "Longitude"
POPULATION_COLUMN = "Population"
YEAR_COLUMN = "Year"
MONTH_COLUMN = "Month"
QUARTER_COLUMN = "Quarter"
TIME_PERIOD_COLUMN = "TimePeriod"
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
    location_ids: list[str]
    location_metadata: pd.DataFrame
    target_periods: list[pd.Period]
    edge_index: "torch.Tensor"
    inputs_by_period: dict[pd.Period, np.ndarray]
    targets_by_period: dict[pd.Period, np.ndarray]
    baselines_by_period: dict[pd.Period, np.ndarray]  # Holds the scaled baseline (previous slice)
    previous_deltas_by_period: dict[pd.Period, np.ndarray]
    scaler: CrimeScaler


def import_dependencies():
    try:
        import torch
        import torch.nn as nn
        from sklearn.metrics import f1_score, mean_absolute_error, mean_squared_error, r2_score
        from sklearn.model_selection import train_test_split
        from sklearn.neighbors import NearestNeighbors
        from sklearn.preprocessing import MinMaxScaler
    except ImportError as exc:
        raise RuntimeError(
            "Missing ML dependencies. Install numpy, pandas, scikit-learn, torch, and torch-geometric."
        ) from exc

    from torch_geometric.nn import GCNConv
    from torch_geometric.utils import subgraph

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
        subgraph,
    )


def build_model_class():
    torch, nn, *_rest, GCNConv, _subgraph = import_dependencies()

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
            # x shape: [nodes, timesteps, features]
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
            
            # Predicts the change vector bounded tightly to avoid exploding scales
            predicted_delta = torch.tanh(self.fc2(delta)) * self.delta_scale
            
            # Residual calculation is now handled relative to the external baseline in training loop,
            # or directly within the model structure when predicting changes.
            return predicted_delta

    return AdvancedCNNLSTMGCN


def detect_crime_columns(df: pd.DataFrame) -> list[str]:
    return [column for column in df.columns if column not in METADATA_COLUMNS]


def detect_time_frequency(df: pd.DataFrame) -> tuple[str, str]:
    if MONTH_COLUMN in df.columns:
        return MONTH_COLUMN, "M"
    if QUARTER_COLUMN in df.columns:
        return QUARTER_COLUMN, "Q"
    return YEAR_COLUMN, "Y"


def build_time_period_index(df: pd.DataFrame, time_column: str) -> pd.PeriodIndex:
    if time_column == MONTH_COLUMN:
        return pd.PeriodIndex.from_fields(
            year=df[YEAR_COLUMN].astype(int),
            month=df[MONTH_COLUMN].astype(int),
            freq="M",
        )
    if time_column == QUARTER_COLUMN:
        return pd.PeriodIndex.from_fields(
            year=df[YEAR_COLUMN].astype(int),
            quarter=df[QUARTER_COLUMN].astype(int),
            freq="Q",
        )
    return pd.PeriodIndex(df[YEAR_COLUMN].astype(int).astype(str), freq="Y")


def build_location_identifier(df: pd.DataFrame) -> pd.Series:
    return df[STATE_COLUMN].astype(str).str.strip() + "||" + df[DISTRICT_COLUMN].astype(str).str.strip()


def build_location_metadata(df: pd.DataFrame) -> pd.DataFrame:
    location_ids = build_location_identifier(df)
    metadata = df.copy()
    metadata["location_id"] = location_ids
    return (
        metadata.groupby("location_id", as_index=False)
        .agg(
            state=(STATE_COLUMN, "last"),
            district=(DISTRICT_COLUMN, "last"),
            latitude=(LATITUDE_COLUMN, "mean"),
            longitude=(LONGITUDE_COLUMN, "mean"),
            population=(POPULATION_COLUMN, "sum"),
        )
        .set_index("location_id")
    )


def build_location_time_matrix(df: pd.DataFrame, crime_columns: list[str]) -> pd.DataFrame:
    df = df.copy()
    df[TIME_PERIOD_COLUMN] = build_time_period_index(df, detect_time_frequency(df))
    df["location_id"] = build_location_identifier(df)
    return (
        df.groupby(["location_id", TIME_PERIOD_COLUMN], as_index=False)[crime_columns]
        .sum()
        .sort_values(["location_id", TIME_PERIOD_COLUMN])
    )


def infer_target_periods(df: pd.DataFrame, sequence_length: int) -> list[pd.Period]:
    time_column, _freq = detect_time_frequency(df)
    periods = sorted(build_time_period_index(df, time_column).unique().tolist())
    if len(periods) <= sequence_length:
        raise ValueError("The dataset does not contain enough time periods for the requested sequence length.")
    return periods[sequence_length:]


def eligible_locations_for_targets(
    location_time_matrix: pd.DataFrame,
    target_periods: list[pd.Period],
    sequence_length: int,
) -> list[str]:
    eligible: list[str] = []
    for location_id, location_data in location_time_matrix.groupby("location_id"):
        available_periods = set(location_data[TIME_PERIOD_COLUMN].tolist())
        is_valid = True
        for target_period in target_periods:
            required_periods = {target_period - offset for offset in range(sequence_length + 1)}
            if not required_periods.issubset(available_periods):
                is_valid = False
                break
        if is_valid:
            eligible.append(location_id)
    if not eligible:
        raise ValueError("No locations have enough continuous history for periodic backtesting.")
    return sorted(eligible)


def split_locations(location_ids: list[str], val_size: float, test_size: float, random_state: int) -> SplitIndices:
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
        _subgraph,
    ) = import_dependencies()

    indices = list(range(len(location_ids)))
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


def fit_scaler(df: pd.DataFrame, crime_columns: list[str], train_location_ids: list[str]):
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
        _subgraph,
    ) = import_dependencies()

    df = df.copy()
    df["location_id"] = build_location_identifier(df)
    train_rows = df[df["location_id"].isin(train_location_ids)]
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
        _subgraph,
    ) = import_dependencies()

    df = pd.read_csv(dataset_path)
    crime_columns = detect_crime_columns(df)
    if not crime_columns:
        raise ValueError("No crime columns were detected in the dataset.")

    location_metadata = build_location_metadata(df)
    location_time_matrix = build_location_time_matrix(df, crime_columns)
    target_periods = infer_target_periods(df, sequence_length)
    location_ids = eligible_locations_for_targets(location_time_matrix, target_periods, sequence_length)
    split = split_locations(location_ids, val_size=val_size, test_size=test_size, random_state=random_state)
    scaler = fit_scaler(df, crime_columns, [location_ids[index] for index in split.train])

    location_metadata = location_metadata.loc[location_ids]
    coordinates = np.radians(location_metadata[["latitude", "longitude"]].to_numpy(dtype=np.float32))
    effective_neighbors = min(neighbors + 1, len(location_ids))
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

    inputs_by_period: dict[pd.Period, np.ndarray] = {}
    targets_by_period: dict[pd.Period, np.ndarray] = {}
    baselines_by_period: dict[pd.Period, np.ndarray] = {}
    previous_deltas_by_period: dict[pd.Period, np.ndarray] = {}
    grouped = {
        location_id: location_data.sort_values(TIME_PERIOD_COLUMN).set_index(TIME_PERIOD_COLUMN)
        for location_id, location_data in location_time_matrix.groupby("location_id")
    }

    for target_period in target_periods:
        period_inputs: list[np.ndarray] = []
        period_targets: list[np.ndarray] = []
        period_baselines: list[np.ndarray] = []
        input_periods = [target_period - offset for offset in range(sequence_length, 0, -1)]

        for location_id in location_ids:
            location_frame = grouped[location_id]
            input_block = location_frame.loc[input_periods, crime_columns].to_numpy(dtype=np.float32)
            target_row = location_frame.loc[target_period, crime_columns].to_numpy(dtype=np.float32)
            baseline_row = location_frame.loc[target_period - 1, crime_columns].to_numpy(dtype=np.float32)

            period_inputs.append(input_block)
            period_targets.append(target_row)
            period_baselines.append(baseline_row)

        scaled_inputs = scaler.transform(np.array(period_inputs, dtype=np.float32))
        scaled_targets = scaler.transform(np.array(period_targets, dtype=np.float32))
        scaled_baselines = scaler.transform(np.array(period_baselines, dtype=np.float32))

        inputs_by_period[target_period] = scaled_inputs
        targets_by_period[target_period] = scaled_targets - scaled_baselines
        baselines_by_period[target_period] = scaled_baselines
        previous_deltas_by_period[target_period] = (
            scaled_inputs[:, -1, :] - scaled_inputs[:, -2, :]
            if sequence_length >= 2
            else np.zeros_like(scaled_targets)
        )

    bundle = HistoricalBacktestBundle(
        crime_columns=crime_columns,
        location_ids=location_ids,
        location_metadata=location_metadata,
        target_periods=target_periods,
        edge_index=edge_index,
        inputs_by_period=inputs_by_period,
        targets_by_period=targets_by_period,
        baselines_by_period=baselines_by_period,
        previous_deltas_by_period=previous_deltas_by_period,
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


def evaluate_predictions(
    true_actual: np.ndarray,
    pred_actual: np.ndarray,
    crime_columns: list[str],
    thresholds=None,
    baselines: np.ndarray | None = None,
) -> dict[str, float]:
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
        _subgraph,
    ) = import_dependencies()

    flattened_true = true_actual.reshape(-1)
    flattened_pred = pred_actual.reshape(-1)
    rmse = float(np.sqrt(mean_squared_error(flattened_true, flattened_pred)))
    mae = float(mean_absolute_error(flattened_true, flattened_pred))
    r2 = float(r2_score(flattened_true, flattened_pred))
    if baselines is not None:
        delta_true = (true_actual - baselines).reshape(-1)
        delta_pred = (pred_actual - baselines).reshape(-1)
        delta_r2 = float(r2_score(delta_true, delta_pred))
    else:
        delta_r2 = 0.0
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
        "delta_r2": delta_r2,
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
    actual_by_period: dict[pd.Period, np.ndarray],
    predicted_by_period: dict[pd.Period, np.ndarray],
    indices: list[int],
) -> tuple[np.ndarray, np.ndarray]:
    true_rows: list[np.ndarray] = []
    pred_rows: list[np.ndarray] = []
    for target_period in sorted(actual_by_period):
        true_rows.append(actual_by_period[target_period][indices])
        pred_rows.append(predicted_by_period[target_period][indices])
    return np.vstack(true_rows), np.vstack(pred_rows)


def build_prediction_rows(
    bundle: HistoricalBacktestBundle,
    split: SplitIndices,
    actual_by_period: dict[pd.Period, np.ndarray],
    predicted_by_period: dict[pd.Period, np.ndarray],
) -> pd.DataFrame:
    split_lookup: dict[int, str] = {}
    for index in split.train:
        split_lookup[index] = "train"
    for index in split.validation:
        split_lookup[index] = "validation"
    for index in split.test:
        split_lookup[index] = "test"

    rows: list[dict[str, object]] = []
    for target_period in bundle.target_periods:
        for location_index, location_id in enumerate(bundle.location_ids):
            location_meta = bundle.location_metadata.loc[location_id]
            row = {
                "state": location_meta["state"],
                "district": location_meta["district"],
                "location_id": location_id,
                "latitude": float(location_meta["latitude"]),
                "longitude": float(location_meta["longitude"]),
                "population": float(location_meta["population"]) if pd.notna(location_meta["population"]) else 0.0,
                "time_period": str(target_period),
                "year": int(target_period.year),
                "dataset_split": split_lookup[location_index],
            }
            actual_values = actual_by_period[target_period][location_index]
            predicted_values = predicted_by_period[target_period][location_index]
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
            f"delta_r2: {metrics.get('delta_r2', 0.0):.4f}",
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
        subgraph,
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

    # Convert entire datasets to torch tensors
    period_inputs = {period: torch.tensor(v, dtype=torch.float32) for period, v in bundle.inputs_by_period.items()}
    period_targets = {period: torch.tensor(v, dtype=torch.float32) for period, v in bundle.targets_by_period.items()}

    # FIX 1: Generate isolated Graph structural subgraphs to prevent spatial leakage
    train_nodes_t = torch.tensor(split.train, dtype=torch.long)
    val_nodes_t = torch.tensor(split.validation, dtype=torch.long)
    test_nodes_t = torch.tensor(split.test, dtype=torch.long)

    train_edge_index, _ = subgraph(train_nodes_t, bundle.edge_index, relabel_nodes=True)
    val_edge_index, _ = subgraph(val_nodes_t, bundle.edge_index, relabel_nodes=True)
    test_edge_index, _ = subgraph(test_nodes_t, bundle.edge_index, relabel_nodes=True)

    best_state_dict = None
    best_val_loss = float("inf")
    best_epoch = -1
    patience_counter = 0

    for epoch in range(epochs):
        model.train()
        optimizer.zero_grad()
        train_losses = []
        for target_period in bundle.target_periods:
            # Pass ONLY training nodes and their strictly internal subgraph edges
            train_inputs = period_inputs[target_period][split.train]
            predictions_delta = model(train_inputs, train_edge_index)
            
            # Loss evaluated against target Delta metrics
            train_losses.append(criterion(predictions_delta, period_targets[target_period][split.train]))
        
        train_loss = torch.stack(train_losses).mean()
        train_loss.backward()
        optimizer.step()

        model.eval()
        with torch.no_grad():
            val_losses = []
            for target_period in bundle.target_periods:
                val_inputs = period_inputs[target_period][split.validation]
                validation_predictions_delta = model(val_inputs, val_edge_index)
                val_losses.append(
                    criterion(validation_predictions_delta, period_targets[target_period][split.validation])
                )
            val_loss = float(torch.stack(val_losses).mean().item())

        if val_loss < best_val_loss:
            best_val_loss = val_loss
            best_epoch = epoch
            patience_counter = 0
            best_state_dict = {k: v.detach().cpu().clone() for k, v in model.state_dict().items()}
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
    predicted_scaled_by_period: dict[pd.Period, np.ndarray] = {}
    actual_scaled_by_period: dict[pd.Period, np.ndarray] = {}
    baseline_zero_scaled_by_period: dict[pd.Period, np.ndarray] = {}
    baseline_previous_scaled_by_period: dict[pd.Period, np.ndarray] = {}
    
    with torch.no_grad():
        for target_period in bundle.target_periods:
            total_locations = len(bundle.location_ids)
            reconstructed_pred_scaled = np.zeros((total_locations, len(bundle.crime_columns)), dtype=np.float32)

            p_train = model(period_inputs[target_period][split.train], train_edge_index).cpu().numpy()
            reconstructed_pred_scaled[split.train] = bundle.baselines_by_period[target_period][split.train] + p_train

            p_val = model(period_inputs[target_period][split.validation], val_edge_index).cpu().numpy()
            reconstructed_pred_scaled[split.validation] = bundle.baselines_by_period[target_period][split.validation] + p_val

            p_test = model(period_inputs[target_period][split.test], test_edge_index).cpu().numpy()
            reconstructed_pred_scaled[split.test] = bundle.baselines_by_period[target_period][split.test] + p_test

            predicted_scaled_by_period[target_period] = reconstructed_pred_scaled
            actual_scaled_by_period[target_period] = bundle.baselines_by_period[target_period] + bundle.targets_by_period[target_period]
            baseline_zero_scaled_by_period[target_period] = bundle.baselines_by_period[target_period]
            baseline_previous_scaled_by_period[target_period] = (
                bundle.baselines_by_period[target_period] + bundle.previous_deltas_by_period[target_period]
            )

    actual_by_period = {
        period: clamp_predictions(bundle.scaler.inverse_transform(values))
        for period, values in actual_scaled_by_period.items()
    }
    predicted_by_period = {
        period: clamp_predictions(bundle.scaler.inverse_transform(values))
        for period, values in predicted_scaled_by_period.items()
    }
    baseline_zero_by_period = {
        period: clamp_predictions(bundle.scaler.inverse_transform(values))
        for period, values in baseline_zero_scaled_by_period.items()
    }
    baseline_previous_by_period = {
        period: clamp_predictions(bundle.scaler.inverse_transform(values))
        for period, values in baseline_previous_scaled_by_period.items()
    }

    train_true, train_pred = collect_split_arrays(actual_by_period, predicted_by_period, split.train)
    val_true, val_pred = collect_split_arrays(actual_by_period, predicted_by_period, split.validation)
    test_true, test_pred = collect_split_arrays(actual_by_period, predicted_by_period, split.test)
    _, train_baseline = collect_split_arrays(actual_by_period, baseline_zero_by_period, split.train)
    _, val_baseline = collect_split_arrays(actual_by_period, baseline_zero_by_period, split.validation)
    _, test_baseline = collect_split_arrays(actual_by_period, baseline_zero_by_period, split.test)

    train_metrics = evaluate_predictions(
        train_true,
        train_pred,
        bundle.crime_columns,
        baselines=train_baseline,
    )
    thresholds = {
        "low_max": train_metrics["low_max"],
        "medium_max": train_metrics["medium_max"],
    }
    validation_metrics = evaluate_predictions(
        val_true,
        val_pred,
        bundle.crime_columns,
        thresholds=thresholds,
        baselines=val_baseline,
    )
    test_metrics = evaluate_predictions(
        test_true,
        test_pred,
        bundle.crime_columns,
        thresholds=thresholds,
        baselines=test_baseline,
    )
    baseline_zero_test_metrics = evaluate_predictions(
        *collect_split_arrays(actual_by_period, baseline_zero_by_period, split.test),
        bundle.crime_columns,
        thresholds=thresholds,
    )
    baseline_previous_test_metrics = evaluate_predictions(
        *collect_split_arrays(actual_by_period, baseline_previous_by_period, split.test),
        bundle.crime_columns,
        thresholds=thresholds,
    )

    output_dir.mkdir(parents=True, exist_ok=True)
    prediction_rows = build_prediction_rows(bundle, split, actual_by_period, predicted_by_period)
    prediction_path = output_dir / "historical_backtest_predictions.csv"
    metrics_path = output_dir / "historical_backtest_metrics.json"
    prediction_rows.to_csv(prediction_path, index=False)

    artifact = {
        "artifact_version": 2,
        "dataset_path": str(dataset_path),
        "sequence_length": sequence_length,
        "location_count": len(bundle.location_ids),
        "neighbor_count": neighbors,
        "feature_dim": len(bundle.crime_columns),
        "target_dim": len(bundle.crime_columns),
        "time_frequency": detect_time_frequency(pd.read_csv(dataset_path))[1],
        "predicted_historical_periods": [str(period) for period in bundle.target_periods],
        "dataset_splits": {
            "train_locations": len(split.train),
            "validation_locations": len(split.validation),
            "test_locations": len(split.test),
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

    print("Advanced CNN-LSTM-GCN Model Scores (Refactored)")
    print("==============================================")
    print(f"artifact_version: {artifact['artifact_version']}")
    print(f"sequence_length: {artifact['sequence_length']}")
    print(f"location_count: {artifact['location_count']}")
    print(f"neighbor_count: {artifact['neighbor_count']}")
    print()
    print(format_metric_block("Train Metrics", artifact["train"]))
    print()
    print(format_metric_block("Validation Metrics", artifact["validation"]))
    print()
    print(format_metric_block("Test Metrics", artifact["test"]))
    print()
    print(format_metric_block("Naive Persistence Baseline (Zero Delta)", baseline_zero_test_metrics))
    print()
    print(format_metric_block("Naive Persistence Baseline (Previous Delta)", baseline_previous_test_metrics))
    
    return artifact


def build_argument_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Train an honest historical CNN-LSTM-GCN backtest with separated spatial domains."
    )
    parser.add_argument("--dataset", default=str(DEFAULT_DATASET), help="Path to the historical dataset CSV.")
    parser.add_argument("--output-dir", default=str(ML_OUTPUT_DIR), help="Directory for outputs.")
    parser.add_argument("--sequence-length", type=int, default=DEFAULT_SEQUENCE_LENGTH)
    parser.add_argument("--neighbors", type=int, default=DEFAULT_NEIGHBORS)
    parser.add_argument("--epochs", type=int, default=DEFAULT_EPOCHS)
    parser.add_argument("--patience", type=int, default=DEFAULT_PATIENCE)
    parser.add_argument("--random-state", type=int, default=DEFAULT_RANDOM_STATE)
    parser.add_argument("--val-size", type=float, default=DEFAULT_VAL_SIZE)
    parser.add_argument("--test-size", type=float, default=DEFAULT_TEST_SIZE)
    parser.add_argument("--learning-rate", type=float, default=0.001)
    parser.add_argument("--weight-decay", type=float, default=1e-4)
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