// FitForge Service Worker — Offline Shell & Silent Web Push (Mode B)
const CACHE_NAME = 'fitforge-cache-v1';
const OFFLINE_URLS = ['/', '/dashboard', '/plan', '/workout', '/run', '/nutrisi', '/jadwal', '/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_URLS)).catch(() => {})
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
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone)).catch(() => {});
        }
        return response;
      })
      .catch(() => caches.match(event.request))
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
      icon: '/icon.svg',
      badge: '/icon.svg',
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
          client.postMessage({ type: 'SW_NOTIFICATION_ACTION', action, data: event.notification.data });
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
