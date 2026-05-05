/**
 * JobHub Content Script
 *
 * Injeta em:
 *   http://localhost:3000/*          → relay webapp ↔ extensão
 *   https://www.linkedin.com/jobs/*  → coleta de vagas + Easy Apply turbo
 *   https://*.gupy.io/*              → detecção de vagas
 */

const hostname = location.hostname;
const pathname = location.pathname;

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

// Set value on React-controlled inputs (bypasses virtual DOM diffing)
function setReactValue(input, value) {
  const proto  = Object.getPrototypeOf(input);
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input',  { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
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
      chrome.runtime.sendMessage({
        type:       'LOGIN',
        token:      event.data.token,
        user_id:    event.data.user_id,
        user_email: event.data.user_email,
      });
      return;
    }
    if (type === 'JOBHUB_LOGOUT') {
      chrome.runtime.sendMessage({ type: 'LOGOUT' });
      return;
    }
    if (type === 'JOBHUB_APPLY') {
      chrome.runtime.sendMessage({
        type:          'APPLY_LINKEDIN',
        jobUrl:        event.data.jobUrl,
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
    chrome.runtime.sendMessage({ type: 'INGEST_JOBS', jobs });
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
        chrome.runtime.sendMessage({ type: 'INGEST_JOBS', jobs });
      }
    }, 2000);
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

// ─── LINKEDIN JOB DETAIL ──────────────────────────────────────────────────────

