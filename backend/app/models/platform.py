from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.sync_log import SyncLog


class Platform(Base):
    __tablename__ = "platforms"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    slug: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_sync_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    # Layout-break tracking: flips to False when a collector's parser finds a
    # successful HTTP/API response but none of the structural markers it expects —
    # a strong signal the site's layout/API shape changed, not just "no jobs today".
    is_healthy: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    broken_step: Mapped[Optional[str]] = mapped_column(String(255))
    broken_detail: Mapped[Optional[str]] = mapped_column(Text)
    broken_since: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    sync_logs: Mapped[list[SyncLog]] = relationship(back_populates="platform")
