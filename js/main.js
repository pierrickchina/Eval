// Point d'entrée : initialisation, écrans, hors connexion (service worker), installation.
import { app, mount, go, render, updateSyncChips, initBack } from './app.js';
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
import { resumeRoute } from './ui/selfEval.js';
import { SyncController } from './sync/controller.js';
import { applyLevelRule } from './logic/model.js';
import { makeSafetyCopy } from './ui/backup.js';

window.__APP_VERSION = '1.2.0';
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

  // Copie de sécurité interne au premier lancement d'une nouvelle version (les données sont intactes à ce stade)
  try {
    if (repo.getMeta('appVersion') !== window.__APP_VERSION) {
      if (repo.list('evaluations').length || repo.list('classes').length || repo.list('models').length) await makeSafetyCopy(`avant la version ${window.__APP_VERSION}`);
      await repo.setMeta('appVersion', window.__APP_VERSION);
    }
  } catch (e) { console.warn('Copie de sécurité impossible :', e); }

  // Reprise de l'évaluation en cours après un rechargement
  let first = { name: 'home' };
  try {
    const last = JSON.parse(localStorage.getItem('eps-last-route') || 'null');
    if (last?.name === 'eval' && repo.get('evaluations', last.id) && !repo.get('evaluations', last.id).deleted) first = last;
  } catch { /* ignore */ }
  initBack();
  first = resumeRoute() || first; // mode élève actif : on y reste, même après un rechargement
  go(first.name, first);

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
