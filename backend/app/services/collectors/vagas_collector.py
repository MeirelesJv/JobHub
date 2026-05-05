"""
Coleta vagas do Vagas.com.br por HTML publico.
"""
import logging
import re
import time
import unicodedata
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from html import unescape
from urllib.parse import quote_plus, urljoin

import httpx
from sqlalchemy.orm import Session

from app.models.job import JobLevel, JobPlatform, JobType
from app.services.collectors.html_utils import html_to_text
from app.services.job_service import close_sync_log, ensure_platform, open_sync_log, save_job

logger = logging.getLogger(__name__)

PLATFORM_NAME = "Vagas.com.br"
PLATFORM_SLUG = "vagas"
BASE_URL = "https://www.vagas.com.br"
PAGE_SIZE = 20
MAX_PAGES = 3

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8",
    "Referer": "https://www.vagas.com.br/vagas",
}

_JOB_LINK_RE = re.compile(
    r"<h2[^>]*>\s*<a[^>]+href=[\"'](?P<href>[^\"']+)[\"'][^>]*>\s*(?P<title>.*?)\s*</a>\s*</h2>",
    re.I | re.S,
)
_TAG_RE = re.compile(r"<[^>]+>")
_REMOTE_KEYWORDS = frozenset(["100% home office", "home office", "remoto", "remote", "hibrido"])
_MAX_AGE = timedelta(days=30)
_STOPWORDS = frozenset(["a", "as", "o", "os", "de", "da", "das", "do", "dos", "e", "em", "para"])
_BROAD_ROLE_TERMS = frozenset([
    "analista", "analyst", "especialista", "specialist",
    "desenvolvedor", "developer", "dev", "programador", "engineer", "engenheiro",
    "designer", "gerente", "manager", "lead", "lider", "diretor", "director", "head",
])

_SYNONYM_GROUPS: list[frozenset[str]] = [
    frozenset(["desenvolvedor", "developer", "dev", "programador", "engineer", "engenheiro"]),
    frozenset(["analista", "analyst", "especialista", "specialist"]),
    frozenset(["designer", "ux", "ui", "product designer"]),
    frozenset(["gerente", "manager", "lead", "lider"]),
    frozenset(["diretor", "director", "head"]),
    frozenset(["product manager", "produto"]),
    frozenset(["suporte", "support", "helpdesk", "help desk"]),
    frozenset(["dados", "data", "bi", "business intelligence"]),
    frozenset(["seguranca", "security", "infosec"]),
    frozenset(["devops", "sre", "infraestrutura", "infrastructure", "cloud"]),
]


def _normalize(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text.lower())
    ascii_text = normalized.encode("ascii", "ignore").decode("ascii")
    return re.sub(r"\s+", " ", ascii_text).strip()


def _tokenize(text: str) -> list[str]:
    return [token for token in re.split(r"\W+", _normalize(text)) if len(token) >= 3 and token not in _STOPWORDS]


def _clean(text: str) -> str:
    text = _TAG_RE.sub(" ", text)
    return re.sub(r"\s+", " ", unescape(text)).strip()


def _slugify_keyword(keyword: str) -> str:
    return quote_plus(keyword.strip().replace(" ", "-"))


def _variants(term: str) -> set[str]:
    variants = {term}
    if term.endswith("s") and len(term) > 4:
        variants.add(term[:-1])
    else:
        variants.add(f"{term}s")
    return variants


def _expand_terms(words: set[str]) -> frozenset[str]:
    expanded = set(words)
    for word in words:
        expanded |= _variants(word)
        for group in _SYNONYM_GROUPS:
            if word in group:
                expanded |= group
    return frozenset(expanded)


def _build_keyword_matcher(keyword: str) -> dict:
    words = set(_tokenize(keyword))
    expanded = _expand_terms(words)
    broad_terms = expanded & _BROAD_ROLE_TERMS
    specific_words = words - _BROAD_ROLE_TERMS
    specific_terms = _expand_terms(specific_words)
    specific_word_groups = tuple(_expand_terms({word}) for word in sorted(specific_words))

    return {
        "expanded": expanded,
        "broad_terms": frozenset(broad_terms),
        "specific_terms": specific_terms,
        "specific_word_groups": specific_word_groups,
    }


