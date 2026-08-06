from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.models.application import ApplicationMode, ApplicationStatus
from app.models.job import JobLevel, JobPlatform, JobType


class ApplicationCreate(BaseModel):
    job_id: int
    mode: ApplicationMode
    notes: Optional[str] = None


class ManualApplicationCreate(BaseModel):
    """Registers a job the user found and applied to outside the platform's own
    collectors (e.g. a listing shared by a friend, or from a site we don't scrape) —
    creates the Job and the Application together in one step."""
    title: str
    company: str
    url: str
    location: Optional[str] = None
    job_type: Optional[JobType] = None
    level: Optional[JobLevel] = None
    remote: bool = False
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
