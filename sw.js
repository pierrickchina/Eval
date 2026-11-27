// Service worker : l'application fonctionne entièrement hors connexion après le 1er chargement.
// Les données (IndexedDB) ne sont jamais touchées par une mise à jour.
// À CHAQUE nouvelle version de l'application : incrémenter VERSION.
const VERSION = 'eps-eval-v1.6.1';

const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/style.css',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'js/main.js',
  'js/app.js',
  'js/util.js',
  'js/data/schema.js',
  'js/data/db.js',
  'js/data/repo.js',
  'js/logic/model.js',
  'js/logic/scoring.js',
  'js/logic/evaluation.js',
  'js/logic/history.js',
  'js/logic/selfeval.js',
  'js/logic/classes.js',
  'js/sync/engine.js',
  'js/sync/drive.js',
  'js/sync/controller.js',
  'js/import/csv.js',
  'js/import/xlsx.js',
  'js/import/mapper.js',
  'js/ui/dom.js',
  'js/ui/home.js',
  'js/ui/evalView.js',
  'js/ui/historyView.js',
  'js/ui/settings.js',
  'js/ui/modelEditor.js',
  'js/ui/classEditor.js',
  'js/ui/importWizard.js',
  'js/ui/backup.js',
  'js/ui/selfEval.js',
  'js/ui/classesView.js',
  'js/ui/carnet.js',
  'js/logic/activities.js',
  'js/ui/printView.js',
  'js/ui/summaryView.js',
  'js/ui/chronoView.js',
  'js/ui/teamsView.js',
  'js/ui/foundations.js',
  'js/ui/help.js',
  'js/logic/teams.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })))));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k.startsWith('eps-eval-')).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // Google, etc. : réseau uniquement
  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    } catch (e) {
      if (req.mode === 'navigate') return (await cache.match('index.html')) || Response.error();
      throw e;
    }
  })());
});
