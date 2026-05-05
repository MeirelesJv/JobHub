from __future__ import annotations

import enum
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, Enum, ForeignKey, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.job import Job
    from app.models.user import User


class ApplicationStatus(str, enum.Enum):
    APPLIED = "applied"
    IN_REVIEW = "in_review"
    INTERVIEW = "interview"
    OFFER = "offer"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class ApplicationMode(str, enum.Enum):
    TURBO = "turbo"
    ASSISTED = "assisted"
    MANUAL = "manual"


class Application(Base):
    __tablename__ = "applications"
    __table_args__ = (
        UniqueConstraint("user_id", "job_id", name="uq_applications_user_job"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id", ondelete="CASCADE"))
    status: Mapped[ApplicationStatus] = mapped_column(
        Enum(ApplicationStatus, values_callable=lambda x: [e.value for e in x]),
        default=ApplicationStatus.APPLIED,
        nullable=False,
    )
    mode: Mapped[ApplicationMode] = mapped_column(
        Enum(ApplicationMode, values_callable=lambda x: [e.value for e in x]), nullable=False
    )
    applied_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    notes: Mapped[Optional[str]] = mapped_column(Text)

    user: Mapped[User] = relationship(back_populates="applications")
    job: Mapped[Job] = relationship(back_populates="applications")
