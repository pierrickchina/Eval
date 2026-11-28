// Point d'entrée : initialisation, écrans, hors connexion (service worker), installation.
import { savedRoute, app, mount, go, render, updateSyncChips, initBack } from './app.js';
import { createStore } from './data/db.js';
import { Repo } from './data/repo.js';
import { h, toast } from './ui/dom.js';
import './ui/home.js';
import './ui/evalView.js';
import './ui/settings.js';
import './ui/modelEditor.js';
import './ui/classEditor.js';
import './ui/importWizard.js';
import './ui/selfEval.js';
import './ui/classesView.js';
import './ui/chronoView.js';
import './ui/teamsView.js';
import './ui/tournoiView.js';
import './ui/ladderView.js';
import './ui/mkView.js';
import './ui/circuitView.js';
import './ui/kivaouView.js';
import './ui/duathlonView.js';
import './ui/kabaddiView.js';
import './ui/boxeView.js';
import './ui/monteeView.js';
import './ui/interclassesView.js';
import './ui/arbitreView.js';
import './ui/vmaView.js';
import './ui/rotationView.js';
import { noteRoute, applyDisplay, maybeTour, decorateTopbar } from './ui/foundations.js';
import { resumeRoute } from './ui/selfEval.js';
import { SyncController } from './sync/controller.js';
import { applyLevelRule } from './logic/model.js';
import { makeSafetyCopy } from './ui/backup.js';
import { ensureActivities } from './logic/activities.js';
import { installLibrary, upgradeLibrary, originalOf } from './data/library.js';
import { defaultLevels } from './data/schema.js';
import { uid } from './util.js';

window.__APP_VERSION = '1.13.0';
applyDisplay(); // taille du texte / contraste choisis dans les réglages
const rootEl = document.getElementById('app');
mount(rootEl);

