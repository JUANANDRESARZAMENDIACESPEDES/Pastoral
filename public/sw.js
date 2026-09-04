/* ============================================================
   Pastoral Juvenil Luqueña — Service Worker
   ------------------------------------------------------------
   POR EL MOMENTO: permite instalar la web como APP en el
   celular (cachea la shell para arranque rápido/offline).
   El código queda preparado con secciones marcadas para
   habilitar luego la WEB PUSH y el soporte offline completo.
   ============================================================ */

const VERSION = 'pjl-v1';
const SHELL_CACHE = 'pjl-shell';

/* Cache de "cáscara de la app": recursos estables que se
   guardan al instalar y permiten abrir desde pantalla de inicio
   sin depender 100% de la red. */
const CORE_ASSETS = [
  '/',
  '/manifest.json',
  '/android-chrome-192.png',
  '/android-chrome-512.png',
  '/apple-touch-icon.png',
  '/favicon-192.png',
  '/favicon-32.png',
  '/pjl-logo.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
      .catch((err) => console.warn('[SW] Shell cache incomplete', err))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith('pjl-') && k !== SHELL_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // No interceptar llamadas no-GET ni a otros orígenes (API, fuentes, etc.)
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) {
    return;
  }

  // Navegación: red primero, con respaldo a la shell cacheada.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match('/')))
    );
    return;
  }

  // Resto de recursos estáticos: cache primero, red por detrás.
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(SHELL_CACHE).then((c) => c.put(request, copy));
          }
          return res;
        })
    )
  );
});

/* ============================================================
   LISTO PARA WEB PUSH (próximo paso)
   ------------------------------------------------------------
   Habilitar cuando se agregue la suscripción push:
   1) el service worker recibe el mensaje push del servidor
   2) notifica al celular aunque la app esté cerrada.
   Ej: "La misa de hoy cambia de horario" / "¡Llegamos a la meta!"
   ============================================================ */
self.addEventListener('push', (event) => {
  let data = { title: 'Pastoral Juvenil Luqueña', body: 'Tenés una nueva notificación', url: '/' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch (e) {
    /* payload no-JSON: usar valores por defecto */
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/android-chrome-192.png',
      badge: '/favicon-192.png',
      data: { url: data.url },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      const wasFocused = windowClients.some((client) => {
        if ('navigate' in client) {
          client.navigate(target);
          return client.focused;
        }
        return false;
      });
      if (!wasFocused && self.clients.openWindow) {
        return self.clients.openWindow(target);
      }
    })
  );
});
