// service worker de la app del operador: abre aunque no haya señal
const CACHE = 'navi-mando-v4';
const FILES = ['./', 'manifest.webmanifest', '../mando.js?v=4', '../../assets/icon-192.png', '../../assets/navi-logo.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('navi-mando') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// red primero; sin señal, la copia guardada
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request, { cache: 'no-cache' })
    .then(r => {
      if (r.ok && new URL(e.request.url).origin === location.origin) {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
      }
      return r;
    })
    .catch(() => caches.match(e.request, { ignoreSearch: true })));
});
