const CACHE_NAME = 'padaria-v9';
const ASSETS = [
  './',
  './index.html',
  './manifest.json'
];

// Instala y guarda la app en el teléfono
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

// Carga la app desde la memoria interna si estás sin conexión
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => response || fetch(e.request))
  );
});