async function boot() {
  const repo = new Repo(createStore('eps-eval'));
  try {
    await repo.init();
  } catch (e) {
    rootEl.replaceChildren(h('div', { class: 'fatal' }, h('h2', null, 'Stockage local indisponible'),
      h('p', null, 'L\'application ne peut pas enregistrer les données dans ce navigateur (mode privé ou stockage bloqué ?).'), h('pre', null, String(e))));
    return;
  }
  app.repo = repo;
  app.sync = new SyncController(repo);
  window.__app = app; // utile pour le dépannage et les tests

  navigator.storage?.persist?.().catch(() => {});

  // v1.1 : nouvelle règle des niveaux (en cours = moitié du barème, 30–50 / 55–90 / 90–100 %).
  // Appliquée une seule fois aux MODÈLES existants (les évaluations déjà créées ne changent pas : copie figée).
  try {
    if (repo.getMeta('levelRule', 1) < 2) {
      const step = (repo.getMeta('settings', {}) || {}).step || 0.5;
      let n = 0;
      for (const m of repo.list('models')) {
        for (const lv of Object.values(m.levels || {})) for (const c of lv.competences) applyLevelRule(c, step);
        await repo.save('models', m);
        n++;
      }
      await repo.setMeta('levelRule', 2);
      if (n) toast('Mise à jour 1.1 : les plages de niveaux de vos modèles suivent la nouvelle règle (« en cours » = moitié du barème).', { ms: 9000 });
    }
  } catch (e) { console.warn('Migration des niveaux impossible :', e); }

  // v1.9 : bibliothèque « Projet EPS » (grilles de l'équipe), installée une seule fois, modifiable ensuite.
  try {
    const lo = { uid, defaultLevels, step: (repo.getMeta('settings', {}) || {}).step || 0.5 };
    const up = await upgradeLibrary(repo, lo);
    for (const m of up.pending) {
      toast(`La grille « ${m.activity} » du Projet EPS a changé (fiches élèves). Vous l'aviez modifiée : la remplacer ?`, { ms: 20000, action: 'Remplacer', onAction: async () => { await repo.save('models', originalOf(m, lo)); toast('Grille mise à jour.'); render(); } });
    }
    const n = await installLibrary(repo, { uid, defaultLevels, step: (repo.getMeta('settings', {}) || {}).step || 0.5 });
    if (n && repo.list('evaluations').length) toast(`Nouveau : ${n} modèles d'évaluation du Projet EPS ajoutés (Réglages › Modèles).`, { ms: 8000 });
  } catch (e) { console.warn('Bibliothèque Projet EPS non installée :', e); }

  // Copie de sécurité interne au premier lancement d'une nouvelle version (les données sont intactes à ce stade)
  try {
    if (repo.getMeta('appVersion') !== window.__APP_VERSION) {
      if (repo.list('evaluations').length || repo.list('classes').length || repo.list('models').length) await makeSafetyCopy(`avant la version ${window.__APP_VERSION}`);
      await repo.setMeta('appVersion', window.__APP_VERSION);
    }
  } catch (e) { console.warn('Copie de sécurité impossible :', e); }

  // v1.5 : chaque évaluation est rangée dans l'activité de même nom de sa classe ; l'ancien champ « infos » disparaît.
  // Idempotent (rejoué à chaque lancement : répare aussi les données arrivées par import ou synchronisation).
  try {
    const r = ensureActivities(repo.list('classes'), repo.list('evaluations'));
    for (const c of r.classes) await repo.save('classes', c);
    for (const e of r.evals) await repo.save('evaluations', e);
  } catch (e) { console.warn('Rangement des activités impossible :', e); }

  // v1.12 : l'outil « Boxe française · rotation » rejoint les activités de boxe existantes (une seule fois)
  try {
    if (!repo.getMeta('mig112')) {
      for (const c of repo.list('classes')) {
        let dirty = false;
        for (const a of c.activities || []) if (/boxe|\bbf\b/i.test(a.name) && !a.tools.some((t) => t.type === 'boxefps')) { a.tools.push({ type: 'boxefps', addedAt: Date.now(), lastUsed: Date.now() }); dirty = true; }
        if (dirty) await repo.save('classes', c);
      }
      await repo.setMeta('mig112', 1);
    }
  } catch (e) { console.warn('Migration 1.12 impossible :', e); }

  // Reprise de l'évaluation en cours après un rechargement
  let first = { name: 'home' };
  try {
    const last = JSON.parse(localStorage.getItem('eps-last-route') || 'null');
    if (last?.name === 'eval' && repo.get('evaluations', last.id) && !repo.get('evaluations', last.id).deleted) first = last;
  } catch { /* ignore */ }
  initBack();
  app.onRoute = noteRoute;
  app.decorate = decorateTopbar;
  // 1.13 : après une actualisation, on revient sur le même écran (et son historique pour Retour)
  // (seulement pour une actualisation ; ouvrir l'appli depuis l'écran d'accueil de la tablette part de l'accueil)
  const isReload = (() => { try { return performance.getEntriesByType('navigation')[0]?.type === 'reload'; } catch { return false; } })();
  const saved = isReload ? savedRoute() : null;
  if (first.name === 'home' && saved) { first = saved.route; app.stack = (saved.stack || []).filter((x) => app.views[x.name]); }
  first = resumeRoute() || first; // mode élève actif : on y reste, même après un rechargement
  go(first.name, first, { isBack: true });
  if (first.name === 'home') setTimeout(() => maybeTour(), 400);

  window.addEventListener('online', updateSyncChips);
  window.addEventListener('offline', updateSyncChips);
  window.addEventListener('pagehide', () => repo.flush());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') repo.flush(); });
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); window.__installPrompt = e; });
  window.addEventListener('appinstalled', () => { window.__installPrompt = null; });

  registerServiceWorker();
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !/^https:|^http:\/\/localhost|^http:\/\/127\./.test(location.href)) return;
  navigator.serviceWorker.register('sw.js').then((reg) => {
    const offer = (worker) => toast('Une nouvelle version est disponible.', {
      action: 'Mettre à jour', ms: 60000,
      onAction: () => worker.postMessage('SKIP_WAITING'),
    });
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w); });
    });
  }).catch((e) => console.warn('Service worker non enregistré :', e));
  // Rechargement uniquement lors d'une MISE À JOUR acceptée par l'utilisateur, jamais à la 1re installation
  // (où le service worker prend simplement le contrôle de la page sans rien changer).
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    reloading = true;
    location.reload();
  });
}

boot();
