import logging
import re
import unicodedata
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import and_, or_
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.models.job import Job, JobPlatform
from app.models.platform import Platform
from app.models.sync_log import SyncLog, SyncStatus
from app.schemas.job import JobFilters, JobListResponse

logger = logging.getLogger(__name__)

_REMOTE_KEYWORDS = ("remoto", "remote", "home office", "híbrido", "hibrido")
_STOPWORDS = frozenset(["a", "as", "o", "os", "de", "da", "das", "do", "dos", "e", "em", "para"])
_BROAD_ROLE_TERMS = frozenset([
    "analista", "analyst", "especialista", "specialist",
    "desenvolvedor", "developer", "dev", "programador", "engineer", "engenheiro",
    "designer", "gerente", "manager", "lead", "lider", "diretor", "director", "head",
])


def _parse_location_preference(location_preference: str) -> tuple[str, str | None]:
    """'São Paulo, SP' → ('São Paulo', 'SP')"""
    parts = [p.strip() for p in location_preference.split(",")]
    city = parts[0]
    state = parts[1] if len(parts) > 1 else None
    return city, state


def _normalize(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text.lower())
    ascii_text = normalized.encode("ascii", "ignore").decode("ascii")
    return re.sub(r"\s+", " ", ascii_text).strip()


def _role_tokens(role_name: str) -> set[str]:
    return {
        token for token in re.split(r"\W+", _normalize(role_name))
        if len(token) >= 3 and token not in _STOPWORDS
    }


def _term_variants(term: str) -> set[str]:
    variants = {term}
    if term.endswith("s") and len(term) > 4:
        variants.add(term[:-1])
    else:
        variants.add(f"{term}s")
    return variants


def _title_contains_any(terms: set[str]):
    return or_(*[Job.title.ilike(f"%{term}%") for term in terms])


def _desired_role_clause(role_name: str):
    tokens = _role_tokens(role_name)
    if not tokens:
        return None

    broad_terms = tokens & _BROAD_ROLE_TERMS
    specific_terms = tokens - _BROAD_ROLE_TERMS

    if specific_terms:
        specific_clause = and_(*[
            _title_contains_any(_term_variants(term))
            for term in sorted(specific_terms)
        ])
        if broad_terms:
            return and_(specific_clause, _title_contains_any(broad_terms))
        return specific_clause

    return _title_contains_any(tokens)


def get_jobs(
    db: Session,
    filters: JobFilters,
    page: int = 1,
    page_size: int = 20,
    user_id: int | None = None,
    sort_by: str = "date_desc",
) -> JobListResponse:
    from app.models.user import User

    page_size = min(page_size, 100)
    now = datetime.now(timezone.utc)
    q = db.query(Job).filter(
        Job.is_active.is_(True),
        or_(Job.expires_at.is_(None), Job.expires_at > now),
    )

    if filters.query:
        term = f"%{filters.query}%"
        q = q.filter(
            or_(Job.title.ilike(term), Job.company.ilike(term), Job.description.ilike(term))
        )
    if filters.location:
        q = q.filter(Job.location.ilike(f"%{filters.location}%"))
    if filters.job_type:
        q = q.filter(Job.job_type == filters.job_type)
    if filters.level:
        q = q.filter(Job.level == filters.level)
    if filters.remote is not None:
        q = q.filter(Job.remote.is_(filters.remote))
    if filters.platform:
        q = q.filter(Job.platform == filters.platform)
    if filters.salary_min is not None:
        q = q.filter(Job.salary_min >= filters.salary_min)
    if filters.salary_max is not None:
        q = q.filter(Job.salary_max <= filters.salary_max)

    # Location filter: only show jobs matching the user's city/state OR remote jobs
    if user_id is not None and not filters.location:
        user = db.get(User, user_id)
        if user and user.location_preference:
            city, state = _parse_location_preference(user.location_preference)

            remote_conds = [Job.remote.is_(True)]
            for kw in _REMOTE_KEYWORDS:
                remote_conds.append(Job.location.ilike(f"%{kw}%"))

            city_conds = [Job.location.ilike(f"%{city}%")]
            if state:
                city_conds.append(Job.location.ilike(f"%{state}%"))

            q = q.filter(or_(or_(*city_conds), or_(*remote_conds)))

        if user:
            role_names = [role.role_name for role in user.desired_roles]
            if not role_names and user.desired_role:
                role_names = [user.desired_role]

            role_clauses = [
                clause for clause in (_desired_role_clause(role_name) for role_name in role_names)
                if clause is not None
            ]
            if role_clauses:
                q = q.filter(or_(*role_clauses))

    _ORDER = {
        "date_desc":    [Job.published_at.desc().nulls_last(), Job.created_at.desc()],
        "date_asc":     [Job.published_at.asc().nulls_last(),  Job.created_at.asc()],
        "title_asc":    [Job.title.asc()],
        "platform_asc": [Job.platform.asc(), Job.published_at.desc().nulls_last()],
    }
    order_clause = _ORDER.get(sort_by, _ORDER["date_desc"])

    total = q.count()
    items = (
        q.order_by(*order_clause)
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return JobListResponse(items=items, total=total, page=page, page_size=page_size)


def get_job_by_id(db: Session, job_id: int) -> Job:
    job = db.get(Job, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Vaga não encontrada")
    return job


def save_job(db: Session, job_data: dict) -> None:
    """Upsert via INSERT ... ON CONFLICT DO UPDATE."""
    now = datetime.now(timezone.utc)
    expires_days = 14 if job_data.get("remote") else 7

    insert_cols = {k: v for k, v in job_data.items() if v is not None or k in ("remote", "is_active")}
    new_expires_at = now + timedelta(days=expires_days)
    insert_cols["expires_at"] = new_expires_at
    insert_cols["last_seen_at"] = now

    update_cols = {
        k: v for k, v in insert_cols.items()
        if k not in ("external_id", "platform", "created_at")
    }
    update_cols["last_seen_at"] = now
    update_cols["expires_at"] = new_expires_at

    stmt = (
        pg_insert(Job)
        .values(**insert_cols)
        .on_conflict_do_update(
            constraint="uq_jobs_platform_external_id",
            set_=update_cols,
        )
    )
    db.execute(stmt)
    db.commit()


def search_jobs(db: Session, query: str, filters: JobFilters, page: int = 1, page_size: int = 20) -> JobListResponse:
    filters.query = query
    return get_jobs(db, filters, page, page_size)


# ── platform helpers ────────────────────────────────────────────────────────

def ensure_platform(db: Session, name: str, slug: str) -> Platform:
    platform = db.query(Platform).filter(Platform.slug == slug).first()
    if not platform:
        platform = Platform(name=name, slug=slug, is_active=True)
        db.add(platform)
        db.commit()
        db.refresh(platform)
    return platform


def open_sync_log(db: Session, platform: Platform, user_id: int | None = None) -> SyncLog:
    log = SyncLog(platform_id=platform.id, user_id=user_id, status=SyncStatus.SUCCESS)
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


def close_sync_log(
    db: Session,
    log: SyncLog,
    *,
    jobs_found: int = 0,
    jobs_new: int = 0,
    error: str | None = None,
) -> None:
    log.finished_at = datetime.now(timezone.utc)
    log.jobs_found = jobs_found
    log.jobs_new = jobs_new
    if error:
        log.status = SyncStatus.ERROR
        log.error_message = error
    db.commit()
