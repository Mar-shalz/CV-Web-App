// Receipts service worker. Small on purpose.
// Static build assets: cache first. Pages: network first, then the offline page.
// Application pages (the job snapshot and the CV sent) are also kept for offline
// reading, on this phone only, and deleted on sign out.
const VERSION = "v2";
const STATIC = `static-${VERSION}`;
const PAGES = `pages-${VERSION}`;
const RECORDS = `records-${VERSION}`;
const OFFLINE_URL = "/offline";
const MAX_RECORDS = 40;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(PAGES).then((c) => c.add(OFFLINE_URL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => ![STATIC, PAGES, RECORDS].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "clear-records") event.waitUntil(caches.delete(RECORDS));
});

async function trim(cache) {
  const keys = await cache.keys();
  for (const k of keys.slice(0, Math.max(0, keys.length - MAX_RECORDS))) await cache.delete(k);
}

/** /applications and /applications/<id> (not the shortlist or debrief forms). */
function isRecord(url) {
  return /^\/applications(\/[0-9a-z-]+)?\/?$/i.test(url.pathname);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(STATIC).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const res = await fetch(request);
        if (res.ok) cache.put(request, res.clone());
        return res;
      }),
    );
    return;
  }

  if (request.mode !== "navigate") return;

  if (url.pathname === "/sign-in" && url.searchParams.has("signed_out")) {
    event.respondWith(caches.delete(RECORDS).then(() => fetch(request)).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  if (isRecord(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(RECORDS);
        try {
          const res = await fetch(request);
          // Only keep real pages, never a redirect to sign in.
          if (res.ok && !res.redirected) {
            await cache.put(url.pathname, res.clone());
            await trim(cache);
          }
          return res;
        } catch {
          return (await cache.match(url.pathname)) || (await caches.match(OFFLINE_URL));
        }
      })(),
    );
    return;
  }

  event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
});
