from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


RoleType = Literal["citizen", "police", "admin"]
RecordType = Literal["historical", "predicted", "all"]


class RegisterRequest(BaseModel):
    full_name: str = Field(alias="fullName", min_length=3, max_length=255)
    username: str = Field(min_length=3, max_length=100)
    email: EmailStr
    phone: str | None = Field(default=None, max_length=20)
    password: str = Field(min_length=8, max_length=128)
    role: RoleType
    city: str | None = None
    address: str | None = None
    aadhaar: str | None = None
    gps_permission: bool = Field(default=False, alias="gpsPermission")
    badge_id: str | None = Field(default=None, alias="badgeId")
    rank: str | None = None
    station: str | None = None
    district: str | None = None
    department: str | None = None
    auth_code: str | None = Field(default=None, alias="authCode")
    confirm_password: str | None = Field(default=None, alias="confirmPassword")

    model_config = ConfigDict(populate_by_name=True)

    @field_validator("username")
    @classmethod
    def validate_username(cls, value: str) -> str:
        return value.strip()


class LoginRequest(BaseModel):
    username: str = Field(min_length=3, max_length=100)
    password: str = Field(min_length=8, max_length=128)


class UserSummary(BaseModel):
    id: int
    full_name: str
    username: str
    email: EmailStr
    phone: str | None
    role: str
    status: str
    city: str | None
    district: str | None
    station: str | None
    department: str | None

    model_config = ConfigDict(from_attributes=True)


class AuthUserResponse(UserSummary):
    created_at: datetime


class CrimeBase(BaseModel):
    state: str
    district: str
    city: str
    latitude: float
    longitude: float
    year: int
    crime_type: str
    crime_count: int
    record_type: Literal["historical", "predicted"] = "historical"
    prediction_batch: str | None = None


class CrimeCreate(CrimeBase):
    pass


class CrimeResponse(CrimeBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class ForecastResponse(BaseModel):
    city: str
    predicted_crimes: dict[str, int]
    crime_risk_index: float
    record_type: str = "predicted"


class ReportUpdateRequest(BaseModel):
    status: Literal["Submitted", "Triaged", "Assigned", "Verified", "Rejected", "Resolved"]
    verification_notes: str | None = None


class EvidenceResponse(BaseModel):
    id: int
    file_type: str
    original_file_name: str
    uploaded_at: datetime
    access_count: int
    access_url: str

    model_config = ConfigDict(from_attributes=True)


class ReportResponse(BaseModel):
    id: int
    report_id: str
    crime_type: str
    severity: str
    description: str
    latitude: float
    longitude: float
    city: str | None
    state: str | None
    status: str
    assigned_station: str | None
    assigned_district: str | None
    verification_notes: str | None
    created_at: datetime
    updated_at: datetime
    evidence: list[EvidenceResponse]

    model_config = ConfigDict(from_attributes=True)
