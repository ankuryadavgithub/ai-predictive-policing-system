from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    Index,
)
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(255), nullable=False)
    username = Column(String(100), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    phone = Column(String(20))
    address = Column(Text)
    government_id = Column(String(100))
    gps_consent = Column(Boolean, default=False)

    password_hash = Column(String(255), nullable=False)
    role = Column(String(30), nullable=False, index=True)
    status = Column(String(30), default="approved", nullable=False, index=True)

    badge_id = Column(String(100))
    rank = Column(String(100))
    station = Column(String(255))
    district = Column(String(255))
    city = Column(String(255))
    department = Column(String(255))

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    reports = relationship("CrimeReport", back_populates="reporter", foreign_keys="CrimeReport.reporter_user_id")
    reviewed_reports = relationship("CrimeReport", foreign_keys="CrimeReport.reviewed_by")


class Crime(Base):
    __tablename__ = "crimes"

    id = Column(Integer, primary_key=True, index=True)
    state = Column(String(255), index=True)
    district = Column(String(255), index=True)
    city = Column(String(255), index=True)
    latitude = Column(Float)
    longitude = Column(Float)
    year = Column(Integer, index=True)
    crime_type = Column(String(255), index=True)
    crime_count = Column(Integer)
    record_type = Column(String(20), default="historical", nullable=False, index=True)
    prediction_batch = Column(String(100), nullable=True)
    ingested_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("ix_crimes_state_city_year_type_record", "state", "city", "year", "crime_type", "record_type"),
    )


class Prediction(Base):
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True, index=True)
    state = Column(String(255))
    district = Column(String(255))
    year = Column(Integer)
    predicted_crime_count = Column(Float)


class CrimeReport(Base):
    __tablename__ = "crime_reports"

    id = Column(Integer, primary_key=True, index=True)
    report_id = Column(String(20), unique=True, nullable=False, index=True)

    reporter_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    crime_type = Column(String(255), nullable=False)
    severity = Column(String(30), nullable=False)
    description = Column(Text, nullable=False)

    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    city = Column(String(255))
    state = Column(String(255))

    status = Column(String(30), default="Submitted", nullable=False, index=True)
    verification_notes = Column(Text)
    assigned_station = Column(String(255))
    assigned_district = Column(String(255))
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    reviewed_at = Column(DateTime(timezone=True))

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    reporter = relationship("User", back_populates="reports", foreign_keys=[reporter_user_id])
    evidence = relationship("EvidenceFile", back_populates="report", cascade="all, delete-orphan")


class EvidenceFile(Base):
    __tablename__ = "evidence_files"

    id = Column(Integer, primary_key=True, index=True)
    report_id = Column(Integer, ForeignKey("crime_reports.id"), nullable=False, index=True)

    original_file_name = Column(String(255), nullable=False)
    stored_file_name = Column(String(255), nullable=False, unique=True)
    file_path = Column(String(500), nullable=False)
    file_type = Column(String(50), nullable=False)
    content_type = Column(String(100), nullable=False)
    file_size = Column(Integer, nullable=False)
    is_archived = Column(Boolean, default=False, nullable=False)
    access_count = Column(Integer, default=0, nullable=False)
    last_accessed_at = Column(DateTime(timezone=True))
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    report = relationship("CrimeReport", back_populates="evidence")
