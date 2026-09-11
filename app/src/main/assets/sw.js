// Network first, cache fallback: fresh when online, still playable offline.
const C = 'ps-1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('fetch', e => e.respondWith(
  fetch(e.request).then(r => { const c = r.clone(); caches.open(C).then(k => k.put(e.request, c)); return r; })
    .catch(() => caches.match(e.request))));
