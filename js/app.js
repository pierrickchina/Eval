// État global de l'application, routeur minimal et rendu.
import { h, hasDialog, closeTopDialog, toast } from './ui/dom.js';

export const app = {
  repo: null,
  route: { name: 'home' },
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

export function go(name, params = {}) {
  app.route = { name, ...params };
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
