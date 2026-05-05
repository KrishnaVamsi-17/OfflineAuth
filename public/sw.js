/* global workbox */

importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.1.0/workbox-sw.js');

const APP_SHELL_CACHE = 'offlineauth-app-shell-v1';
const ASSET_CACHE = 'offlineauth-assets-v1';
const IMAGE_CACHE = 'offlineauth-images-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) => cache.addAll(['/', '/index.html', '/favicon.ico'])),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

if (self.workbox) {
  workbox.core.setCacheNameDetails({ prefix: 'offlineauth' });

  workbox.routing.registerRoute(
    ({ request }) => request.mode === 'navigate',
    async () => {
      const cache = await caches.open(APP_SHELL_CACHE);

      try {
        const response = await fetch('/');
        cache.put('/', response.clone());
        return response;
      } catch (error) {
        const cachedResponse = await cache.match('/');
        if (cachedResponse) {
          return cachedResponse;
        }

        throw error;
      }
    },
  );

  workbox.routing.registerRoute(
    ({ request, url }) =>
      url.origin === self.location.origin &&
      (request.destination === 'script' || request.destination === 'style' || request.destination === 'worker'),
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: ASSET_CACHE,
      plugins: [new workbox.cacheableResponse.CacheableResponsePlugin({ statuses: [0, 200] })],
    }),
  );

  workbox.routing.registerRoute(
    ({ request, url }) => url.origin === self.location.origin && request.destination === 'image',
    new workbox.strategies.CacheFirst({
      cacheName: IMAGE_CACHE,
      plugins: [
        new workbox.cacheableResponse.CacheableResponsePlugin({ statuses: [0, 200] }),
        new workbox.expiration.ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 7 * 24 * 60 * 60 }),
      ],
    }),
  );
}