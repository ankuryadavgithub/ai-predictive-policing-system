from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import redis
from pymongo import MongoClient

DATABASE_URL = "postgresql://postgres:postgres123123@localhost:5432/crime_db"

engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

# ✅ REQUIRED FOR SQLALCHEMY MODELS
Base = declarative_base()

# Redis (optional caching)
redis_client = redis.Redis(
    host="localhost",
    port=6379,
    decode_responses=True
)

# MongoDB (optional for media storage)
mongo_client = MongoClient("mongodb://localhost:27017")
mongo_db = mongo_client["crime_db"]