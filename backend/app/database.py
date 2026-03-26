from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.audit import logger
from app.config import settings

try:
    import redis
except ImportError:  # pragma: no cover
    redis = None

try:
    from pymongo import MongoClient
except ImportError:  # pragma: no cover
    MongoClient = None


engine = create_engine(settings.database_url, pool_pre_ping=True)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

Base = declarative_base()

redis_client = None
if redis is not None:
    try:
        redis_client = redis.from_url(settings.redis_url, decode_responses=True)
        redis_client.ping()
    except Exception as exc:  # pragma: no cover
        logger.warning("Redis unavailable: %s", exc)
        redis_client = None

mongo_client = None
mongo_db = None
if MongoClient is not None:
    try:
        mongo_client = MongoClient(settings.mongo_url, serverSelectionTimeoutMS=1000)
        mongo_db = mongo_client[settings.mongo_db_name]
    except Exception as exc:  # pragma: no cover
        logger.warning("Mongo unavailable: %s", exc)
        mongo_client = None
        mongo_db = None
