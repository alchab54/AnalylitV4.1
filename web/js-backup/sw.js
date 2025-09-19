const CACHE_NAME = 'analylit-v1-cache';

// 1. Événement d'installation
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Installation...');
  self.skipWaiting();
});

// 2. Événement d'activation
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activation...');
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) {
          console.log('[ServiceWorker] Suppression de l\'ancien cache', key); // Corrigé ici
          return caches.delete(key);
        }
      }));
    })
  );
  return self.clients.claim();
});

// 3. Événement de Fetch (interception des requêtes)
self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/api/') || event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    // Stratégie : Réseau d'abord
    fetch(event.request)
      .then((networkResponse) => {
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        });
      })
      .catch(() => {
        // La requête réseau a échoué (hors ligne ?)
        console.log('[ServiceWorker] Réseau échoué, service depuis le cache pour :', event.request.url); // Corrigé ici
        return caches.match(event.request);
      })
  );
});