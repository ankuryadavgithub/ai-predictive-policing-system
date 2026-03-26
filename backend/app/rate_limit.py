from fastapi import HTTPException

from app.audit import logger
from app.database import redis_client


def enforce_rate_limit(key: str, limit: int, window_seconds: int) -> None:
    if redis_client is None:
        return

    try:
        current = redis_client.incr(key)
        if current == 1:
            redis_client.expire(key, window_seconds)

        if current > limit:
            raise HTTPException(
                status_code=429,
                detail="Too many requests. Please try again later.",
            )
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("Rate limiter unavailable for key=%s: %s", key, exc)
