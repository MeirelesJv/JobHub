/**
 * JobHub Popup — controla a UI do popup da extensão.
 */

const APP_URL = 'http://localhost:3000';

// ─── DOM refs ─────────────────────────────────────────────────────────────────

const stateUnauth      = document.getElementById('state-unauth');
const stateAuth        = document.getElementById('state-auth');
const userEmailEl      = document.getElementById('user-email');
const lastSyncTextEl   = document.getElementById('last-sync-text');
const nextSyncTextEl   = document.getElementById('next-sync-text');
const btnSync          = document.getElementById('btn-sync');
const syncLabel        = document.getElementById('sync-label');
const syncSpinner      = document.getElementById('sync-spinner');
const btnOpenLogin     = document.getElementById('btn-open-login');
const btnJobs          = document.getElementById('btn-jobs');
const btnApplications  = document.getElementById('btn-applications');
const btnLogout        = document.getElementById('btn-logout');
const toastEl          = document.getElementById('toast');

// ─── Toast ────────────────────────────────────────────────────────────────────

let toastTimer;
function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2500);
}

// ─── Sync time helpers ────────────────────────────────────────────────────────

function formatAgo(ts) {
  if (!ts) return 'Nunca';
  const mins = Math.round((Date.now() - ts) / 60_000);
  if (mins < 1)  return 'há menos de 1 minuto';
  if (mins < 60) return `há ${mins} minuto${mins === 1 ? '' : 's'}`;
  const hrs = Math.round(mins / 60);
  return `há ${hrs} hora${hrs === 1 ? '' : 's'}`;
}

function formatNext(lastSync) {
  if (!lastSync) return '';
  const nextMs = lastSync + 120 * 60_000;
  const diff   = Math.max(0, Math.round((nextMs - Date.now()) / 60_000));
  if (diff === 0) return 'Próxima sincronização: em breve';
  return `Próxima sincronização: em ${diff} min`;
}

// ─── Render ───────────────────────────────────────────────────────────────────

function renderUnauth() {
  stateUnauth.classList.remove('hidden');
  stateAuth.classList.add('hidden');
}

function renderAuth(status) {
  stateUnauth.classList.add('hidden');
  stateAuth.classList.remove('hidden');

  if (status.userEmail) userEmailEl.textContent = status.userEmail;
  lastSyncTextEl.textContent = `Última sincronização: ${formatAgo(status.lastSync)}`;
  nextSyncTextEl.textContent = formatNext(status.lastSync);
}

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  try {
    const status = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
    if (status.authenticated) {
      renderAuth(status);
    } else {
      renderUnauth();
    }
  } catch {
    renderUnauth();
  }
}

init();

// ─── Button handlers ──────────────────────────────────────────────────────────

btnOpenLogin.addEventListener('click', () => {
  chrome.tabs.create({ url: `${APP_URL}/login` });
  window.close();
});

btnJobs.addEventListener('click', () => {
  chrome.tabs.create({ url: `${APP_URL}/jobs` });
  window.close();
});

btnApplications.addEventListener('click', () => {
  chrome.tabs.create({ url: `${APP_URL}/applications` });
  window.close();
});

btnSync.addEventListener('click', async () => {
  btnSync.disabled = true;
  syncLabel.textContent = 'Sincronizando…';
  syncSpinner.classList.remove('hidden');

  try {
    const result = await chrome.runtime.sendMessage({ type: 'FORCE_SYNC' });
    if (result.success) {
      syncLabel.textContent = 'Sincronizado!';
      lastSyncTextEl.textContent = `Última sincronização: ${formatAgo(result.lastSync)}`;
      nextSyncTextEl.textContent = formatNext(result.lastSync);
      showToast('Vagas sincronizadas com sucesso');
      setTimeout(() => { syncLabel.textContent = 'Sincronizar agora'; }, 2000);
    }
  } catch (err) {
    showToast('Erro ao sincronizar');
    syncLabel.textContent = 'Sincronizar agora';
  } finally {
    syncSpinner.classList.add('hidden');
    btnSync.disabled = false;
  }
});

btnLogout.addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'LOGOUT' });
  renderUnauth();
  showToast('Sessão encerrada');
});
