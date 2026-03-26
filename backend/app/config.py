import os
from pathlib import Path


def _as_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


BASE_DIR = Path(__file__).resolve().parent.parent
UPLOADS_DIR = Path(os.getenv("UPLOADS_DIR", BASE_DIR / "uploads")).resolve()


class Settings:
    app_name = os.getenv("APP_NAME", "AI Based Predictive Policing System")
    app_version = os.getenv("APP_VERSION", "1.1.0")
    environment = os.getenv("ENVIRONMENT", "development")

    database_url = os.getenv(
        "DATABASE_URL",
        "postgresql://postgres:postgres123123@localhost:5432/crime_db",
    )
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    mongo_url = os.getenv("MONGO_URL", "mongodb://localhost:27017")
    mongo_db_name = os.getenv("MONGO_DB_NAME", "crime_db")

    secret_key = os.getenv("SECRET_KEY", "change-me-in-production")
    jwt_algorithm = os.getenv("JWT_ALGORITHM", "HS256")
    access_token_expire_minutes = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

    access_cookie_name = os.getenv("ACCESS_COOKIE_NAME", "pps_access_token")
    cookie_secure = _as_bool(os.getenv("COOKIE_SECURE"), default=False)
    cookie_samesite = os.getenv("COOKIE_SAMESITE", "lax")

    allowed_origins = [
        origin.strip()
        for origin in os.getenv(
            "ALLOWED_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173",
        ).split(",")
        if origin.strip()
    ]

    allow_admin_registration = _as_bool(
        os.getenv("ALLOW_ADMIN_REGISTRATION"),
        default=False,
    )
    admin_registration_code = os.getenv("ADMIN_REGISTRATION_CODE", "")

    max_evidence_files = int(os.getenv("MAX_EVIDENCE_FILES", "5"))
    max_upload_size_bytes = int(os.getenv("MAX_UPLOAD_SIZE_BYTES", str(10 * 1024 * 1024)))

    redis_cache_ttl_seconds = int(os.getenv("REDIS_CACHE_TTL_SECONDS", "120"))
    rate_limit_window_seconds = int(os.getenv("RATE_LIMIT_WINDOW_SECONDS", "300"))
    login_rate_limit = int(os.getenv("LOGIN_RATE_LIMIT", "10"))
    registration_rate_limit = int(os.getenv("REGISTRATION_RATE_LIMIT", "5"))
    report_rate_limit = int(os.getenv("REPORT_RATE_LIMIT", "10"))


settings = Settings()
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
