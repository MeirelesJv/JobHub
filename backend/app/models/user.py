from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.application import Application
    from app.models.desired_role import UserDesiredRole
    from app.models.resume import Resume
    from app.models.sync_log import SyncLog


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[Optional[str]] = mapped_column(String(50))
    location: Mapped[Optional[str]] = mapped_column(String(255))

    # Profile / onboarding fields
    desired_role: Mapped[Optional[str]] = mapped_column(String(255))
    location_preference: Mapped[Optional[str]] = mapped_column(String(255))
    job_type_preference: Mapped[Optional[str]] = mapped_column(String(50))
    level_preference: Mapped[Optional[str]] = mapped_column(String(50))
    remote_preference: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    salary_expectation_min: Mapped[Optional[int]] = mapped_column(Integer)
    onboarding_completed: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    resumes: Mapped[list[Resume]] = relationship(back_populates="user")
    applications: Mapped[list[Application]] = relationship(back_populates="user")
    sync_logs: Mapped[list[SyncLog]] = relationship(back_populates="user")
    desired_roles: Mapped[list[UserDesiredRole]] = relationship(
        back_populates="user", cascade="all, delete-orphan", order_by="UserDesiredRole.order"
    )
