// Service worker de NEXO.
// Guarda solo lo que no cambia (estilos, código, íconos) y una página "Sin conexión".
// Nunca guarda páginas de la app ni respuestas con datos: tu información financiera no queda en el teléfono.
const VERSION = "nexo-v1";
const STATIC = `${VERSION}-static`;
const OFFLINE = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC).then((c) => c.addAll([OFFLINE, "/icons/192", "/icons/512"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

const isStatic = (url) => url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || /\.(?:woff2?|svg|png|ico)$/.test(url.pathname);

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // formularios y acciones siempre van al servidor
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/app/exportar")) return;

  // Archivos que no cambian: primero lo guardado.
  if (isStatic(url)) {
    event.respondWith(
      caches.open(STATIC).then(async (c) => {
        const hit = await c.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) c.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  // Páginas: siempre desde el servidor; si no hay conexión, la página "Sin conexión".
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE)));
  }
});
