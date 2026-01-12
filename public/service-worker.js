/**
 * SERVICE WORKER - Offline cache for authenticated users
 */

const CACHE_NAME = 'vola-ko-cache-v1';
const OFFLINE_ASSETS = [
  '/',
  '/index.html',
  '/dashboard.html',
  '/budgets.html',
  '/expenses.html',
  '/incomes.html',
  '/savings.html',
  '/reports.html',
  '/settings.html',
  '/login.html',
  '/register.html',
  '/css/base.css',
  '/css/theme.css',
  '/css/dark.css',
  '/css/animations.css',
  '/css/notifications.css',
  '/css/app-layout.css',
  '/css/bottom-nav.css',
  '/css/responsive.css',
  '/css/home.css',
  '/js/app.js',
  '/js/auth.js',
  '/js/offline.js',
  '/js/budgets.js',
  '/js/components.js',
  '/js/dashboard.js',
  '/js/expenses.js',
  '/js/financeEngine.js',
  '/js/financeIntegrity.js',
  '/js/i18n.js',
  '/js/incomes.js',
  '/js/mobile-menu.js',
  '/js/notifications.js',
  '/js/reports.js',
  '/js/router.js',
  '/js/savings.js',
  '/js/settings.js',
  '/js/storage.js',
  '/js/theme.js',
  '/js/utils.js',
  '/js/ux-enhancements.js',
  '/locales/fr.json',
  '/locales/mg.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(OFFLINE_ASSETS))
      .catch((err) => console.error('Cache install error', err))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((oldKey) => caches.delete(oldKey))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request)
        .then((networkResponse) => {
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            networkResponse.type === 'basic'
          ) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => caches.match('/index.html'));
    })
  );
});
