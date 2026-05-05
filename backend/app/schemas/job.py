from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.models.job import JobLevel, JobPlatform, JobType


class JobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    external_id: str
    title: str
    company: str
    location: Optional[str]
    description: Optional[str]
    salary_min: Optional[Decimal]
    salary_max: Optional[Decimal]
    job_type: Optional[JobType]
    level: Optional[JobLevel]
    remote: bool
    easy_apply: bool
    platform: JobPlatform
    url: str
    published_at: Optional[datetime]
    expires_at: Optional[datetime]
    is_active: bool
    created_at: datetime


class JobListResponse(BaseModel):
    items: list[JobResponse]
    total: int
    page: int
    page_size: int


class JobFilters(BaseModel):
    query: Optional[str] = None
    location: Optional[str] = None
    job_type: Optional[JobType] = None
    level: Optional[JobLevel] = None
    remote: Optional[bool] = None
    platform: Optional[JobPlatform] = None
    salary_min: Optional[float] = None
    salary_max: Optional[float] = None
