"""
Coleta vagas do portal.gupy.io via Playwright headless.

Estratégia anti-ban:
  - Intercepção de rede: captura respostas da API (JSON) sem parsing de DOM frágil
  - Stealth: mascara navigator.webdriver, injeta window.chrome, plugins e languages reais
  - Viewport + User-Agent aleatórios por sessão
  - Delays humanizados entre páginas (scroll = paginação do infinite-scroll)
  - 1 browser por lote de keywords — sem paralelismo
  - MAX_SCROLL_PAGES conservador (2 scrolls = 3 páginas totais)
"""
import logging
import json
import random
import re
import time
import unicodedata
from datetime import datetime, timedelta, timezone
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen

from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout
from sqlalchemy.orm import Session

from app.models.job import JobLevel, JobPlatform
from app.models.platform import Platform
from app.services.collectors.html_utils import format_gupy_description, html_to_text
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

PLATFORM_NAME = "Gupy"
PLATFORM_SLUG = "gupy"
PORTAL_BASE   = "https://portal.gupy.io"
PORTAL_API_BASE = "https://employability-portal.gupy.io"
MAX_SCROLL_PAGES = 2   # scrolls adicionais após a 1ª carga (total: 3 páginas)
_API_PAGE_LIMIT = 100

_VIEWPORTS = [
    {"width": 1920, "height": 1080},
    {"width": 1440, "height": 900},
    {"width": 1366, "height": 768},
    {"width": 1280, "height": 800},
]

_USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
]

_BROWSER_ARGS = [
    "--disable-blink-features=AutomationControlled",
    "--disable-dev-shm-usage",
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-extensions",
    "--disable-default-apps",
]

# Injected em cada página antes de qualquer script do site
_STEALTH_SCRIPT = """
// Remove flag de automação
Object.defineProperty(navigator, 'webdriver', {get: () => undefined});

// Chrome real tem essas propriedades
window.chrome = {
    runtime: {},
    loadTimes: function() {},
    csi: function() {},
    app: {},
};

// Plugins não-vazios (headless tem array vazio)
Object.defineProperty(navigator, 'plugins', {
    get: () => {
        const arr = [1, 2, 3, 4, 5];
        arr.item = i => arr[i];
        arr.namedItem = () => undefined;
        arr.refresh = () => {};
        return arr;
    }
});

// Idiomas reais
Object.defineProperty(navigator, 'languages', {
    get: () => ['pt-BR', 'pt', 'en-US', 'en']
});

// Permissions API real (headless retorna "denied" para notificações)
const originalQuery = window.navigator.permissions.query;
window.navigator.permissions.query = (params) => {
    if (params.name === 'notifications') {
        return Promise.resolve({state: 'prompt'});
    }
    return originalQuery(params);
};
"""

_REMOTE_KEYWORDS = frozenset(["remoto", "remote", "home office"])

# Vagas marcadas como "hybrid" no campo estruturado, mas cuja descrição oferece
# remoto como alternativa explícita (ex: "Híbrido ou remoto") — texto puro, sem tags.
_HYBRID_OR_REMOTE_RE = re.compile(
    r"h[ií]brido\s+ou\s+remot[oa]|remot[oa]\s+ou\s+h[ií]brido",
    re.IGNORECASE,
)

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


def _expand_keyword(keyword: str) -> frozenset[str]:
    words = {w for w in keyword.lower().split() if len(w) >= 3}
    expanded = set(words)
    for word in words:
        for group in _SYNONYM_GROUPS:
            if word in group:
                expanded |= group
    return frozenset(expanded)


def _title_matches(title: str, expanded: frozenset[str]) -> bool:
    return any(term in title.lower() for term in expanded)


def _should_keep_location(job: dict, city: str) -> bool:
    if job.get("remote"):
        return True
    loc = (job.get("location") or "").lower()
    return city.lower() in loc or any(kw in loc for kw in _REMOTE_KEYWORDS)


