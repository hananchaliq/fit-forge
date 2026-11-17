// FitForge Service Worker v2 — Mobile PWA Offline Shell, Asset Caching & Silent Web Push
const CACHE_NAME = 'fitforge-pwa-cache-v2';
const PRECACHE_URLS = [
  '/',
  '/dashboard',
  '/run',
  '/workout',
  '/plan',
  '/nutrisi',
  '/jadwal',
  '/analitik',
  '/pengaturan',
  '/login',
  '/icon.svg',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-512x512.png',
  '/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  // Skip cross-origin APIs (Firestore, Google Auth, Aladhan, Gemini API routes)
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(event.request, clone))
            .catch(() => {});
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request).then((cached) => cached || caches.match('/dashboard'))
      )
  );
});

// Mode B — Silent Notification Handler (Prayer & Hydration)
self.addEventListener('push', (event) => {
  let payload = {
    title: 'FitForge Pengingat Harian',
    body: 'Waktunya cek jadwal ibadah dan hidrasi Anda.',
    tag: 'fitforge-silent',
    type: 'hydration',
  };
  try {
    if (event.data) {
      payload = { ...payload, ...event.data.json() };
    }
  } catch {
    // fallback payload
  }

  const actions =
    payload.type === 'prayer'
      ? [{ action: 'mark_prayer', title: 'Sudah Sholat ✓' }]
      : [{ action: 'drink_250ml', title: 'Minum 250ml 💧' }];

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: payload.tag,
      silent: false,
      renotify: false,
      actions,
      data: payload,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const action = event.action;
  const targetUrl =
    action === 'mark_prayer'
      ? '/jadwal?action=prayer_done'
      : action === 'drink_250ml'
        ? '/jadwal?action=drink_250ml'
        : '/jadwal';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.postMessage({
            type: 'SW_NOTIFICATION_ACTION',
            action,
            data: event.notification.data,
          });
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
