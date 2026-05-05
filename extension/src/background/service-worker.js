/**
 * JobHub Extension — Service Worker (Manifest V3)
 */

const API_BASE = 'http://localhost:8000';

// ─── Auth helpers ─────────────────────────────────────────────────────────────

async function getToken() {
  const { token } = await chrome.storage.local.get('token');
  return token || null;
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
  return !!token && !jwtExpired(token);
}

async function authHeaders() {
  const token = await getToken();
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

// ─── Easy Apply (Turbo mode) ──────────────────────────────────────────────────

async function startLinkedInEasyApply(msg) {
  if (!(await isAuthenticated())) return { success: false, error: 'not_authenticated' };

  // Fetch user profile for form filling
  let profile = {};
  try {
    const res = await fetch(`${API_BASE}/api/users/profile`, { headers: await authHeaders() });
    if (res.ok) profile = await res.json();
  } catch { /* use empty profile, content script will fill what it can */ }

  // Store pending apply — content script picks it up when LinkedIn job page loads
  await chrome.storage.local.set({
    pendingApply: {
      jobUrl:         msg.jobUrl,
      linkedinJobId:  msg.linkedinJobId,
      internalJobId:  msg.internalJobId,
      profile: {
        full_name: profile.full_name || '',
        email:     profile.email     || '',
        phone:     profile.phone     || '',
      },
    },
  });

  // Open LinkedIn job page in background tab
  chrome.tabs.create({ url: msg.jobUrl, active: false });
  console.log('[JobHub] Easy Apply initiated for job', msg.linkedinJobId);
  return { success: true, status: 'initiated' };
}

async function handleApplyComplete(msg, sender) {
  // Clear pending
  await chrome.storage.local.remove('pendingApply');

  if (msg.success && msg.internalJobId) {
    try {
      await fetch(`${API_BASE}/api/applications`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ job_id: msg.internalJobId, mode: 'turbo' }),
      });
    } catch (err) {
      console.error('[JobHub] Failed to register application:', err.message);
    }
    chrome.notifications.create(`apply-ok-${Date.now()}`, {
      type: 'basic', iconUrl: 'public/icons/icon128.png',
      title: 'JobHub — Candidatura enviada!',
      message: 'Sua candidatura LinkedIn foi registrada com sucesso.',
    });
  } else {
    chrome.notifications.create(`apply-fail-${Date.now()}`, {
      type: 'basic', iconUrl: 'public/icons/icon128.png',
      title: 'JobHub — Candidatura não concluída',
      message: msg.error || 'Não foi possível completar o formulário automaticamente.',
    });
  }

  // Close the LinkedIn background tab
  if (sender?.tab?.id) {
    chrome.tabs.remove(sender.tab.id);
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
      await chrome.storage.local.set({ token: msg.token, user_id: msg.user_id, user_email: msg.user_email });
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
    case 'APPLY_LINKEDIN': {
      return startLinkedInEasyApply(msg);
    }
    case 'APPLY_COMPLETE': {
      return handleApplyComplete(msg, sender);
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
