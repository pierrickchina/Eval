// État global de l'application, routeur minimal et rendu.
import { h, hasDialog, closeTopDialog, closeAllOverlays, toast } from './ui/dom.js';

export const app = {
  repo: null,
  route: { name: 'home' },
  stack: [], // v1.12 : historique unique des écrans (Retour = écran précédent, partout)
  views: {},
  sync: null, // contrôleur de synchronisation (voir sync/controller.js)
  syncState: 'local',
};

let root;
export const registerView = (name, fn) => { app.views[name] = fn; };

export function mount(el) {
  root = el;
  // Suivi des champs « tapés mais pas encore validés » (data-fid) pour ne jamais perdre une saisie lors d'un re-rendu.
  // La phase de capture garantit que le drapeau est retiré AVANT le traitement de la validation par le champ.
  el.addEventListener('input', (e) => { if (e.target.dataset?.fid) e.target.dataset.dirty = '1'; });
  // Un champ « brouillon » (data-draft) n'a pas de validation propre : son texte n'existe que dans la page
  // jusqu'à l'action explicite (ex. bouton Ajouter). Un simple changement de focus ne le « valide » donc pas.
  el.addEventListener('change', (e) => { const d = e.target.dataset; if (d?.fid && !('draft' in d)) delete d.dirty; }, true);
}

// ---------- Bouton « Précédent » (tablette Samsung) ----------
// Précédent remonte d'un niveau (fiche élève → tableau → accueil ; réglages → accueil) au lieu de fermer l'application.
// Au niveau de l'accueil, un 1er appui prévient, un 2e appui quitte.

/** Remonte d'un niveau. Renvoie false si on est déjà à l'accueil (rien à faire). */
export function goBack() {
  if (app.route.name === 'selfEval') { app.selfEvalBack?.(); return true; } // mode élève : jamais de sortie par Précédent
  if (hasDialog()) { closeTopDialog(); return true; }
  const b = [...(root?.querySelectorAll('[data-back]') || [])].at(-1); // le plus « profond » dans la page
  if (b && !b.disabled) { b.click(); return true; }
  return false;
}

export function initBack() {
  try {
    history.replaceState({ base: 1 }, '');
    history.pushState({ guard: 1 }, '');
  } catch { return; }
  window.addEventListener('popstate', (e) => {
    if (!e.state?.base) return;
    if (goBack()) { try { if (history.state?.base) history.pushState({ guard: 1 }, ''); } catch { /* ignore */ } }
    else toast('Appuyez encore une fois sur Précédent pour quitter.', { ms: 2500 });
  });
}

const snap = (r) => { try { return JSON.parse(JSON.stringify(r)); } catch { return { name: r.name }; } };
const same = (a, b) => JSON.stringify(snap(a)) === JSON.stringify(snap(b));
const IDS = ['id', 'setId', 'sid', 'tid', 'icId'];
/** Même écran : simple changement d'onglet, ou fiche « sœur » (dupliquée, leçon suivante…) → remplace au lieu d'empiler. */
const onlyTab = (a, b) => {
  if (a.name !== b.name) return false;
  const keys = new Set([...Object.keys(snap(a)), ...Object.keys(snap(b))]);
  const diff = [...keys].filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
  return diff.every((k) => k === 'tab' || (IDS.includes(k) && a[k] && b[k]));
};
/** Écrans de passage (éditeurs, création) : jamais gardés dans l'historique. */
const TRANSIENT = new Set(['classEdit', 'modelEdit', 'import', 'selfEval']);
const transient = (r) => TRANSIENT.has(r.name) || !!r.setup;
/** next est le « parent » de cur (même outil, moins de détail : la liste après la fiche) : on remonte, on n'empile pas. */
const isParent = (next, cur) => next.name === cur.name && Object.keys(snap(next)).every((k) => JSON.stringify(cur[k]) === JSON.stringify(next[k])) && Object.keys(snap(cur)).filter((k) => JSON.stringify(cur[k]) !== JSON.stringify(next[k])).every((k) => next[k] == null && [...IDS, 'direct', 'latest'].includes(k));

/**
 * Change d'écran. L'écran quitté est mémorisé (sauf retour, remplacement, simple changement d'onglet).
 * Revenir à un écran déjà dans l'historique coupe l'historique à cet endroit : aucune boucle possible.
 */
