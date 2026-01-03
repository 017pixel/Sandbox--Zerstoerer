const CACHE_NAME = 'sandbox-v1';
const ASSETS = [
    './',
    './index.html',
    './sb-styles.css',
    './sb-data.js',
    './sb-utils.js',
    './sb-world.js',
    './sb-renderer.js',
    './sb-physics.js',
    './sb-ui.js',
    './sb-main.js',
    './pwa-icon.png',
    'https://cdn.tailwindcss.com',
    'https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap'
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then((response) => {
            return response || fetch(e.request);
        })
    );
});
