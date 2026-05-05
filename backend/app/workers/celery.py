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
        "sync-all-jobs-every-2h": {
            "task": "app.workers.tasks.sync_all_jobs",
            "schedule": crontab(minute=0, hour="*/2"),
        },
        "cleanup-expired-jobs-daily": {
            "task": "app.workers.tasks.cleanup_expired_jobs",
            "schedule": crontab(minute=0, hour=0),
        },
    },
)