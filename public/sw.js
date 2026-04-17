const CACHE_NAME = 'fuel-track-v2';

self.addEventListener('install', (event) => {
  // Force new service worker to activate immediately, avoiding the "waiting" state
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Clear old caches when a new version of the app/worker is activated
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Network-First strategy for HTML / Navigation requests
  // Guarantees we always fetch the latest index.html with the correct JS/CSS hashes
  if (event.request.mode === 'navigate' || (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html'))) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          return response;
        })
        .catch(() => caches.match(event.request).then(res => res || caches.match('/index.html')))
    );
    return;
  }

  // Stale-While-Revalidate for other static assets (JS, CSS, images)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          // Cache successful responses
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
          }
          return networkResponse;
        })
        .catch(() => {
          /* offline, return nothing more as we already returned cachedResponse if available */
        });

      return cachedResponse || fetchPromise;
    })
  );
});

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : { title: 'Fuel-Tracker Update', body: 'Um posto foi atualizado!' };
  const options = {
    body: data.body,
    icon: 'https://cdn-icons-png.flaticon.com/512/2311/2311296.png',
    badge: 'https://cdn-icons-png.flaticon.com/512/2311/2311296.png',
    vibrate: [100, 50, 100],
    data: {
      url: self.location.origin
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});
