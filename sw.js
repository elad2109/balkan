const CACHE_NAME = 'balkan-offline-v2';
const CORE_ASSETS = [
  './',
  './index.html',
  './desktop.html',
  './manifest.json',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(
        CORE_ASSETS.map(url => cache.add(url).catch(() => null))
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

// Network-first for HTML (so live updates arrive when online, instant cache fallback when offline);
// Cache-first for Leaflet, audio (.mp3), and viewed Google Maps tiles (mt0-mt3.google.com/vt).
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  const isHtml = event.request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/');
  if (isHtml) {
    event.respondWith(
      fetch(event.request).then(resp => {
        if (resp && resp.ok) {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, copy));
        }
        return resp;
      }).catch(() => caches.match(event.request).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(resp => {
        if (resp && (resp.ok || resp.type === 'opaque')) {
          const isCacheable =
            url.hostname.includes('unpkg.com') ||
            url.hostname.includes('cdnjs.cloudflare.com') ||
            url.hostname.includes('google.com') ||
            url.pathname.endsWith('.mp3') ||
            url.pathname.endsWith('.json');
          if (isCacheable) {
            const copy = resp.clone();
            caches.open(CACHE_NAME).then(c => c.put(event.request, copy));
          }
        }
        return resp;
      }).catch(() => new Response('', { status: 408, statusText: 'Offline' }));
    })
  );
});
