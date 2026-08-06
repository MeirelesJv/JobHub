import logging
import re
import unicodedata
from datetime import date, datetime, timedelta, timezone

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
    normalized = _normalize(role_name)
    tokens = {
        token for token in re.split(r"\W+", _normalize(role_name))
        if len(token) >= 3 and token not in _STOPWORDS
    }
    if "banco de dados" in normalized:
        tokens.discard("banco")
    return tokens


def _term_variants(term: str) -> set[str]:
    variants = {term}
    if term in {"dado", "dados"}:
        variants.update({"data", "database", "bi", "sql", "dba"})
    if term == "dba":
        variants.update({"database", "sql"})
    if term.endswith("s") and len(term) > 4:
        variants.add(term[:-1])
    else:
        variants.add(f"{term}s")
    return {variant for variant in variants if len(variant) >= 3}


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
    if filters.desired_roles:
        role_clauses = [
            clause for clause in (_desired_role_clause(role_name) for role_name in filters.desired_roles)
            if clause is not None
        ]
        if role_clauses:
            q = q.filter(or_(*role_clauses))

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
            blocked_companies = [
                company.strip()
                for company in (user.blocked_companies or [])
                if company and company.strip()
            ]
            for company in blocked_companies:
                q = q.filter(~Job.company.ilike(f"%{company}%"))

            if not filters.desired_roles:
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
        "match_desc":   [Job.match_score.desc().nulls_last(), Job.published_at.desc().nulls_last()],
    }
    order_clause = _ORDER.get(sort_by, _ORDER["date_desc"])

    total = q.count()
    new_total = q.filter(Job.created_at >= now - timedelta(days=1)).count()
    items = (
        q.order_by(*order_clause)
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return JobListResponse(items=items, total=total, new_total=new_total, page=page, page_size=page_size)


_PCD_KEYWORDS = ("pcd", "pessoa com deficiencia", "pessoas com deficiencia", "vaga afirmativa pcd")


def _get_match_profile(db: Session) -> dict | None:
    """Loads the single local user's resume + preferences for match scoring."""
    from app.core.deps import SINGLE_USER_ID
    from app.models.resume import Resume
    from app.models.user import User

    user = db.get(User, SINGLE_USER_ID)
    if not user:
        return None

    resume = db.query(Resume).filter(Resume.user_id == user.id).first()

    skill_names: list[str] = []
    experiences: list[dict] = []
    education_terms: list[str] = []
    educations: list[dict] = []
    extra_keywords: list[str] = []
    is_pcd = False

    if resume:
        skill_names = [s.name for s in resume.skills]
        extra_keywords = resume.extra_keywords or []
        is_pcd = bool(resume.is_pcd)
        for exp in resume.experiences:
            experiences.append({
                "title": exp.title,
                "start_date": exp.start_date,
                "end_date": exp.end_date,
                "is_current": exp.is_current,
                "keywords": exp.keywords or [],
            })
        for edu in resume.educations:
            if edu.field_of_study:
                education_terms.append(edu.field_of_study)
            if edu.degree:
                education_terms.append(edu.degree)
            educations.append({
                "education_type": edu.education_type,
                "status": edu.status,
            })

    roles = [{"name": r.role_name, "level": r.level} for r in user.desired_roles]
    if not roles and user.desired_role:
        roles = [{"name": user.desired_role, "level": None}]

    return {
        "skills": skill_names,
        "extra_keywords": extra_keywords,
        "education_terms": education_terms,
        "educations": educations,
        "experiences": experiences,
        "roles": roles,
        "job_type_preference": user.job_type_preference,
        "remote_preference": user.remote_preference,
        "is_pcd": is_pcd,
    }


def _titles_match(reference_title: str, candidate_title_norm: str) -> bool:
    """True when `reference_title` (an experience or desired-role title) refers to the
    same role as `candidate_title_norm` (an already-normalized job title).

    Mirrors the specific/broad split used by `_desired_role_clause`: a lone broad word
    like "analista" matches almost any title, so if the reference has any specific
    (non-broad) tokens, ALL of them must appear (as a variant) in the candidate — broad
    tokens alone are never enough to claim a match. Only when the reference has no
    specific tokens at all do we fall back to matching on the broad ones.
    """
    tokens = _role_tokens(reference_title)
    if not tokens:
        return False

    broad = tokens & _BROAD_ROLE_TERMS
    specific = tokens - _BROAD_ROLE_TERMS

    def _variant_present(term: str) -> bool:
        return any(v in candidate_title_norm for v in _term_variants(term))

    if specific:
        if not all(_variant_present(term) for term in specific):
            return False
        if broad and not any(_variant_present(term) for term in broad):
            return False
        return True

    return any(_variant_present(term) for term in broad)


_LEVEL_ORDER = {"junior": 0, "pleno": 1, "senior": 2}
_LEVEL_WEIGHT = 17


def _level_score(job_level: str | None, role_level: str | None) -> float:
    """Graduated level match: closer levels score higher than distant ones.

    No data to compare (missing job level or role has no level set) → full credit.
    Same level → full credit. One step apart (junior↔pleno, pleno↔senior) → half
    credit. Two steps apart (junior↔senior) → zero — a much bigger gap than one step.
    """
    if not role_level or not job_level:
        return _LEVEL_WEIGHT
    if job_level not in _LEVEL_ORDER or role_level not in _LEVEL_ORDER:
        return _LEVEL_WEIGHT
    distance = abs(_LEVEL_ORDER[job_level] - _LEVEL_ORDER[role_level])
    if distance == 0:
        return _LEVEL_WEIGHT
    if distance == 1:
        return _LEVEL_WEIGHT * 0.5
    return 0


_DEGREE_HIGHER_ED_TYPES = ("graduacao", "pos", "tecnico")
_DEGREE_REQUIRED_KEYWORDS = (
    "ensino superior completo", "graduacao completa", "curso superior completo",
    "formacao completa em", "diploma de graduacao", "nivel superior completo",
    "superior completo", "graduado em", "graduacao concluida",
)


def _job_requires_completed_degree(text: str) -> bool:
    return any(kw in text for kw in _DEGREE_REQUIRED_KEYWORDS)


def _education_bonus(text: str, educations: list[dict]) -> int:
    """+10 when the job demands a completed degree and the user has one; -10 when
    it demands one and the user's only relevant education is still in progress (or
    missing entirely). 0 when the job doesn't mention the requirement."""
    if not _job_requires_completed_degree(text):
        return 0
    relevant = [e for e in educations if e.get("education_type") in _DEGREE_HIGHER_ED_TYPES]
    if any(e.get("status") == "concluido" for e in relevant):
        return 10
    return -10


_REQUIRED_HEADERS = (
    "requisitos obrigatorios", "requisitos", "conhecimentos tecnicos",
    "requisitos tecnicos", "qualificacoes", "pre-requisitos", "pre requisitos",
    "o que voce precisa ter", "conhecimentos necessarios", "habilidades necessarias",
)
_DIFFERENTIAL_HEADERS = (
    "diferenciais", "sera um diferencial", "desejavel", "desejaveis",
    "nice to have", "conhecimentos desejaveis", "diferencial", "vai te ajudar",
)
_SECTION_SPAN = 600  # chars a section runs for when no other header ends it first


def _split_requirements(text: str) -> tuple[str, str]:
    """Splits normalized job text into (required_section, differential_section) using
    common posting headers ("Requisitos" vs "Diferenciais" etc). Each section runs from
    its header to the next header found (of either kind) or a fixed span, whichever
    comes first. Falls back to (text, "") when no headers are found — most job postings
    don't separate the two explicitly, so treat everything as required in that case.
    """
    all_headers = _REQUIRED_HEADERS + _DIFFERENTIAL_HEADERS

    def _next_header(start: int, headers: tuple[str, ...]) -> tuple[int | None, str | None]:
        nearest_idx, nearest_header = None, None
        for other in headers:
            idx = text.find(other, start)
            if idx != -1 and (nearest_idx is None or idx < nearest_idx):
                nearest_idx, nearest_header = idx, other
        return nearest_idx, nearest_header

    def _section_after(header: str, terminators: tuple[str, ...]) -> str:
        start = text.find(header)
        if start == -1:
            return ""
        start += len(header)

        # Postings often repeat the section heading right after itself (a category
        # label followed by the bold title, e.g. "Requisitos e qualificações\nRequisitos
        # e Qualificações"), and required content is often split across several
        # sub-headers of its own kind (e.g. "Requisitos" then "Conhecimentos técnicos").
        # Skip over those same-kind headers so `start`/the section body isn't cut off
        # before reaching a real terminator (a header of the *other* kind).
        while True:
            idx, matched_header = _next_header(start, all_headers)
            if idx is None or matched_header in terminators or idx - start > 15:
                break
            start = idx + len(matched_header)

        end = start + _SECTION_SPAN
        idx, _ = _next_header(start, terminators)
        if idx is not None:
            end = min(end, idx)
        return text[start:end]

    required = ""
    for header in _REQUIRED_HEADERS:
        required = _section_after(header, _DIFFERENTIAL_HEADERS)
        if required:
            break

    differential = ""
    for header in _DIFFERENTIAL_HEADERS:
        differential = _section_after(header, _REQUIRED_HEADERS)
        if differential:
            break

    if not required and not differential:
        return text, ""
    return required, differential


def compute_match_score(job_data: dict, profile: dict) -> int:
    """Heuristic 0-100 match between a job posting and the user's resume/preferences.

    Desired role/title isn't scored: the feed is already filtered to jobs whose title
    matches a desired role (see get_jobs), so every scored job matches by construction —
    scoring it would just be a constant, non-discriminating 20 points on everything.

    Base weights: keywords 45 total, split between the posting's "required"
    section (Requisitos/Conhecimentos técnicos — up to 30) and its "differential"
    section (Diferenciais/Desejável — up to 15) when the posting separates them;
    otherwise the full 45 applies to a single combined match against the whole text.
    Plus: tenure in a similar past role 20, level (graduated distance, per matched
    desired role) 17, job type 8, remote 5 — subtotal 95.
    Bonuses (additive, can exceed/reduce the subtotal before the final 0-100 clamp):
    completed-degree requirement fit ±10, PCD +5.
    Preferences the user hasn't set are given full credit (not penalized).
    """
    text = _normalize(f"{job_data.get('title', '')} {job_data.get('description') or ''}")
    title_norm = _normalize(job_data.get("title") or "")

    # Keywords: skills + tagged experience keywords + education terms + user-pasted
    # extra keywords (e.g. extracted from the resume PDF by an external AI)
    keyword_pool = list(profile.get("skills") or [])
    for exp in profile.get("experiences") or []:
        keyword_pool.extend(exp.get("keywords") or [])
    keyword_pool.extend(profile.get("education_terms") or [])
    keyword_pool.extend(profile.get("extra_keywords") or [])
    normalized_pool = [term_norm for term in keyword_pool if len(term_norm := _normalize(term)) >= 2]

    required_text, differential_text = _split_requirements(text)
    if required_text or differential_text:
        matched_required = sum(1 for term in normalized_pool if term in required_text)
        matched_differential = sum(1 for term in normalized_pool if term in differential_text)
        keyword_score = (
            (min(matched_required, 8) / 8) * 30
            + (min(matched_differential, 6) / 6) * 15
        ) if normalized_pool else 0
    else:
        matched_keywords = sum(1 for term in normalized_pool if term in text)
        keyword_score = (min(matched_keywords, 8) / 8) * 45 if normalized_pool else 0

    # Find which desired role this job matches — not scored (see docstring), only used
    # to pick up that role's own level for the level_score below.
    matched_role: dict | None = None
    for role in profile.get("roles") or []:
        if _titles_match(role.get("name") or "", title_norm):
            matched_role = role
            break

    # Tenure in a similar past role (caps at 24 months for full credit)
    tenure_months = 0
    today = date.today()
    for exp in profile.get("experiences") or []:
        if not _titles_match(exp.get("title") or "", title_norm):
            continue
        start = exp.get("start_date")
        if not start:
            continue
        end = today if exp.get("is_current") else (exp.get("end_date") or start)
        months = max(0, (end.year - start.year) * 12 + (end.month - start.month))
        tenure_months += months
    tenure_score = min(20, (tenure_months / 24) * 20)

    def _enum_value(value):
        return value.value if hasattr(value, "value") else value

    # Level: graduated distance against the level set on the matched desired role.
    role_level = matched_role.get("level") if matched_role else None
    job_level = _enum_value(job_data.get("level"))
    level_score = _level_score(job_level, role_level)

    type_pref = profile.get("job_type_preference")
    job_type = _enum_value(job_data.get("job_type"))
    type_score = 8 if (not type_pref or job_type == type_pref) else 0

    remote_pref = profile.get("remote_preference")
    job_remote = bool(job_data.get("remote"))
    remote_score = 5 if (not remote_pref or job_remote) else 0

    education_score = _education_bonus(text, profile.get("educations") or [])
    pcd_score = 5 if (profile.get("is_pcd") and any(kw in text for kw in _PCD_KEYWORDS)) else 0

    total = (
        keyword_score + tenure_score + level_score
        + type_score + remote_score + education_score + pcd_score
    )
    return max(0, min(100, round(total)))


def get_job_by_id(db: Session, job_id: int) -> Job:
    job = db.get(Job, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Vaga não encontrada")
    return job


def save_job(db: Session, job_data: dict) -> None:
    """Upsert via INSERT ... ON CONFLICT DO UPDATE."""
    now = datetime.now(timezone.utc)
    expires_days = get_search_lookback_days(db) + 1

    profile = _get_match_profile(db)
    if profile is not None:
        job_data = {**job_data, "match_score": compute_match_score(job_data, profile)}

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

def get_platform_sync_anchor(
    db: Session,
    platform: JobPlatform,
    keyword: str | None = None,
) -> tuple[datetime | None, str | None]:
    """Retorna (published_at, external_id) da vaga mais recente para plataforma + keyword."""
    q = db.query(Job.published_at, Job.external_id).filter(
        Job.platform == platform,
        Job.is_active.is_(True),
        Job.published_at.isnot(None),
    )

    if keyword:
        role_clause = _desired_role_clause(keyword)
        if role_clause is not None:
            q = q.filter(role_clause)

    row = q.order_by(Job.published_at.desc()).limit(1).first()
    if not row:
        return None, None
    return row.published_at, row.external_id


def get_search_lookback_days(db: Session) -> int:
    """How many days back the collectors should search — user-configurable (7/15/30), default 30."""
    from app.core.deps import SINGLE_USER_ID
    from app.models.user import User

    user = db.get(User, SINGLE_USER_ID)
    return user.search_lookback_days if user else 30


def compute_sync_cutoff(
    latest_date: datetime | None,
    max_days: int = 30,
    overlap_days: int = 1,
) -> datetime:
    """Se há sync anterior: cutoff = latest_date - overlap. Senão: now - max_days."""
    now = datetime.now(timezone.utc)
    max_cutoff = now - timedelta(days=max_days)
    if latest_date is None:
        return max_cutoff

    if latest_date.tzinfo is None:
        latest_date = latest_date.replace(tzinfo=timezone.utc)
    else:
        latest_date = latest_date.astimezone(timezone.utc)

    return max(latest_date - timedelta(days=overlap_days), max_cutoff)


def ensure_platform(db: Session, name: str, slug: str) -> Platform:
    platform = db.query(Platform).filter(Platform.slug == slug).first()
    if not platform:
        platform = Platform(name=name, slug=slug, is_active=True)
        db.add(platform)
        db.commit()
        db.refresh(platform)
    return platform


def record_structural_check(
    db: Session,
    platform: Platform,
    *,
    ok: bool,
    step: str,
    detail: str | None = None,
) -> None:
    """Call from a collector right after its most layout-sensitive parse step, on the
    first page/request of a run. ok=False means the site answered successfully but the
    parser found none of the structural markers it expects there — a strong signal the
    page layout or API shape changed, as opposed to "no jobs matched this search".
    Flips Platform.is_healthy so the frontend can surface which site broke and where.
    """
    changed = False
    if ok:
        if not platform.is_healthy:
            platform.is_healthy = True
            platform.broken_step = None
            platform.broken_detail = None
            changed = True
    else:
        if platform.is_healthy:
            platform.is_healthy = False
            platform.broken_step = step
            platform.broken_detail = (detail or "")[:500] or None
            platform.broken_since = datetime.now(timezone.utc)
            changed = True
            logger.error("Coletor '%s' parece quebrado em '%s': %s", platform.slug, step, detail)
    if changed:
        db.commit()


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
