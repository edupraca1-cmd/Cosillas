const CACHE_NAME = 'padaria-v2';
const ASSETS = [
  'index.html',
  'manifest.json'
];

// Instalar y guardar en caché
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS);
    })
  );
});

// Responder desde la caché si no hay internet
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(response => {
      return response || fetch(e.request);
    })
  );
});
