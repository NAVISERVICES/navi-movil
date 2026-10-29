// El sitio se mudó a /demo: este service worker reemplaza al anterior de la raíz y se da de baja solo,
// para que los visitantes que ya lo tenían vean la página nueva.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
    .then(() => self.registration.unregister()));
});
