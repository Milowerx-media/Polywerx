// Polywerx offline helper. It keeps a copy of the app on this computer so the installed app
// opens without internet, and it fetches the newest version whenever you're online.
const VERSION = "pwx-1";
const SHELL = ["./", "index.html", "guide.pdf", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png", "icons/favicon-32.png"];
// the 3D engine and its add-ons come from these sites; a copy is kept after the first visit
const LIBS = /^https:\/\/(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|unpkg\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)\//;
const CORE_LIBS = [
  "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js",
  "https://cdn.jsdelivr.net/npm/three-mesh-bvh@0.7.8/build/index.module.js",
  "https://cdn.jsdelivr.net/npm/meshoptimizer@1.3.0/meshopt_simplifier.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"
];
self.addEventListener("install", e => {
  e.waitUntil(Promise.all([
    caches.open(VERSION).then(c => Promise.all(SHELL.map(u => c.add(new Request(u, { cache: "reload" })).catch(() => {})))),
    caches.open("pwx-libs").then(c => Promise.all(CORE_LIBS.map(u => c.match(u).then(m => m || c.add(u)).catch(() => {}))))
  ]).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== "pwx-libs").map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
const timeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);
self.addEventListener("fetch", e => {
  const r = e.request; if (r.method !== "GET") return;
  const url = new URL(r.url);
  if (url.origin === self.location.origin) {
    if (r.mode === "navigate" || url.pathname.endsWith("/") || url.pathname.endsWith("index.html")) {   // the app itself: newest when online
      const saved = () => caches.match("index.html").then(m => m || caches.match("./"));
      e.respondWith(timeout(fetch(r), 6000).then(res => { if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put("index.html", copy)); return res; } return saved().then(m => m || res); })   // site down or paused: keep using the saved copy
        .catch(saved));
      return;
    }
    e.respondWith(caches.match(r).then(m => m || fetch(r).then(res => { if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(r, copy)); } return res; })));
    return;
  }
  if (LIBS.test(r.url)) {   // 3D engine, add-ons and fonts: use the saved copy, refresh it in the background
    e.respondWith(caches.open("pwx-libs").then(c => c.match(r).then(m => { const net = fetch(r).then(res => { if (res.ok || res.type === "opaque") c.put(r, res.clone()); return res; }).catch(() => m); return m || net; })));
  }
});
