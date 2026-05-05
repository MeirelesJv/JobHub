"""
Coleta vagas do LinkedIn via API guest paginada (sem autenticação).
"""
import logging
import random
import re
import time
from collections.abc import Callable
from datetime import datetime, timedelta, timezone

import httpx
from sqlalchemy.orm import Session

from app.models.job import JobPlatform
from app.services.collectors.html_utils import html_to_text
from app.services.job_service import close_sync_log, ensure_platform, open_sync_log, save_job

logger = logging.getLogger(__name__)

PLATFORM_NAME = "LinkedIn"
PLATFORM_SLUG = "linkedin"
GUEST_API  = "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search"
DETAIL_API = "https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/{job_id}"
GEO_BRASIL = 106057199
PAGE_SIZE  = 10   # LinkedIn guest API retorna ~10 por página, ignora count > 10
MAX_PAGES  = 10

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8",
    "Referer":         "https://www.linkedin.com/jobs/search/",
}

# Localidades que indicam vaga fora do Brasil (não-remotas)
_FOREIGN_MARKERS = frozenset([
    "united states", "new york", "san francisco", "los angeles",
    "chicago", "seattle", "austin", "boston", "miami",
    ", ca", ", ny", ", tx", ", wa", ", ma", ", fl", ", il",
    "remote, us", "remote, ca", "remote (us", "us only",
    "portugal", "lisboa", "porto,",
])

_REMOTE_KEYWORDS = frozenset(["remoto", "remote", "home office", "híbrido", "hibrido"])

# Grupos de sinônimos para filtro de título
_SYNONYM_GROUPS: list[frozenset[str]] = [
    frozenset(["desenvolvedor", "developer", "dev", "programador", "engineer", "engenheiro"]),
    frozenset(["analista", "analyst", "especialista", "specialist"]),
    frozenset(["designer", "ux", "ui", "product designer"]),
    frozenset(["gerente", "manager", "lead", "líder", "lider"]),
    frozenset(["diretor", "director", "head"]),
    frozenset(["product manager", "produto"]),
    frozenset(["suporte", "support", "helpdesk", "help desk"]),
    frozenset(["dados", "data", "bi", "business intelligence"]),
    frozenset(["segurança", "security", "infosec"]),
    frozenset(["devops", "sre", "infraestrutura", "infrastructure", "cloud"]),
]

_JOB_ID_RE  = re.compile(r'data-entity-urn="urn:li:jobPosting:(\d+)"')
_TITLE_RE   = re.compile(r'class="[^"]*base-search-card__title[^"]*"[^>]*>\s*(.*?)\s*</h3>', re.S)
_COMPANY_RE = re.compile(r'class="[^"]*base-search-card__subtitle[^"]*"[^>]*>\s*<[^>]+>\s*(.*?)\s*</a>', re.S)
_LOC_RE     = re.compile(r'class="[^"]*job-search-card__location[^"]*"[^>]*>\s*(.*?)\s*</span>', re.S)
_DATE_RE    = re.compile(r'<time[^>]+datetime="([^"]+)"')


