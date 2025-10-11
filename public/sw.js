const CACHE_NAME = 'chesso-v1';
const urlsToCache = [
  '/',
  '/auth',
  '/lobby',
  '/css/style.css',
  '/css/lobby.css',
  '/css/auth.css',
  '/js/chessgame.js',
  '/js/lobby.js',
  '/js/auth.js',
  '/js/firebase-config.js',
  '/js/theme.js',
  '/js/pwa.js',
  '/manifest.json',
  '/icons/icon-192x192.png'
];

// Install event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
  );
});

// Fetch event
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        return response || fetch(event.request);
      }
    )
  );
});

// Activate event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});