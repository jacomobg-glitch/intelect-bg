// Service worker: всички файлове се кешират при инсталиране и после се сервират офлайн.
// Списъкът се генерира с `npm run precache`; нов файл не изисква промяна тук.
importScripts('./precache-manifest.js');

// Името е уникално, защото GitHub Pages споделя един origin между проектите на потребителя.
const PREFIX = 'evolyutsiya-na-uma-';
const CACHE = PREFIX + self.PRECACHE.version;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(self.PRECACHE.files.map((f) => new Request(f, { cache: 'reload' })));
    // Новата версия влиза тихо: отворената страница работи със заредения код, а следващото отваряне е с новия.
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n.startsWith(PREFIX) && n !== CACHE).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // Всички навигации водят към './', а не към index.html: `npx serve` пренасочва index.html
    // и такъв кеширан отговор браузърът отказва да използва за навигация.
    const hit = await cache.match(request.mode === 'navigate' ? './' : request, { ignoreSearch: true });
    return hit || fetch(request);
  })());
});
