"""
Coleta vagas do InfoJobs por HTML publico.
"""
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
from app.services.collectors.html_utils import html_to_text
from app.services.job_service import close_sync_log, ensure_platform, open_sync_log, save_job

logger = logging.getLogger(__name__)

PLATFORM_NAME = "InfoJobs"
PLATFORM_SLUG = "infojobs"
BASE_URL = "https://www.infojobs.com.br"
PAGE_SIZE = 20
MAX_PAGES = 2

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
_TAG_RE = re.compile(r"<[^>]+>")
_REMOTE_KEYWORDS = frozenset(["home office", "remoto", "remote", "híbrido", "hibrido"])
_MAX_AGE = timedelta(days=30)

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
    lower = text.lower()
    if "junior" in lower or "júnior" in lower or "trainee" in lower or " jr" in f" {lower}":
        return JobLevel.JUNIOR
    if "pleno" in lower or " pl" in f" {lower}":
        return JobLevel.PLENO
    if "senior" in lower or "sênior" in lower or " sr" in f" {lower}":
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
            "external_id": _external_id_from_url(url),
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


def _detail_description(url: str) -> str | None:
    try:
        resp = httpx.get(url, headers=HEADERS, timeout=10, follow_redirects=True)
        resp.raise_for_status()
    except Exception as exc:
        logger.debug("InfoJobs detail failed for %s: %s", url, exc)
        return None

    text = html_to_text(resp.text)
    if not text:
        return None

    for marker in ("Descrição", "Atividades", "Requisitos", "Sobre a vaga"):
        idx = text.lower().find(marker.lower())
        if idx >= 0:
            return text[idx: idx + 4000].strip()
    return text[:2500].strip()


def _fetch_page(url: str, page: int) -> list[dict]:
    params = {"Page": page} if page > 1 else None
    logger.info("InfoJobs GET %s page=%d", url, page)
    resp = httpx.get(url, params=params, headers=HEADERS, timeout=12, follow_redirects=True)
    resp.raise_for_status()
    cards = _parse_cards(resp.text)
    logger.info("InfoJobs status=%d cards_parsed=%d", resp.status_code, len(cards))
    return cards


def _fetch_all_pages(keyword: str, city: str | None, expanded: frozenset[str]) -> list[dict]:
    collected: dict[str, dict] = {}
    cutoff = datetime.now(timezone.utc) - _MAX_AGE
    url = _search_url(keyword, city)

    for page in range(1, MAX_PAGES + 1):
        try:
            cards = _fetch_page(url, page)
        except Exception as exc:
            logger.warning("InfoJobs fetch error page=%d kw=%s city=%s: %s", page, keyword, city, exc)
            break

        if not cards:
            break

        recent = [
            job for job in cards
            if job["published_at"] is None or job["published_at"] >= cutoff
        ]
        matched = [job for job in recent if _title_matches(job["title"], expanded)]
        logger.info("InfoJobs: %d/%d vagas passaram no filtro de titulo", len(matched), len(recent))

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
    expanded = _expand_keyword(keyword)

    jobs_found = 0
    jobs_new = 0
    try:
        candidates = [
            job for job in _fetch_all_pages(keyword, city, expanded)
            if city is None or _should_keep_location(job, city)
        ]

        _fetch_details_parallel(candidates)

        candidate_ids = [job["external_id"] for job in candidates]
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
