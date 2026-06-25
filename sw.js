// Service Worker for Pragna College PWA
const CACHE_NAME = 'pragna-v3';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/students.html',
  '/payments.html',
  '/certificates.html',
  '/audit.html',
  '/student-view.html',
  '/css/style.css',
  '/js/config.js',
  '/js/utils.js',
  '/js/auth.js',
  '/js/dashboard.js',
  '/js/students.js',
  '/js/payments.js',
  '/js/certificates.js',
  '/js/audit.js',
  '/manifest.json',
];

// Install — cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch — network first, fallback to cache
self.addEventListener('fetch', (event) => {
  // Skip non-GET and Supabase API requests
  if (
    event.request.method !== 'GET' ||
    event.request.url.includes('supabase.co')
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache fresh responses
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, clone);
        });
        return response;
      })
      .catch(() => {
        // Fallback to cache if offline
        return caches.match(event.request);
      })
  );
});
