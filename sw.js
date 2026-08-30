self.addEventListener("install", event => {
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", event => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(new Request(event.request, { cache: "reload" }))
      .then(response => response)
      .catch(() => caches.match(event.request))
  );
});
