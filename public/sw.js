// Anson Family — minimal service worker
// Satisfies Chrome's PWA installability requirement.
// Uses network-first so the app always gets fresh data.

const CACHE = 'ansons-v1'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (e) =>
  e.waitUntil(clients.claim())
)

self.addEventListener('fetch', (e) => {
  // Let the browser handle everything normally — we just need the listener
  // to exist so Chrome classifies this as an installable PWA.
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  )
})
