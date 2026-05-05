import logging
from contextlib import contextmanager
from datetime import datetime, timezone

import redis as _redis

from app.core.config import settings
from app.workers.celery import celery_app

logger = logging.getLogger(__name__)

_redis_client = _redis.from_url(settings.REDIS_URL)

@contextmanager
def _task_lock(lock_name: str, ttl: int = 3600):
    """Redis-based lock: skip task if already running. ttl in seconds."""
    acquired = _redis_client.set(lock_name, "1", nx=True, ex=ttl)
    if not acquired:
        logger.info("Task '%s' already running — skipping duplicate", lock_name)
        yield False
        return
    try:
        yield True
    finally:
        _redis_client.delete(lock_name)

DEFAULT_KEYWORDS = [
    "desenvolvedor",
    "analista",
    "engenheiro",
    "designer",
    "product manager",
]

DEFAULT_LOCATIONS = [
    "São Paulo",
    "Rio de Janeiro",
    "Belo Horizonte",
    "Curitiba",
    "Porto Alegre",
    "Brasília",
    "Recife",
    "Salvador",
    "Fortaleza",
    "Florianópolis",
]


@celery_app.task(name="app.workers.tasks.sync_linkedin_jobs")
def sync_linkedin_jobs(
    keywords: list | None = None,
    locations: list | None = None,
) -> dict:
    from app.database import SessionLocal
    from app.services.collectors import linkedin_collector

    keywords  = keywords  or DEFAULT_KEYWORDS
    locations = locations or DEFAULT_LOCATIONS

    with _task_lock("lock:sync_linkedin_jobs", ttl=3600) as acquired:
        if not acquired:
            return {"skipped": True}
        db = SessionLocal()
        total_found = total_new = 0
        try:
            for location in locations:
                for kw in keywords:
                    found, new = linkedin_collector.collect(db, kw, location=location)
                    total_found += found
                    total_new   += new
        finally:
            db.close()

    logger.info("sync_linkedin_jobs: %d encontradas, %d novas", total_found, total_new)
    return {"jobs_found": total_found, "jobs_new": total_new}


@celery_app.task(name="app.workers.tasks.sync_gupy_jobs")
def sync_gupy_jobs(
    keywords: list | None = None,
    locations: list | None = None,
) -> dict:
    from app.database import SessionLocal
    from app.services.collectors import gupy_collector

    keywords  = keywords  or DEFAULT_KEYWORDS
    locations = locations or DEFAULT_LOCATIONS

    with _task_lock("lock:sync_gupy_jobs", ttl=3600) as acquired:
        if not acquired:
            return {"skipped": True}
        db = SessionLocal()
        total_found = total_new = 0
        try:
            for city in locations:
                found, new = gupy_collector.collect_batch(db, keywords, city=city)
                total_found += found
                total_new   += new
        finally:
            db.close()

    logger.info("sync_gupy_jobs: %d encontradas, %d novas", total_found, total_new)
    return {"jobs_found": total_found, "jobs_new": total_new}


@celery_app.task(name="app.workers.tasks.sync_vagas_jobs")
def sync_vagas_jobs(
    keywords: list | None = None,
    locations: list | None = None,
) -> dict:
    from app.database import SessionLocal
    from app.services.collectors import vagas_collector

    keywords  = keywords  or DEFAULT_KEYWORDS
    locations = locations or DEFAULT_LOCATIONS

    with _task_lock("lock:sync_vagas_jobs", ttl=3600) as acquired:
        if not acquired:
            return {"skipped": True}
        db = SessionLocal()
        total_found = total_new = 0
        try:
            for city in locations:
                for kw in keywords:
                    found, new = vagas_collector.collect(db, kw, city=city)
                    total_found += found
                    total_new   += new
        finally:
            db.close()

    logger.info("sync_vagas_jobs: %d encontradas, %d novas", total_found, total_new)
    return {"jobs_found": total_found, "jobs_new": total_new}


@celery_app.task(name="app.workers.tasks.sync_infojobs_jobs")
def sync_infojobs_jobs(
    keywords: list | None = None,
    locations: list | None = None,
) -> dict:
    from app.database import SessionLocal
    from app.services.collectors import infojobs_collector

    keywords  = keywords  or DEFAULT_KEYWORDS
    locations = locations or DEFAULT_LOCATIONS

    with _task_lock("lock:sync_infojobs_jobs", ttl=3600) as acquired:
        if not acquired:
            return {"skipped": True}
        db = SessionLocal()
        total_found = total_new = 0
        try:
            for city in locations:
                for kw in keywords:
                    found, new = infojobs_collector.collect(db, kw, city=city)
                    total_found += found
                    total_new   += new
        finally:
            db.close()

    logger.info("sync_infojobs_jobs: %d encontradas, %d novas", total_found, total_new)
    return {"jobs_found": total_found, "jobs_new": total_new}


