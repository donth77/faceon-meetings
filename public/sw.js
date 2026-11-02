// FaceOn's service worker, registered by src/components/pwa/service-worker.tsx in
// production builds. It keeps a page to show when there's no connection, and caches
// files that never change, so the installed app opens fast. It never caches pages,
// /api (sign-in included), media or anything from another site: those always come from
// the network. The rules are in cacheRule, unit-tested in src/lib/pwa/service-worker.test.ts.

/** The offline page and the icon it shows. */
const SHELL = "faceon-shell-v1";
/** Next.js build files, whose names change whenever their content does. */
const STATIC = "faceon-static-v1";
/** Icons, backgrounds and the effects engine's files. */
const ASSETS = "faceon-assets-v1";
const OFFLINE_PAGE = "/offline.html";
const SHELL_FILES = [OFFLINE_PAGE, "/icons/icon-192.png"];
/** How many files each cache keeps; the oldest go first. */
const LIMITS = { [STATIC]: 300, [ASSETS]: 120 };
/** How often the offline page is fetched again, so it follows the app's updates. */
const SHELL_REFRESH_MS = 6 * 60 * 60 * 1000;

/**
 * What the worker does with a request:
 * - "bypass": nothing, so the browser fetches it as if there were no worker;
 * - "page": the network, or the offline page when there's no connection;
 * - "static": the cache, else the network (the file never changes);
 * - "asset": the cache at once, refreshed from the network for next time;
 * - "fresh": the network, or the cache when there's no connection.
 *
 * @param {{ url: URL, origin: string, method: string, mode: string, range: boolean, rsc: boolean }} request
 * @returns {"bypass" | "page" | "static" | "asset" | "fresh"}
 */
function cacheRule({ url, origin, method, mode, range, rsc }) {
  if (method !== "GET" || url.origin !== origin) return "bypass";
  // A range is part of a video or a sound, which the browser streams itself.
  if (range) return "bypass";
  const path = url.pathname;
  if (path === "/api" || path.startsWith("/api/")) return "bypass";
  if (mode === "navigate") return "page";
  // The router's requests for a page's content: always the network, like pages.
  if (rsc || url.searchParams.has("_rsc")) return "bypass";
  if (path.startsWith("/_next/static/")) return "static";
  if (/\.(mp4|webm|mov|m4v|mp3|m4a|ogg|oga|wav)$/i.test(path)) return "bypass";
  // The effects engine's runtime and model must match each other, so the network
  // decides; the cache only stands in without a connection.
  if (path.startsWith("/effects/")) return "fresh";
  if (
    ["/backgrounds/", "/icons/", "/brand/", "/avatar/"].some((prefix) =>
      path.startsWith(prefix),
    ) ||
    ["/favicon.ico", "/icon.svg", "/apple-icon.png", "/manifest.webmanifest"].includes(path)
  ) {
    return "asset";
  }
  return "bypass";
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      await refreshShell();
      // Nothing it caches can go out of step with a page, so the new worker can take over now.
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const kept = new Set([SHELL, STATIC, ASSETS]);
      for (const name of await caches.keys()) {
        if (name.startsWith("faceon-") && !kept.has(name)) await caches.delete(name);
      }
      // Lets a page's request start while the worker is still waking up.
      await self.registration.navigationPreload?.enable();
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const rule = cacheRule({
    url: new URL(request.url),
    origin: self.location.origin,
    method: request.method,
    mode: request.mode,
    range: request.headers.has("range"),
    rsc: request.headers.has("rsc"),
  });
  if (rule === "page") event.respondWith(page(event));
  else if (rule === "static") event.respondWith(cacheFirst(request));
  else if (rule === "asset") event.respondWith(staleWhileRevalidate(event));
  else if (rule === "fresh") event.respondWith(networkFirst(request));
});

/** Fetches the offline page and its icon again, past the browser's own cache. */
async function refreshShell() {
  const cache = await caches.open(SHELL);
  await cache.addAll(SHELL_FILES.map((path) => new Request(path, { cache: "reload" })));
}

/** Whether the offline page was fetched long enough ago to fetch it again. */
async function shellIsOld() {
  const offline = await caches.match(OFFLINE_PAGE);
  const fetchedAt = Date.parse(offline?.headers.get("date") ?? "");
  return !(Date.now() - fetchedAt < SHELL_REFRESH_MS);
}

/** A page: always from the network, else the offline page. */
async function page(event) {
  try {
    const response = (await event.preloadResponse) ?? (await fetch(event.request));
    event.waitUntil(
      shellIsOld()
        .then((old) => (old ? refreshShell() : undefined))
        .catch(() => {}),
    );
    return response;
  } catch {
    const offline = await caches.match(OFFLINE_PAGE);
    return (
      offline ??
      new Response("You're offline.", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      })
    );
  }
}

const cacheable = (response) => response.ok && response.type === "basic";

async function keep(name, request, response) {
  const cache = await caches.open(name);
  await cache.put(request, response);
  const keys = await cache.keys();
  for (const old of keys.slice(0, Math.max(0, keys.length - LIMITS[name]))) {
    await cache.delete(old);
  }
}

async function cacheFirst(request) {
  const hit = await caches.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (cacheable(response)) await keep(STATIC, request, response.clone());
  return response;
}

async function staleWhileRevalidate(event) {
  const { request } = event;
  const hit = await caches.match(request);
  const fresh = fetch(request).then(async (response) => {
    if (cacheable(response)) await keep(ASSETS, request, response.clone());
    return response;
  });
  if (!hit) return fresh;
  event.waitUntil(fresh.catch(() => {}));
  return hit;
}

async function networkFirst(request) {
  const hit = await caches.match(request);
  try {
    const response = await fetch(request);
    // These files are large: keep a copy only when it's new.
    const tag = response.headers.get("etag");
    const unchanged = hit && tag && hit.headers.get("etag") === tag;
    if (cacheable(response) && !unchanged) {
      await keep(ASSETS, request, response.clone());
    }
    return response;
  } catch (error) {
    if (hit) return hit;
    throw error;
  }
}