def _parse_level(text: str) -> JobLevel | None:
    normalized = unicodedata.normalize("NFKD", text.lower()).encode("ascii", "ignore").decode("ascii")
    if re.search(r"(?<![a-z0-9])(?:junior|jr|trainee)(?![a-z0-9])", normalized):
        return JobLevel.JUNIOR
    if re.search(r"(?<![a-z0-9])(?:pleno|pl)(?![a-z0-9])", normalized):
        return JobLevel.PLENO
    if re.search(r"(?<![a-z0-9])(?:senior|sr)(?![a-z0-9])", normalized):
        return JobLevel.SENIOR
    return None


def _extract_company(raw: dict, job_url: str) -> str:
    """Tenta múltiplos campos e extrai do subdomínio como fallback."""
    # Campos que o portal pode retornar dependendo da versão da API
    for field in ("careerPageName", "companyName"):
        v = (raw.get(field) or "").strip()
        if v:
            return v
    career_page = raw.get("careerPage") or {}
    v = (career_page.get("name") or "").strip()
    if v:
        return v

    company_data = raw.get("company") or {}
    v = (company_data.get("name") or company_data.get("careerPageName") or "").strip()
    if v:
        return v
    # Fallback: subdomínio da URL (ex: roldao.gupy.io → Roldao)
    try:
        import re
        m = re.match(r"https://([^.]+)\.gupy\.io", job_url)
        if m:
            slug = m.group(1)
            # Capitaliza e remove sufixos comuns como &123&inactive
            slug = slug.split("&")[0]
            return slug.replace("-", " ").title()
    except Exception:
        pass
    return "Empresa não informada"


def _parse_job(raw: dict) -> dict | None:
    job_id = str(raw.get("id", ""))
    if not job_id:
        return None
    title = (raw.get("name") or "").strip()
    if not title:
        return None

    city_name = raw.get("city") or raw.get("addressCity") or ""
    state_name = raw.get("state") or raw.get("addressState") or ""
    location   = ", ".join(filter(None, [city_name, state_name])) or None

    published_raw = raw.get("publishedDate") or raw.get("publishedAt") or raw.get("createdAt")
    published_at  = None
    if published_raw:
        try:
            published_at = datetime.fromisoformat(published_raw.replace("Z", "+00:00"))
            if published_at.tzinfo is None:
                published_at = published_at.replace(tzinfo=timezone.utc)
        except ValueError:
            pass

    workplace = (raw.get("workplaceType") or "").lower()
    remote    = workplace in ("remote", "remoto")
    if not remote and workplace == "hybrid":
        desc_text = html_to_text(raw.get("description") or "") or ""
        remote = bool(_HYBRID_OR_REMOTE_RE.search(desc_text))

    expires_at = None
    expires_raw = raw.get("applicationDeadline") or raw.get("expiresAt") or raw.get("registerEndDate")
    if expires_raw:
        try:
            expires_at = datetime.fromisoformat(expires_raw.replace("Z", "+00:00"))
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
        except ValueError:
            pass

    subdomain = (
        raw.get("subdomain")
        or (raw.get("company") or {}).get("subdomain")
        or (raw.get("careerPage") or {}).get("subdomain")
    )
    job_url = raw.get("jobUrl")
    if not job_url and subdomain:
        job_url = f"https://{subdomain}.gupy.io/jobs/{job_id}?jobBoardSource=gupy_public_page"
    if not job_url:
        job_url = f"https://portal.gupy.io/job/{job_id}"
    company = _extract_company(raw, job_url)

    return {
        "external_id":  job_id,
        "title":        title,
        "company":      company,
        "location":     location,
        "description":  format_gupy_description(raw.get("description")),
        "level":        _parse_level(title),
        "platform":     JobPlatform.GUPY,
        "url":          job_url,
        "published_at": published_at,
        "expires_at":    expires_at,
        "remote":       remote,
        "is_active":    True,
    }


def _build_search_url(keyword: str, state: str | None) -> str:
    # O portal usa rota path-based: /job-search/<params sem ?>
    # Ordenar por mais recentes maximiza cobertura de vagas novas
    parts = [
        f"sortBy=publishedDate",
        f"sortOrder=desc",
        f"term={quote(keyword)}",
    ]
    if state:
        parts.append(f"state={quote(state)}")
    return f"{PORTAL_BASE}/job-search/" + "&".join(parts)


