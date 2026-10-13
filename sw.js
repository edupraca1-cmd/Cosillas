// Padaria Vicente - service worker
// Estratégia: REDE PRIMEIRO, com cópia guardada de reserva.
//  - Com cobertura boa: abre sempre a versão mais recente do index.html.
//  - Sem cobertura: usa a cópia guardada (abre logo, sem esperar).
//  - Cobertura fraca: espera no máximo 3 s pela rede; se não chegar, abre a cópia
//    guardada e deixa o descarregamento a continuar em segundo plano para a próxima vez.
// Já NÃO é preciso mudar nenhum número ao subir uma versão nova do index.html.
// Os dados da app (localStorage / IndexedDB) nunca são tocados por este ficheiro.
//
// IMPORTANTE (v2): este ficheiro só mexe no que é DESTA app. O GitHub Pages serve várias apps
// no mesmo endereço (mesma "origem"), por isso:
//  - só atende o index.html / manifest.json desta pasta; qualquer outra página (outra app) passa direta;
//  - só apaga caches com o prefixo "padaria-" (nunca as de outras apps);
//  - nunca guarda como index.html uma página que não seja a desta app.

const CACHE_NAME = 'padaria-app';
const PREFIXO = 'padaria-';
const ESPERA_MS = 3000;
const FICHEIROS = ['./index.html', './manifest.json'];
const RAIZ = new URL(self.registration.scope).pathname;           // ex.: /padaria/
const CHAVE_INDEX = new URL('./index.html', self.registration.scope).href;

// É um pedido desta app? (a página inicial ou os dois ficheiros acima)
function ehDestaApp(pedido, url) {
  const p = url.pathname;
  if (pedido.mode === 'navigate') return p === RAIZ || p === RAIZ + 'index.html';
  return p === RAIZ + 'index.html' || p === RAIZ + 'manifest.json';
}

// O index.html desta app regista sempre o sw.js; uma página de login de wifi ou de outra app não.
async function pareceDestaApp(resposta, chave) {
  if (chave !== CHAVE_INDEX) return true;
  try { return (await resposta.clone().text()).includes('sw.js'); } catch (_) { return false; }
}

// Instala: guarda uma cópia fresca dos ficheiros (ignora a cache HTTP do GitHub)
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => Promise.all(FICHEIROS.map((f) => {
        const chave = new URL(f, self.registration.scope).href;
        return fetch(new Request(chave, { cache: 'reload' }))
          .then(async (r) => (r && r.ok && await pareceDestaApp(r, chave) ? cache.put(chave, r) : null))
          .catch(() => null);
      })))
      .then(() => self.skipWaiting())
  );
});

// Ativa: apaga só as caches antigas DESTA app (padaria-v30, etc.) e toma o controlo já
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((chaves) => Promise.all(chaves
        .filter((k) => k.startsWith(PREFIXO) && k !== CACHE_NAME)
        .map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const pedido = e.request;
  if (pedido.method !== 'GET') return;
  const url = new URL(pedido.url);
  if (url.origin !== self.location.origin) return; // o que vem de fora, o navegador trata
  if (!ehDestaApp(pedido, url)) return;            // outra app / outra página: não mexemos
  e.respondWith(redePrimeiro(e, url));
});

function redePrimeiro(e, url) {
  const pedido = e.request;
  // Qualquer abertura da app (/, /index.html, ?algo) usa a mesma cópia
  const chave = pedido.mode === 'navigate' ? CHAVE_INDEX : url.origin + url.pathname;

  const rede = fetch(pedido.url, { cache: 'no-cache' }).then(async (r) => {
    const boa = !!(r && r.ok && await pareceDestaApp(r, chave));
    if (boa) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(chave, r.clone());
    }
    return { r, boa };
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

    rede.then(({ r, boa }) => {
      clearTimeout(temporizador);
      if (boa) return fim(r);
      return guardada().then((c) => fim(c || r));
    }).catch(() => {
      clearTimeout(temporizador);
      return guardada().then((c) => fim(c || Response.error()));
    });
  });
}
