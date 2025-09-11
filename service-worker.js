const CACHE_PREFIX = 'edukanban-cache-';
const CACHE_NAME = 'edukanban-cache-v0.0.59'; // Bump cache para forzar actualización
// URL base del scope del SW (funciona tanto en GitHub Pages como en localhost)
const SCOPE_BASE = self.registration?.scope || self.location.origin + '/';
const OFFLINE_FALLBACK_URL = new URL('index.html', SCOPE_BASE).toString();
// Usar rutas relativas al SW para que funcionen en cualquier host/path
const urlsToCache = [
  './',
  'index.html',
  'archivo.html',
  'recordatorios.html',
  'pdf-viewer.html',
  'recordatorios.html',
  'css/styles.css',
  'js/app.js',
  'js/archivo.js',
  'js/recordatorios.js',
  'js/sw-register.js',
  'js/recordatorios.js',
  'manifest.json'
  // Nota: no precacheamos los iconos para acelerar la primera carga
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

// REEMPLAZA EL ANTIGUO 'fetch' LISTENER POR ESTE:
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  // Ignorar peticiones que no son GET (como POST a Dropbox)
  if (event.request.method !== 'GET') {
    event.respondWith(fetch(event.request));
    return;
  }

  // Servir PDFs temporales almacenados en Cache Storage por la app (antes de cualquier otra excepción)
  if (url.pathname.includes('/__pdf__/')) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(event.request, { ignoreSearch: true });
        if (cached) return cached;
        return Response.error();
      })()
    );
    return;
  }

  // No cachear ni interceptar PDFs ni esquemas no estándar
  const accept = event.request.headers.get('Accept') || '';
  if (accept.includes('application/pdf') || event.request.url.startsWith('blob:') || event.request.url.startsWith('data:')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Ignorar peticiones a dominios externos (como la API de Dropbox)
  if (!event.request.url.startsWith(self.location.origin)) {
    event.respondWith(fetch(event.request));
    return;
  }

  

  // Para manifest.json: usar red primero para ver cambios de atajos/íconos
  if (url.pathname.endsWith('/manifest.json') || url.pathname.endsWith('manifest.json')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request, { ignoreSearch: true }))
    );
    return;
  }

  // Navegación de documentos (HTML): red primero con fallback offline
  if (event.request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(event.request);
          // Opcional: cachear navegaciones exitosas
          const cache = await caches.open(CACHE_NAME);
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        } catch (err) {
          // Primero intentar servir la propia ruta desde caché
          const anyCached = await caches.match(event.request, { ignoreSearch: true });
          if (anyCached) return anyCached;
          // Fallback al shell (index) en caché para experiencia offline
          const cachedShell = await caches.match(OFFLINE_FALLBACK_URL, { ignoreSearch: true });
          if (cachedShell) return cachedShell;
          throw err;
        }
      })()
    );
    return;
  }

  // Para las peticiones GET a nuestros propios archivos, usar estrategia de caché
  const cacheable = /\.(?:html|css|js|json|png|jpg|jpeg|svg|webp|ico|txt|woff2?)$/i.test(url.pathname);
  if (!cacheable) {
    // No cachear otros recursos (p.ej. vistas incrustadas, previsualizaciones)
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith((async () => {
    const cachedResponse = await caches.match(event.request, { ignoreSearch: true });
    if (cachedResponse) return cachedResponse;
    try {
      const networkResponse = await fetch(event.request);
      const cache = await caches.open(CACHE_NAME);
      cache.put(event.request, networkResponse.clone());
      return networkResponse;
    } catch (e) {
      if (event.request.destination === 'document') {
        const cachedShell = await caches.match(OFFLINE_FALLBACK_URL, { ignoreSearch: true });
        if (cachedShell) return cachedShell;
      }
      return Response.error();
    }
  })());
});

// Añade este evento para limpiar caches antiguos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // Solo borrar caches pertenecientes a esta app y que no sean la versión actual
          if (cacheName.startsWith(CACHE_PREFIX) && cacheName !== CACHE_NAME) {
            console.log('Borrando cache antiguo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      ).then(() => self.clients.claim())
       .then(() => self.clients.matchAll({ includeUncontrolled: true }))
       .then(clients => {
          for (const client of clients) {
            try { client.postMessage({ type: 'SW_VERSION', version: CACHE_NAME }); } catch (_) {}
          }
       });
    })
  );
});

// Al hacer clic en una notificación, enfocar/abrir la app
// (Eliminado listener de notificationclick; no se usan notificaciones push locales)

// Responder a consultas desde la página para exponer versión del SW/caché
self.addEventListener('message', (event) => {
  try {
    const data = event.data || {};
    if (data && data.type === 'GET_SW_VERSION') {
      const payload = { type: 'SW_VERSION', version: CACHE_NAME };
      if (event.source && event.source.postMessage) {
        event.source.postMessage(payload);
      } else if (self.clients && event.clientId) {
        self.clients.get(event.clientId).then(c => c && c.postMessage(payload));
      }
    }
  } catch (_) {}
});
