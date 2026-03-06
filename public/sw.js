const CACHE_NAME = 'chesso-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // A simple fetch handler is required by Chromium for PWA installability
  event.respondWith(
    fetch(event.request).catch(() => {
      // In a real offline-first app, we'd return cached assets here
      return new Response('Offline mode');
    })
  );
});
