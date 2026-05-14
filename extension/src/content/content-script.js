/**
 * JobHub Content Script
 *
 * Injeta em:
 *   http://localhost:3000/*          → relay webapp ↔ extensão
 *   https://www.linkedin.com/jobs/*  → coleta de vagas + detecção de candidatura
 *   https://*.gupy.io/*              → detecção de vagas
 */

const hostname = location.hostname;
const pathname = location.pathname;
const DEBUG_APPLY = true;

// ─── Utils ────────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(fn, timeout = 6000, interval = 250) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const el = fn();
    if (el) return el;
    await sleep(interval);
  }
  return null;
}

function debugApply(event, data = {}) {
  if (!DEBUG_APPLY) return;
  const payload = {
    event,
    href: location.href,
    at: new Date().toISOString(),
    ...data,
  };
  console.log('[JobHub Apply Debug]', payload);
  chrome.storage?.local?.set?.({ lastApplyDebug: payload });
}

function sendRuntimeMessage(message) {
  try {
    chrome.runtime.sendMessage(message);
  } catch (err) {
    console.warn('[JobHub] Extension context unavailable. Reload the page after reloading the extension.', err);
  }
}

function currentLinkedInJobId() {
  const viewMatch = location.pathname.match(/\/jobs\/view\/(\d+)/);
  if (viewMatch) return viewMatch[1];

  const params = new URLSearchParams(location.search);
  const currentJobId = params.get('currentJobId') || params.get('jobId');
  if (currentJobId) return currentJobId;

  const selectedJob =
    document.querySelector('[data-job-id]')?.dataset.jobId ||
    document.querySelector('[data-occludable-job-id]')?.dataset.occludableJobId;
  if (selectedJob) return selectedJob;

  const jobLink = document.querySelector('a[href*="/jobs/view/"]')?.href;
  return jobLink?.match(/\/jobs\/view\/(\d+)/)?.[1] || null;
}

// ─── WEBAPP RELAY (localhost) ─────────────────────────────────────────────────

function initWebappRelay() {
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const { type } = event.data || {};

    if (type === 'JOBHUB_PING') {
      window.postMessage({ type: 'JOBHUB_PONG' }, '*');
      return;
    }
    if (type === 'JOBHUB_LOGIN') {
      sendRuntimeMessage({
        type:          'LOGIN',
        token:         event.data.token,
        refresh_token: event.data.refresh_token,
        user_id:       event.data.user_id,
        user_email:    event.data.user_email,
      });
      return;
    }
    if (type === 'JOBHUB_LOGOUT') {
      sendRuntimeMessage({ type: 'LOGOUT' });
      return;
    }
    if (type === 'JOBHUB_TRACK_APPLY') {
      sendRuntimeMessage({
        type:          'TRACK_APPLY',
        linkedinJobId: event.data.linkedinJobId,
        internalJobId: event.data.internalJobId,
      });
    }
  });
}

// ─── LINKEDIN JOB SEARCH — coleta de vagas ────────────────────────────────────

function extractJobCard(card) {
  // Job ID via data attribute (most reliable)
  const jobId = card.dataset.jobId
    || card.querySelector('[data-job-id]')?.dataset.jobId
    || card.querySelector('a[href*="/jobs/view/"]')?.href.match(/\/jobs\/view\/(\d+)/)?.[1];

  if (!jobId) return null;

  const titleEl =
    card.querySelector('a.job-card-container__link span[aria-hidden]') ||
    card.querySelector('.job-card-container__link span') ||
    card.querySelector('a[href*="/jobs/view/"] span');

  const companyEl =
    card.querySelector('.job-card-container__primary-description') ||
    card.querySelector('.artdeco-entity-lockup__subtitle span') ||
    card.querySelector('[class*="company"]');

  const locationEl =
    card.querySelector('.job-card-container__metadata-item') ||
    card.querySelector('[class*="location"]');

  // Easy Apply: look for lightning bolt icon or "Easy Apply" text
  const easyApply =
    !!card.querySelector('[data-control-name="jobdetails_topcard_inapply"]') ||
    card.textContent?.includes('Easy Apply') ||
    card.textContent?.includes('Candidatura simplificada');

  const remoteText = (locationEl?.textContent || '').toLowerCase();
  const remote = remoteText.includes('remote') || remoteText.includes('remoto');

  const title   = titleEl?.textContent?.trim();
  const company = companyEl?.textContent?.trim();
  const url     = `https://www.linkedin.com/jobs/view/${jobId}`;

  if (!title || !company) return null;

  return {
    external_id: jobId,
    platform:    'linkedin',
    title,
    company,
    url,
    easy_apply:  !!easyApply,
    location:    locationEl?.textContent?.trim() || null,
    remote,
  };
}

