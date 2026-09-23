const ROOT = new URL('./', import.meta.url);
const CACHE_PREFIX = `dither-shell-${encodeURIComponent(ROOT.pathname)}-`;
const CACHE = `${CACHE_PREFIX}v22`;
const FILES = [
  './', 'index.html', 'css/app.css', 'css/fonts.css', 'manifest.webmanifest',
  'icons/app-icon.svg', 'icons/app-192.png', 'icons/app-512.png', 'icons/app-maskable-512.png',
  'icons/ui.svg',
  'fonts/Noto Sans/NotoSans-Regular.ttf',
  'fonts/Noto Sans/NotoSans-Italic.ttf',
  'fonts/Noto Sans/NotoSans-Medium.ttf',
  'fonts/Noto Sans/NotoSans-MediumItalic.ttf',
  'fonts/Noto Sans/NotoSans-Bold.ttf',
  'fonts/Noto Sans/NotoSans-BoldItalic.ttf',
  'fonts/Noto Sans/NotoSans-Black.ttf',
  'fonts/Noto Sans/NotoSans-BlackItalic.ttf',
  'fonts/Inter/Inter_18pt-Regular.ttf',
  'fonts/Inter/Inter_18pt-Italic.ttf',
  'fonts/Inter/Inter_18pt-Medium.ttf',
  'fonts/Inter/Inter_18pt-MediumItalic.ttf',
  'fonts/Inter/Inter_18pt-SemiBold.ttf',
  'fonts/Inter/Inter_18pt-SemiBoldItalic.ttf',
  'fonts/Inter/Inter_18pt-Bold.ttf',
  'fonts/Inter/Inter_18pt-BoldItalic.ttf',
  'fonts/Inter/Inter_18pt-Black.ttf',
  'fonts/Inter/Inter_18pt-BlackItalic.ttf',
  'fonts/Noto Emoji/NotoEmoji-Regular.ttf',
  'fonts/Noto Emoji/NotoEmoji-Medium.ttf',
  'fonts/Noto Emoji/NotoEmoji-Bold.ttf',
  'js/app.js', 'js/model/document.js', 'js/model/effects.js', 'js/model/line.js',
  'js/model/pixel-region.js', 'js/interaction/pixel-selection.js', 'js/rendering/image-pixels.js',
  'js/history/history.js', 'js/storage/assets.js', 'js/storage/projects.js',
  'js/interaction/geometry.js', 'js/interaction/workspace.js', 'js/components/panels.js', 'js/components/panel-resizer.js',
  'js/components/context-menu.js',
  'js/components/document-presets.js', 'js/model/document-presets.js',
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
