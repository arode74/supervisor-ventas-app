// sw.js - APP Ventas Mobile (PWA)
// Cache básico para que Android/Chrome lo reconozca como instalable.
// Ajusta ASSETS si quieres precachear CSS/JS específicos.

const CACHE = "ventas-afp-mobile-v1";
const ASSETS = [
  "/",
  "/index.html",
  "/favicon.ico",
  "/manifest.webmanifest"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Navegación: usa index.html como fallback offline
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match("/index.html"))
    );
    return;
  }

  // Recursos: cache-first
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req))
  );
});
