from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Body, Depends, Query, Response
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.database import get_db
from app.models.job import Job, JobLevel, JobPlatform, JobType
from app.models.platform import Platform
from app.models.user import User
from app.schemas.job import JobFilters, JobListResponse, JobResponse
from app.services import job_service

router = APIRouter()


class SyncRequest(BaseModel):
    locations: list[str] | None = None
    keywords:  list[str] | None = None
    platforms: list[str] | None = None


class ExtensionJobData(BaseModel):
    external_id: str
    platform:    JobPlatform
    title:       str
    company:     str
    url:         str
    easy_apply:  bool = False
    location:    Optional[str] = None
    remote:      bool = False
    description: Optional[str] = None
    level:       Optional[JobLevel] = None
    job_type:    Optional[JobType] = None
    salary_min:  Optional[float] = None
    salary_max:  Optional[float] = None
    published_at: Optional[datetime] = None


@router.get("", response_model=JobListResponse)
def list_jobs(
    response: Response,
    query: str | None = Query(None),
    location: str | None = Query(None),
    job_type: JobType | None = Query(None),
    level: JobLevel | None = Query(None),
    remote: bool | None = Query(None),
    platform: JobPlatform | None = Query(None),
    salary_min: float | None = Query(None),
    salary_max: float | None = Query(None),
    sort_by: str = Query("date_desc"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    filters = JobFilters(
        query=query,
        location=location,
        job_type=job_type,
        level=level,
        remote=remote,
        platform=platform,
        salary_min=salary_min,
        salary_max=salary_max,
    )
    result = job_service.get_jobs(db, filters, page, page_size, user_id=current_user.id, sort_by=sort_by)

    # X-Cache-Until: earliest expiry among active non-expired jobs
    now = datetime.now(timezone.utc)
    min_exp = db.query(func.min(Job.expires_at)).filter(
        Job.is_active.is_(True), Job.expires_at > now
    ).scalar()
    if min_exp:
        response.headers["X-Cache-Until"] = min_exp.isoformat()

    return result


@router.delete("/all", status_code=200)
def delete_all_jobs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    deleted = db.query(Job).delete()
    db.commit()
    return {"deleted": deleted}


@router.get("/platforms")
def list_platforms(db: Session = Depends(get_db)):
    platforms = db.query(Platform).filter(Platform.is_active.is_(True)).all()
    return [{"id": p.id, "name": p.name, "slug": p.slug, "last_sync_at": p.last_sync_at} for p in platforms]


@router.post("/sync", status_code=202)
def trigger_sync(
    body: SyncRequest = Body(default=SyncRequest()),
    current_user: User = Depends(get_current_user),
):
    import redis as _redis
    from app.workers.celery import celery_app
    from app.workers.tasks import sync_all_jobs, sync_jobs_for_user
    from app.core.config import settings

    redis_client = _redis.from_url(settings.REDIS_URL)

    # Include platforms in lock key so "catho only" and "all" don't share a slot
    platforms_key = ",".join(sorted(body.platforms)) if body.platforms else "all"
    lock_key = f"sync_task_user:{current_user.id}:{platforms_key}"

    existing_task_id = redis_client.get(lock_key)
    if existing_task_id:
        existing_task_id = existing_task_id.decode()
        result = celery_app.AsyncResult(existing_task_id)
        if result.state in ("PENDING", "STARTED", "PROGRESS"):
            return {"status": "started", "task_id": existing_task_id}

    if current_user.location_preference and not body.locations:
        task = sync_jobs_for_user.delay(user_id=current_user.id, platforms=body.platforms)
    else:
        task = sync_all_jobs.delay(locations=body.locations, keywords=body.keywords)

    redis_client.setex(lock_key, 1800, task.id)
    return {"status": "started", "task_id": task.id}


@router.get("/sync/status/{task_id}")
def get_sync_status(
    task_id: str,
    _: User = Depends(get_current_user),
):
    from app.workers.celery import celery_app

    result = celery_app.AsyncResult(task_id)

    if result.state in ("PENDING", "STARTED"):
        return {"status": "pending", "progress": 0, "message": "Aguardando na fila…"}
    if result.state == "PROGRESS":
        meta = result.info or {}
        return {
            "status":     "running",
            "progress":   meta.get("progress", 0),
            "message":    meta.get("message", ""),
            "jobs_found": meta.get("jobs_found", 0),
            "jobs_new":   meta.get("jobs_new", 0),
        }
    if result.state == "SUCCESS":
        info = result.info or {}
        return {
            "status":   "completed",
            "progress": 100,
            "message":  info.get("message", "Concluído"),
            "jobs_new": info.get("jobs_new", 0),
        }
    if result.state == "FAILURE":
        return {"status": "failed", "progress": 0, "message": str(result.info)}

    return {"status": "running", "progress": 0, "message": ""}


@router.post("/from-extension", status_code=200)
def ingest_from_extension(
    jobs: list[ExtensionJobData],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    saved = 0
    for job in jobs:
        try:
            job_service.save_job(db, job.model_dump(exclude_none=True))
            saved += 1
        except Exception:
            pass
    return {"saved": saved, "total": len(jobs)}


@router.get("/{job_id}", response_model=JobResponse)
def get_job(job_id: int, db: Session = Depends(get_db)):
    return job_service.get_job_by_id(db, job_id)
