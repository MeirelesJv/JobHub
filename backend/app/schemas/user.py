from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.job import JobPlatform


def validate_platform_list(v: list[str] | None) -> list[str] | None:
    if v is None:
        return None
    valid = {p.value for p in JobPlatform}
    invalid = set(v) - valid
    if invalid:
        raise ValueError(f"Plataformas inválidas: {', '.join(sorted(invalid))}")
    seen: set[str] = set()
    return [p for p in v if not (p in seen or seen.add(p))]


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
    remote_preference: bool
    blocked_companies: list[str] = Field(default_factory=list)
    enabled_platforms: list[str] = Field(default_factory=list)
    auto_sync_platforms: list[str] = Field(default_factory=list)
    sync_interval_minutes: int
    search_lookback_days: int
    onboarding_completed: bool
    created_at: datetime


class UserProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    desired_role: Optional[str] = None
    location_preference: Optional[str] = None
    job_type_preference: Optional[str] = None
    remote_preference: Optional[bool] = None
    blocked_companies: Optional[list[str]] = None
    enabled_platforms: Optional[list[str]] = None
    auto_sync_platforms: Optional[list[str]] = None
    sync_interval_minutes: Optional[int] = None
    search_lookback_days: Optional[int] = None
    onboarding_completed: Optional[bool] = None

    @field_validator("blocked_companies")
    @classmethod
    def clean_blocked_companies(cls, v: list[str] | None) -> list[str] | None:
        if v is None:
            return None
        return normalize_company_list(v)

    @field_validator("enabled_platforms")
    @classmethod
    def validate_enabled_platforms(cls, v: list[str] | None) -> list[str] | None:
        return validate_platform_list(v)

    @field_validator("auto_sync_platforms")
    @classmethod
    def validate_auto_sync_platforms(cls, v: list[str] | None) -> list[str] | None:
        return validate_platform_list(v)

    @field_validator("sync_interval_minutes")
    @classmethod
    def validate_sync_interval_minutes(cls, v: int | None) -> int | None:
        if v is None:
            return None
        allowed = {10, 30, 60, 120}
        if v not in allowed:
            raise ValueError(f"Intervalo inválido: {v}. Use um de {sorted(allowed)}")
        return v

    @field_validator("search_lookback_days")
    @classmethod
    def validate_search_lookback_days(cls, v: int | None) -> int | None:
        if v is None:
            return None
        allowed = {7, 15, 30}
        if v not in allowed:
            raise ValueError(f"Limite de busca inválido: {v}. Use um de {sorted(allowed)}")
        return v
