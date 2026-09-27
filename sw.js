// Service worker: lets the app open without a connection (DECISIONS D17).
// Bump VERSION whenever you change this file's caching or the SHELL list; old caches are then deleted.
// SHELL lists every file the app needs, so a new file in css/ or js/ goes here too (the tests check).
const VERSION = 'todo-v4';
const SHELL = ['./', 'firebase-config.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png',
  'fonts/AtkinsonHyperlegibleNext.woff2',
  'css/base.css', 'css/layout.css', 'css/items.css', 'css/gantt.css', 'css/dialogs.css',
  'js/main.js', 'js/config.js', 'js/format.js', 'js/models.js', 'js/store.js', 'js/state.js', 'js/actions.js', 'js/sync.js',
  'js/router.js', 'js/events.js', 'js/views/dom.js', 'js/views/render.js', 'js/views/rows.js', 'js/views/project.js',
  'js/views/gantt.js', 'js/views/pickers.js', 'js/views/editors.js', 'js/views/fields.js', 'js/reorder.js',
  'js/repeat.js', 'js/calendar.js'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION)
    .then(cache => cache.addAll(SHELL.map(url => new Request(url, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(key => key !== VERSION).map(key => caches.delete(key))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin === location.origin) event.respondWith(networkFirst(request));
  else if (url.hostname === 'www.gstatic.com') event.respondWith(cacheFirst(request));
  // Everything else (Firebase sign-in and database traffic) is left alone: the SDK handles offline itself.
});

// Our own files: fresh from the network when possible, the saved copy when offline or slower than 3 s.
async function networkFirst(request) {
  const cache = await caches.open(VERSION);
  const fresh = fetch(request.url, { cache: 'no-cache' }).then(response => {
    if (response.ok) cache.put(request.url, response.clone());
    return response;
  });
  const slow = new Promise(resolve => setTimeout(resolve, 3000));
  return (await Promise.race([fresh.catch(() => null), slow]))
    || (await cache.match(request.url, { ignoreSearch: true }))
    || (request.mode === 'navigate' && await cache.match('./'))
    || fresh;
}

// Firebase SDK files have the version in their URL, so a saved copy never goes stale.
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) (await caches.open(VERSION)).put(request, response.clone());
  return response;
}
