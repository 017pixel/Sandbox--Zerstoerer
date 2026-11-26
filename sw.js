const CACHE_NAME = 'sandbox-v1.2.2';
const ASSETS = [
    './', './index.html', './sb-styles.css', './sb-chunk.js', './sb-data.js',
    './sb-utils.js', './sb-audio.js', './sb-storage.js', './sb-world.js',
    './sb-renderer.js', './sb-physics.js', './sb-ui.js', './sb-main.js', './sb-update.js',
    './pwa-icon.png', './manifest.json', './assets/game.css', './assets/fonts/pixel.woff2'
];
self.addEventListener('install', event => {
    event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
    self.skipWaiting();
});
self.addEventListener('activate', event => {
    event.waitUntil(caches.keys().then(keys => Promise.all(
        keys.filter(key => key.startsWith('sandbox-') && key !== CACHE_NAME).map(key => caches.delete(key))
    )).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    // The landing page stays independent, including its video and demo.
    if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.includes('/landing-page')) return;
    if (event.request.mode === 'navigate') {
        event.respondWith(fetch(event.request).then(response => {
            if (response.ok) {
                const copy = response.clone();
                event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)));
            }
            return response;
        }).catch(() => caches.match(event.request).then(cached => cached || caches.match('./index.html'))));
        return;
    }
    // Only precached game files use the offline cache. Never cache unrelated requests.
    event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});
