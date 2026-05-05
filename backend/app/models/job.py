from __future__ import annotations

import enum
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, DateTime, Enum, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.application import Application


class JobPlatform(str, enum.Enum):
    LINKEDIN = "linkedin"
    GUPY = "gupy"
    VAGAS = "vagas"
    CATHO = "catho"
    INFOJOBS = "infojobs"


class JobType(str, enum.Enum):
    CLT = "clt"
    PJ = "pj"
    FREELANCE = "freelance"


class JobLevel(str, enum.Enum):
    JUNIOR = "junior"
    PLENO = "pleno"
    SENIOR = "senior"


class Job(Base):
    __tablename__ = "jobs"
    __table_args__ = (
        UniqueConstraint("platform", "external_id", name="uq_jobs_platform_external_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    external_id: Mapped[str] = mapped_column(String(255), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    company: Mapped[str] = mapped_column(String(255), nullable=False)
    location: Mapped[Optional[str]] = mapped_column(String(255))
    description: Mapped[Optional[str]] = mapped_column(Text)
    salary_min: Mapped[Optional[float]] = mapped_column(Numeric(12, 2))
    salary_max: Mapped[Optional[float]] = mapped_column(Numeric(12, 2))
    job_type: Mapped[Optional[JobType]] = mapped_column(
        Enum(JobType, values_callable=lambda x: [e.value for e in x])
    )
    level: Mapped[Optional[JobLevel]] = mapped_column(
        Enum(JobLevel, values_callable=lambda x: [e.value for e in x])
    )
    remote: Mapped[bool] = mapped_column(Boolean, default=False)
    easy_apply: Mapped[bool] = mapped_column(Boolean, default=False)
    platform: Mapped[JobPlatform] = mapped_column(
        Enum(JobPlatform, values_callable=lambda x: [e.value for e in x]), nullable=False
    )
    url: Mapped[str] = mapped_column(String(2048), nullable=False)
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    last_seen_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    applications: Mapped[list[Application]] = relationship(back_populates="job")
