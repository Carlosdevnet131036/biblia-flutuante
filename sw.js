// Mantém o app e as traduções baixadas disponíveis offline.
const CACHE = 'biblia-v2';
const SHELL = ['./', 'index.html', 'web-api.js', 'search.js', 'note-topics.js', 'manifest.webmanifest',
  'assets/biblia.svg', 'assets/apple-touch-icon.png', 'assets/icon-192.png', 'assets/icon-512.png', 'data/referencias.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const bible = url.hostname === 'raw.githubusercontent.com';
  if (bible) {
    // Traduções: baixa uma vez e usa o cache para sempre.
    e.respondWith(caches.open(CACHE).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) c.put(req, res.clone());
      return res;
    }));
  } else if (url.origin === location.origin) {
    // Arquivos do app: tenta a rede (para receber atualizações) e cai no cache offline.
    e.respondWith(fetch(req).then(res => {
      if (res.ok) caches.open(CACHE).then(c => c.put(req, res.clone()));
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true })));
  }
});
