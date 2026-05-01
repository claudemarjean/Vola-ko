/**
 * OFFLINE.JS - Service worker registration after authentication
 */

const OFFLINE_FLAG = '__tvolako_offline_ready';
const OFFLINE_CACHE_VERSION = 'sw-v5-network-first';
const OFFLINE_CACHE_VERSION_KEY = '__tvolako_offline_cache_version';
const OFFLINE_SW_URL = `/service-worker.js?v=${encodeURIComponent(OFFLINE_CACHE_VERSION)}`;

async function cleanupLegacyOfflineState() {
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));

  if ('caches' in window) {
    const cacheKeys = await caches.keys();
    const legacyKeys = cacheKeys.filter((key) => key.startsWith('vola-ko-cache-'));
    await Promise.all(legacyKeys.map((key) => caches.delete(key)));
  }
}

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
    const currentVersion = window.localStorage.getItem(OFFLINE_CACHE_VERSION_KEY);
    if (currentVersion !== OFFLINE_CACHE_VERSION) {
      await cleanupLegacyOfflineState();
      window.localStorage.setItem(OFFLINE_CACHE_VERSION_KEY, OFFLINE_CACHE_VERSION);
    }

    const registration = await navigator.serviceWorker.register(OFFLINE_SW_URL, {
      updateViaCache: 'none'
    });
    await registration.update();
    window[OFFLINE_FLAG] = true;
    console.log('✅ Service worker registered', registration.scope);
  } catch (error) {
    console.error('Service worker registration failed:', error);
  }
}
