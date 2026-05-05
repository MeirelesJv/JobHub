# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

JobHub is a unified job-search platform for Brazilian job seekers. It aggregates listings from multiple platforms (Indeed, LinkedIn, Gupy, Catho, InfoJobs), automates applications, and tracks application status — all in one place. A Chrome extension runs silently in the background to collect listings and execute applications on platforms without public APIs.

The product is being built in three phases. This repository may contain only the scope document (`JobHub_Escopo.docx`) at early stages.

## Planned Architecture

### Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js, TailwindCSS, React Query |
| Backend | Python FastAPI, PostgreSQL, Redis, Celery |
| Chrome Extension | Manifest V3, Playwright, chrome.runtime |
| AI | Claude API (matching, assisted applications, form analysis) |
| Scraping | Playwright, SerpAPI (optional fallback) |
| Infrastructure | Docker, Railway or Render, AWS S3 |

Authentication: email + password with JWT sessions — no OAuth in the MVP.

### Repository structure (intended)

```
jobhub/
  webapp/          # Next.js frontend
  api/             # FastAPI backend
  extension/       # Chrome extension (Manifest V3)
  infra/           # Docker, deployment configs
```

### Key architectural decisions

**Chrome extension ↔ webapp communication**: The extension is a Service Worker (MV3) that communicates bidirectionally with the webapp via `chrome.runtime`. It silently opens background tabs to fill and submit application forms, then closes them, displaying a discrete toast "Vaga registrada no JobHub ✓".

**Job aggregation**: Each platform has a different integration strategy:
- **Indeed**: official API (job collection + applications)
- **LinkedIn**: public RSS feed (collection only in MVP; Easy Apply via extension in v2)
- **Gupy**: public API (collection; application via extension in v2)
- **Catho / InfoJobs**: Playwright scraping (collection; application via extension in v2)

**Application modes**:
- *Turbo*: fully silent — extension fills and submits the form automatically
- *Assisted*: AI pre-fills what it knows; user reviews open-ended questions in a modal; extension submits after user approves
- *Manual*: redirects to the original site; extension detects the user clicking "apply" and auto-registers the job in the kanban

**Background jobs**: Celery + Redis handles the scraping queue (job collection every 2h) and daily status sync for Gupy, InfoJobs, and Catho.

**AI usage**: Claude API is used for job-profile matching (ranking the feed), generating draft answers for open-ended application questions, and analyzing application forms to distinguish auto-fillable fields from fields that need the user.

## Development Phases

### Phase 1 — MVP (8–10 weeks)
- Auth: registration, login, JWT sessions
- User profile (progressive completion)
- Resume editor (sections: experience, education, skills, languages)
- Job aggregator: Indeed (API) + LinkedIn (RSS)
- Unified feed with basic filters (role, location, work mode, level, salary, platform)
- Indeed automatic application (Turbo mode)
- Application kanban (manual updates in MVP)
- Chrome extension v1: silent background collection + external application detection
- 3-step guided onboarding

### Phase 2 — Expansion (4–6 weeks)
- Scraping Catho, InfoJobs, Gupy
- Application via extension: LinkedIn Easy Apply + Gupy
- Automatic status sync (Gupy, InfoJobs, Catho) — 1x/day via extension
- Smart reminder for LinkedIn jobs with no response after 14 days
- AI matching — feed ranked by profile fit
- Assisted application mode with review modal

### Phase 3 — Intelligence (ongoing)
- Adaptive resume per job using AI
- Draft open-ended answers on demand
- Email alerts for matching new jobs
- Application analytics (response rate, average time, etc.)
- Monetization implementation (premium plans)

## Key Risks to Keep in Mind

- **Scraping vs. ToS**: Scraping violates most platforms' terms. Prioritize official APIs. Use humanized delays, user-agent rotation, and limited access frequency to reduce bot detection risk.
- **LGPD**: Resume and personal data are sensitive. Explicit consent must be collected during onboarding. Privacy policy required from MVP.
- **Chrome Web Store review**: Takes 1–2 weeks. Start the extension publication process early; don't block webapp launch on it.
- **Scraping fragility**: Layout changes break collectors. Plan automated scraping tests and periodic monitoring.
- **Browser must be open**: Background sync requires the browser. Mitigate with automatic sync on browser open + manual "Update jobs" button in the dashboard.

## Next Steps (from scope document)

1. Define database schema (entity modeling)
2. Create repository and configure Next.js + FastAPI projects
3. Implement auth flow (registration, login, JWT sessions)
4. Configure Indeed API integration
5. Build basic job feed (Indeed + LinkedIn RSS)
6. Create Chrome extension skeleton (Manifest V3)
7. Start Chrome Web Store publication process in parallel
