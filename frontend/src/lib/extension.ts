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

export function sendTokenToExtension(token: string, userId: number, userEmail: string, refreshToken?: string): void {
  window.postMessage(
    { type: 'JOBHUB_LOGIN', token, refresh_token: refreshToken, user_id: userId, user_email: userEmail },
    '*',
  );
}

export function sendLogoutToExtension(): void {
  window.postMessage({ type: 'JOBHUB_LOGOUT' }, '*');
}

/**
 * Pede para a extensão rastrear a confirmação do Easy Apply no LinkedIn.
 * A candidatura só é registrada quando a extensão detecta a tela de sucesso.
 */
export function trackLinkedInApply(params: {
  linkedinJobId: string
  internalJobId: number
}): void {
  window.postMessage({ type: 'JOBHUB_TRACK_APPLY', ...params }, '*');
}
