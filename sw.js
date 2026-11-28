// Service worker : l'application fonctionne entièrement hors connexion après le 1er chargement.
// Les données (IndexedDB) ne sont jamais touchées par une mise à jour.
// À CHAQUE nouvelle version de l'application : incrémenter VERSION.
const VERSION = 'eps-eval-v1.13.0';

const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/style.css',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
  'icons/logo.svg',
  'fonts/DejaVuSans.woff',
  'fonts/DejaVuSans-Bold.woff',
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
  'js/ui/tournoiView.js',
  'js/logic/tournament.js',
  'js/data/library.js',
  'js/logic/perf.js',
  'js/logic/ladder.js',
  'js/logic/mariokart.js',
  'js/logic/intervals.js',
  'js/ui/ladderView.js',
  'js/ui/mkView.js',
  'js/ui/circuitView.js',
  'js/ui/kabaddiView.js',
  'js/ui/boxeView.js',
  'js/ui/monteeView.js',
  'js/ui/interclassesView.js',
  'js/ui/arbitreView.js',
  'js/ui/vmaView.js',
  'js/ui/rotationView.js',
  'js/ui/todayView.js',
  'js/logic/today.js',
  'js/ui/badges.js',
  'js/ui/classIcon.js',
  'js/logic/arbitre.js',
  'js/logic/vma.js',
  'js/logic/kabaddi.js',
  'js/logic/montee.js',
  'js/logic/interclasses.js',
  'img/mk/banane.png',
  'img/mk/bill-ball.png',
  'img/mk/boo.png',
  'img/mk/champi-roi.png',
  'img/mk/champi.png',
  'img/mk/etoile.png',
  'img/mk/goomba.png',
  'img/mk/plante-piranha.png',
  'img/mk/triple-champi.png',
  'img/duathlon/fiche-3e-1.jpg',
  'img/duathlon/fiche-3e-2.jpg',
  'img/duathlon/fiche-4e-1.jpg',
  'img/duathlon/fiche-4e-2.jpg',
  'img/boxe/fiche-1.jpg',
  'img/boxe/fiche-2.jpg',
  'js/ui/drag.js',
  'js/ui/presets.js',
  'js/ui/kivaouView.js',
  'js/ui/duathlonView.js',
  'js/logic/kivaou.js',
  'js/data/exercises.js',
  'img/exos/burpees.jpg',
  'img/exos/chaise.jpg',
  'img/exos/course-sur-place.jpg',
  'img/exos/crunchs-lateraux-2.jpg',
  'img/exos/crunchs-lateraux.jpg',
  'img/exos/crunchs.jpg',
  'img/exos/extension-hanches.jpg',
  'img/exos/extensions-mollet.jpg',
  'img/exos/fentes.jpg',
  'img/exos/gainage-inverse.jpg',
  'img/exos/gainage-lateral.jpg',
  'img/exos/gainage-militaire.jpg',
  'img/exos/high-kick.jpg',
  'img/exos/hip-thrust.jpg',
  'img/exos/jumping-jacks.jpg',
  'img/exos/mountain-climbers.jpg',
  'img/exos/planche.jpg',
  'img/exos/pompes-ouverture.jpg',
  'img/exos/pompes.jpg',
  'img/exos/squats.jpg',
  'img/exos/superman.jpg',
  'js/logic/results.js',
  'js/ui/suiviView.js',
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
