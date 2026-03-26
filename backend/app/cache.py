import json
from typing import Any

from app.audit import logger
from app.database import redis_client


def _safe_redis():
    if redis_client is None:
        return None
    return redis_client


def get_cache(key: str) -> Any | None:
    client = _safe_redis()
    if client is None:
        return None

    try:
        value = client.get(key)
        if value is None:
            return None
        return json.loads(value)
    except Exception as exc:
        logger.warning("Redis cache get failed for key=%s: %s", key, exc)
        return None


def set_cache(key: str, value: Any, ttl_seconds: int) -> None:
    client = _safe_redis()
    if client is None:
        return

    try:
        client.setex(key, ttl_seconds, json.dumps(value, default=str))
    except Exception as exc:
        logger.warning("Redis cache set failed for key=%s: %s", key, exc)


def delete_cache(key: str) -> None:
    client = _safe_redis()
    if client is None:
        return

    try:
        client.delete(key)
    except Exception as exc:
        logger.warning("Redis cache delete failed for key=%s: %s", key, exc)