def _clean(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def _strip_html(html: str) -> str:
    return html_to_text(html)


def _expand_keyword(keyword: str) -> frozenset[str]:
    """Expande cada palavra do cargo com seus sinônimos."""
    words = {w for w in keyword.lower().split() if len(w) >= 3}
    expanded = set(words)
    for word in words:
        for group in _SYNONYM_GROUPS:
            if word in group:
                expanded |= group
    return frozenset(expanded)


def _title_matches(title: str, expanded: frozenset[str]) -> bool:
    """Retorna True se o título contém ao menos um termo do cargo (ou sinônimo)."""
    title_lower = title.lower()
    return any(term in title_lower for term in expanded)


def _is_foreign(location: str | None) -> bool:
    if not location:
        return False
    loc = location.lower()
    return any(marker in loc for marker in _FOREIGN_MARKERS)


def _is_remote(title: str, location: str | None) -> bool:
    combined = (title + " " + (location or "")).lower()
    return any(kw in combined for kw in _REMOTE_KEYWORDS)


def _should_keep_location(job: dict, city: str) -> bool:
    """Mantém vagas na cidade alvo OU remotas."""
    if job.get("remote"):
        return True
    loc = (job.get("location") or "").lower()
    return city.lower() in loc or any(kw in loc for kw in _REMOTE_KEYWORDS)


def _extract_description(html: str) -> str | None:
    marker = "show-more-less-html__markup"
    start = html.find(marker)
    if start == -1:
        return None
    tag_end = html.find(">", start)
    if tag_end == -1:
        return None
    content_start = tag_end + 1

    depth = 1
    pos   = content_start
    while depth > 0 and pos < len(html):
        open_pos  = html.find("<div", pos)
        close_pos = html.find("</div", pos)
        if close_pos == -1:
            break
        if open_pos != -1 and open_pos < close_pos:
            depth += 1
            pos = open_pos + 4
        else:
            depth -= 1
            pos = close_pos + 5

    content_end = html.rfind("</div", content_start, pos)
    if content_end <= content_start:
        return None
    return _strip_html(html[content_start:content_end]) or None


def _detect_easy_apply(html: str) -> bool:
    return "apply-button--default" in html and "offsite-apply-icon" not in html


def _fetch_detail(job_id: str, max_retries: int = 3) -> tuple[str | None, bool]:
    """Returns (description, easy_apply)."""
    url = DETAIL_API.format(job_id=job_id)
    for attempt in range(max_retries):
        try:
            resp = httpx.get(url, headers=HEADERS, timeout=10)
            if resp.status_code == 429:
                wait = (2 ** attempt) * random.uniform(5, 10)
                logger.warning("LinkedIn 429 for %s, waiting %.1fs (attempt %d/%d)", job_id, wait, attempt + 1, max_retries)
                time.sleep(wait)
                continue
            resp.raise_for_status()
            return _extract_description(resp.text), _detect_easy_apply(resp.text)
        except httpx.HTTPStatusError:
            raise
        except Exception as exc:
            logger.debug("LinkedIn detail failed for %s: %s", job_id, exc)
            return None, False
    logger.warning("LinkedIn detail gave up after %d retries for %s", max_retries, job_id)
    return None, False


def _parse_cards(html: str) -> list[dict]:
    jobs: list[dict] = []
    job_ids   = _JOB_ID_RE.findall(html)
    titles    = [_clean(t) for t in _TITLE_RE.findall(html)]
    companies = [_clean(c) for c in _COMPANY_RE.findall(html)]
    locations = [_clean(l) for l in _LOC_RE.findall(html)]
    dates     = _DATE_RE.findall(html)

    for i, job_id in enumerate(job_ids):
        title = titles[i] if i < len(titles) else ""
        if not title:
            continue

        location = locations[i] if i < len(locations) else None
        if _is_foreign(location):
            continue

        company = companies[i] if i < len(companies) else "Empresa não informada"
        published_at = None
        if i < len(dates):
            try:
                published_at = datetime.fromisoformat(dates[i]).replace(tzinfo=timezone.utc)
            except ValueError:
                pass

        jobs.append({
            "external_id":  job_id,
            "title":        title,
            "company":      company,
            "location":     location,
            "platform":     JobPlatform.LINKEDIN,
            "url":          f"https://www.linkedin.com/jobs/view/{job_id}/",
            "published_at": published_at,
            "remote":       _is_remote(title, location),
            "is_active":    True,
        })
    return jobs


def _fetch_all_pages(
    base_params: dict,
    expanded: frozenset[str],
    on_progress: Callable[[str], None] | None = None,
    label: str = "página",
) -> list[dict]:
    """Busca até MAX_PAGES páginas, parando quando vagas ficarem mais antigas que 30 dias."""
    collected: dict[str, dict] = {}
    cutoff = datetime.now(timezone.utc) - timedelta(days=30)

    for page in range(MAX_PAGES):
        if on_progress:
            on_progress(f"{label} {page + 1}/{MAX_PAGES}")

        params = {**base_params, "start": page * PAGE_SIZE}
        try:
            req = httpx.Request("GET", GUEST_API, params=params)
            logger.info("LinkedIn GET %s", req.url)
            resp = httpx.get(GUEST_API, params=params, headers=HEADERS, timeout=12)
            resp.raise_for_status()
            cards = _parse_cards(resp.text)
            logger.info("LinkedIn status=%d cards_parsed=%d", resp.status_code, len(cards))
        except Exception as exc:
            logger.warning("LinkedIn fetch error page=%d params=%s: %s", page, params, exc)
            break

        if not cards:
            logger.info("LinkedIn: nenhum card retornado na página %d", page)
            break

        matched = [c for c in cards if _title_matches(c["title"], expanded)]
        logger.info("LinkedIn: %d/%d vagas passaram no filtro de título", len(matched), len(cards))

        for job in matched:
            collected.setdefault(job["external_id"], job)

        # Resultados são ordenados por data desc (sortBy=DD).
        # Se a vaga mais recente da página já é mais antiga que 30 dias,
        # todas as próximas páginas serão ainda mais antigas — para aqui.
        dated = [c for c in cards if c.get("published_at")]
        if dated:
            newest = max(dated, key=lambda j: j["published_at"])
            if newest["published_at"] < cutoff:
                logger.info(
                    "LinkedIn: vaga mais recente da página %d é de %s (>30 dias) — encerrando paginação",
                    page, newest["published_at"].date(),
                )
                break

        if page < MAX_PAGES - 1:
            time.sleep(random.uniform(2, 4))

    return list(collected.values())


def collect(
    db: Session,
    keyword: str,
    location: str = "Brasil",
    user_id: int | None = None,
    seen_ids: set[str] | None = None,
    on_progress: Callable[[str], None] | None = None,
) -> tuple[int, int]:
    platform = ensure_platform(db, PLATFORM_NAME, PLATFORM_SLUG)
    log      = open_sync_log(db, platform, user_id)

    city = None if location.lower() in ("brasil", "brazil", "") else location
    expanded = _expand_keyword(keyword)

    jobs_found = 0
    jobs_new   = 0
    try:
        jobs_by_id: dict[str, dict] = {}

        # Busca 1: vagas na cidade do usuário (ou Brasil)
        city_location = f"{city}, Brasil" if city else "Brasil"
        city_params = {
            "keywords": keyword,
            "location": city_location,
            "geoId":    GEO_BRASIL,
            "sortBy":   "DD",
            "f_TPR":    "r2592000",
            "count":    PAGE_SIZE,
        }
        for job in _fetch_all_pages(city_params, expanded, on_progress=on_progress, label="cidade pg"):
            jobs_by_id[job["external_id"]] = job

        # Busca 2: vagas remotas no Brasil (apenas quando há cidade específica)
        if city:
            time.sleep(1)
            remote_params = {
                "keywords": keyword,
                "location": "Brasil",
                "geoId":    GEO_BRASIL,
                "sortBy":   "DD",
                "f_TPR":    "r2592000",
                "f_WT":     "2",  # remote work type
                "count":    PAGE_SIZE,
            }
            for job in _fetch_all_pages(remote_params, expanded, on_progress=on_progress, label="remoto pg"):
                job["remote"] = True  # encontrada via filtro f_WT=2 — garantidamente remota
                if job["external_id"] in jobs_by_id:
                    jobs_by_id[job["external_id"]]["remote"] = True
                else:
                    jobs_by_id[job["external_id"]] = job

        # Filtro de localização: mantém cidade alvo + remotas
        # Skip IDs already processed by a previous keyword in the same sync run
        candidates = [
            j for j in jobs_by_id.values()
            if (city is None or _should_keep_location(j, city))
            and (seen_ids is None or j["external_id"] not in seen_ids)
        ]
        if seen_ids is not None:
            seen_ids.update(j["external_id"] for j in candidates)

        # Enriquece com descrição completa e detecta Easy Apply
        # Batch-fetch existing jobs to avoid N+1 queries and skip redundant HTTP calls
        from app.models.job import Job as _Job
        candidate_ids = [j["external_id"] for j in candidates]
        existing_map: dict[str, _Job] = {
            row.external_id: row
            for row in db.query(_Job)
            .filter(_Job.external_id.in_(candidate_ids), _Job.platform == JobPlatform.LINKEDIN)
            .all()
        }

        total_candidates = len(candidates)
        for idx, job_data in enumerate(candidates):
            if on_progress:
                on_progress(f"detalhes {idx + 1}/{total_candidates}")
            existing = existing_map.get(job_data["external_id"])
            if existing and existing.description:
                job_data["description"] = existing.description
                job_data["easy_apply"] = existing.easy_apply or False
                continue
            description, easy_apply = _fetch_detail(job_data["external_id"])
            if description:
                job_data["description"] = description
            job_data["easy_apply"] = easy_apply
            time.sleep(random.uniform(1.5, 3))

        jobs_found = len(candidates)
        existing_ids = set(existing_map.keys())
        for job_data in candidates:
            save_job(db, job_data)
            if job_data["external_id"] not in existing_ids:
                jobs_new += 1

        close_sync_log(db, log, jobs_found=jobs_found, jobs_new=jobs_new)
        logger.info("LinkedIn [%s @ %s]: %d vagas, %d novas", keyword, location, jobs_found, jobs_new)
    except Exception as exc:
        close_sync_log(db, log, jobs_found=jobs_found, jobs_new=jobs_new, error=str(exc))
        logger.warning("LinkedIn [%s @ %s] erro: %s", keyword, location, exc)

    return jobs_found, jobs_new
