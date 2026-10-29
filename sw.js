// service worker: guarda la página para que abra rápido y funcione sin señal
const CACHE = 'navi-v1';
const FILES = ['./', 'index.html', 'manifest.webmanifest', 'assets/navi-logo.png', 'assets/icon-192.png',
  'assets/sofi.png', 'assets/beto.png', 'assets/chayo.png', 'assets/mama.png', 'assets/tono.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// red primero (siempre lo más nuevo); si no hay señal, usa la copia guardada
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request)
    .then(r => {
      if (r.ok && new URL(e.request.url).origin === location.origin) {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
      }
      return r;
    })
    .catch(() => caches.match(e.request)));
});
