// Offline: the app itself is kept up to date on each visit; Bible, Fathers and calendar data are
// kept once fetched, so anything read before works without internet.
const SHELL = "ob-shell-v4", DATA = "ob-data-40dcc1163c";
const FILES = ["./", "index.html", "app.css", "config.js", "app.js", "manifest.webmanifest", "icon.svg", "icon-192.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(SHELL).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => ![SHELL, DATA].includes(k)).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (url.origin === location.origin && url.pathname.includes("/data/")) {
    // Data files: from the phone if saved, else from the internet (and saved).
    e.respondWith(caches.open(DATA).then(async (c) => (await c.match(e.request)) || fetch(e.request).then((r) => { if (r.ok) c.put(e.request, r.clone()); return r; })));
  } else if (url.origin === location.origin && !url.pathname.includes("/api/")) {
    // The app: fresh when online, saved copy when not.
    e.respondWith(fetch(e.request).then((r) => { if (r.ok) caches.open(SHELL).then((c) => c.put(e.request, r.clone())); return r; }).catch(() => caches.match(e.request).then((r) => r || caches.match("index.html"))));
  } else if (url.hostname.includes("fonts.g")) {
    e.respondWith(caches.open(SHELL).then(async (c) => (await c.match(e.request)) || fetch(e.request).then((r) => { c.put(e.request, r.clone()); return r; })));
  }
});