function extractCurrentJobDetail() {
  const match = pathname.match(/\/jobs\/view\/(\d+)/);
  if (!match) return null;
  const jobId = match[1];

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

// ─── LINKEDIN EASY APPLY FORM ─────────────────────────────────────────────────

function findApplyButton() {
  const selectors = [
    '.jobs-apply-button--top-card',
    '.jobs-s-apply button',
    'button.jobs-apply-button',
    '[data-control-name="jobdetails_topcard_inapply"]',
  ];
  for (const sel of selectors) {
    const btn = document.querySelector(sel);
    if (btn && !btn.disabled) return btn;
  }
  return null;
}

function findPrimaryFooterButton(labels) {
  const footer = document.querySelector('.jobs-easy-apply-content footer') ||
                 document.querySelector('.artdeco-modal__actionbar');
  if (!footer) return null;
  for (const btn of footer.querySelectorAll('button')) {
    const text = btn.textContent?.trim() || '';
    if (labels.some((l) => text.toLowerCase().includes(l.toLowerCase()))) {
      if (!btn.disabled) return btn;
    }
  }
  return null;
}

async function fillCurrentStep(profile) {
  await sleep(500);

  const modal = document.querySelector('.jobs-easy-apply-content') ||
                document.querySelector('[data-test-modal]');
  if (!modal) return;

  // Fill text / tel / email inputs based on label context
  const formGroups = modal.querySelectorAll(
    '.fb-form-element, .jobs-easy-apply-form-element, .artdeco-text-entity, [class*="form-element"]'
  );
  for (const group of formGroups) {
    const label = (group.querySelector('label')?.textContent || '').toLowerCase();
    const input = group.querySelector('input[type="text"], input[type="tel"], input[type="email"], input[type="number"]');
    if (!input || input.value) continue;

    if (/email/.test(label))                        setReactValue(input, profile.email);
    else if (/phone|telefone|celular|mobile/.test(label)) setReactValue(input, profile.phone);
    else if (/name|nome/.test(label))               setReactValue(input, profile.full_name);
  }

  // Fallback: fill by input type/autocomplete when not in a labeled group
  const allInputs = modal.querySelectorAll('input:not([value]):not([type="hidden"]):not([type="checkbox"]):not([type="radio"])');
  for (const input of allInputs) {
    if (input.value) continue;
    const ac   = input.autocomplete?.toLowerCase() || '';
    const name = (input.name || input.id || '').toLowerCase();

    if (ac === 'email' || /email/.test(name))           setReactValue(input, profile.email);
    else if (ac === 'tel' || /phone|phone/.test(name))  setReactValue(input, profile.phone);
    else if (/name/.test(name))                         setReactValue(input, profile.full_name);
  }

  await sleep(300);
}

async function triggerEasyApply(profile) {
  const applyBtn = findApplyButton();
  if (!applyBtn) return { success: false, error: 'Botão Easy Apply não encontrado' };

  applyBtn.click();

  const modal = await waitFor(() =>
    document.querySelector('.jobs-easy-apply-content') ||
    document.querySelector('[data-test-modal-id="easy-apply-modal"]'),
    6000
  );
  if (!modal) return { success: false, error: 'Modal Easy Apply não abriu' };

  for (let step = 0; step < 15; step++) {
    await fillCurrentStep(profile);
    await sleep(800);

    // Check for success confirmation (already submitted by previous iteration)
    const confirmation = document.querySelector('.jobs-easy-apply-content__confirmation') ||
                         document.querySelector('[data-test-job-apply-confirmation]');
    if (confirmation) return { success: true };

    // Try submit
    const submitBtn = findPrimaryFooterButton(['Submit application', 'Enviar candidatura', 'Submit', 'Enviar']);
    if (submitBtn) {
      submitBtn.click();
      await sleep(2500);
      const done = document.querySelector('.jobs-easy-apply-content__confirmation, [data-test-job-apply-confirmation]');
      return done
        ? { success: true }
        : { success: false, error: 'Confirmação não detectada após submit' };
    }

    // Go to next step
    const nextBtn = findPrimaryFooterButton(['Next', 'Próximo', 'Continue', 'Review', 'Revisar']);
    if (!nextBtn) return { success: false, error: `Nenhum botão de navegação encontrado (step ${step})` };
    nextBtn.click();
    await sleep(1200);
  }

  return { success: false, error: 'Número máximo de etapas atingido' };
}

async function checkPendingApply() {
  const { pendingApply } = await chrome.storage.local.get('pendingApply');
  if (!pendingApply) return;

  const currentId = pathname.match(/\/jobs\/view\/(\d+)/)?.[1];
  if (pendingApply.linkedinJobId !== currentId) return;

  console.log('[JobHub] Pending Easy Apply detected, waiting for page render…');
  await sleep(3000);

  const result = await triggerEasyApply(pendingApply.profile);
  console.log('[JobHub] Easy Apply result:', result);

  await chrome.storage.local.remove('pendingApply');
  chrome.runtime.sendMessage({
    type:          'APPLY_COMPLETE',
    success:       result.success,
    error:         result.error || null,
    internalJobId: pendingApply.internalJobId,
  });
}

// ─── GUPY JOB DETAIL ─────────────────────────────────────────────────────────

function detectGupy() {
  const match = pathname.match(/\/jobs?\/(\d+)/);
  const jobId = match?.[1] || new URLSearchParams(location.search).get('jobId');
  if (!jobId) return;

  const title   = document.querySelector('[data-testid="job-title"], h1')?.textContent?.trim() || document.title;
  const company = document.querySelector('[data-testid="company-name"]')?.textContent?.trim()
    || location.hostname.replace('.gupy.io', '');

  chrome.runtime.sendMessage({ type: 'JOB_VIEWED', platform: 'gupy', job_id: jobId, title, company });
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
        chrome.runtime.sendMessage({ type: 'INGEST_JOBS', jobs: [job] });
        chrome.runtime.sendMessage({ type: 'JOB_VIEWED', platform: 'linkedin', job_id: job.external_id, title: job.title, company: job.company });
      }
      // Check if extension should auto-apply
      await checkPendingApply();
    });
  } else if (pathname.includes('/jobs/')) {
    onReady(collectLinkedInSearchJobs);
  }
} else if (hostname.endsWith('.gupy.io')) {
  onReady(detectGupy);
}
