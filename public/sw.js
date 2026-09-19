const CACHE_NAME = "ueb-shell-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  // Network-first keeps event listings and account screens current while the
  // service worker makes the site installable on supported browsers.
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
