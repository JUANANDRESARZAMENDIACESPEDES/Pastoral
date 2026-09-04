/* ============================================================
   Pastoral Juvenil Luqueña — Service Worker
   ------------------------------------------------------------
   Permite instalar la web como APP en el celular
   (cachea la shell para arranque rápido/offline).
   sirve iconos PWA personalizados desde Cache API
   cuando el admin cambia el logo desde el panel.
   ============================================================ */

const VERSION = 'pjl-v2';
const SHELL_CACHE = 'pjl-shell';
const CUSTOM_ICONS_CACHE = 'pjl-custom-icons';

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

const ICON_URLS = ['/android-chrome-192.png', '/android-chrome-512.png'];

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
            .filter((k) => k.startsWith('pjl-') && k !== SHELL_CACHE && k !== CUSTOM_ICONS_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'UPDATE_PWA_ICONS') {
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      clients.forEach((client) => {
        if (client.url && !client.url.includes('chrome-extension://')) {
          client.postMessage({ type: 'PWA_ICONS_UPDATED' });
        }
      });
    });
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) {
    return;
  }

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

  const pathname = new URL(request.url).pathname;

  if (ICON_URLS.includes(pathname)) {
    event.respondWith(
      caches.open(CUSTOM_ICONS_CACHE).then((cache) =>
        cache.match(request).then((custom) => {
          if (custom) return custom;
          return caches.match(request).then((cached) => cached || fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(SHELL_CACHE).then((c) => c.put(request, copy));
            }
            return res;
          }));
        })
      )
    );
    return;
  }

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
   WEB PUSH — Notificaciones push habilitadas
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
