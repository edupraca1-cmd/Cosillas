const CACHE_NAME = 'padaria-v13'; // Subimos a v12 para forzar el cambio
const ASSETS = [
  './',
  './index.html',
  './manifest.json'
];

// Instala y guarda la app en el teléfono
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting()) // Fuerza al nuevo SW a activarse de inmediato
  );
});

// Limpia las cachés antiguas para que no interfieran con el nuevo código
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('Borrando caché antigua:', key);
            return caches.delete(key); // Borra de raíz la v10 y anteriores sin tocar tus datos locales
          }
        })
      );
    }).then(() => self.clients.claim()) // Toma el control de la aplicación ya mismo
  );
});

// Carga la app desde la memoria interna si estás sin conexión
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => response || fetch(e.request))
  );
});
