// Service worker minimal : l'application reste consultable hors connexion.
const CACHE = 'gares-de-paris-v5';
// three.js (web/vendor) n'est pas préchargé : il n'est demandé qu'à l'ouverture
// de la maquette, puis gardé en cache par le gestionnaire de requêtes ci-dessous.
const ASSETS = [
  './', './index.html', './css/app.css', './js/app.js', './js/artwork.js',
  './js/carte.js', './js/croisement.js', './js/exercices.js', './js/immersion.js',
  './js/scene-ligne.js', './js/departs.js', './js/maquette.js', './js/direct.js',
  './data/corpus.json', './manifest.webmanifest', './icon.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  // Le relais « En direct » et les services externes passent sans détour : une
  // réponse de secours (la page d'accueil) n'aurait aucun sens à leur place.
  if (new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      if (res.ok && new URL(e.request.url).origin === location.origin) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
