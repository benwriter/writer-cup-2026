const CACHE = "writer-cup-v10-logo";
const ASSETS = ["./","./index.html","./styles.css?v=10-logo","./app.js?v=10-logo","./manifest.json","./config.js","./data.js","./assets/writer-cup-default.png","./assets/icon-192.png","./assets/icon-512.png","./newcup.html","./postcup.html","./postcup.css?v=10-logo"];
self.addEventListener("install", e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener("activate", e => e.waitUntil(Promise.all([
  caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))),
  self.clients.claim()
])));
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(fetch(e.request).then(r => {
    const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r;
  }).catch(() => caches.match(e.request).then(cached => cached || caches.match("./index.html"))));
});
