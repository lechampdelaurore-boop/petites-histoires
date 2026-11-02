// Garde l'appli disponible hors ligne.
// Changer CACHE à chaque mise à jour des fichiers listés ci-dessous.
var CACHE = 'petites-histoires-v2';
var FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './fonts/fredoka-latin.woff2',
  './fonts/nunito-latin.woff2',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;

  // La page passe d'abord par le réseau pour recevoir les mises à jour, sinon le cache.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(function (res) {
        if (res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () {
        return caches.match(req, { ignoreSearch: true }).then(function (hit) { return hit || caches.match('./index.html'); });
      })
    );
    return;
  }

  // Polices et icônes : le cache d'abord.
  e.respondWith(caches.match(req).then(function (hit) { return hit || fetch(req); }));
});
