/**
 * JobHub Extension — Service Worker (Manifest V3)
 */

const API_BASE = 'http://localhost:8000';
const DEBUG_APPLY = true;

function debugApply(event, data = {}) {
  if (!DEBUG_APPLY) return;
  const payload = {
    event,
    at: new Date().toISOString(),
    ...data,
  };
  console.log('[JobHub Apply Debug]', payload);
  chrome.storage?.local?.set?.({ lastApplyDebug: payload });
}

// ─── Auth helpers ─────────────────────────────────────────────────────────────

async function getToken() {
  const { token } = await chrome.storage.local.get('token');
  return token || null;
}

async function getRefreshToken() {
  const { refresh_token } = await chrome.storage.local.get('refresh_token');
  return refresh_token || null;
}

function jwtExpired(token) {
  try {
    const { exp } = JSON.parse(atob(token.split('.')[1]));
    return exp ? exp * 1000 < Date.now() : false;
  } catch {
    return true;
  }
}

async function isAuthenticated() {
  const token = await getToken();
  if (token && !jwtExpired(token)) return true;
  return !!(await refreshAccessToken());
}

async function refreshAccessToken() {
  const refreshToken = await getRefreshToken();
  if (!refreshToken || jwtExpired(refreshToken)) return null;

  try {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    await chrome.storage.local.set({ token: data.access_token });
    return data.access_token;
  } catch (err) {
    console.error('[JobHub] refreshAccessToken failed:', err.message);
    return null;
  }
}

async function authHeaders() {
  let token = await getToken();
  if (!token || jwtExpired(token)) token = await refreshAccessToken();
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

// ─── Job sync ─────────────────────────────────────────────────────────────────

async function syncJobs() {
  if (!(await isAuthenticated())) return;
  try {
    const res = await fetch(`${API_BASE}/api/jobs/sync`, {
      method: 'POST',
      headers: await authHeaders(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await chrome.storage.local.set({ lastSync: Date.now() });
    console.log('[JobHub] syncJobs OK');
  } catch (err) {
    console.error('[JobHub] syncJobs failed:', err.message);
  }
}

async function syncApplicationStatus() {
  if (!(await isAuthenticated())) return;
  try {
    const res = await fetch(`${API_BASE}/api/applications`, {
      headers: await authHeaders(),
    });
    if (!res.ok) return;

    const apps = await res.json();
    const { savedApplications = {} } = await chrome.storage.local.get('savedApplications');
    const updated = { ...savedApplications };

    for (const app of apps) {
      const prev = savedApplications[app.id];
      if (prev && prev !== app.status) {
        chrome.notifications.create(`jobhub-status-${app.id}-${Date.now()}`, {
          type: 'basic', iconUrl: 'public/icons/icon128.png',
          title: 'JobHub — Atualização de candidatura',
          message: `Sua candidatura em ${app.job?.company ?? ''} mudou para ${app.status}`,
        });
      }
      updated[app.id] = app.status;
    }
    await chrome.storage.local.set({ savedApplications: updated });
  } catch (err) {
    console.error('[JobHub] syncApplicationStatus failed:', err.message);
  }
}

// ─── Easy Apply detection ─────────────────────────────────────────────────────

async function handleTrackApply(msg) {
  if (!(await isAuthenticated())) return { success: false, error: 'not_authenticated' };
  if (!msg.internalJobId || !msg.linkedinJobId) return { success: false, error: 'missing_job_id' };
  debugApply('track:received', {
    internalJobId: msg.internalJobId,
    linkedinJobId: msg.linkedinJobId,
  });

  await chrome.storage.local.set({
    pendingTrack: {
      linkedinJobId: msg.linkedinJobId,
      internalJobId: msg.internalJobId,
      startedAt:     Date.now(),
    },
  });

  console.log('[JobHub] Easy Apply tracking armed for job', msg.linkedinJobId);
  debugApply('track:stored', {
    internalJobId: msg.internalJobId,
    linkedinJobId: msg.linkedinJobId,
  });
  return { success: true, status: 'tracking' };
}

async function handleApplyDetected(msg) {
  debugApply('detected:received', msg);
  await chrome.storage.local.remove('pendingTrack');

  if (msg.internalJobId) {
    try {
      const res = await fetch(`${API_BASE}/api/applications`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ job_id: msg.internalJobId, mode: 'manual' }),
      });
      if (!res.ok) {
        let detail = '';
        try {
          detail = (await res.json())?.detail || '';
        } catch { /* ignore non-json responses */ }
        if (res.status === 400 && detail.toLowerCase().includes('já')) {
          chrome.notifications.create(`apply-existing-${Date.now()}`, {
            type: 'basic', iconUrl: 'public/icons/icon128.png',
            title: 'JobHub — Candidatura já registrada',
            message: 'Essa candidatura já estava no JobHub.',
          });
          return { success: true, status: 'already_registered' };
        }
        throw new Error(detail || `HTTP ${res.status}`);
      }
      debugApply('backend:application-created', { internalJobId: msg.internalJobId });
    } catch (err) {
      console.error('[JobHub] Failed to register application:', err.message);
      debugApply('backend:application-error', { internalJobId: msg.internalJobId, error: err.message });
      chrome.notifications.create(`apply-fail-${Date.now()}`, {
        type: 'basic', iconUrl: 'public/icons/icon128.png',
        title: 'JobHub — Candidatura detectada',
        message: 'A candidatura foi detectada, mas não foi possível registrar no JobHub.',
      });
      return { success: false, error: err.message };
    }

    chrome.notifications.create(`apply-ok-${Date.now()}`, {
      type: 'basic', iconUrl: 'public/icons/icon128.png',
      title: 'JobHub — Candidatura registrada',
      message: 'Sua candidatura LinkedIn foi registrada no JobHub.',
    });
  } else {
    chrome.notifications.create(`apply-fail-${Date.now()}`, {
      type: 'basic', iconUrl: 'public/icons/icon128.png',
      title: 'JobHub — Candidatura detectada',
      message: 'Não foi possível identificar a vaga interna para registrar.',
    });
    return { success: false, error: 'missing_internal_job_id' };
  }

  return { success: true };
}

// ─── Extension job ingestion ──────────────────────────────────────────────────

async function ingestJobs(jobs) {
  if (!(await isAuthenticated()) || !jobs?.length) return;
  try {
    await fetch(`${API_BASE}/api/jobs/from-extension`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify(jobs),
    });
    console.log(`[JobHub] Ingested ${jobs.length} jobs from extension`);
  } catch (err) {
    console.error('[JobHub] ingestJobs failed:', err.message);
  }
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('sync-jobs',   { periodInMinutes: 120  });
  chrome.alarms.create('sync-status', { periodInMinutes: 1440 });
  console.log('[JobHub] Installed');
});

