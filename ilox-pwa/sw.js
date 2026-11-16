/* ILOX PWA: actualización automática de la aplicación y caché de respaldo offline. */
const CACHE = "ilox-pwa-network-first-20261116-v13";
const CORE = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./game.js",
  "./multiplayer.js",
  "./manifest.webmanifest",
  "./icon.svg",
  "./icon-192.svg",
  "./icon-512.svg"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(CORE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

/*
 * Network-first: en cada apertura/solicitud se consulta el build publicado.
 * La caché queda como respaldo si el dispositivo está sin conexión.
 * Así un HTML/JS/CSS viejo nunca gana sobre una versión nueva disponible.
 */
self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // No interferir con descargas parciales/streaming.
  if (request.headers.has("range")) return;

  event.respondWith((async () => {
    try {
      const response = await fetch(request, { cache: "no-cache" });
      if (response && response.ok && response.status === 200) {
        const cache = await caches.open(CACHE);
        await cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      const cached = await caches.match(request);
      if (cached) return cached;
      if (request.mode === "navigate") {
        const shell = await caches.match("./index.html");
        if (shell) return shell;
      }
      throw error;
    }
  })());
});
