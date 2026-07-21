const CACHE_NAME = "orion-gym-v7";
const CACHE_PREFIX = "orion-gym-";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-192.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon-32.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // Cache what we can; a single missing/opaque asset shouldn't abort install.
      Promise.allSettled(APP_SHELL.map((url) => cache.add(url)))
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys
      .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
      .map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

// Serve whatever's cached instantly, then fetch a fresh copy in the background
// to update the cache for next time. On a slow/flaky connection this means
// the app never sits waiting on the network for something it already has —
// the old strategy re-fetched every hashed asset and every navigation before
// falling back to cache, which made a poor connection feel slower than the
// cache alone would have been.
function staleWhileRevalidate(request, event, cacheKey = request) {
  return caches.open(CACHE_NAME).then(async (cache) => {
    const cached = await cache.match(cacheKey);
    const networkUpdate = fetch(request)
      .then((response) => {
        if (response && response.status === 200) {
          cache.put(cacheKey, response.clone());
        }
        return response;
      })
      .catch(() => null);

    if (cached) {
      // Keep the worker alive long enough for the background refresh to
      // finish, without making the response wait on it.
      event.waitUntil(networkUpdate);
      return cached;
    }

    return (await networkUpdate) || Response.error();
  });
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  const isNavigation = event.request.mode === "navigate";
  const scopePath = new URL(self.registration.scope).pathname;
  const isAppAsset = url.pathname.startsWith(`${scopePath}assets/`) || url.pathname.startsWith(`${scopePath}data/`);
  const isShellAsset = APP_SHELL.some((path) => new URL(path, self.registration.scope).pathname === url.pathname);

  if (isNavigation) {
    // Every navigation resolves to the same cached app shell, so it's always
    // revalidated and stored under one fixed key regardless of the path.
    const shellUrl = new URL("./index.html", self.registration.scope).href;
    event.respondWith(staleWhileRevalidate(event.request, event, shellUrl));
    return;
  }

  if (isAppAsset || isShellAsset) {
    event.respondWith(staleWhileRevalidate(event.request, event));
    return;
  }

  // Anything else same-origin (e.g. API-style calls) stays network-first with
  // no caching, since it isn't part of the versioned app shell/assets.
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request).then((cached) => cached || Response.error()))
  );
});

self.addEventListener("push", (event) => {
  let payload;
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "Orion Gym";
  const options = {
    body: payload.body || "Time to check in on your training.",
    tag: payload.tag || "orion-gym-push",
    icon: "./icons/icon-192.png",
    badge: "./icons/favicon-32.png",
    data: payload.data || {},
    renotify: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = allClients[0];
    if (existing) {
      existing.focus();
      return;
    }
    await self.clients.openWindow("./");
  })());
});


self.addEventListener("periodicsync", (event) => {
  if (event.tag !== "orion-gym-reminder-check") {
    return;
  }

  event.waitUntil((async () => {
    await self.registration.showNotification("Orion Gym Reminder", {
      body: "Quick reminder to check in on your training streak today.",
      tag: "orion-gym-periodic-reminder",
      renotify: false,
    });
  })());
});