def _wait_for_jobs_api(page, timeout: int) -> None:
    wait_for_response = getattr(page, "wait_for_response", None)
    if wait_for_response is not None:
        wait_for_response(_is_jobs_api_response, timeout=timeout)
        return
    page.wait_for_timeout(min(timeout, 2_000))


def _build_jobs_api_url(keyword: str, offset: int = 0) -> str:
    params = {
        "jobName": keyword,
        "limit": str(_API_PAGE_LIMIT),
        "offset": str(offset),
    }
    return f"{PORTAL_API_BASE}/api/v1/jobs?{urlencode(params)}"


def _is_jobs_api_response(resp) -> bool:
    return "/api/v1/jobs" in resp.url and resp.status == 200


def _job_passes_filters(
    job: dict,
    state: str | None,
    expanded: frozenset[str],
    cutoff: datetime,
) -> bool:
    if job["published_at"] is not None and job["published_at"] < cutoff:
        return False
    if job.get("expires_at") is not None and job["expires_at"] < datetime.now(timezone.utc):
        return False
    if not _title_matches(job["title"], expanded):
        return False
    if state and not job.get("remote"):
        loc = (job.get("location") or "").lower()
        if state.lower() not in loc:
            return False
    return True


def _deactivate_stale_jobs(db: Session) -> None:
    from app.models.job import Job
    from sqlalchemy import or_

    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=get_search_lookback_days(db))
    stale_count = (
        db.query(Job)
        .filter(
            Job.platform == JobPlatform.GUPY,
            Job.is_active.is_(True),
            or_(
                Job.published_at.isnot(None) & (Job.published_at < cutoff),
                Job.expires_at.isnot(None) & (Job.expires_at < now),
            ),
        )
        .update({Job.is_active: False}, synchronize_session=False)
    )
    if stale_count:
        logger.info("Gupy: %d vagas antigas/expiradas marcadas como inativas", stale_count)
        db.commit()


def _fetch_keyword_via_api(
    db: Session,
    platform: Platform,
    keyword: str,
    state: str | None,
    expanded: frozenset[str],
    cutoff: datetime,
    anchor_id: str | None,
) -> tuple[list[dict], bool]:
    collected: dict[str, dict] = {}
    api_loaded = False

    for page_n in range(MAX_SCROLL_PAGES + 1):
        offset = page_n * _API_PAGE_LIMIT
        url = _build_jobs_api_url(keyword, offset=offset)
        req = Request(
            url,
            headers={
                "Accept": "application/json",
                "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8",
                "Referer": _build_search_url(keyword, state=None),
                "User-Agent": random.choice(_USER_AGENTS),
            },
        )
        try:
            with urlopen(req, timeout=20) as resp:
                payload = json.loads(resp.read().decode("utf-8"))
        except Exception as exc:
            logger.debug("Gupy API falhou em %s: %s", url, exc)
            break

        batch = payload.get("data") if isinstance(payload, dict) else None
        if not batch:
            break
        api_loaded = True
        if page_n == 0:
            record_structural_check(db, platform, ok=True, step="API interna (employability-portal)")

        added = 0
        anchor_found = False
        cutoff_reached = False
        for raw in batch:
            job = _parse_job(raw)
            if not job:
                continue
            if anchor_id is not None and job["external_id"] == anchor_id:
                anchor_found = True
            if job["published_at"] is not None and job["published_at"] < cutoff:
                cutoff_reached = True
            if not _job_passes_filters(job, state, expanded, cutoff):
                continue
            if job["external_id"] not in collected:
                collected[job["external_id"]] = job
                added += 1

        logger.info("Gupy API: pagina %d -> +%d vagas", page_n + 1, added)

        pagination = payload.get("pagination") or {}
        total = pagination.get("total")
        if anchor_found:
            logger.info("Gupy API: anchor %s encontrado na pagina %d — encerrando paginação", anchor_id, page_n + 1)
            break
        if cutoff_reached:
            logger.info("Gupy API: cutoff %s atingido na pagina %d — encerrando paginação", cutoff.date(), page_n + 1)
            break
        if added == 0 or total is None or offset + _API_PAGE_LIMIT >= total:
            break

    return list(collected.values()), api_loaded


