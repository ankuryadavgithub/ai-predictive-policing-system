from pydantic import BaseModel
from typing import Optional, List


# --------------------------------
# User Schemas (for future auth)
# --------------------------------
class UserCreate(BaseModel):
    username: str
    password: str
    role: str  # admin / police


class UserResponse(BaseModel):
    id: int
    username: str
    role: str

    class Config:
        from_attributes = True


# --------------------------------
# Crime Schemas
# --------------------------------
class CrimeBase(BaseModel):
    state: str
    district: str
    city: str
    latitude: float
    longitude: float
    year: int
    crime_type: str
    crime_count: int


class CrimeCreate(CrimeBase):
    pass


class CrimeResponse(CrimeBase):
    id: int

    class Config:
        from_attributes = True


# --------------------------------
# Forecast Schemas
# --------------------------------
class ForecastRequest(BaseModel):
    state: str
    district: str
    year: int


class ForecastResponse(BaseModel):
    state: str
    district: str
    year: int
    predicted_crime_count: float


# --------------------------------
# Crime Report Schemas
# --------------------------------
class ReportCreate(BaseModel):
    crime_type: str
    severity: str
    description: str
    latitude: float
    longitude: float
    evidence: Optional[List[str]] = None


class ReportResponse(BaseModel):
    id: int
    report_id: str
    crime_type: str
    severity: str
    description: str
    latitude: float
    longitude: float
    status: str
    created_at: Optional[str]

    class Config:
        from_attributes = True