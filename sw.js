const ROOT = new URL('./', import.meta.url);
const CACHE_PREFIX = `dither-shell-${encodeURIComponent(ROOT.pathname)}-`;
const CACHE = `${CACHE_PREFIX}v7`;
const FILES = [
  './', 'index.html', 'css/app.css', 'manifest.webmanifest',
  'icons/app-icon.svg', 'icons/app-192.png', 'icons/app-512.png', 'icons/app-maskable-512.png',
  'icons/bootstrap-icons.min.css',
  'icons/fonts/bootstrap-icons.woff2?e34853135f9e39acf64315236852cd5a',
  'icons/fonts/bootstrap-icons.woff?e34853135f9e39acf64315236852cd5a',
  'js/app.js', 'js/model/document.js', 'js/model/effects.js',
  'js/history/history.js', 'js/storage/assets.js', 'js/storage/projects.js',
  'js/interaction/geometry.js', 'js/interaction/workspace.js', 'js/components/panels.js',
  'js/rendering/renderer.js', 'js/rendering/effects.js', 'js/rendering/dither.js',
  'js/rendering/pixels.js', 'js/rendering/pixel-worker.js'
];
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES.map(file => new URL(file, ROOT).href)))); });
self.addEventListener('activate', event => { event.waitUntil((async () => { for (const key of await caches.keys()) if (key.startsWith(CACHE_PREFIX) && key !== CACHE) await caches.delete(key); await self.clients.claim(); })()); });
self.addEventListener('message', event => { if (event.data?.type === 'ACTIVATE_UPDATE') self.skipWaiting(); });
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== ROOT.origin || !url.pathname.startsWith(ROOT.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE), cached = await cache.match(event.request);
    if (cached) return cached;
    try { return await fetch(event.request); }
    catch (error) { if (event.request.mode === 'navigate') return (await cache.match(ROOT.href)) || Response.error(); throw error; }
  })());
});
