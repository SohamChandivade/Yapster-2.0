/*
 * Yapster service worker. Deliberately small:
 *   - precaches the offline page and the static chunks it needs,
 *   - caches hashed build assets and icons on first use (they never change under one URL),
 *   - serves the offline page when a navigation fails,
 *   - never touches the API (another origin) or anything that is not a GET.
 * Bump VERSION to drop every old cache on the next activation.
 */
const VERSION = "yapster-v1";
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(VERSION);
      const res = await fetch(OFFLINE_URL, { cache: "reload", credentials: "same-origin" });
      if (!res.ok) return;
      await cache.put(OFFLINE_URL, res.clone());
      // The page's own stylesheet and scripts, so it renders styled with no network at all.
      const html = await res.text();
      const assets = [...html.matchAll(/(?:href|src)="(\/_next\/static\/[^"]+)"/g)].map((m) => m[1]);
      await Promise.all(
        [...new Set(assets)].map((url) => cache.add(url).catch(() => undefined)),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(async () => (await caches.match(OFFLINE_URL)) ?? Response.error()));
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(VERSION);
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) await cache.put(req, res.clone());
        return res;
      })(),
    );
  }
});
