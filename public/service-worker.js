/**
 * SERVICE WORKER - Offline cache for authenticated users
 */

const CACHE_NAME = 'vola-ko-cache-v4';
const OFFLINE_ASSETS = [
  '/',
  '/index.html',
  '/dashboard.html',
  '/budgets.html',
  '/expenses.html',
  '/incomes.html',
  '/savings.html',
  '/reports.html',
  '/transactions.html',
  '/settings.html',
  '/login.html',
  '/register.html',
  '/favicon.ico',
  '/favicon.svg',
  '/icones/vola-ko/vola-ko-favicon.png',
  '/icones/vola-ko/icon-vola-ko-color.png',
  '/icones/vola-ko/icon-vola-ko-white.png',
  '/icones/vola-ko/logo-vola-ko-main.png',
  '/icones/vola-ko/logo-vola-ko-black.png',
  '/icones/vola-ko/logo-vola-ko-white.png',
  '/locales/fr.json',
  '/locales/mg.json'
];

async function precacheStableAssets() {
  const cache = await caches.open(CACHE_NAME);

  await Promise.all(
    OFFLINE_ASSETS.map(async (assetUrl) => {
      try {
        const response = await fetch(assetUrl, { cache: 'no-cache' });
        if (!response.ok) {
          console.warn('Precache skipped for asset:', assetUrl, response.status);
          return;
        }
        await cache.put(assetUrl, response.clone());
      } catch (error) {
        console.warn('Precache skipped for asset:', assetUrl, error);
      }
    })
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    precacheStableAssets()
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
  const requestUrl = new URL(request.url);
  const path = requestUrl.pathname;

  if (request.method !== 'GET') {
    return;
  }

  // Ignore non-HTTP(S) schemes (e.g. chrome-extension://) that Cache API cannot store.
  if (requestUrl.protocol !== 'http:' && requestUrl.protocol !== 'https:') {
    return;
  }

  // Do not cache cross-origin resources.
  if (requestUrl.origin !== self.location.origin) {
    event.respondWith(fetch(request));
    return;
  }

  // Never intercept Vite/HMR internals.
  if (
    path.startsWith('/@vite') ||
    path.startsWith('/@id/') ||
    path.startsWith('/__vite') ||
    path.startsWith('/node_modules/')
  ) {
    event.respondWith(fetch(request));
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
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone).catch((error) => {
                console.warn('Cache put skipped for request:', request.url, error);
              });
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Return app shell only for navigations.
          if (request.mode === 'navigate') {
            return caches.match('/index.html');
          }
          return new Response('', { status: 504, statusText: 'Offline' });
        });
    })
  );
});
