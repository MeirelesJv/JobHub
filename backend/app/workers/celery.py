from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "jobhub",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.workers.tasks"]
)

from celery.schedules import crontab

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="America/Sao_Paulo",
    enable_utc=True,
    task_track_started=True,
    worker_prefetch_multiplier=1,
    beat_schedule={
        "check-scheduled-sync": {
            "task": "app.workers.tasks.maybe_run_scheduled_sync",
            "schedule": crontab(minute="*/10"),
        },
        "cleanup-expired-jobs-daily": {
            "task": "app.workers.tasks.cleanup_expired_jobs",
            "schedule": crontab(minute=0, hour=0),
        },
    },
)