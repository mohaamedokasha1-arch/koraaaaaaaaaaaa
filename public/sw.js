/*
 * KoraScore service worker — deliberately minimal.
 *
 * WHAT IT DOES
 *   • caches static build assets (immutable, content-hashed) — cache-first,
 *   • keeps one offline fallback page per locale and serves it when a navigation
 *     cannot reach the network,
 *   • cleans up older cache versions on activation.
 *
 * WHAT IT NEVER DOES (the reason it is safe to ship)
 *   • never caches or intercepts /api/* responses,
 *   • never caches HTML pages other than the offline fallback, so a reader can
 *     never be shown yesterday's scoreboard from the SW cache,
 *   • never serves stale live data: page requests are network-first with a very
 *     short timeout, and any failure falls back to the offline page — not to a
 *     cached page with old scores,
 *   • never touches cross-origin requests.
 */

const VERSION = 'kora-static-v1';
const OFFLINE_PAGES = ['/ar/offline', '/en/offline'];
const NAVIGATION_TIMEOUT_MS = 4000;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(VERSION);
      // addAll fails the whole install if any URL fails; add individually instead.
      await Promise.all(
        OFFLINE_PAGES.map((url) => cache.add(new Request(url, { cache: 'reload' })).catch(() => undefined)),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/_next/image') ||
    /\.(?:css|js|mjs|woff2?|ttf|otf|svg|png|jpe?g|webp|avif|ico)$/.test(url.pathname)
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return; // live data is never cached

  if (isStaticAsset(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(VERSION);
        const cached = await cache.match(request);
        if (cached) return cached;
        try {
          const response = await fetch(request);
          if (response && response.ok) cache.put(request, response.clone());
          return response;
        } catch (error) {
          return cached || Response.error();
        }
      })(),
    );
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), NAVIGATION_TIMEOUT_MS);
          const response = await fetch(request, { signal: controller.signal });
          clearTimeout(timer);
          return response;
        } catch (error) {
          const cache = await caches.open(VERSION);
          const locale = url.pathname.startsWith('/en') ? '/en/offline' : '/ar/offline';
          const fallback =
            (await cache.match(locale)) || (await cache.match('/ar/offline'));
          if (fallback) return fallback;
          return new Response(
            '<!doctype html><meta charset="utf-8"><title>Offline</title><body style="font-family:system-ui;background:#0b1424;color:#e2e8f0;padding:2rem">لا يوجد اتصال بالإنترنت — KoraScore offline</body>',
            { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
          );
        }
      })(),
    );
  }
});
