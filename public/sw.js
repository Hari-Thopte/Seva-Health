const CACHE_NAME = 'seva-health-cache-v1'

const PRECACHE_URLS = [
  '/',
  '/worker/dashboard',
  '/worker/new-visit',
  '/worker/patients',
  '/worker/followups',
  '/favicon.ico',
  '/manifest.json'
]

// In development, immediately unregister to prevent infinite reload loops
self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.registration.unregister())
  )
})

// Activate event: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name)
          }
        })
      )
    }).then(() => self.clients.claim())
  )
})

// Fetch event: Network-first for dynamic navigation, Cache-first for static assets
self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)

  // Skip non-GET requests (e.g. POST /api/visits is handled by client-side offlineStorage queue)
  if (request.method !== 'GET') {
    return
  }

  // Handle API calls: Network first, don't break on offline
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(JSON.stringify({ offline: true, error: 'Offline mode active' }), {
          headers: { 'Content-Type': 'application/json' },
          status: 200
        })
      })
    )
    return
  }

  // Handle navigation requests (pages)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
          return response
        })
        .catch(() => {
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse
            return caches.match('/')
          })
        })
    )
    return
  }

  // Static assets (scripts, styles, fonts, images): Stale-while-revalidate / Cache-first
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache))
          }
          return networkResponse
        })
        .catch(() => cachedResponse)

      return cachedResponse || fetchPromise
    })
  )
})
