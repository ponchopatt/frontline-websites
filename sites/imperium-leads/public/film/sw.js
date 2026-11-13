/*
  Film List's offline shell: the page, its scripts, fonts and icons, so it opens with no
  signal. /api/ is never cached, so no ideas are stored here. When online the network always
  wins, so a new release shows up on the next open.
*/
const CACHE = "imperium-film-shell-v3";
const SHELL = ["/film/", "/film/film.js", "/film/film-model.js", "/film/film.css", "/film/ad-filming.json", "/film/manifest.json", "/film/fonts/big-shoulders.woff2", "/film/fonts/instrument-sans.woff2", "/film/icon-192.png", "/film/icon-512.png", "/film/apple-touch-icon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("imperium-film-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith("/film/")) return;
  const key = req.mode === "navigate" ? "/film/" : url.pathname;
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

// Phone reminders (sent by /api/film?action=remind): show it, and open Film List when tapped.
self.addEventListener("push", (event) => {
  let m = {};
  try { m = event.data ? event.data.json() : {}; } catch (e) { m = { title: "Film List", body: event.data ? event.data.text() : "" }; }
  event.waitUntil(self.registration.showNotification(m.title || "Film List", {
    body: m.body || "",
    tag: m.tag || "film",
    icon: "/film/icon-192.png",
    badge: "/film/icon-192.png",
    data: { url: m.url || "/film/" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/film/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) if (new URL(c.url).pathname.startsWith("/film/") && "focus" in c) return c.focus();
      return self.clients.openWindow(url);
    }),
  );
});
