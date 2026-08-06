"""
Coleta vagas do InfoJobs por HTML publico.
"""
import json
import logging
import re
import time
import unicodedata
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from html import unescape
from urllib.parse import urljoin

import httpx
from sqlalchemy.orm import Session

from app.models.job import JobLevel, JobPlatform, JobType
from app.models.platform import Platform
from app.services.collectors.html_utils import html_to_text
from app.services.job_service import (
    close_sync_log,
    compute_sync_cutoff,
    ensure_platform,
    get_platform_sync_anchor,
    get_search_lookback_days,
    open_sync_log,
    record_structural_check,
    save_job,
)

logger = logging.getLogger(__name__)

PLATFORM_NAME = "InfoJobs"
PLATFORM_SLUG = "infojobs"
BASE_URL = "https://www.infojobs.com.br"
PAGE_SIZE = 20
MAX_PAGES = 500
PAGE_DELAY_SECONDS = 0.2

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8",
    "Referer": "https://www.infojobs.com.br/",
}

_JOB_LINK_RE = re.compile(
    r"<a[^>]+href=[\"'](?P<href>[^\"']*vaga-de-[^\"']*?\.aspx[^\"']*)[\"'][^>]*>\s*(?P<title>.*?)\s*</a>",
    re.I | re.S,
)
_JSON_LD_RE = re.compile(
    r"<script[^>]+type=[\"']application/ld\+json[\"'][^>]*>(?P<payload>.*?)</script>",
    re.I | re.S,
)
_TAG_RE = re.compile(r"<[^>]+>")
_REMOTE_KEYWORDS = frozenset(["home office", "remoto", "remote", "híbrido", "hibrido"])

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


def _clean(text: str) -> str:
    text = _TAG_RE.sub(" ", text)
    return re.sub(r"\s+", " ", unescape(text)).strip()


def _ascii_slug(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text.strip().lower())
    ascii_text = normalized.encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_text).strip("-")
    return slug


def _search_url(keyword: str, city: str | None = None) -> str:
    keyword_slug = _ascii_slug(keyword)
    if not city:
        return f"{BASE_URL}/vagas-de-emprego-{keyword_slug}.aspx"

    city_name = city
    state = None
    if "," in city:
        city_name, state = [part.strip() for part in city.split(",", 1)]

    city_slug = _ascii_slug(city_name)
    if state:
        return f"{BASE_URL}/vagas-de-emprego-{keyword_slug}-em-{city_slug}%2C-{_ascii_slug(state)}.aspx"
    return f"{BASE_URL}/vagas-de-emprego-{keyword_slug}-em-{city_slug}.aspx"


def _expand_keyword(keyword: str) -> frozenset[str]:
    normalized = unicodedata.normalize("NFKD", keyword.lower()).encode("ascii", "ignore").decode("ascii")
    words = {w for w in re.split(r"\W+", normalized) if len(w) >= 3}
    expanded = set(words)
    for word in words:
        for group in _SYNONYM_GROUPS:
            if word in group:
                expanded |= group
    return frozenset(expanded)


def _title_matches(title: str, expanded: frozenset[str]) -> bool:
    normalized = unicodedata.normalize("NFKD", title.lower()).encode("ascii", "ignore").decode("ascii")
    return any(term in normalized for term in expanded)


def _is_remote(title: str, location: str | None, description: str | None = None) -> bool:
    combined = " ".join(filter(None, [title, location, description])).lower()
    return any(kw in combined for kw in _REMOTE_KEYWORDS)


def _should_keep_location(job: dict, city: str) -> bool:
    if job.get("remote"):
        return True
    loc = (job.get("location") or "").lower()
    city_name = city.split(",", 1)[0].strip().lower()
    return city_name in loc


def _parse_level(text: str) -> JobLevel | None:
    normalized = unicodedata.normalize("NFKD", text.lower()).encode("ascii", "ignore").decode("ascii")
    if re.search(r"(?<![a-z0-9])(?:junior|jr|trainee)(?![a-z0-9])", normalized):
        return JobLevel.JUNIOR
    if re.search(r"(?<![a-z0-9])(?:pleno|pl)(?![a-z0-9])", normalized):
        return JobLevel.PLENO
    if re.search(r"(?<![a-z0-9])(?:senior|sr)(?![a-z0-9])", normalized):
        return JobLevel.SENIOR
    return None