def _fetch_keyword_in_browser(
    db: Session,
    platform: Platform,
    browser,
    keyword: str,
    state: str | None,
    expanded: frozenset[str],
    cutoff: datetime,
    anchor_id: str | None,
) -> list[dict]:
    """
    Usa um browser aberto para interceptar a API de vagas,
    paginar via scroll e retornar vagas que batem no keyword/localizacao.
    """
    api_jobs, api_loaded = _fetch_keyword_via_api(db, platform, keyword, state, expanded, cutoff, anchor_id)
    if api_loaded:
        return api_jobs

    collected: dict[str, dict] = {}

    viewport = random.choice(_VIEWPORTS)
    ua = random.choice(_USER_AGENTS)
    search_url = _build_search_url(keyword, state=None)

    ctx = browser.new_context(
        viewport=viewport,
        user_agent=ua,
        locale="pt-BR",
        timezone_id="America/Sao_Paulo",
        extra_http_headers={"Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8"},
    )
    ctx.add_init_script(_STEALTH_SCRIPT)
    page = ctx.new_page()

    # Buffer das respostas interceptadas entre cada scroll
    _pending: list[list[dict]] = []

    def _on_response(resp):
        # Captura qualquer chamada à API de vagas do portal
        if _is_jobs_api_response(resp):
            try:
                data = resp.json()
                batch = data.get("data") if isinstance(data, dict) else None
                if batch:
                    _pending.append(batch)
                    logger.debug(
                        "Gupy intercept: %d vagas em %s", len(batch), resp.url
                    )
            except Exception:
                pass

    page.on("response", _on_response)

    def _drain_pending() -> tuple[int, bool, bool]:
        """Processa buffer e retorna (novas vagas adicionadas, anchor encontrado, cutoff atingido)."""
        added = 0
        anchor_found = False
        cutoff_reached = False
        for batch in _pending:
            for raw in batch:
                job = _parse_job(raw)
                if not job:
                    continue
                if anchor_id is not None and job["external_id"] == anchor_id:
                    anchor_found = True
                if job["published_at"] is not None and job["published_at"] < cutoff:
                    cutoff_reached = True
                if not _job_passes_filters(job, state, expanded, cutoff):
                    continue
                if job["external_id"] not in collected:
                    collected[job["external_id"]] = job
                    added += 1
        _pending.clear()
        return added, anchor_found, cutoff_reached

    try:
        # ── Carga inicial ────────────────────────────────────────────────────
        logger.info("Gupy Playwright → %s", search_url)
        try:
            page.goto(search_url, wait_until="domcontentloaded", timeout=30_000)
            if not _pending:
                _wait_for_jobs_api(page, timeout=15_000)
            time.sleep(0.8)
        except PWTimeout:
            logger.warning("Gupy: API nao respondeu na carga inicial")

        initial, anchor_found, cutoff_reached = _drain_pending()
        logger.info("Gupy: %d vagas na carga inicial", initial)

        if initial:
            record_structural_check(db, platform, ok=True, step="interceptação da API interna (Playwright)")

        if anchor_found:
            logger.info("Gupy: anchor %s encontrado na carga inicial — encerrando paginação", anchor_id)
            return list(collected.values())
        if cutoff_reached:
            logger.info("Gupy: cutoff %s atingido na carga inicial — encerrando paginação", cutoff.date())
            return list(collected.values())

        if not initial:
            # Página pode ter retornado erro ou CAPTCHA — abandona
            logger.warning("Gupy: nenhuma vaga interceptada — possível bloqueio")
            record_structural_check(
                db, platform, ok=False, step="interceptação da API interna (Playwright)",
                detail="Página carregou mas nenhuma resposta JSON de vagas foi interceptada — possível CAPTCHA/bloqueio ou mudança na API",
            )
            return []

        # ── Paginação via scroll ─────────────────────────────────────────────
        for scroll_n in range(MAX_SCROLL_PAGES):
            # Scroll suave até o fim da página (simula leitura)
            page.evaluate("""
                window.scrollTo({top: document.body.scrollHeight, behavior: 'smooth'});
            """)

            time.sleep(random.uniform(1.2, 2.2))

            try:
                if not _pending:
                    _wait_for_jobs_api(page, timeout=6_000)
                time.sleep(0.5)
            except PWTimeout:
                pass

            added, anchor_found, cutoff_reached = _drain_pending()
            logger.info("Gupy: scroll %d → +%d vagas", scroll_n + 1, added)

            if anchor_found:
                logger.info("Gupy: anchor %s encontrado no scroll %d — encerrando paginação", anchor_id, scroll_n + 1)
                break
            if cutoff_reached:
                logger.info("Gupy: cutoff %s atingido no scroll %d — encerrando paginação", cutoff.date(), scroll_n + 1)
                break
            if added == 0:
                # Sem novas vagas = chegamos no fim
                break
    finally:
        page.close()
        ctx.close()

    return list(collected.values())


