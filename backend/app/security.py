import re
import uuid
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import settings
from app.database import redis_client


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
PASSWORD_PATTERN = re.compile(r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$")


def validate_password_strength(password: str) -> bool:
    return bool(PASSWORD_PATTERN.match(password))


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    return pwd_context.verify(password, hashed)


def create_access_token(data: dict) -> tuple[str, str, datetime]:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.access_token_expire_minutes
    )
    token_id = str(uuid.uuid4())
    to_encode.update({"exp": expire, "jti": token_id})

    encoded_jwt = jwt.encode(
        to_encode,
        settings.secret_key,
        algorithm=settings.jwt_algorithm,
    )

    return encoded_jwt, token_id, expire


def revoke_token(token_id: str, expires_at: datetime | int | float) -> None:
    if redis_client is None:
        return

    if isinstance(expires_at, (int, float)):
        expires_at = datetime.fromtimestamp(expires_at, tz=timezone.utc)

    ttl = max(int((expires_at - datetime.now(timezone.utc)).total_seconds()), 0)
    if ttl <= 0:
        return

    redis_client.setex(f"revoked_token:{token_id}", ttl, "1")


def is_token_revoked(token_id: str | None) -> bool:
    if redis_client is None or not token_id:
        return False
    return bool(redis_client.exists(f"revoked_token:{token_id}"))


def verify_token(token: str):
    try:
        payload = jwt.decode(
            token,
            settings.secret_key,
            algorithms=[settings.jwt_algorithm],
        )
        if is_token_revoked(payload.get("jti")):
            return None
        return payload
    except JWTError:
        return None
