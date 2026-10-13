// Padaria Vicente - service worker
// Estratégia: REDE PRIMEIRO, com cópia guardada de reserva.
//  - Com cobertura boa: abre sempre a versão mais recente do index.html.
//  - Sem cobertura: usa a cópia guardada (abre logo, sem esperar).
//  - Cobertura fraca: espera no máximo 3 s pela rede; se não chegar, abre a cópia
//    guardada e deixa o descarregamento a continuar em segundo plano para a próxima vez.
// Já NÃO é preciso mudar nenhum número ao subir uma versão nova do index.html.
// Os dados da app (localStorage / IndexedDB) nunca são tocados por este ficheiro.

const CACHE_NAME = 'padaria-app';
const ESPERA_MS = 3000;
const FICHEIROS = ['./index.html', './manifest.json'];

// Instala: guarda uma cópia fresca dos ficheiros (ignora a cache HTTP do GitHub)
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => Promise.all(FICHEIROS.map((f) =>
        fetch(new Request(f, { cache: 'reload' }))
          .then((r) => (r && r.ok ? cache.put(f, r) : null))
          .catch(() => null)
      )))
      .then(() => self.skipWaiting())
  );
});

// Ativa: apaga as caches antigas (padaria-v30, etc.) e toma o controlo já
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((chaves) => Promise.all(chaves.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const pedido = e.request;
  if (pedido.method !== 'GET') return;
  const url = new URL(pedido.url);
  if (url.origin !== self.location.origin) return; // o que vem de fora, o navegador trata
  e.respondWith(redePrimeiro(e, url));
});

function redePrimeiro(e, url) {
  const pedido = e.request;
  // Qualquer abertura da app (/, /index.html, ?algo) usa a mesma cópia
  const chave = pedido.mode === 'navigate'
    ? new URL('./index.html', self.registration.scope).href
    : url.origin + url.pathname;

  const rede = fetch(pedido.url, { cache: 'no-cache' }).then(async (r) => {
    if (r && r.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(chave, r.clone());
    }
    return r;
  });
  // Deixa o descarregamento acabar mesmo que já se tenha aberto a cópia guardada
  e.waitUntil(rede.catch(() => {}));

  const guardada = () => caches.open(CACHE_NAME).then((c) => c.match(chave));

  return new Promise((resolver) => {
    let feito = false;
    const fim = (resp) => { if (!feito) { feito = true; resolver(resp); } };

    const temporizador = setTimeout(() => {
      guardada().then((c) => { if (c) fim(c); }); // se não há cópia, continua a esperar pela rede
    }, ESPERA_MS);

    rede.then((r) => {
      clearTimeout(temporizador);
      if (r.ok) return fim(r);
      return guardada().then((c) => fim(c || r));
    }).catch(() => {
      clearTimeout(temporizador);
      return guardada().then((c) => fim(c || Response.error()));
    });
  });
}