def _parse_job_type(text: str) -> JobType | None:
    lower = text.lower()
    if "prestador de serviços" in lower or "prestador de servicos" in lower or " pj" in f" {lower}":
        return JobType.PJ
    if "efetivo" in lower or "clt" in lower:
        return JobType.CLT
    return None


def _parse_date(text: str) -> datetime | None:
    now = datetime.now(timezone.utc)
    lower = text.lower()
    if "hoje" in lower:
        return now
    if "ontem" in lower:
        return now - timedelta(days=1)

    match = re.search(r"\b(\d{1,2})\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\b", lower)
    if match:
        day = int(match.group(1))
        month = {
            "jan": 1, "fev": 2, "mar": 3, "abr": 4, "mai": 5, "jun": 6,
            "jul": 7, "ago": 8, "set": 9, "out": 10, "nov": 11, "dez": 12,
        }[match.group(2)]
        year = now.year
        parsed = datetime(year, month, day, tzinfo=timezone.utc)
        if parsed > now + timedelta(days=1):
            parsed = parsed.replace(year=year - 1)
        return parsed

    match = re.search(r"\b(\d{2})/(\d{2})/(\d{4})\b", text)
    if match:
        day, month, year = map(int, match.groups())
        return datetime(year, month, day, tzinfo=timezone.utc)

    return None


def _parse_iso_datetime(value: str | None) -> datetime | None:
    if not value:
        return None

    cleaned = value.strip().replace("Z", "+00:00")
    match = re.match(r"^(.+?)(\.\d{1,})([+-]\d{2}:\d{2})?$", cleaned)
    if match and len(match.group(2)) > 7:
        cleaned = f"{match.group(1)}{match.group(2)[:7]}{match.group(3) or ''}"

    try:
        parsed = datetime.fromisoformat(cleaned)
    except ValueError:
        return None

    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _external_id_from_url(url: str) -> str:
    match = re.search(r"__(\d+)\.aspx", url)
    if match:
        return match.group(1)
    slug = url.split("?", 1)[0].rstrip("/").rsplit("/", 1)[-1]
    return slug.removesuffix(".aspx")


def _lines_from_segment(segment: str) -> list[str]:
    text = html_to_text(segment)
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    noise = {
        "nova",
        "contratação urgente",
        "contratacao urgente",
        "relevantes",
        "recentes",
        "próximas",
        "proximas",
    }
    return [line for line in lines if line.lower() not in noise]


def _looks_like_rating(line: str) -> bool:
    return bool(re.fullmatch(r"\d,\d", line.strip()))


def _looks_like_location(line: str) -> bool:
    lower = line.lower()
    return "todo brasil" in lower or bool(re.search(r"-\s*[A-Z]{2}(?:\b|,|\.)", line))


def _looks_like_salary(line: str) -> bool:
    lower = line.lower()
    return "a combinar" in lower or "r$" in lower


def _parse_salary(line: str) -> tuple[float | None, float | None]:
    numbers = []
    for raw in re.findall(r"R\$\s*([\d\.\,]+)", line):
        try:
            numbers.append(float(raw.replace(".", "").replace(",", ".")))
        except ValueError:
            pass
    if not numbers:
        return None, None
    if len(numbers) == 1:
        return numbers[0], None
    return min(numbers), max(numbers)


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
        external_id = _external_id_from_url(url)
        if not external_id.isdigit():
            continue

        joined = " ".join(lines)
        published_at = None
        location = None
        salary_min = None
        salary_max = None

        for line in lines[:8]:
            published_at = published_at or _parse_date(line)
            if location is None and _looks_like_location(line):
                location = re.sub(r",\s*\d+\s*Km de você\.", "", line).strip()
            if salary_min is None and _looks_like_salary(line):
                salary_min, salary_max = _parse_salary(line)

        company = "Empresa não informada"
        ignored_company_lines = {
            "hoje", "ontem", "a combinar", "ensino superior", "ensino médio (2º grau)",
            "ensino medio (2º grau)", "curso técnico", "curso tecnico", "presencial",
            "home office", "híbrido", "hibrido",
        }
        for line in lines:
            lower = line.lower()
            if (
                _parse_date(line)
                or _looks_like_rating(line)
                or _looks_like_location(line)
                or _looks_like_salary(line)
                or lower in ignored_company_lines
                or "experiência" in lower
                or "experiencia" in lower
            ):
                continue
            company = line
            break

        description_lines = [
            line for line in lines
            if line != company
            and line != location
            and not _parse_date(line)
            and not _looks_like_rating(line)
            and not _looks_like_salary(line)
        ]
        description = "\n".join(description_lines[-4:]).strip() or None

        jobs.append({
            "external_id": external_id,
            "title": title,
            "company": company,
            "location": location,
            "description": description,
            "salary_min": salary_min,
            "salary_max": salary_max,
            "job_type": _parse_job_type(joined),
            "level": _parse_level(f"{title} {joined}"),
            "platform": JobPlatform.INFOJOBS,
            "url": url,
            "published_at": published_at,
            "remote": _is_remote(title, location, joined),
            "is_active": True,
        })

    return jobs