async function collectLinkedInSearchJobs() {
  // Wait for job cards to render
  await waitFor(() =>
    document.querySelector('li[data-occludable-job-id], .job-card-container, .jobs-search__results-list li'),
    8000
  );
  await sleep(1500);

  const cardSelectors = [
    'li[data-occludable-job-id]',
    'div.job-card-container',
    'li.jobs-search__results-list-item',
    'div[data-job-id]',
  ];

  let cards = [];
  for (const sel of cardSelectors) {
    cards = [...document.querySelectorAll(sel)];
    if (cards.length > 0) break;
  }

  const jobs = cards.map(extractJobCard).filter(Boolean);

  if (jobs.length > 0) {
    sendRuntimeMessage({ type: 'INGEST_JOBS', jobs });
    console.log(`[JobHub] Collected ${jobs.length} jobs from LinkedIn search`);
  }

  // Watch for pagination / infinite scroll
  observeNewCards(cardSelectors[0] || cardSelectors[1]);
}

function observeNewCards(selector) {
  let collectTimer;
  const observer = new MutationObserver(() => {
    clearTimeout(collectTimer);
    collectTimer = setTimeout(async () => {
      const cards  = [...document.querySelectorAll(selector)];
      const jobs   = cards.map(extractJobCard).filter(Boolean);
      if (jobs.length > 0) {
        sendRuntimeMessage({ type: 'INGEST_JOBS', jobs });
      }
    }, 2000);
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

// ─── LINKEDIN JOB DETAIL ──────────────────────────────────────────────────────

function extractCurrentJobDetail() {
  const jobId = currentLinkedInJobId();
  if (!jobId) return null;

  const titleEl =
    document.querySelector('.job-details-jobs-unified-top-card__job-title h1') ||
    document.querySelector('h1.t-24') ||
    document.querySelector('h1');

  const companyEl =
    document.querySelector('.job-details-jobs-unified-top-card__company-name a') ||
    document.querySelector('.topcard__org-name-link') ||
    document.querySelector('a[href*="/company/"]');

  const locationEl =
    document.querySelector('.job-details-jobs-unified-top-card__bullet') ||
    document.querySelector('.topcard__flavor--bullet');

  const easyApply = isEasyApplyJob();

  return {
    external_id: jobId,
    platform:    'linkedin',
    title:       titleEl?.textContent?.trim()   || document.title,
    company:     companyEl?.textContent?.trim()  || '',
    url:         `https://www.linkedin.com/jobs/view/${jobId}`,
    location:    locationEl?.textContent?.trim() || null,
    easy_apply:  easyApply,
    remote:      (locationEl?.textContent || '').toLowerCase().includes('remoto'),
  };
}

function isEasyApplyJob() {
  // "Easy Apply" button exists (not "Apply on company website")
  const applyBtns = document.querySelectorAll('button.jobs-apply-button, .jobs-s-apply button');
  for (const btn of applyBtns) {
    if (btn.textContent?.includes('Easy Apply') || btn.textContent?.includes('Candidatura simplificada')) {
      return true;
    }
  }
  // Negative check: if there's an offsite-apply icon it's external
  return !document.querySelector('.offsite-apply-icon') &&
         !!document.querySelector('.jobs-apply-button--top-card, .jobs-s-apply button');
}

// ─── LINKEDIN EASY APPLY DETECTION ────────────────────────────────────────────

const PENDING_TRACK_TTL_MS = 30 * 60 * 1000;
let easyApplyObserver = null;
let easyApplyTrackedKey = null;
let easyApplyPollTimer = null;
let easyApplySubmitSeenAt = null;
let easyApplyNotified = false;

function normalizedText(node) {
  return (node?.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function findEasyApplyConfirmation() {
  const selectors = [
    '.jobs-easy-apply-content__confirmation',
    '[data-test-job-apply-confirmation]',
    '[data-test-modal-id="easy-apply-modal"] [class*="confirmation"]',
    '.artdeco-inline-feedback--success',
    '[class*="success"]',
  ];
  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (!el) continue;
    const text = normalizedText(el);
    if (
      text.includes('application') ||
      text.includes('candidatura') ||
      text.includes('submitted') ||
      text.includes('enviada') ||
      text.includes('success')
    ) {
      return el;
    }
  }

  const modalText = (
    document.querySelector('.jobs-easy-apply-content')?.textContent ||
    document.querySelector('[data-test-modal-id="easy-apply-modal"]')?.textContent ||
    ''
  ).toLowerCase();

  if (
    modalText.includes('application submitted') ||
    modalText.includes('your application was sent') ||
    modalText.includes('your application has been sent') ||
    modalText.includes('application sent') ||
    modalText.includes('submitted successfully') ||
    modalText.includes('candidatura enviada') ||
    modalText.includes('sua candidatura foi enviada') ||
    modalText.includes('candidatura foi enviada') ||
    modalText.includes('enviada com sucesso')
  ) {
    return document.querySelector('.jobs-easy-apply-content') || document.body;
  }

  const appliedButton = [...document.querySelectorAll('button, [role="button"]')].find((el) => {
    const text = normalizedText(el);
    return (
      text === 'applied' ||
      text === 'candidatado' ||
      text === 'candidatura enviada' ||
      text.includes('application submitted') ||
      text.includes('candidatura enviada')
    );
  });
  if (appliedButton) return appliedButton;

  return null;
}

function isFinalSubmitButton(button) {
  const text = normalizedText(button);
  return (
    text.includes('submit application') ||
    text.includes('send application') ||
    text.includes('enviar candidatura') ||
    text === 'submit' ||
    text === 'enviar'
  );
}

async function watchForEasyApplyCompletion() {
  const { pendingTrack } = await chrome.storage.local.get('pendingTrack');
  debugApply('watch:init', { pendingTrack, currentId: currentLinkedInJobId() });
  if (!pendingTrack) return;

  const currentId = currentLinkedInJobId();
  if (currentId && pendingTrack.linkedinJobId !== currentId) {
    debugApply('watch:id-mismatch-continuing', {
      expected: pendingTrack.linkedinJobId,
      currentId,
    });
  }

  const trackedKey = `${pendingTrack.internalJobId}:${pendingTrack.linkedinJobId}`;
  if (easyApplyTrackedKey === trackedKey && easyApplyObserver) return;

  if (!pendingTrack.startedAt || Date.now() - pendingTrack.startedAt > PENDING_TRACK_TTL_MS) {
    debugApply('watch:expired', { pendingTrack });
    await chrome.storage.local.remove('pendingTrack');
    return;
  }

  const notifyDetected = async () => {
    if (easyApplyNotified) return;
    easyApplyNotified = true;
    debugApply('apply:detected', {
      internalJobId: pendingTrack.internalJobId,
      linkedinJobId: pendingTrack.linkedinJobId,
    });
    easyApplyObserver?.disconnect();
    if (easyApplyPollTimer) clearInterval(easyApplyPollTimer);
    easyApplyObserver = null;
    easyApplyTrackedKey = null;
    easyApplyPollTimer = null;
    easyApplySubmitSeenAt = null;
    await chrome.storage.local.remove('pendingTrack');
    sendRuntimeMessage({
      type:          'APPLY_DETECTED',
      internalJobId: pendingTrack.internalJobId,
      linkedinJobId: pendingTrack.linkedinJobId,
    });
  };

  const notifyAfterFinalSubmitClick = () => {
    easyApplySubmitSeenAt = Date.now();
    debugApply('submit:clicked', {
      internalJobId: pendingTrack.internalJobId,
      linkedinJobId: pendingTrack.linkedinJobId,
    });
    setTimeout(async () => {
      if (findEasyApplyConfirmation()) {
        debugApply('submit:confirmation-after-click');
        await notifyDetected();
        return;
      }

      const modalStillOpen = document.querySelector(
        '.jobs-easy-apply-content, [data-test-modal-id="easy-apply-modal"], [role="dialog"]'
      );
      const applyButtonText = normalizedText(
        document.querySelector('.jobs-apply-button--top-card, .jobs-s-apply button, button.jobs-apply-button')
      );

      if (!modalStillOpen || applyButtonText.includes('applied') || applyButtonText.includes('candidatado')) {
        debugApply('submit:modal-closed-or-applied', { modalStillOpen: !!modalStillOpen, applyButtonText });
        await notifyDetected();
      }
    }, 3500);
  };

  if (findEasyApplyConfirmation()) {
    debugApply('watch:confirmation-already-present');
    await notifyDetected();
    return;
  }

  easyApplyObserver?.disconnect();
  if (easyApplyPollTimer) clearInterval(easyApplyPollTimer);
  easyApplyTrackedKey = trackedKey;
  easyApplyNotified = false;
  easyApplyObserver = new MutationObserver(async () => {
    if (!findEasyApplyConfirmation()) return;
    debugApply('observer:confirmation-found');
    await notifyDetected();
  });

  easyApplyObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
  debugApply('watch:armed', { trackedKey });

  document.addEventListener('click', (event) => {
    const button = event.target?.closest?.('button, [role="button"]');
    if (!button) return;
    const text = normalizedText(button);
    if (text.includes('candidatura') || text.includes('application') || text.includes('submit') || text.includes('enviar')) {
      debugApply('button:click', { text });
    }
    if (isFinalSubmitButton(button)) notifyAfterFinalSubmitClick();
  }, { capture: true, once: false });

  easyApplyPollTimer = setInterval(async () => {
    if (Date.now() - pendingTrack.startedAt > PENDING_TRACK_TTL_MS) {
      easyApplyObserver?.disconnect();
      clearInterval(easyApplyPollTimer);
      easyApplyObserver = null;
      easyApplyPollTimer = null;
      easyApplyTrackedKey = null;
      easyApplySubmitSeenAt = null;
      await chrome.storage.local.remove('pendingTrack');
      return;
    }
    if (findEasyApplyConfirmation()) {
      await notifyDetected();
      return;
    }
    if (easyApplySubmitSeenAt && Date.now() - easyApplySubmitSeenAt > 2500) {
      const modalStillOpen = document.querySelector('.jobs-easy-apply-content, [data-test-modal-id="easy-apply-modal"], [role="dialog"]');
      const applyButtonText = normalizedText(document.querySelector('.jobs-apply-button--top-card, .jobs-s-apply button, button.jobs-apply-button'));
      if (!modalStillOpen || applyButtonText.includes('applied') || applyButtonText.includes('candidatado')) {
        await notifyDetected();
      }
    }
  }, 2000);
}

// ─── GUPY JOB DETAIL ─────────────────────────────────────────────────────────

function detectGupy() {
  const match = pathname.match(/\/jobs?\/(\d+)/);
  const jobId = match?.[1] || new URLSearchParams(location.search).get('jobId');
  if (!jobId) return;

  const title   = document.querySelector('[data-testid="job-title"], h1')?.textContent?.trim() || document.title;
  const company = document.querySelector('[data-testid="company-name"]')?.textContent?.trim()
    || location.hostname.replace('.gupy.io', '');

  sendRuntimeMessage({ type: 'JOB_VIEWED', platform: 'gupy', job_id: jobId, title, company });
}

// ─── Init ─────────────────────────────────────────────────────────────────────

function onReady(fn) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fn);
  } else {
    fn();
  }
}

if (hostname === 'localhost' || hostname === '127.0.0.1') {
  initWebappRelay();
} else if (hostname === 'www.linkedin.com') {
  if (pathname.includes('/jobs/view/')) {
    onReady(async () => {
      // Collect job data for backend
      await waitFor(() => document.querySelector('h1'), 5000);
      const job = extractCurrentJobDetail();
      if (job?.title) {
        sendRuntimeMessage({ type: 'INGEST_JOBS', jobs: [job] });
        sendRuntimeMessage({ type: 'JOB_VIEWED', platform: 'linkedin', job_id: job.external_id, title: job.title, company: job.company });
      }
      // Track manual Easy Apply completion when started from JobHub.
      await watchForEasyApplyCompletion();
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.pendingTrack) {
          watchForEasyApplyCompletion();
        }
      });
    });
  } else if (pathname.includes('/jobs/')) {
    onReady(async () => {
      await collectLinkedInSearchJobs();
      await watchForEasyApplyCompletion();
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.pendingTrack) {
          watchForEasyApplyCompletion();
        }
      });
    });
  }
} else if (hostname.endsWith('.gupy.io')) {
  onReady(detectGupy);
}
