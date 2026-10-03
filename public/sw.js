/* UEB service worker.
 *
 * Why this file exists: Chrome/Edge only fire `beforeinstallprompt` — the event
 * behind the in-app "Install app" button — when the site is served over HTTPS,
 * has a web manifest, AND has a service worker with a `fetch` handler. It is
 * also what lets an installed UEB start with a cached shell when the network is
 * flaky at a venue.
 *
 * Caching rules, deliberately conservative:
 *   • /api/*            → never touched, data stays live
 *   • navigations       → network first, cache only as an offline fallback
 *   • /_next/static, /icons, /events (images) → cache first, refreshed behind
 *
 * Registered from `src/components/InstallAppPrompt.tsx`. In `next dev` it is
 * registered with `?dev=1`, which disables every cache write so local
 * development can never serve a stale chunk.
 */

const VERSION = "ueb-v1";
const PAGES = `${VERSION}-pages`;
const ASSETS = `${VERSION}-assets`;

const DEV = new URL(self.location.href).searchParams.get("dev") === "1";

/** Small shell so an installed app still opens something without a network. */
const PRECACHE = ["/", "/events", "/checkin", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  if (DEV) {
    self.skipWaiting();
    return;
  }
  event.waitUntil(
    caches
      .open(PAGES)
      .then((cache) => Promise.allSettled(PRECACHE.map((url) => cache.add(new Request(url, { cache: "reload" })))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

/** Only whole, ok, same-origin responses are worth keeping. */
function cacheable(response) {
  return response && response.ok && response.status === 200 && response.type === "basic";
}

async function put(cacheName, request, response) {
  const cache = await caches.open(cacheName);
  await cache.put(request, response);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // Development: never read or write a cache, just pass through.
  if (DEV) return;

  // Documents: always prefer the network so organisers never see a stale
  // roster or ticket page; the cache only answers when the network fails.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          if (cacheable(fresh)) put(PAGES, request, fresh.clone());
          return fresh;
        } catch {
          const cached = (await caches.match(request)) || (await caches.match("/"));
          if (cached) return cached;
          return new Response(
            "<!doctype html><meta charset=utf-8><title>UEB offline</title><body style=\"font-family:system-ui;padding:2rem\"><h1>You are offline</h1><p>Reconnect to load UEB.</p></body>",
            { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } }
          );
        }
      })()
    );
    return;
  }

  // Immutable build output, icons and event artwork: cache first, refresh in
  // the background so the next load is already up to date.
  const isStatic =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/events/");

  if (!isStatic) return;

  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      const network = fetch(request)
        .then((response) => {
          if (cacheable(response)) put(ASSETS, request, response.clone());
          return response;
        })
        .catch(() => null);
      return cached || (await network) || Response.error();
    })()
  );
});