chrome.runtime.onStartup.addListener(() => syncJobs());

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'sync-jobs')   syncJobs();
  if (alarm.name === 'sync-status') syncApplicationStatus();
});

// ─── Message handler ──────────────────────────────────────────────────────────

async function handleMessage(msg, sender) {
  switch (msg.type) {
    case 'GET_STATUS': {
      const { lastSync, user_email } = await chrome.storage.local.get(['lastSync', 'user_email']);
      return { authenticated: await isAuthenticated(), lastSync: lastSync || null, userEmail: user_email || null };
    }
    case 'FORCE_SYNC': {
      await syncJobs();
      const { lastSync } = await chrome.storage.local.get('lastSync');
      return { success: true, lastSync: lastSync || null };
    }
    case 'LOGIN': {
      await chrome.storage.local.set({
        token:         msg.token,
        refresh_token: msg.refresh_token || null,
        user_id:       msg.user_id,
        user_email:    msg.user_email,
      });
      await chrome.alarms.clearAll();
      chrome.alarms.create('sync-jobs',   { periodInMinutes: 120  });
      chrome.alarms.create('sync-status', { periodInMinutes: 1440 });
      syncJobs();
      return { success: true };
    }
    case 'LOGOUT': {
      await chrome.storage.local.clear();
      await chrome.alarms.clearAll();
      return { success: true };
    }
    case 'TRACK_APPLY': {
      return handleTrackApply(msg);
    }
    case 'APPLY_DETECTED': {
      return handleApplyDetected(msg);
    }
    case 'INGEST_JOBS': {
      ingestJobs(msg.jobs);
      return { success: true };
    }
    case 'JOB_VIEWED': {
      console.log(`[JobHub] Job viewed: [${msg.platform}] ${msg.job_id} — ${msg.title}`);
      return { success: true };
    }
    default:
      return { error: `Unknown type: ${msg.type}` };
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  handleMessage(msg, sender).then(sendResponse).catch((err) => sendResponse({ error: err.message }));
  return true;
});
