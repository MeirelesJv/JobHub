from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, field_validator


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
    onboarding_completed: Optional[bool] = None


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class AccessTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