@celery_app.task(name="app.workers.tasks.sync_catho_jobs")
def sync_catho_jobs(
    keywords: list | None = None,
    locations: list | None = None,
) -> dict:
    from app.database import SessionLocal
    from app.services.collectors import catho_collector

    keywords  = keywords  or DEFAULT_KEYWORDS
    locations = locations or DEFAULT_LOCATIONS

    with _task_lock("lock:sync_catho_jobs", ttl=3600) as acquired:
        if not acquired:
            return {"skipped": True}
        db = SessionLocal()
        total_found = total_new = 0
        try:
            for city in locations:
                for kw in keywords:
                    found, new = catho_collector.collect(db, kw, city=city)
                    total_found += found
                    total_new   += new
        finally:
            db.close()

    logger.info("sync_catho_jobs: %d encontradas, %d novas", total_found, total_new)
    return {"jobs_found": total_found, "jobs_new": total_new}


@celery_app.task(name="app.workers.tasks.sync_all_jobs")
def sync_all_jobs(
    locations: list | None = None,
    keywords: list | None = None,
) -> dict:
    sync_linkedin_jobs.delay(keywords=keywords, locations=locations)
    sync_gupy_jobs.delay(keywords=keywords, locations=locations)
    sync_vagas_jobs.delay(keywords=keywords, locations=locations)
    sync_infojobs_jobs.delay(keywords=keywords, locations=locations)
    sync_catho_jobs.delay(keywords=keywords, locations=locations)
    return {"status": "enqueued"}


_ALL_PLATFORMS = {"linkedin", "gupy", "vagas", "infojobs", "catho"}


