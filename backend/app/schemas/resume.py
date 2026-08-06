from datetime import date
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


# ─── Experience ──────────────────────────────────────────────────────────────

class ResumeExperienceBase(BaseModel):
    title: str                      # cargo
    company: str
    location: Optional[str] = None
    description: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    is_current: bool = False
    keywords: list[str] = Field(default_factory=list)


class ResumeExperienceCreate(ResumeExperienceBase):
    pass


class ResumeExperienceResponse(ResumeExperienceBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


# ─── Education ───────────────────────────────────────────────────────────────

EDUCATION_TYPES = ("graduacao", "pos", "tecnico", "curso", "certificado", "outro")
EDUCATION_STATUS = ("concluido", "cursando", "trancado")


class ResumeEducationBase(BaseModel):
    institution: Optional[str] = None
    degree: Optional[str] = None            # grau (ex: Bacharelado)
    field_of_study: Optional[str] = None    # área/formação (ex: Ciência da Computação)
    education_type: str = "graduacao"       # graduacao | pos | tecnico | curso | certificado | outro
    status: str = "concluido"               # concluido | cursando | trancado
    expected_completion_date: Optional[date] = None   # usado quando status == cursando
    start_date: Optional[date] = None
    end_date: Optional[date] = None


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

GENDER_OPTIONS = ("feminino", "masculino", "nao_binario", "prefiro_nao_informar")


class ResumeUpdate(BaseModel):
    title: Optional[str] = None
    summary: Optional[str] = None
    gender: Optional[str] = None
    is_pcd: Optional[bool] = None
    extra_keywords: Optional[list[str]] = None


class ResumeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    summary: Optional[str]
    gender: Optional[str] = None
    is_pcd: bool = False
    extra_keywords: list[str] = Field(default_factory=list)
    # User profile fields — injected by GET /api/resume, None on all other endpoints
    full_name: Optional[str] = None
    location_preference: Optional[str] = None
    desired_role: Optional[str] = None
    experiences: list[ResumeExperienceResponse]
    educations: list[ResumeEducationResponse]
    skills: list[ResumeSkillResponse]
    languages: list[ResumeLanguageResponse]
