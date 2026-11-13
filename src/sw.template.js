/* TRIAD service worker — network-first for pages, cache-first for assets & images.
   Makes the site installable as an app and readable offline. */
const VERSION = 'triad-__VERSION__';
const BASE = '__BASE__';
const CORE = [BASE, `${BASE}magazine/`, `${BASE}news/`, `${BASE}archive/`, `${BASE}about/`, `${BASE}404.html`];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.pathname.startsWith(`${BASE}admin`)) return;

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); return res; })
        .catch(() => caches.match(req).then((r) => r || caches.match(`${BASE}404.html`)))
    );
    return;
  }
  if (url.origin === location.origin || url.hostname.endsWith('picsum.photos') || url.hostname.includes('fastly.picsum') || url.hostname.includes('fonts.g')) {
    e.respondWith(
      caches.match(req).then(
        (hit) => hit || fetch(req).then((res) => { if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); } return res; })
      )
    );
  }
});
