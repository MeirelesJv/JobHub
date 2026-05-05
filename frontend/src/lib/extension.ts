/**
 * Utilitários para comunicação webapp ↔ extensão Chrome.
 * O content script da extensão roda em localhost e faz relay
 * das mensagens window.postMessage → chrome.runtime.sendMessage.
 */

export async function isExtensionInstalled(): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      window.removeEventListener('message', handler);
      resolve(false);
    }, 500);

    function handler(event: MessageEvent) {
      if (event.source !== window) return;
      if (event.data?.type === 'JOBHUB_PONG') {
        clearTimeout(timer);
        window.removeEventListener('message', handler);
        resolve(true);
      }
    }

    window.addEventListener('message', handler);
    window.postMessage({ type: 'JOBHUB_PING' }, '*');
  });
}

export function sendTokenToExtension(token: string, userId: number, userEmail: string): void {
  window.postMessage(
    { type: 'JOBHUB_LOGIN', token, user_id: userId, user_email: userEmail },
    '*',
  );
}

export function sendLogoutToExtension(): void {
  window.postMessage({ type: 'JOBHUB_LOGOUT' }, '*');
}

/**
 * Dispara o Easy Apply turbo via extensão.
 * A extensão abre a vaga no LinkedIn em background, preenche e submete.
 * O resultado chega via notificação Chrome (async fire-and-forget).
 */
export function applyLinkedInEasyApply(params: {
  jobUrl: string
  linkedinJobId: string
  internalJobId: number
}): void {
  window.postMessage({ type: 'JOBHUB_APPLY', ...params }, '*');
}
