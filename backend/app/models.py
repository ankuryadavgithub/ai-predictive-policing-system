from sqlalchemy import Column, Integer, String, Float, Text, TIMESTAMP, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base

# ------------------------------
# Users Table (for auth later)
# ------------------------------
class User(Base):

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)

    full_name = Column(String)
    username = Column(String, unique=True)
    email = Column(String, unique=True)
    phone = Column(String)

    password_hash = Column(String)

    role = Column(String)

    status = Column(String, default="approved")
    
    badge_id = Column(String)
    rank = Column(String)
    station = Column(String)
    district = Column(String)

    city = Column(String)

    department = Column(String)


# ------------------------------
# Historical Crimes Table
# ------------------------------
class Crime(Base):
    __tablename__ = "crimes"

    id = Column(Integer, primary_key=True, index=True)
    state = Column(String)
    district = Column(String)
    city = Column(String)
    latitude = Column(Float)
    longitude = Column(Float)
    year = Column(Integer)
    crime_type = Column(String)
    crime_count = Column(Integer)


# ------------------------------
# Forecast Table (Future Use)
# ------------------------------
class Prediction(Base):
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True, index=True)
    state = Column(String)
    district = Column(String)
    year = Column(Integer)
    predicted_crime_count = Column(Float)


# ------------------------------
# Crime Report Table
# ------------------------------
class CrimeReport(Base):
    __tablename__ = "crime_reports"

    id = Column(Integer, primary_key=True, index=True)
    report_id = Column(String, unique=True)

    crime_type = Column(String)
    severity = Column(String)
    description = Column(Text)

    latitude = Column(Float)
    longitude = Column(Float)

    status = Column(String, default="Pending")
    created_at = Column(TIMESTAMP, server_default=func.now())

    evidence = relationship("EvidenceFile", back_populates="report")

class EvidenceFile(Base):
    __tablename__ = "evidence_files"

    id = Column(Integer, primary_key=True, index=True)

    report_id = Column(Integer, ForeignKey("crime_reports.id"))

    file_path = Column(String)
    file_type = Column(String)

    report = relationship("CrimeReport", back_populates="evidence")