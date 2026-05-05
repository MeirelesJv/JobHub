"""
Coleta vagas da Catho via curl_cffi (impersonate Chrome para bypass de bot detection).
"""
import logging
import re
import time
import unicodedata
from datetime import datetime, timedelta, timezone
from html import unescape

from sqlalchemy.orm import Session

from app.models.job import JobLevel, JobPlatform, JobType
from app.services.collectors.vagas_collector import _build_keyword_matcher, _title_matches
from app.services.job_service import close_sync_log, ensure_platform, open_sync_log, save_job

logger = logging.getLogger(__name__)

PLATFORM_NAME = "Catho"
PLATFORM_SLUG = "catho"
BASE_URL = "https://www.catho.com.br"
PAGE_SIZE = 20
MAX_PAGES = 3

_HEADERS = {"Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8"}
_REMOTE_KEYWORDS = frozenset(["home office", "remoto", "remote", "híbrido", "hibrido", "trabalhe de casa"])
_MAX_AGE = timedelta(days=60)
_CITY_STATES = {
    "sao-paulo": "sp",
    "rio-de-janeiro": "rj",
    "belo-horizonte": "mg",
    "curitiba": "pr",
    "porto-alegre": "rs",
    "brasilia": "df",
    "recife": "pe",
    "salvador": "ba",
    "fortaleza": "ce",
    "florianopolis": "sc",
}

_CARD_SEP = re.compile(r"(?=<li [^>]*data-offer-item=)")
_OFFER_ID = re.compile(r'data-offer-item=["\']?(\d+)')
_TITLE_HREF = re.compile(r'class="title_offer"[^>]*>.*?<a[^>]+href="([^"]+)"[^>]+title="([^"]+)"', re.S)
_COMPANY = re.compile(r'class="text-12">([^<]+)<')
_LOCATION = re.compile(r'i_job_location[^>]*></span>\s*<strong>[^<]+</strong>\s*-\s*([^<\r\n]+)')
_SALARY_STR = re.compile(r'i_salary[^>]*></span>\s*<strong>([^<]+)</strong>')
_DATE_TAG = re.compile(r'class="tag pub_[^"]+">([^<]+)<')


def _cffi_get(url: str, timeout: int = 15):
    from curl_cffi import requests as cffi
    return cffi.get(url, impersonate="chrome124", headers=_HEADERS, timeout=timeout, allow_redirects=True)


def _ascii_slug(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text.strip().lower())
    ascii_text = normalized.encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", "-", ascii_text).strip("-")


def _search_url(keyword: str, city: str | None = None, page: int = 1) -> str:
    keyword_slug = _ascii_slug(keyword)
    if city:
        city_name = city
        state = None
        if "," in city:
            city_name, state = [p.strip() for p in city.split(",", 1)]
        city_slug = _ascii_slug(city_name)
        inferred_state = state or _CITY_STATES.get(city_slug)
        location_segment = f"{city_slug}-{_ascii_slug(inferred_state)}/" if inferred_state else f"{city_slug}/"
    else:
        location_segment = ""

    page_segment = f"p{page}/" if page > 1 else ""
    return f"{BASE_URL}/vagas/{keyword_slug}/{location_segment}{page_segment}"


def _is_remote(title: str, location: str | None, description: str | None = None) -> bool:
    combined = " ".join(filter(None, [title, location, description])).lower()
    return any(kw in combined for kw in _REMOTE_KEYWORDS)


def _should_keep_location(job: dict, city: str) -> bool:
    if job.get("remote"):
        return True
    loc = (job.get("location") or "").lower()
    return city.split(",", 1)[0].strip().lower() in loc


def _parse_level(text: str) -> JobLevel | None:
    lower = text.lower()
    if "junior" in lower or "júnior" in lower or "trainee" in lower or f" jr" in f" {lower}":
        return JobLevel.JUNIOR
    if "pleno" in lower or f" pl" in f" {lower}":
        return JobLevel.PLENO
    if "senior" in lower or "sênior" in lower or f" sr" in f" {lower}":
        return JobLevel.SENIOR
    return None


def _parse_job_type(text: str) -> JobType | None:
    lower = text.lower()
    if "pj" in lower or "prestador" in lower or "pessoa jurídica" in lower or "pessoa juridica" in lower:
        return JobType.PJ
    if "clt" in lower or "efetivo" in lower:
        return JobType.CLT
    return None


