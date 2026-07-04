const CACHE_NAME = "orion-gym-v6";
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
  const shouldCache = isNavigation || isAppAsset || isShellAsset;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (shouldCache && response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            if (isNavigation) {
              cache.put(new URL("./index.html", self.registration.scope).href, clone);
              return;
            }
            cache.put(event.request, clone);
          });
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) {
          return cached;
        }
        if (isNavigation) {
          return caches.match(new URL("./index.html", self.registration.scope).href);
        }
        return Response.error();
      })
  );
});

self.addEventListener("push", (event) => {
  let payload = {};
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
