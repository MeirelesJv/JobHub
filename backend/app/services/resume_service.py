from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from app.models.resume import Resume, ResumeEducation, ResumeExperience, ResumeLanguage, ResumeSkill
from app.schemas.resume import (
    ResumeEducationCreate,
    ResumeExperienceCreate,
    ResumeLanguageCreate,
    ResumeSkillCreate,
    ResumeUpdate,
)


def _load(db: Session, user_id: int) -> Resume:
    return (
        db.query(Resume)
        .options(
            joinedload(Resume.experiences),
            joinedload(Resume.educations),
            joinedload(Resume.skills),
            joinedload(Resume.languages),
        )
        .filter(Resume.user_id == user_id)
        .first()
    )


def get_or_create(db: Session, user_id: int) -> Resume:
    resume = _load(db, user_id)
    if resume is None:
        resume = Resume(user_id=user_id, title="Meu Currículo")
        db.add(resume)
        db.commit()
        resume = _load(db, user_id)
    return resume


def update_resume(db: Session, user_id: int, data: ResumeUpdate) -> Resume:
    resume = get_or_create(db, user_id)
    if data.title is not None:
        resume.title = data.title
    if data.summary is not None:
        resume.summary = data.summary
    db.commit()
    return _load(db, user_id)


# ─── helpers ─────────────────────────────────────────────────────────────────

def _get_item(db: Session, model, item_id: int, resume_id: int, label: str):
    item = db.get(model, item_id)
    if item is None or item.resume_id != resume_id:
        raise HTTPException(status_code=404, detail=f"{label} não encontrado")
    return item


def _next_order(collection) -> int:
    return max((i.order for i in collection), default=-1) + 1


# ─── experiences ─────────────────────────────────────────────────────────────

def add_experience(db: Session, user_id: int, data: ResumeExperienceCreate) -> Resume:
    resume = get_or_create(db, user_id)
    exp = ResumeExperience(
        resume_id=resume.id,
        order=_next_order(resume.experiences),
        **data.model_dump(),
    )
    db.add(exp)
    db.commit()
    return _load(db, user_id)


def update_experience(db: Session, user_id: int, exp_id: int, data: ResumeExperienceCreate) -> Resume:
    resume = get_or_create(db, user_id)
    exp = _get_item(db, ResumeExperience, exp_id, resume.id, "Experiência")
    for k, v in data.model_dump().items():
        setattr(exp, k, v)
    db.commit()
    return _load(db, user_id)


def delete_experience(db: Session, user_id: int, exp_id: int) -> Resume:
    resume = get_or_create(db, user_id)
    exp = _get_item(db, ResumeExperience, exp_id, resume.id, "Experiência")
    db.delete(exp)
    db.commit()
    return _load(db, user_id)


# ─── educations ──────────────────────────────────────────────────────────────

def add_education(db: Session, user_id: int, data: ResumeEducationCreate) -> Resume:
    resume = get_or_create(db, user_id)
    edu = ResumeEducation(
        resume_id=resume.id,
        order=_next_order(resume.educations),
        **data.model_dump(),
    )
    db.add(edu)
    db.commit()
    return _load(db, user_id)


def update_education(db: Session, user_id: int, edu_id: int, data: ResumeEducationCreate) -> Resume:
    resume = get_or_create(db, user_id)
    edu = _get_item(db, ResumeEducation, edu_id, resume.id, "Formação")
    for k, v in data.model_dump().items():
        setattr(edu, k, v)
    db.commit()
    return _load(db, user_id)


def delete_education(db: Session, user_id: int, edu_id: int) -> Resume:
    resume = get_or_create(db, user_id)
    edu = _get_item(db, ResumeEducation, edu_id, resume.id, "Formação")
    db.delete(edu)
    db.commit()
    return _load(db, user_id)


# ─── skills ──────────────────────────────────────────────────────────────────

def add_skill(db: Session, user_id: int, data: ResumeSkillCreate) -> Resume:
    resume = get_or_create(db, user_id)
    skill = ResumeSkill(
        resume_id=resume.id,
        order=_next_order(resume.skills),
        **data.model_dump(),
    )
    db.add(skill)
    db.commit()
    return _load(db, user_id)


def delete_skill(db: Session, user_id: int, skill_id: int) -> Resume:
    resume = get_or_create(db, user_id)
    skill = _get_item(db, ResumeSkill, skill_id, resume.id, "Habilidade")
    db.delete(skill)
    db.commit()
    return _load(db, user_id)


# ─── languages ───────────────────────────────────────────────────────────────

def add_language(db: Session, user_id: int, data: ResumeLanguageCreate) -> Resume:
    resume = get_or_create(db, user_id)
    lang = ResumeLanguage(
        resume_id=resume.id,
        order=_next_order(resume.languages),
        **data.model_dump(),
    )
    db.add(lang)
    db.commit()
    return _load(db, user_id)


def delete_language(db: Session, user_id: int, lang_id: int) -> Resume:
    resume = get_or_create(db, user_id)
    lang = _get_item(db, ResumeLanguage, lang_id, resume.id, "Idioma")
    db.delete(lang)
    db.commit()
    return _load(db, user_id)
