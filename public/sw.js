// Service worker de Guafra.
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

// Avisos en el celular: llegan vacíos y se pide a la app qué mostrar (con tu sesión), así ningún dato viaja en el aviso.
self.addEventListener("push", (event) => {
  event.waitUntil((async () => {
    let m = { title: "Guafra", body: "Tenés pagos o cobros para revisar.", url: "/app/proximos" };
    try {
      const r = await fetch("/api/push/aviso", { credentials: "same-origin", cache: "no-store" });
      if (r.ok) m = await r.json();
    } catch (e) { /* sin conexión: se muestra el aviso genérico */ }
    await self.registration.showNotification(m.title, { body: m.body, icon: "/icons/192", badge: "/icons/192", data: { url: m.url }, tag: "guafra-vencimientos" });
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/app";
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const w of wins) if (new URL(w.url).origin === self.location.origin) { await w.focus(); return w.navigate(url); }
    return self.clients.openWindow(url);
  })());
});
