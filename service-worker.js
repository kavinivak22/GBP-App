const CACHE_NAME = 'guberaan-builders-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  // Add other assets here if they were external files (e.g., /assets/images/logo.png)
  // Since the logo is embedded, it's part of index.html and doesn't need separate caching unless it was external.
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;600;700&family=Raleway:wght@300;400;600;700&display=swap'
];

// Install event: caches the static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Fetch event: serves cached content when offline
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        // No cache hit - fetch from network
        return fetch(event.request).catch(() => {
          // If network fetch fails, provide a fallback.
          // For this simple app, we can just return a basic offline response.
          // You might have a specific offline.html page for a more complex app.
          return new Response("<h1>You are offline.</h1><p>Please check your internet connection.</p>", {
            headers: { 'Content-Type': 'text/html' }
          });
        });
      })
  );
});

// Activate event: cleans up old caches
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName); // Delete old caches
          }
        })
      );
    })
  );
});
