
const CACHE = "writer-cup-2026-v4";
const ASSETS = ["./","./index.html","./styles.css","./app.js","./manifest.json","./config.js","./data.js","./assets/writer-cup-logo.png","./assets/icon-192.png","./assets/icon-512.png"];
self.addEventListener("install", e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS))));
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", e => {
  e.respondWith(caches.match(e.request).then(cached => cached || fetch(e.request).then(r => {
    const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r;
  }).catch(() => caches.match("./index.html"))));
});
