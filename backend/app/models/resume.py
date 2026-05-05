from __future__ import annotations

from datetime import date, datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class Resume(Base):
    __tablename__ = "resumes"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    summary: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped[User] = relationship(back_populates="resumes")
    experiences: Mapped[list[ResumeExperience]] = relationship(
        back_populates="resume", cascade="all, delete-orphan", order_by="ResumeExperience.order"
    )
    educations: Mapped[list[ResumeEducation]] = relationship(
        back_populates="resume", cascade="all, delete-orphan", order_by="ResumeEducation.order"
    )
    skills: Mapped[list[ResumeSkill]] = relationship(
        back_populates="resume", cascade="all, delete-orphan", order_by="ResumeSkill.order"
    )
    languages: Mapped[list[ResumeLanguage]] = relationship(
        back_populates="resume", cascade="all, delete-orphan", order_by="ResumeLanguage.order"
    )


class ResumeExperience(Base):
    __tablename__ = "resume_experiences"

    id: Mapped[int] = mapped_column(primary_key=True)
    resume_id: Mapped[int] = mapped_column(ForeignKey("resumes.id", ondelete="CASCADE"))
    company: Mapped[str] = mapped_column(String(255), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    location: Mapped[Optional[str]] = mapped_column(String(255))
    start_date: Mapped[Optional[date]] = mapped_column(Date)
    end_date: Mapped[Optional[date]] = mapped_column(Date)
    is_current: Mapped[bool] = mapped_column(Boolean, default=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    order: Mapped[int] = mapped_column(Integer, default=0)

    resume: Mapped[Resume] = relationship(back_populates="experiences")


class ResumeEducation(Base):
    __tablename__ = "resume_educations"

    id: Mapped[int] = mapped_column(primary_key=True)
    resume_id: Mapped[int] = mapped_column(ForeignKey("resumes.id", ondelete="CASCADE"))
    institution: Mapped[str] = mapped_column(String(255), nullable=False)
    degree: Mapped[Optional[str]] = mapped_column(String(255))
    field_of_study: Mapped[Optional[str]] = mapped_column(String(255))
    start_date: Mapped[Optional[date]] = mapped_column(Date)
    end_date: Mapped[Optional[date]] = mapped_column(Date)
    is_current: Mapped[bool] = mapped_column(Boolean, default=False)
    order: Mapped[int] = mapped_column(Integer, default=0)

    resume: Mapped[Resume] = relationship(back_populates="educations")


class ResumeSkill(Base):
    __tablename__ = "resume_skills"

    id: Mapped[int] = mapped_column(primary_key=True)
    resume_id: Mapped[int] = mapped_column(ForeignKey("resumes.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    # basic, intermediate, advanced, expert
    level: Mapped[Optional[str]] = mapped_column(String(50))
    order: Mapped[int] = mapped_column(Integer, default=0)

    resume: Mapped[Resume] = relationship(back_populates="skills")


class ResumeLanguage(Base):
    __tablename__ = "resume_languages"

    id: Mapped[int] = mapped_column(primary_key=True)
    resume_id: Mapped[int] = mapped_column(ForeignKey("resumes.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    # basic, intermediate, advanced, fluent, native
    proficiency: Mapped[str] = mapped_column(String(50), nullable=False)
    order: Mapped[int] = mapped_column(Integer, default=0)

    resume: Mapped[Resume] = relationship(back_populates="languages")
