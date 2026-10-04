/*
  Offline shell only. The page and its scripts are cached so the app opens with no signal;
  everything else goes straight to the network. Supabase (another origin) and /api/ are never
  touched, so no lead data is ever stored here. When online the network always wins, so a new
  release shows up on the next open.
*/
const CACHE = "imperium-leads-shell-v3";
const SHELL = ["/", "/claude-shim.js", "/reviews.js", "/model.js", "/vendor/supabase.js", "/config.js", "/manifest.json", "/icon-192.png", "/icon-512.png", "/apple-touch-icon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  const key = req.mode === "navigate" ? "/" : url.pathname;
  if (!SHELL.includes(key)) return;
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(key, copy));
        }
        return res;
      })
      .catch(() => caches.match(key).then((hit) => hit || Response.error())),
  );
});