def collect_batch(
    db: Session,
    keywords: list[str],
    city: str | None = None,
    user_id: int | None = None,
) -> tuple[int, int]:
    from app.models.job import Job

    platform = ensure_platform(db, PLATFORM_NAME, PLATFORM_SLUG)
    log      = open_sync_log(db, platform, user_id)

    # Usa a cidade como filtro de estado no portal (ex: "São Paulo" → state=São Paulo)
    state = city.split(",")[0].strip() if city else None

    jobs_found = 0
    jobs_new   = 0
    try:
        _deactivate_stale_jobs(db)

        all_jobs: dict[str, dict] = {}
        lookback_days = get_search_lookback_days(db)

        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=True, args=_BROWSER_ARGS)
            try:
                for idx, keyword in enumerate(keywords):
                    expanded = _expand_keyword(keyword)
                    latest_date, anchor_id = get_platform_sync_anchor(db, JobPlatform.GUPY, keyword)
                    cutoff = compute_sync_cutoff(latest_date, max_days=lookback_days)
                    for job in _fetch_keyword_in_browser(db, platform, browser, keyword, state, expanded, cutoff, anchor_id):
                        existing = all_jobs.get(job["external_id"])
                        if existing:
                            if job.get("remote"):
                                existing["remote"] = True
                        else:
                            all_jobs[job["external_id"]] = job

                    if idx < len(keywords) - 1:
                        time.sleep(random.uniform(2.0, 3.5))
            finally:
                browser.close()

        candidates = [
            j for j in all_jobs.values()
            if city is None or _should_keep_location(j, city)
        ]

        candidate_ids = [j["external_id"] for j in candidates]
        existing_ids = {
            row[0]
            for row in db.query(Job.external_id)
            .filter(Job.external_id.in_(candidate_ids), Job.platform == JobPlatform.GUPY)
            .all()
        }

        jobs_found = len(candidates)
        for job_data in candidates:
            save_job(db, job_data)
            if job_data["external_id"] not in existing_ids:
                jobs_new += 1

        close_sync_log(db, log, jobs_found=jobs_found, jobs_new=jobs_new)
        logger.info(
            "Gupy batch [%d keywords @ %s]: %d vagas, %d novas",
            len(keywords), city or "Brasil", jobs_found, jobs_new,
        )
    except Exception as exc:
        close_sync_log(db, log, jobs_found=jobs_found, jobs_new=jobs_new, error=str(exc))
        logger.warning(
            "Gupy batch [%d keywords @ %s] erro: %s",
            len(keywords), city or "Brasil", exc,
        )

    return jobs_found, jobs_new


def collect(
    db: Session,
    keyword: str,
    city: str | None = None,
    user_id: int | None = None,
) -> tuple[int, int]:
    return collect_batch(db, [keyword], city=city, user_id=user_id)
