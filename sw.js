const CACHE = "parece-mentira-v3";

const ASSETS = [
  "./",
  "index.html",
  "styles.css?v=2",
  "app.js?v=2",
  "manifest.json",
  "icon-192.png",
  "icon-512.png"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();

  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // IMPORTANTE:
  // O Service Worker só controla arquivos do próprio GitHub Pages.
  // Chamadas para o backend Cloudflare passam direto pela internet.
  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.method !== "GET") {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();

          caches
            .open(CACHE)
            .then((cache) =>
              cache.put("index.html", copy)
            );

          return response;
        })
        .catch(() =>
          caches.match("index.html")
        )
    );

    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const networkRequest = fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();

            caches
              .open(CACHE)
              .then((cache) =>
                cache.put(request, copy)
              );
          }

          return response;
        })
        .catch(() => cached);

      return cached || networkRequest;
    })
  );
});