def _contains_term(title: str, term: str) -> bool:
    return bool(re.search(rf"(?<![a-z0-9]){re.escape(term)}(?![a-z0-9])", title))


def _title_matches(title: str, matcher: dict) -> bool:
    title_normalized = _normalize(title)

    specific_terms = matcher["specific_terms"]
    broad_terms = matcher["broad_terms"]
    specific_word_groups = matcher["specific_word_groups"]

    if specific_terms:
        if len(specific_word_groups) > 1:
            has_specific = all(
                any(_contains_term(title_normalized, term) for term in group)
                for group in specific_word_groups
            )
        else:
            has_specific = any(_contains_term(title_normalized, term) for term in specific_terms)

        has_broad = not broad_terms or any(_contains_term(title_normalized, term) for term in broad_terms)
        return has_specific and has_broad

    return any(_contains_term(title_normalized, term) for term in matcher["expanded"])


def _is_remote(title: str, location: str | None, description: str | None = None) -> bool:
    combined = " ".join(filter(None, [title, location, description])).lower()
    return any(kw in combined for kw in _REMOTE_KEYWORDS)


def _should_keep_location(job: dict, city: str) -> bool:
    if job.get("remote"):
        return True
    loc = (job.get("location") or "").lower()
    return city.lower() in loc


def _parse_level(text: str) -> JobLevel | None:
    lower = text.lower()
    if "junior" in lower or "j\u00fanior" in lower or "trainee" in lower or "jr" in lower:
        return JobLevel.JUNIOR
    if "pleno" in lower:
        return JobLevel.PLENO
    if "senior" in lower or "s\u00eanior" in lower or "sr" in lower:
        return JobLevel.SENIOR
    return None


def _parse_job_type(text: str) -> JobType | None:
    lower = text.lower()
    if "pessoa juridica" in lower or "pessoa jur\u00eddica" in lower or " pj" in f" {lower}":
        return JobType.PJ
    if "clt" in lower or "regime clt" in lower:
        return JobType.CLT
    return None


def _parse_date(text: str) -> datetime | None:
    now = datetime.now(timezone.utc)
    lower = text.lower()
    if "hoje" in lower:
        return now
    if "ontem" in lower:
        return now - timedelta(days=1)

    match = re.search(r"ha\s+(\d+)\s+dias|h\u00e1\s+(\d+)\s+dias", lower)
    if match:
        return now - timedelta(days=int(match.group(1) or match.group(2)))

    match = re.search(r"\b(\d{2})/(\d{2})/(\d{4})\b", text)
    if match:
        day, month, year = map(int, match.groups())
        return datetime(year, month, day, tzinfo=timezone.utc)

    return None


def _external_id_from_url(url: str) -> str:
    match = re.search(r"/vagas/v(\d+)", url)
    if match:
        return match.group(1)
    return url.rstrip("/").rsplit("/", 1)[-1]


def _detail_description(url: str) -> str | None:
    try:
        resp = httpx.get(url, headers=HEADERS, timeout=10)
        resp.raise_for_status()
    except Exception as exc:
        logger.debug("Vagas detail failed for %s: %s", url, exc)
        return None

    text = html_to_text(resp.text)
    if not text:
        return None

    for marker in ("Descricao da vaga", "Descri\u00e7\u00e3o da vaga", "Atividades", "Requisitos"):
        idx = text.lower().find(marker.lower())
        if idx >= 0:
            return text[idx: idx + 4000].strip()
    return text[:2500].strip()


def _lines_from_segment(segment: str) -> list[str]:
    text = html_to_text(segment)
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    noise = {"publicidade", "cancelar aplicar filtros"}
    return [line for line in lines if line.lower() not in noise]


