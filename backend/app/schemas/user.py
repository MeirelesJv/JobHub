from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


def normalize_company_list(values: list[str] | None) -> list[str]:
    if not values:
        return []

    normalized: list[str] = []
    seen: set[str] = set()
    for value in values:
        company = " ".join(value.strip().split())
        key = company.casefold()
        if company and key not in seen:
            normalized.append(company)
            seen.add(key)
    return normalized


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("A senha deve ter no mínimo 8 caracteres")
        return v


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    full_name: str
    phone: Optional[str]
    location: Optional[str]
    desired_role: Optional[str]
    location_preference: Optional[str]
    job_type_preference: Optional[str]
    level_preference: Optional[str]
    remote_preference: bool
    salary_expectation_min: Optional[int]
    blocked_companies: list[str] = Field(default_factory=list)
    onboarding_completed: bool
    created_at: datetime


class UserProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    desired_role: Optional[str] = None
    location_preference: Optional[str] = None
    job_type_preference: Optional[str] = None
    level_preference: Optional[str] = None
    remote_preference: Optional[bool] = None
    salary_expectation_min: Optional[int] = None
    blocked_companies: Optional[list[str]] = None
    onboarding_completed: Optional[bool] = None

    @field_validator("blocked_companies")
    @classmethod
    def clean_blocked_companies(cls, v: list[str] | None) -> list[str] | None:
        if v is None:
            return None
        return normalize_company_list(v)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class AccessTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
