/* ============================================================
   PDF & Excel Reader — Service Worker
   IMPORTANT: Bump CACHE whenever you deploy an update.
   ============================================================ */
const CACHE = 'reader-v1';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(
      APP_SHELL.map((url) =>
        cache.add(new Request(url, { cache: 'reload' }))
          .catch((err) => console.warn('[SW] skip pre-cache:', url, err))
      )
    );
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isCdn = /(^|\.)cdnjs\.cloudflare\.com$|(^|\.)unpkg\.com$/.test(url.host);

  if (!isSameOrigin && !isCdn) return;

  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;

    try {
      const res = await fetch(req);
      if (res && (res.ok || res.type === 'opaque')) {
        const cache = await caches.open(CACHE);
        cache.put(req, res.clone()).catch(() => {});
      }
      return res;
    } catch (_) {
      if (req.mode === 'navigate') {
        const shell = (await caches.match('./')) || (await caches.match('./index.html'));
        if (shell) return shell;
      }
      return new Response('Offline — resource not cached', {
        status: 503,
        statusText: 'Offline',
        headers: { 'Content-Type': 'text/plain' }
      });
    }
  })());
});