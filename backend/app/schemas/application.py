from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.models.application import ApplicationMode, ApplicationStatus
from app.models.job import JobLevel, JobPlatform, JobType


class ApplicationCreate(BaseModel):
    job_id: int
    mode: ApplicationMode
    notes: Optional[str] = None


class ApplicationUpdate(BaseModel):
    status: Optional[ApplicationStatus] = None
    notes: Optional[str] = None


class StatusUpdate(BaseModel):
    status: ApplicationStatus


class JobSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    company: str
    platform: JobPlatform
    url: str
    job_type: Optional[JobType]
    level: Optional[JobLevel]
    location: Optional[str]
    remote: bool


class ApplicationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    job_id: int
    status: ApplicationStatus
    mode: ApplicationMode
    applied_at: datetime
    updated_at: datetime
    notes: Optional[str]
    job: JobSummary


class KanbanResponse(BaseModel):
    applied: list[ApplicationResponse]
    in_review: list[ApplicationResponse]
    interview: list[ApplicationResponse]
    offer: list[ApplicationResponse]
    rejected: list[ApplicationResponse]
    cancelled: list[ApplicationResponse]


class ApplicationStats(BaseModel):
    total: int
    applied: int
    in_review: int
    interview: int
    offer: int
    rejected: int
    cancelled: int