def _parse_cards(html: str) -> list[dict]:
    matches = list(_JOB_LINK_RE.finditer(html))
    jobs: list[dict] = []

    for idx, match in enumerate(matches):
        href = match.group("href")
        title = _clean(match.group("title"))
        if not title:
            continue

        start = match.end()
        end = matches[idx + 1].start() if idx + 1 < len(matches) else len(html)
        lines = _lines_from_segment(html[start:end])
        if not lines:
            continue

        url = urljoin(BASE_URL, href)
        company = lines[0]
        level = _parse_level(" ".join(lines[:4]))
        job_type = _parse_job_type(" ".join(lines))
        published_at = _parse_date(" ".join(lines[-4:]))

        location = None
        for line in reversed(lines):
            lower = line.lower()
            if "home office" in lower:
                location = "100% Home Office"
                break
            if re.search(r"\b[A-Z]{2}\b", line) and "/" in line:
                location = line
                break

        description_lines = [
            line for line in lines[1:]
            if line != location and not _parse_date(line) and "empresa aceita" not in line.lower()
        ]
        description = "\n".join(description_lines[:6]).strip() or None

        jobs.append({
            "external_id": _external_id_from_url(url),
            "title": title,
            "company": company,
            "location": location,
            "description": description,
            "job_type": job_type,
            "level": level,
            "platform": JobPlatform.VAGAS,
            "url": url,
            "published_at": published_at,
            "remote": _is_remote(title, location, description),
            "is_active": True,
        })

    return jobs


def _fetch_all_pages(keyword: str, matcher: dict) -> list[dict]:
    collected: dict[str, dict] = {}
    cutoff = datetime.now(timezone.utc) - _MAX_AGE
    search_slug = _slugify_keyword(keyword)

    for page in range(1, MAX_PAGES + 1):
        url = f"{BASE_URL}/vagas-de-{search_slug}"
        params = {"pagina": page} if page > 1 else None
        try:
            logger.info("Vagas GET %s page=%d", url, page)
            resp = httpx.get(url, params=params, headers=HEADERS, timeout=12)
            resp.raise_for_status()
            cards = _parse_cards(resp.text)
            logger.info("Vagas status=%d cards_parsed=%d", resp.status_code, len(cards))
        except Exception as exc:
            logger.warning("Vagas fetch error page=%d kw=%s: %s", page, keyword, exc)
            break

        if not cards:
            break

        recent = [
            job for job in cards
            if job["published_at"] is None or job["published_at"] >= cutoff
        ]
        matched = [job for job in recent if _title_matches(job["title"], matcher)]
        logger.info("Vagas: %d/%d vagas passaram no filtro de titulo", len(matched), len(recent))

        for job in matched:
            collected.setdefault(job["external_id"], job)

        if len(cards) < PAGE_SIZE or not recent:
            break
        if len(recent) > 0 and len(matched) / len(recent) < 0.5:
            break

        if page < MAX_PAGES:
            time.sleep(1)

    return list(collected.values())


def _fetch_details_parallel(candidates: list[dict], max_workers: int = 5) -> None:
    if not candidates:
        return
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        results = executor.map(lambda j: _detail_description(j["url"]), candidates)
        for job_data, detail in zip(candidates, results):
            if detail:
                job_data["description"] = detail


def collect(
    db: Session,
    keyword: str,
    city: str | None = None,
    user_id: int | None = None,
) -> tuple[int, int]:
    from app.models.job import Job

    platform = ensure_platform(db, PLATFORM_NAME, PLATFORM_SLUG)
    log = open_sync_log(db, platform, user_id)
    matcher = _build_keyword_matcher(keyword)

    jobs_found = 0
    jobs_new = 0
    try:
        candidates = [
            job for job in _fetch_all_pages(keyword, matcher)
            if city is None or _should_keep_location(job, city)
        ]

        _fetch_details_parallel(candidates)

        candidate_ids = [job["external_id"] for job in candidates]
        existing_ids = {
            row[0]
            for row in db.query(Job.external_id)
            .filter(Job.external_id.in_(candidate_ids), Job.platform == JobPlatform.VAGAS)
            .all()
        }

        jobs_found = len(candidates)
        for job_data in candidates:
            save_job(db, job_data)
            if job_data["external_id"] not in existing_ids:
                jobs_new += 1

        close_sync_log(db, log, jobs_found=jobs_found, jobs_new=jobs_new)
        logger.info("Vagas [%s @ %s]: %d vagas, %d novas", keyword, city or "Brasil", jobs_found, jobs_new)
    except Exception as exc:
        close_sync_log(db, log, jobs_found=jobs_found, jobs_new=jobs_new, error=str(exc))
        logger.warning("Vagas [%s @ %s] erro: %s", keyword, city or "Brasil", exc)

    return jobs_found, jobs_new
