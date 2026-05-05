from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.database import get_db
from app.models.user import User
from app.schemas.resume import (
    ResumeEducationCreate,
    ResumeExperienceCreate,
    ResumeLanguageCreate,
    ResumeResponse,
    ResumeSkillCreate,
    ResumeUpdate,
)
from app.services import resume_service

router = APIRouter()


@router.get("", response_model=ResumeResponse)
def get_resume(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    resume = resume_service.get_or_create(db, current_user.id)
    data = ResumeResponse.model_validate(resume)
    return data.model_copy(update={
        "full_name":           current_user.full_name,
        "location_preference": current_user.location_preference,
        "desired_role":        current_user.desired_role,
    })


@router.patch("", response_model=ResumeResponse)
def update_resume(
    data: ResumeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return resume_service.update_resume(db, current_user.id, data)


# ─── experiences ─────────────────────────────────────────────────────────────

@router.post("/experiences", response_model=ResumeResponse, status_code=201)
def add_experience(
    data: ResumeExperienceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return resume_service.add_experience(db, current_user.id, data)


@router.put("/experiences/{exp_id}", response_model=ResumeResponse)
def update_experience(
    exp_id: int,
    data: ResumeExperienceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return resume_service.update_experience(db, current_user.id, exp_id, data)


@router.delete("/experiences/{exp_id}", response_model=ResumeResponse)
def delete_experience(
    exp_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return resume_service.delete_experience(db, current_user.id, exp_id)


# ─── educations ──────────────────────────────────────────────────────────────

@router.post("/educations", response_model=ResumeResponse, status_code=201)
def add_education(
    data: ResumeEducationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return resume_service.add_education(db, current_user.id, data)


@router.put("/educations/{edu_id}", response_model=ResumeResponse)
def update_education(
    edu_id: int,
    data: ResumeEducationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return resume_service.update_education(db, current_user.id, edu_id, data)


@router.delete("/educations/{edu_id}", response_model=ResumeResponse)
def delete_education(
    edu_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return resume_service.delete_education(db, current_user.id, edu_id)


# ─── skills ──────────────────────────────────────────────────────────────────

@router.post("/skills", response_model=ResumeResponse, status_code=201)
def add_skill(
    data: ResumeSkillCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return resume_service.add_skill(db, current_user.id, data)


@router.delete("/skills/{skill_id}", response_model=ResumeResponse)
def delete_skill(
    skill_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return resume_service.delete_skill(db, current_user.id, skill_id)


# ─── languages ───────────────────────────────────────────────────────────────

@router.post("/languages", response_model=ResumeResponse, status_code=201)
def add_language(
    data: ResumeLanguageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return resume_service.add_language(db, current_user.id, data)


@router.delete("/languages/{lang_id}", response_model=ResumeResponse)
def delete_language(
    lang_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return resume_service.delete_language(db, current_user.id, lang_id)
