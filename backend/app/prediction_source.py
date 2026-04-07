from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import and_, or_
from sqlalchemy.orm import Query, Session

from app import models


PRODUCTION_BASELINE_BATCH_PREFIX = "baseline_prod_"
MODEL_PREDICTION_BATCH_PREFIX = "cnn_lstm_gcn_"


@dataclass(frozen=True)
class PredictionSource:
    source: str | None
    prediction_batch: str | None


def resolve_effective_record_type(year: int | None, record_type: str) -> str:
    if record_type != "all":
        return record_type
    if year is None:
        return "all"
    return "historical" if year <= 2025 else "predicted"


def _select_latest_batch_with_prefix(prediction_batches: list[str | None], prefix: str) -> str | None:
    matching_batches = sorted(
        batch
        for batch in prediction_batches
        if batch and batch.startswith(prefix)
    )
    return matching_batches[-1] if matching_batches else None


def select_latest_model_batch(prediction_batches: list[str | None]) -> str | None:
    return _select_latest_batch_with_prefix(prediction_batches, MODEL_PREDICTION_BATCH_PREFIX)


def select_latest_baseline_batch(prediction_batches: list[str | None]) -> str | None:
    return _select_latest_batch_with_prefix(prediction_batches, PRODUCTION_BASELINE_BATCH_PREFIX)


def resolve_prediction_source(db: Session) -> PredictionSource:
    prediction_batches = [
        row[0]
        for row in (
            db.query(models.Crime.prediction_batch)
            .filter(models.Crime.record_type == "predicted")
            .distinct()
            .all()
        )
    ]

    latest_baseline_batch = select_latest_baseline_batch(prediction_batches)
    if latest_baseline_batch:
        return PredictionSource(
            source="baseline_production",
            prediction_batch=latest_baseline_batch,
        )

    latest_model_batch = select_latest_model_batch(prediction_batches)
    if latest_model_batch:
        return PredictionSource(
            source="model_experimental",
            prediction_batch=latest_model_batch,
        )

    has_legacy_predictions = db.query(models.Crime.id).filter(
        models.Crime.record_type == "predicted"
    ).first()
    if has_legacy_predictions:
        return PredictionSource(
            source="db_fallback",
            prediction_batch=None,
        )

    return PredictionSource(source=None, prediction_batch=None)


def apply_prediction_source_filter(query: Query, db: Session) -> Query:
    source = resolve_prediction_source(db)
    if source.prediction_batch:
        query = query.filter(models.Crime.prediction_batch == source.prediction_batch)
    return query


def apply_record_scope_filter(query: Query, db: Session, year: int | None, record_type: str) -> Query:
    resolved_record_type = resolve_effective_record_type(year, record_type)
    if resolved_record_type == "historical":
        return query.filter(models.Crime.record_type == "historical")

    if resolved_record_type == "predicted":
        query = query.filter(models.Crime.record_type == "predicted")
        return apply_prediction_source_filter(query, db)

    source = resolve_prediction_source(db)
    if source.prediction_batch:
        return query.filter(
            or_(
                models.Crime.record_type == "historical",
                and_(
                    models.Crime.record_type == "predicted",
                    models.Crime.prediction_batch == source.prediction_batch,
                ),
            )
        )

    return query
