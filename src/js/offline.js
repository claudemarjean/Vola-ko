/**
 * OFFLINE.JS - Service worker registration after authentication
 */

const OFFLINE_FLAG = '__tvolako_offline_ready';

export async function registerOfflineCapabilities(isAuthenticated) {
  if (!('serviceWorker' in navigator)) return;

  if (import.meta.env.DEV) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));

      if ('caches' in window) {
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys.map((key) => caches.delete(key)));
      }

      window[OFFLINE_FLAG] = false;
      return;
    } catch (error) {
      console.warn('Service worker cleanup failed in dev mode:', error);
      return;
    }
  }

  if (!isAuthenticated) return;
  if (window[OFFLINE_FLAG]) return;

  try {
    const registration = await navigator.serviceWorker.register('/service-worker.js');
    window[OFFLINE_FLAG] = true;
    console.log('✅ Service worker registered', registration.scope);
  } catch (error) {
    console.error('Service worker registration failed:', error);
  }
}