def _find_job_posting(payload) -> dict | None:
    if isinstance(payload, dict):
        type_value = payload.get("@type")
        types = type_value if isinstance(type_value, list) else [type_value]
        if "JobPosting" in types:
            return payload
        for key in ("@graph", "mainEntity", "itemListElement"):
            found = _find_job_posting(payload.get(key))
            if found:
                return found
    if isinstance(payload, list):
        for item in payload:
            found = _find_job_posting(item)
            if found:
                return found
    return None


def _address_location(job_posting: dict) -> str | None:
    location = job_posting.get("jobLocation")
    if isinstance(location, list):
        location = location[0] if location else None
    if not isinstance(location, dict):
        return None

    address = location.get("address")
    if not isinstance(address, dict):
        return None

    city = address.get("addressLocality")
    state = address.get("addressRegion")
    parts = [part for part in (city, state) if part]
    return " - ".join(parts) if parts else None


def _detail_fields(url: str) -> dict:
    try:
        resp = httpx.get(url, headers=HEADERS, timeout=10, follow_redirects=True)
        resp.raise_for_status()
    except Exception as exc:
        logger.debug("InfoJobs detail failed for %s: %s", url, exc)
        return {}

    fields: dict = {}
    for match in _JSON_LD_RE.finditer(resp.text):
        try:
            payload = json.loads(unescape(match.group("payload")))
        except json.JSONDecodeError:
            continue

        job_posting = _find_job_posting(payload)
        if not job_posting:
            continue

        if job_posting.get("title"):
            fields["title"] = _clean(str(job_posting["title"]))

        organization = job_posting.get("hiringOrganization")
        if isinstance(organization, dict) and organization.get("name"):
            fields["company"] = _clean(str(organization["name"]))

        location = _address_location(job_posting)
        if location:
            fields["location"] = location

        published_at = _parse_iso_datetime(job_posting.get("datePosted"))
        if published_at:
            fields["published_at"] = published_at

        if job_posting.get("description"):
            fields["description"] = html_to_text(str(job_posting["description"]))[:4000].strip()

        break

    text = html_to_text(resp.text)
    if text and not fields.get("description"):
        for marker in ("Descrição", "Atividades", "Requisitos", "Sobre a vaga"):
            idx = text.lower().find(marker.lower())
            if idx >= 0:
                fields["description"] = text[idx: idx + 4000].strip()
                break
        else:
            fields["description"] = text[:2500].strip()

    return fields


def _fetch_page(url: str, page: int) -> tuple[list[dict], int]:
    params = {"Page": page} if page > 1 else None
    logger.info("InfoJobs GET %s page=%d", url, page)
    resp = httpx.get(url, params=params, headers=HEADERS, timeout=12, follow_redirects=True)
    resp.raise_for_status()
    cards = _parse_cards(resp.text)
    logger.info("InfoJobs status=%d cards_parsed=%d", resp.status_code, len(cards))
    return cards, resp.status_code


