/**
 * Sunday Guelph VB — Service Worker
 * ───────────────────────────────────
 * Strategy:
 *  - App shell (HTML, fonts, images): Cache-first with network fallback
 *  - Google Sheets API calls: Network-first with cache fallback + background refresh
 *  - External images (Pexels): Cache-first, long TTL
 *  - Everything else: Network-first
 */

const CACHE_VERSION   = 'sgvb-v1';
const SHELL_CACHE     = CACHE_VERSION + '-shell';
const DATA_CACHE      = CACHE_VERSION + '-data';
const IMAGE_CACHE     = CACHE_VERSION + '-images';

// Files to pre-cache on install (the app shell)
const SHELL_ASSETS = [
  './index.html',
  './manifest.json',
];

// Origins / patterns to treat as data (network-first)
const DATA_ORIGINS = [
  'script.google.com',
  'api.mailersend.com',
];

// Origins to treat as remote images (cache-first, long TTL)
const IMAGE_ORIGINS = [
  'images.pexels.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
];

const MAX_IMAGE_CACHE_ENTRIES = 60;
const MAX_DATA_CACHE_AGE_MS   = 5 * 60 * 1000; // 5 minutes

// ── INSTALL ──────────────────────────────────────────────────

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[SW] Install error:', err))
  );
});

// ── ACTIVATE ─────────────────────────────────────────────────

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k.startsWith('sgvb-') && k !== SHELL_CACHE && k !== DATA_CACHE && k !== IMAGE_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH ─────────────────────────────────────────────────────

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and chrome-extension URLs
  if (request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;

  // Data/API requests — network-first with cache fallback
  if (DATA_ORIGINS.some(o => url.hostname.includes(o))) {
    event.respondWith(networkFirstWithCache(request, DATA_CACHE));
    return;
  }

  // Remote images — cache-first with network fallback
  if (IMAGE_ORIGINS.some(o => url.hostname.includes(o))) {
    event.respondWith(cacheFirstWithNetwork(request, IMAGE_CACHE, MAX_IMAGE_CACHE_ENTRIES));
    return;
  }

  // App shell and local assets — cache-first
  event.respondWith(cacheFirstWithNetwork(request, SHELL_CACHE));
});

// ── STRATEGIES ────────────────────────────────────────────────

async function networkFirstWithCache(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const networkResponse = await fetch(request.clone(), { cache: 'no-store' });
    if (networkResponse.ok || networkResponse.type === 'opaque') {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    // Return offline JSON for data requests
    return new Response(JSON.stringify({ ok: false, offline: true, rows: [] }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function cacheFirstWithNetwork(request, cacheName, maxEntries) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) {
    // Refresh in background (stale-while-revalidate)
    fetch(request.clone()).then(res => {
      if (res && (res.ok || res.type === 'opaque')) {
        cache.put(request, res);
        if (maxEntries) trimCache(cacheName, maxEntries);
      }
    }).catch(() => {});
    return cached;
  }
  try {
    const networkResponse = await fetch(request.clone());
    if (networkResponse.ok || networkResponse.type === 'opaque') {
      cache.put(request, networkResponse.clone());
      if (maxEntries) trimCache(cacheName, maxEntries);
    }
    return networkResponse;
  } catch (err) {
    // Offline fallback for the main HTML
    if (request.mode === 'navigate') {
      const fallback = await caches.match('./index.html');
      if (fallback) return fallback;
    }
    return new Response('Offline — please check your connection.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys  = await cache.keys();
  if (keys.length > maxEntries) {
    await cache.delete(keys[0]);
  }
}

// ── BACKGROUND SYNC (for failed form submissions) ─────────────

self.addEventListener('sync', event => {
  if (event.tag === 'sync-submissions') {
    event.waitUntil(replaySyncQueue());
  }
});

async function replaySyncQueue() {
  // IndexedDB queue is managed in the main app; SW just triggers the flush
  const clients = await self.clients.matchAll({ type: 'window' });
  clients.forEach(client => client.postMessage({ type: 'SYNC_QUEUE' }));
}

// ── PUSH NOTIFICATIONS (future use) ──────────────────────────

self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'Sunday Guelph VB', {
      body:    data.body || '',
      icon:    './icons/icon-192.png',
      badge:   './icons/icon-72.png',
      tag:     data.tag || 'sgvb',
      data:    { url: data.url || './' },
      actions: data.actions || [],
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || './';
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clients => {
      const existing = clients.find(c => c.url.includes('sundayguelphvb'));
      if (existing) { existing.focus(); existing.navigate(url); }
      else self.clients.openWindow(url);
    })
  );
});

// ── MESSAGE HANDLER (from main app) ──────────────────────────

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data?.type === 'CLEAR_CACHE') {
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))));
  }
});
