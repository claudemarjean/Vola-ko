/**
 * OFFLINE.JS - Service worker registration after authentication
 */

const OFFLINE_FLAG = '__tvolako_offline_ready';

export async function registerOfflineCapabilities(isAuthenticated) {
  if (!isAuthenticated) return;
  if (!('serviceWorker' in navigator)) return;
  if (window[OFFLINE_FLAG]) return;

  try {
    const registration = await navigator.serviceWorker.register('/service-worker.js');
    window[OFFLINE_FLAG] = true;
    console.log('✅ Service worker registered', registration.scope);
  } catch (error) {
    console.error('Service worker registration failed:', error);
  }
}
