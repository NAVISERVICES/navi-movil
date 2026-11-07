// service worker de la app del operador: abre aunque no haya señal
const CACHE = 'navi-mando-v12';
const FILES = ['./', 'manifest.webmanifest', '../config.js?v=1', '../mando.js?v=12', '../patch.js?v=1', '../sync.js?v=1', '../tech.css?v=1', '../../assets/icon-192.png', '../../assets/navi-logo.png'];

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
  // la API y el canal en vivo nunca se guardan: siempre van directo al servidor
  if (new URL(e.request.url).pathname.startsWith('/api/')) return;
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
