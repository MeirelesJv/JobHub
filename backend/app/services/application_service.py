import uuid
from datetime import datetime, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from fastapi import HTTPException

from app.models.application import Application, ApplicationMode, ApplicationStatus
from app.models.job import Job, JobPlatform
from app.schemas.application import (
    ApplicationCreate,
    ApplicationStats,
    KanbanResponse,
    ManualApplicationCreate,
)


def _base_query(db: Session, user_id: int):
    return (
        db.query(Application)
        .options(joinedload(Application.job))
        .filter(Application.user_id == user_id)
    )


def _get_or_404(db: Session, user_id: int, application_id: int) -> Application:
    app = _base_query(db, user_id).filter(Application.id == application_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Candidatura não encontrada")
    return app


def create_application(db: Session, user_id: int, data: ApplicationCreate) -> Application:
    if not db.get(Job, data.job_id):
        raise HTTPException(status_code=404, detail="Vaga não encontrada")

    if (
        db.query(Application)
        .filter_by(user_id=user_id, job_id=data.job_id)
        .first()
    ):
        raise HTTPException(status_code=400, detail="Você já se candidatou a essa vaga")

    application = Application(
        user_id=user_id,
        job_id=data.job_id,
        mode=data.mode,
        status=ApplicationStatus.APPLIED,
        notes=data.notes,
    )
    db.add(application)
    db.commit()
    db.refresh(application)
    # reload with job relationship eager-loaded
    return _get_or_404(db, user_id, application.id)


def create_manual_application(db: Session, user_id: int, data: ManualApplicationCreate) -> Application:
    from app.services.job_service import _get_match_profile, compute_match_score

    job_data = {
        "external_id": str(uuid.uuid4()),
        "platform": JobPlatform.MANUAL,
        "title": data.title,
        "company": data.company,
        "url": data.url,
        "location": data.location,
        "job_type": data.job_type,
        "level": data.level,
        "remote": data.remote,
        "is_active": True,
        "published_at": datetime.now(timezone.utc),
    }

    profile = _get_match_profile(db)
    if profile is not None:
        job_data["match_score"] = compute_match_score(job_data, profile)

    job = Job(**job_data)
    db.add(job)
    db.flush()

    application = Application(
        user_id=user_id,
        job_id=job.id,
        mode=ApplicationMode.MANUAL,
        status=ApplicationStatus.APPLIED,
        notes=data.notes,
    )
    db.add(application)
    db.commit()
    db.refresh(application)
    return _get_or_404(db, user_id, application.id)


def get_applications(
    db: Session,
    user_id: int,
    status: ApplicationStatus | None = None,
    platform: str | None = None,
) -> list[Application]:
    q = _base_query(db, user_id)
    if status:
        q = q.filter(Application.status == status)
    if platform:
        q = q.join(Application.job).filter(Job.platform == platform)
    return q.order_by(Application.applied_at.desc()).all()


def get_application(db: Session, user_id: int, application_id: int) -> Application:
    return _get_or_404(db, user_id, application_id)


def get_kanban(db: Session, user_id: int) -> KanbanResponse:
    apps = get_applications(db, user_id)
    columns: dict[str, list[Application]] = {s.value: [] for s in ApplicationStatus}
    for app in apps:
        columns[app.status.value].append(app)
    return KanbanResponse(**columns)


def update_status(
    db: Session,
    user_id: int,
    application_id: int,
    status: ApplicationStatus,
) -> Application:
    app = _get_or_404(db, user_id, application_id)
    app.status = status
    db.commit()
    return _get_or_404(db, user_id, application_id)


def update_application(
    db: Session,
    user_id: int,
    application_id: int,
    *,
    status: ApplicationStatus | None = None,
    notes: str | None = None,
) -> Application:
    app = _get_or_404(db, user_id, application_id)
    if status is not None:
        app.status = status
    if notes is not None:
        app.notes = notes
    db.commit()
    return _get_or_404(db, user_id, application_id)


def delete_application(db: Session, user_id: int, application_id: int) -> None:
    app = _get_or_404(db, user_id, application_id)
    db.delete(app)
    db.commit()


def get_stats(db: Session, user_id: int) -> ApplicationStats:
    rows = (
        db.query(Application.status, func.count(Application.id))
        .filter(Application.user_id == user_id)
        .group_by(Application.status)
        .all()
    )
    counts = {s.value: 0 for s in ApplicationStatus}
    for status, count in rows:
        counts[status.value] = count
    return ApplicationStats(total=sum(counts.values()), **counts)