def _fetch_all_pages(
    db: Session,
    platform: Platform,
    keyword: str,
    city: str | None,
    expanded: frozenset[str],
    cutoff: datetime,
    anchor_id: str | None,
) -> list[dict]:
    collected: dict[str, dict] = {}
    url = _search_url(keyword, city)

    for page in range(1, MAX_PAGES + 1):
        try:
            cards, status_code = _fetch_page(url, page)
            if page == 1:
                record_structural_check(
                    db, platform, ok=bool(cards), step="listagem (regex de card no HTML)",
                    detail=None if cards else f"HTTP {status_code} OK, 0 cards extraídos pelo regex de listagem",
                )
        except Exception as exc:
            logger.warning("InfoJobs fetch error page=%d kw=%s city=%s: %s", page, keyword, city, exc)
            break

        if not cards:
            break

        anchor_found = anchor_id is not None and any(job["external_id"] == anchor_id for job in cards)
        cutoff_reached = any(
            job["published_at"] is not None and job["published_at"] < cutoff
            for job in cards
        )
        recent = [
            job for job in cards
            if job["published_at"] is None or job["published_at"] >= cutoff
        ]
        matched = [job for job in recent if _title_matches(job["title"], expanded)]
        logger.info("InfoJobs: %d/%d vagas passaram no filtro de titulo", len(matched), len(recent))

        for job in matched:
            collected.setdefault(job["external_id"], job)

        if not recent:
            break
        if cutoff_reached:
            logger.info("InfoJobs: cutoff %s atingido na página %d — encerrando paginação", cutoff.date(), page)
            break
        if anchor_found:
            logger.info("InfoJobs: anchor %s encontrado na página %d — encerrando paginação", anchor_id, page)
            break
        if len(cards) < PAGE_SIZE:
            break

        if page < MAX_PAGES:
            time.sleep(PAGE_DELAY_SECONDS)
    else:
        logger.info("InfoJobs: limite de segurança de %d páginas atingido para kw=%s city=%s", MAX_PAGES, keyword, city)

    return list(collected.values())


def _fetch_details_parallel(candidates: list[dict], max_workers: int = 5) -> None:
    if not candidates:
        return
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        results = executor.map(lambda j: _detail_fields(j["url"]), candidates)
        for job_data, detail_fields in zip(candidates, results):
            if not detail_fields:
                continue
            job_data.update({key: value for key, value in detail_fields.items() if value is not None})
            job_data["level"] = _parse_level(f"{job_data['title']} {job_data.get('description') or ''}")
            job_data["job_type"] = _parse_job_type(job_data.get("description") or "")
            job_data["remote"] = _is_remote(
                job_data["title"],
                job_data.get("location"),
                job_data.get("description"),
            )


def collect(
    db: Session,
    keyword: str,
    city: str | None = None,
    user_id: int | None = None,
) -> tuple[int, int]:
    from app.models.job import Job

    platform = ensure_platform(db, PLATFORM_NAME, PLATFORM_SLUG)
    log = open_sync_log(db, platform, user_id)
    latest_date, anchor_id = get_platform_sync_anchor(db, JobPlatform.INFOJOBS, keyword)
    cutoff = compute_sync_cutoff(latest_date, max_days=get_search_lookback_days(db))
    expanded = _expand_keyword(keyword)

    jobs_found = 0
    jobs_new = 0
    try:
        raw_candidates = _fetch_all_pages(db, platform, keyword, city, expanded, cutoff, anchor_id)

        if city is None:
            candidates = raw_candidates
            detail_targets = candidates
        else:
            needs_location = [
                job for job in raw_candidates
                if not job.get("remote") and not job.get("location")
            ]
            _fetch_details_parallel(needs_location)

            candidates = [job for job in raw_candidates if _should_keep_location(job, city)]
            detailed_ids = {job["external_id"] for job in needs_location}
            detail_targets = [job for job in candidates if job["external_id"] not in detailed_ids]

        _fetch_details_parallel(detail_targets)

        candidate_ids = [job["external_id"] for job in candidates]
        existing_ids = set()
        if candidate_ids:
            existing_ids = {
                row[0]
                for row in db.query(Job.external_id)
                .filter(Job.external_id.in_(candidate_ids), Job.platform == JobPlatform.INFOJOBS)
                .all()
            }

        jobs_found = len(candidates)
        for job_data in candidates:
            save_job(db, job_data)
            if job_data["external_id"] not in existing_ids:
                jobs_new += 1

        close_sync_log(db, log, jobs_found=jobs_found, jobs_new=jobs_new)
        logger.info("InfoJobs [%s @ %s]: %d vagas, %d novas", keyword, city or "Brasil", jobs_found, jobs_new)
    except Exception as exc:
        close_sync_log(db, log, jobs_found=jobs_found, jobs_new=jobs_new, error=str(exc))
        logger.warning("InfoJobs [%s @ %s] erro: %s", keyword, city or "Brasil", exc)

    return jobs_found, jobs_new
