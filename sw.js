/* WESHAH service worker — يجعل لوحة التحكم تعمل كتطبيق ويمكن فتحها حتى مع ضعف الاتصال */
const VERSION = 'weshah-v4';
const SHELL = [
  './', 'index.html', 'login.html', 'settings.html', 'products.html', 'orders.html', 'WESHAH_marketplace_day_night.html',
  'weshah.css', 'weshah-lite.js', 'weshah-core.js', 'weshah-accounting.js',
  'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'add-product.html', 'weshah-codes.js', 'WESHAH_marketplace_day_night.html', 'products.html'
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await Promise.all(SHELL.map(u => cache.add(u).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Firestore / auth / identity APIs: never intercept (Firestore has its own offline cache)
  if (/(firestore|identitytoolkit|securetoken|firebaseinstallations)\.googleapis\.com$/.test(url.hostname)) return;

  // Page navigations: network first, fall back to cache
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(VERSION);
        cache.put(req, fresh.clone());
        return fresh;
      } catch (_) {
        return (await caches.match(req, { ignoreSearch: true })) ||
               (await caches.match('index.html')) ||
               new Response('غير متصل', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }
    })());
    return;
  }

  // ملفات الموقع نفسها (html/js/css): الشبكة أولًا حتى لا يبقى كاش قديم يكسر الصفحات بعد التحديث
  if (url.origin === self.location.origin && /\.(js|css|html|webmanifest)$/.test(url.pathname)) {
    e.respondWith((async () => {
      const cache = await caches.open(VERSION);
      try { const fresh = await fetch(req); if (fresh && fresh.ok) cache.put(req, fresh.clone()); return fresh; }
      catch (_) { return (await cache.match(req)) || new Response('', { status: 504 }); }
    })());
    return;
  }

  // Everything else (own assets, Firebase SDK, fonts, logo): stale-while-revalidate
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const cached = await cache.match(req);
    const network = fetch(req).then(res => {
      if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
      return res;
    }).catch(() => cached);
    return cached || network;
  })());
});
