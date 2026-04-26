import notify from './notifications.js';

let listenersInitialized = false;

export function isOnline() {
  return navigator.onLine;
}

export function ensureOnlineForCriticalAction(actionLabel = 'Cette action') {
  if (isOnline()) {
    return true;
  }

  notify.error(`${actionLabel} nécessite une connexion Internet active.`);
  return false;
}

export function initConnectivityAwareness() {
  if (listenersInitialized) {
    return;
  }

  listenersInitialized = true;

  window.addEventListener('offline', () => {
    notify.warning('Mode hors ligne: les actions critiques sont temporairement bloquées.');
  });

  window.addEventListener('online', () => {
    notify.success('Connexion rétablie.');
  });
}