def _parse_date(text: str) -> datetime | None:
    now = datetime.now(timezone.utc)
    lower = text.lower()
    if "hoje" in lower:
        return now
    if "ontem" in lower:
        return now - timedelta(days=1)
    match = re.search(r"\b(\d{1,2})/(\d{1,2})\b", text)
    if match:
        day, month = map(int, match.groups())
        parsed = datetime(now.year, month, day, tzinfo=timezone.utc)
        if parsed > now + timedelta(days=1):
            parsed = parsed.replace(year=now.year - 1)
        return parsed
    return None


def _parse_salary(text: str) -> tuple[float | None, float | None]:
    numbers = []
    for raw in re.findall(r"R\$\s*([\d\.\,]+)", text):
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
    segments = _CARD_SEP.split(html)
    jobs: list[dict] = []

    for seg in segments[1:]:
        id_m = _OFFER_ID.search(seg)
        if not id_m:
            continue
        external_id = id_m.group(1)

        title_m = _TITLE_HREF.search(seg)
        if not title_m:
            continue
        href = title_m.group(1)
        title = unescape(title_m.group(2)).strip()
        if not title:
            continue

        url = href if href.startswith("http") else f"{BASE_URL}{href}"

        company_m = _COMPANY.search(seg)
        company = unescape(company_m.group(1).strip()) if company_m else "Empresa não informada"

        loc_m = _LOCATION.search(seg)
        location = unescape(loc_m.group(1).strip()) if loc_m else None

        salary_m = _SALARY_STR.search(seg)
        salary_text = salary_m.group(1).strip() if salary_m else ""
        salary_min, salary_max = _parse_salary(salary_text)

        date_m = _DATE_TAG.search(seg)
        published_at = _parse_date(date_m.group(1)) if date_m else None

        jobs.append({
            "external_id": external_id,
            "title": title,
            "company": company,
            "location": location,
            "description": None,
            "salary_min": salary_min,
            "salary_max": salary_max,
            "job_type": _parse_job_type(seg),
            "level": _parse_level(title),
            "platform": JobPlatform.CATHO,
            "url": url,
            "published_at": published_at,
            "remote": _is_remote(title, location),
            "is_active": True,
        })

    return jobs


def _fetch_all_pages(keyword: str, city: str | None, matcher: dict) -> list[dict]:
    collected: dict[str, dict] = {}
    cutoff = datetime.now(timezone.utc) - _MAX_AGE

    for page in range(1, MAX_PAGES + 1):
        url = _search_url(keyword, city, page)
        try:
            logger.info("Catho GET %s", url)
            resp = _cffi_get(url)
            resp.raise_for_status()
        except Exception as exc:
            logger.warning("Catho fetch error page=%d kw=%s city=%s: %s", page, keyword, city, exc)
            break

        cards = _parse_cards(resp.text)
        logger.info("Catho page=%d cards=%d", page, len(cards))

        if not cards:
            break

        recent = [j for j in cards if j["published_at"] is None or j["published_at"] >= cutoff]
        matched = [j for j in recent if _title_matches(j["title"], matcher)]
        logger.info("Catho: %d/%d vagas passaram no filtro de título", len(matched), len(recent))

        for job in matched:
            collected.setdefault(job["external_id"], job)

        if len(cards) < PAGE_SIZE or not recent:
            break

        if page < MAX_PAGES:
            time.sleep(1)

    return list(collected.values())


def collect(
    db: Session,
    keyword: str,
    city: str | None = None,
    user_id: int | None = None,
) -> tuple[int, int]:
    platform = ensure_platform(db, PLATFORM_NAME, PLATFORM_SLUG)
    log = open_sync_log(db, platform, user_id)
    matcher = _build_keyword_matcher(keyword)

    jobs_found = 0
    jobs_new = 0
    try:
        candidates = [
            job for job in _fetch_all_pages(keyword, city, matcher)
            if city is None or _should_keep_location(job, city)
        ]

        from app.models.job import Job

        candidate_ids = [job["external_id"] for job in candidates]
        existing_ids = {
            row[0]
            for row in db.query(Job.external_id)
            .filter(Job.external_id.in_(candidate_ids), Job.platform == JobPlatform.CATHO)
            .all()
        }

        jobs_found = len(candidates)
        for job_data in candidates:
            save_job(db, job_data)
            if job_data["external_id"] not in existing_ids:
                jobs_new += 1

        close_sync_log(db, log, jobs_found=jobs_found, jobs_new=jobs_new)
        logger.info("Catho [%s @ %s]: %d vagas, %d novas", keyword, city or "Brasil", jobs_found, jobs_new)
    except Exception as exc:
        close_sync_log(db, log, jobs_found=jobs_found, jobs_new=jobs_new, error=str(exc))
        logger.warning("Catho [%s @ %s] erro: %s", keyword, city or "Brasil", exc)

    return jobs_found, jobs_new
