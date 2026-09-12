const VERSION = 'mkwii-v1';
const SHELL = [
  '/', '/index.html', '/manifest.webmanifest',
  '/src/main.js', '/src/style.css', '/src/worker.js', '/src/logger.js',
  '/src/gpu-init.js', '/src/input.js',
  '/src/settings.js', '/src/mods.js',
  '/worklets/mkwii-pcm.js',
];
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  if (/\.(wasm|js|css|html)$/.test(url.pathname) || url.pathname === '/') {
    e.respondWith(
      caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
        const clone = res.clone();
        caches.open(VERSION).then((c) => c.put(e.request, clone));
        return res;
      }))
    );
  }
});