export function go(name, params = {}, { replace = false, isBack = false } = {}) {
  isBack ||= app.backing;
  const next = { name, ...params };
  const cur = app.route;
  if (name === 'home') app.stack.length = 0;
  else if (!isBack && !replace && cur && !transient(cur) && !same(cur, next) && !onlyTab(cur, next) && !isParent(next, cur)) {
    const i = app.stack.findIndex((x) => same(x, next) || onlyTab(x, next));
    if (i >= 0) app.stack.length = i;
    else {
      const j = app.stack.findIndex((x) => same(x, cur) || onlyTab(x, cur)); // chaque écran une seule fois
      if (j >= 0) app.stack.length = j;
      app.stack.push(snap(cur)); if (app.stack.length > 40) app.stack.shift();
    }
  }
  // l'écran d'arrivée ne figure jamais lui-même en haut de l'historique
  while (app.stack.length && (same(app.stack.at(-1), next) || onlyTab(app.stack.at(-1), next))) app.stack.pop();
  if (cur?.name !== name || !same(cur, next)) closeAllOverlays();
  // 1.13 : actualiser la page ramène au même écran (avec son historique) ; jamais au milieu d'un éditeur
  if (!transient(next)) { try { localStorage.setItem('eps-route', JSON.stringify({ route: snap(next), stack: app.stack.map(snap), at: Date.now() })); } catch { /* */ } }
  app.route = next;
  app.onRoute?.(app.route);
  try {
    // Bouton « Précédent » de la tablette : on garde toujours une entrée « garde » devant l'entrée de base
    if (history.state?.base) history.pushState({ guard: 1 }, '', '#' + name);
    else history.replaceState(history.state ?? { guard: 1 }, '', '#' + name);
  } catch { /* ignore */ }
  try {
    // mémorise l'évaluation ouverte pour y revenir après un rechargement accidentel
    if (name === 'eval') localStorage.setItem('eps-last-route', JSON.stringify({ name, id: params.id }));
    else localStorage.removeItem('eps-last-route');
  } catch { /* stockage indisponible : sans importance */ }
  render();
}

/** Écran à rouvrir après une actualisation (moins de 12 h), sinon null. */
export function savedRoute() {
  try {
    const x = JSON.parse(localStorage.getItem('eps-route') || 'null');
    if (!x?.route?.name || !app.views[x.route.name] || Date.now() - (x.at || 0) > 12 * 3600e3) return null;
    return x;
  } catch { return null; }
}

/** Retour : écran précédent de l'historique ; sinon fallback (ou l'accueil). */
export function back(fallback) {
  const prev = app.stack.pop();
  if (prev) { const { name, ...p } = prev; go(name, p, { isBack: true }); }
  else { app.backing = true; try { fallback ? fallback() : go('home'); } finally { app.backing = false; } }
}

/** Re-rend la vue courante en conservant la position de défilement des zones [data-keep]. */
export function render() {
  const keep = {};
  root.querySelectorAll('[data-keep]').forEach((el) => { keep[el.dataset.keep] = [el.scrollLeft, el.scrollTop]; });
  // Champ en cours de saisie (repéré par data-fid) : on le retrouve après le re-rendu, avec son texte
  const ae = document.activeElement;
  const fid = ae && root.contains(ae) ? ae.dataset?.fid : null;
  const typed = fid ? { value: ae.value, from: ae.selectionStart, to: ae.selectionEnd } : null;
  const dirty = [...root.querySelectorAll('[data-fid][data-dirty]')].map((e) => [e.dataset.fid, e.value]);
  const fn = app.views[app.route.name];
  let view;
  try {
    view = fn ? fn(app.route) : h('p', null, 'Écran inconnu.');
  } catch (e) {
    console.error(e);
    view = h('div', { class: 'fatal' }, h('h2', null, 'Une erreur est survenue'), h('pre', null, String(e.stack || e)),
      h('button', { class: 'btn primary', onClick: () => go('home') }, 'Retour à l\'accueil'));
  }
  root.replaceChildren(view);
  try { app.decorate?.(view, app.route); } catch (e) { console.warn(e); }
  root.querySelectorAll('[data-keep]').forEach((el) => {
    const k = keep[el.dataset.keep];
    if (k) { el.scrollLeft = k[0]; el.scrollTop = k[1]; }
  });
  for (const [id, value] of dirty) {
    const el = root.querySelector(`[data-fid="${CSS.escape(id)}"]`);
    if (el) { if (el.value !== value) el.value = value; el.dataset.dirty = '1'; } // saisie non encore validée
  }
  if (fid) {
    const el = root.querySelector(`[data-fid="${CSS.escape(fid)}"]`);
    if (el) {
      el.focus({ preventScroll: true });
      try { el.setSelectionRange(typed.from, typed.to); } catch { /* champ sans sélection */ }
    }
  }
  updateSyncChips();
}

// ---------- Pastille de synchronisation ----------

const SYNC_LABELS = {
  local: ['Local uniquement', 'gray'],
  synced: ['Synchronisé', 'green'],
  pending: ['Modifications en attente', 'amber'],
  syncing: ['Synchronisation en cours…', 'blue'],
  error: ['Erreur de synchronisation', 'red'],
  offline: ['Hors connexion', 'gray'],
};

export function syncChip() {
  const chip = h('button', { type: 'button', class: 'syncchip', onClick: () => go('settings', { tab: 'data' }) });
  paintChip(chip);
  return chip;
}

function paintChip(chip) {
  const pending = app.repo?.pendingCount() ?? 0;
  let st = app.syncState;
  if (st === 'synced' && pending > 0) st = 'pending';
  const [label, color] = SYNC_LABELS[st] || SYNC_LABELS.local;
  chip.className = `syncchip ${color}`;
  chip.title = label + (st === 'local' ? ' — touchez pour configurer Google Drive' : '');
  chip.replaceChildren(h('i', { class: 'dot' }), h('span', null, label));
}

export function updateSyncChips() {
  document.querySelectorAll('.syncchip').forEach(paintChip);
}
