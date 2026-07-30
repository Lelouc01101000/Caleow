/* Caleow service worker — caches the app shell so it installs like a real
   app and keeps working without a connection. Bump CACHE_NAME on releases
   that change any cached file, so old caches get cleared automatically. */
const CACHE_NAME = 'caleow-v1';
const APP_SHELL = [
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/foods-data.js',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Cache-first for anything in the app shell; fall back to the network
  // (and cache the response) for everything else.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (event.request.method === 'GET' && response && response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);
    })
  );
});