@celery_app.task(name="app.workers.tasks.sync_jobs_for_user", bind=True)
def sync_jobs_for_user(self, user_id: int, platforms: list[str] | None = None) -> dict:
    """Collect jobs scoped to a specific user's location preference, with progress reporting.

    platforms: subset of {"linkedin","gupy","vagas","infojobs","catho"} or None for all.
    """
    from app.database import SessionLocal
    from app.models.user import User
    from app.services.collectors import linkedin_collector, gupy_collector, vagas_collector, infojobs_collector, catho_collector

    enabled = _ALL_PLATFORMS if not platforms else (_ALL_PLATFORMS & set(platforms))

    def _progress(pct: int, msg: str, found: int = 0, new: int = 0) -> None:
        self.update_state(state="PROGRESS", meta={
            "progress": pct, "message": msg,
            "jobs_found": found, "jobs_new": new,
        })

    def _platform_loop(collector_fn, keywords_list, pct_start, pct_end, label, **kwargs):
        nonlocal total_found, total_new
        n_kw = len(keywords_list)
        for i, kw in enumerate(keywords_list):
            pct = pct_start + int((i / n_kw) * (pct_end - pct_start))
            suffix = f" — {total_found} vagas encontradas" if total_found else ""
            _progress(pct, f"{label} ({i + 1}/{n_kw}){suffix}", total_found, total_new)
            f, n = collector_fn(db, kw, **kwargs)
            total_found += f
            total_new   += n
        suffix = f" — {total_found} vagas encontradas"
        _progress(pct_end, f"{label} concluído{suffix}", total_found, total_new)

    total_found = total_new = 0
    db = SessionLocal()
    try:
        _progress(5, "Iniciando busca…")

        user = db.get(User, user_id)
        if not user or not user.location_preference:
            logger.warning("sync_jobs_for_user: user %d has no location_preference", user_id)
            return {"progress": 100, "message": "Sem preferência de localização configurada", "jobs_found": 0, "jobs_new": 0}

        location_preference = user.location_preference.strip()
        city = location_preference.split(",")[0].strip()

        from app.models.desired_role import UserDesiredRole
        roles = (
            db.query(UserDesiredRole)
            .filter_by(user_id=user_id)
            .order_by(UserDesiredRole.is_primary.desc(), UserDesiredRole.order)
            .all()
        )
        if roles:
            keywords = [r.role_name for r in roles]
        else:
            keywords = list(DEFAULT_KEYWORDS)
            if user.desired_role:
                keywords.insert(0, user.desired_role)

        # Build platform schedule: [(slug, collector_fn, label, pct_start, pct_end, kwargs)]
        # Distribute progress range across enabled platforms
        platform_defs = [
            ("linkedin",  None,                         "LinkedIn",       {}),
            ("gupy",      None,                         "Gupy",           {"city": city, "user_id": user_id}),
            ("vagas",     vagas_collector.collect,      "Vagas.com.br",   {"city": city, "user_id": user_id}),
            ("infojobs",  infojobs_collector.collect,   "InfoJobs",       {"city": city, "user_id": user_id}),
            ("catho",     catho_collector.collect,      "Catho",          {"city": location_preference, "user_id": user_id}),
        ]
        active = [(slug, fn, label, kw) for slug, fn, label, kw in platform_defs if slug in enabled]
        n_active = len(active)

        # Spread 10–95% across active platforms
        pct_range = 85
        per_platform = pct_range // n_active if n_active else pct_range

        pct_cursor = 10
        seen_linkedin_ids: set[str] = set()
        n_kw = len(keywords)

        for slug, collector_fn, label, extra_kwargs in active:
            pct_end_platform = pct_cursor + per_platform

            if slug == "linkedin":
                for i, kw in enumerate(keywords):
                    suffix = f" — {total_found} vagas encontradas" if total_found else ""
                    _progress(pct_cursor, f"LinkedIn ({i + 1}/{n_kw}){suffix}", total_found, total_new)

                    def _on_progress(msg: str, _i=i, _n=n_kw) -> None:
                        _progress(pct_cursor, f"LinkedIn ({_i + 1}/{_n}) — {msg}", total_found, total_new)

                    f, n = linkedin_collector.collect(
                        db, kw, location=city, user_id=user_id,
                        seen_ids=seen_linkedin_ids, on_progress=_on_progress,
                    )
                    total_found += f
                    total_new   += n
                suffix = f" — {total_found} vagas encontradas"
                _progress(pct_end_platform, f"LinkedIn concluído{suffix}", total_found, total_new)
            elif slug == "gupy":
                suffix = f" — {total_found} vagas encontradas" if total_found else ""
                _progress(pct_cursor, f"Gupy ({n_kw} keywords){suffix}", total_found, total_new)
                f, n = gupy_collector.collect_batch(db, keywords, **extra_kwargs)
                total_found += f
                total_new   += n
                suffix = f" — {total_found} vagas encontradas"
                _progress(pct_end_platform, f"Gupy concluído{suffix}", total_found, total_new)
            else:
                _platform_loop(collector_fn, keywords, pct_cursor, pct_end_platform, label, **extra_kwargs)

            pct_cursor = pct_end_platform

        _progress(95, f"Finalizando… {total_found} vagas encontradas", total_found, total_new)

    except Exception as exc:
        logger.exception("sync_jobs_for_user(%d) falhou", user_id)
        return {"progress": 0, "message": str(exc), "jobs_found": total_found, "jobs_new": total_new, "error": True}
    finally:
        db.close()

    msg = f"Concluído — {total_new} nova{'s' if total_new != 1 else ''} vaga{'s' if total_new != 1 else ''} encontrada{'s' if total_new != 1 else ''}"
    logger.info("sync_jobs_for_user(%d): %d encontradas, %d novas", user_id, total_found, total_new)
    return {"progress": 100, "message": msg, "jobs_found": total_found, "jobs_new": total_new}


@celery_app.task(name="app.workers.tasks.cleanup_expired_jobs")
def cleanup_expired_jobs() -> dict:
    """Mark expired jobs with applications as inactive; delete the rest."""
    from app.database import SessionLocal
    from app.models.job import Job

    db = SessionLocal()
    deactivated = deleted = 0
    try:
        now = datetime.now(timezone.utc)

        # Expired jobs that have applications → mark inactive only
        with_apps = (
            db.query(Job)
            .filter(Job.expires_at < now, Job.is_active.is_(True), Job.applications.any())
            .all()
        )
        for job in with_apps:
            job.is_active = False
        deactivated = len(with_apps)

        # Expired jobs without applications AND already inactive → delete
        deleted = (
            db.query(Job)
            .filter(Job.expires_at < now, Job.is_active.is_(False), ~Job.applications.any())
            .delete(synchronize_session=False)
        )
        db.commit()
    except Exception:
        logger.exception("cleanup_expired_jobs falhou")
        db.rollback()
    finally:
        db.close()

    logger.info("cleanup_expired_jobs: %d desativadas, %d deletadas", deactivated, deleted)
    return {"deactivated": deactivated, "deleted": deleted}
