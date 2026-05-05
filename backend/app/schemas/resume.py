from datetime import date
from typing import Optional

from pydantic import BaseModel, ConfigDict


# ─── Experience ──────────────────────────────────────────────────────────────

class ResumeExperienceBase(BaseModel):
    title: str                      # cargo
    company: str
    location: Optional[str] = None
    description: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    is_current: bool = False


class ResumeExperienceCreate(ResumeExperienceBase):
    pass


class ResumeExperienceResponse(ResumeExperienceBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


# ─── Education ───────────────────────────────────────────────────────────────

class ResumeEducationBase(BaseModel):
    institution: str
    degree: Optional[str] = None
    field_of_study: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    is_current: bool = False


class ResumeEducationCreate(ResumeEducationBase):
    pass


class ResumeEducationResponse(ResumeEducationBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


# ─── Skill ───────────────────────────────────────────────────────────────────

SKILL_LEVELS = ("beginner", "intermediate", "advanced", "expert")


class ResumeSkillBase(BaseModel):
    name: str
    level: Optional[str] = None     # beginner | intermediate | advanced | expert


class ResumeSkillCreate(ResumeSkillBase):
    pass


class ResumeSkillResponse(ResumeSkillBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


# ─── Language ────────────────────────────────────────────────────────────────

LANGUAGE_LEVELS = ("basic", "intermediate", "advanced", "fluent", "native")


class ResumeLanguageBase(BaseModel):
    name: str
    proficiency: str                # basic | intermediate | advanced | fluent | native


class ResumeLanguageCreate(ResumeLanguageBase):
    pass


class ResumeLanguageResponse(ResumeLanguageBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


# ─── Resume ──────────────────────────────────────────────────────────────────

class ResumeUpdate(BaseModel):
    title: Optional[str] = None
    summary: Optional[str] = None


class ResumeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    summary: Optional[str]
    # User profile fields — injected by GET /api/resume, None on all other endpoints
    full_name: Optional[str] = None
    location_preference: Optional[str] = None
    desired_role: Optional[str] = None
    experiences: list[ResumeExperienceResponse]
    educations: list[ResumeEducationResponse]
    skills: list[ResumeSkillResponse]
    languages: list[ResumeLanguageResponse]
