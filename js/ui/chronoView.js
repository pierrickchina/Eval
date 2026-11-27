// Outil Chronomètre : de 1 à 4 panneaux (chronomètre ou minuteur), très grands chiffres, rien n'est enregistré.
// Utilisable seul (onglet Outils) ou comme raccourci dans une activité : même écran dans les deux cas.
import { app, registerView, go, render } from '../app.js';
import { h, btn, icon, iconBtn, openDialog, confirmDialog, popMenu } from './dom.js';
import { uid } from '../util.js';
import { helpItem } from './help.js';
import { buzz } from './foundations.js';

const MAX = 4;
const PRESETS = [1, 2, 3, 5, 10]; // minutes
const C = { panels: [], display: false, ticker: null, lock: null };

// ---------- Calculs (temps réel : on part de l'heure, donc juste même si l'écran se verrouille un instant) ----------

export const elapsed = (p, t = Date.now()) => p.base + (p.startedAt ? t - p.startedAt : 0);
export const remaining = (p, t = Date.now()) => p.duration - elapsed(p, t);
const running = (p) => !!p.startedAt;

/** Texte affiché : mm:ss (h:mm:ss au-delà d'une heure). Le minuteur arrondit vers le haut (00:01 reste jusqu'à zéro). */
export function clockText(ms, up = true) {
  const s = Math.max(0, up ? Math.floor(ms / 1000) : Math.ceil(ms / 1000));
  const h2 = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const p2 = (n) => String(n).padStart(2, '0');
  return h2 ? `${h2}:${p2(m)}:${p2(sec)}` : `${p2(m)}:${p2(sec)}`;
}

/** État visuel d'un panneau : 'idle' | 'run' | 'warn' (≤ 10 s, orange) | 'done' (zéro, rouge qui clignote). */
export function panelState(p, t = Date.now()) {
  if (p.mode === 'timer') {
    const r = remaining(p, t);
    if (r <= 0) return 'done';
    if (r <= 10000 && (running(p) || elapsed(p, t) > 0)) return 'warn';
  }
  return running(p) ? 'run' : 'idle';
}

function newPanel(mode, minutes = 0) {
  const n = C.panels.length + 1;
  return { id: uid(), name: mode === 'timer' ? `Minuteur ${n}` : `Chrono ${n}`, mode, duration: minutes * 60000, base: 0, startedAt: null };
}
function stop(p) { if (p.startedAt) { p.base += Date.now() - p.startedAt; p.startedAt = null; } }
function start(p) { if (!p.startedAt && !(p.mode === 'timer' && remaining(p) <= 0)) p.startedAt = Date.now(); }

// ---------- Écran toujours allumé + battement ----------

async function keepAwake() {
  try { if (!C.lock && navigator.wakeLock) { C.lock = await navigator.wakeLock.request('screen'); C.lock.addEventListener?.('release', () => { C.lock = null; }); } } catch { /* sans importance */ }
}
function release() { try { C.lock?.release?.(); } catch { /* */ } C.lock = null; }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && app.route.name === 'chrono') keepAwake(); });

function tick() {
  if (app.route.name !== 'chrono') { clearInterval(C.ticker); C.ticker = null; return; }
  const t = Date.now();
  for (const el of document.querySelectorAll('[data-pid]')) {
    const p = C.panels.find((x) => x.id === el.dataset.pid);
    if (!p) continue;
    const d = el.querySelector('.cdigits');
    const txt = p.mode === 'timer' ? clockText(remaining(p, t), false) : clockText(elapsed(p, t));
    if (d.textContent !== txt) d.textContent = txt;
    const st = panelState(p, t);
    if (el.dataset.st !== st) { if (st === 'done' && (el.dataset.st === 'run' || el.dataset.st === 'warn')) buzz('end'); el.dataset.st = st; el.className = `cpanel ${st}`; }
  }
}

function leave() {
  clearInterval(C.ticker); C.ticker = null; release();
  C.panels = []; C.display = false; // « aucune mémoire » : tout s'efface en quittant
  const r = app.route;
  if (r.from === 'classPage' && r.classId) go('classPage', { id: r.classId }); else go('home');
}

async function tryLeave() {
  if (C.display) { C.display = false; render(); return; }
  if (C.panels.some(running) && !(await confirmDialog('Un chronomètre tourne encore. Quitter l\'outil l\'arrête et efface tous les panneaux.', 'Quitter', { danger: true }))) return;
  leave();
}

// ---------- Fenêtres ----------

function addDialog() {
  if (C.panels.length >= MAX) return;
  const make = (mode, min = 0, dlg) => { C.panels.push(newPanel(mode, min)); dlg.close(); keepAwake(); render(); };
  let mm = '', ss = '';
  const dlg = openDialog({
    title: 'Ajouter un panneau',
    body: [
      btn('Chronomètre (compte vers le haut)', { icon: 'chrono', cls: 'primary bigbtn', onClick: () => make('chrono', 0, dlg) }),
      h('div', { class: 'muted small' }, 'Minuteur (décompte jusqu\'à zéro) :'),
      h('div', { class: 'row wrap' }, PRESETS.map((m) => btn(`${m} min`, { cls: 'bigbtn', onClick: () => make('timer', m, dlg) }))),
      h('div', { class: 'row wrap', style: { alignItems: 'flex-end' } },
        h('label', { class: 'field', style: { width: '110px' } }, 'Minutes', h('input', { type: 'number', inputmode: 'numeric', min: 0, max: 600, placeholder: '0', onInput: (e) => { mm = e.target.value; } })),
        h('label', { class: 'field', style: { width: '110px' } }, 'Secondes', h('input', { type: 'number', inputmode: 'numeric', min: 0, max: 59, placeholder: '0', onInput: (e) => { ss = e.target.value; } })),
        btn('Minuteur de cette durée', { onClick: () => { const total = (parseInt(mm, 10) || 0) * 60 + (parseInt(ss, 10) || 0); if (total > 0) { C.panels.push({ ...newPanel('timer', 0), duration: total * 1000 }); dlg.close(); keepAwake(); render(); } } }))],
    actions: [{ label: 'Annuler' }],
  });
}

function renameDialog(p) {
  let name = p.name;
  const dlg = openDialog({
    title: 'Nom du panneau',
    body: h('input', { type: 'text', value: p.name, autofocus: true, 'aria-label': 'Nom', onInput: (e) => { name = e.target.value; } }),
    actions: [{ label: 'Annuler' }, { label: 'Enregistrer', primary: true, keepOpen: true, onClick: () => { p.name = name.trim() || p.name; dlg.close(); render(); return false; } }],
  });
}

// ---------- Écran ----------

function panelEl(p) {
  const st = panelState(p);
  const el = h('section', { class: `cpanel ${st}`, 'data-pid': p.id, 'data-st': st });
  const ctrl = h('div', { class: 'cctrl' },
    btn(running(p) ? 'Pause' : (p.mode === 'timer' && remaining(p) <= 0) ? 'Terminé' : 'Démarrer', {
      icon: running(p) ? 'pause' : 'play', cls: 'primary bigbtn',
      onClick: () => { running(p) ? stop(p) : start(p); render(); } }),
    p.mode === 'timer' ? btn('+1 min', { cls: 'bigbtn', onClick: () => { p.duration += 60000; render(); } }) : null,
    btn('Zéro', { icon: 'reset', cls: 'bigbtn', onClick: () => { stop(p); p.base = 0; render(); } }),
    iconBtn('trash', 'Supprimer ce panneau', () => { C.panels = C.panels.filter((x) => x.id !== p.id); render(); }, 'boxed'));
  el.append(
    h('button', { type: 'button', class: 'cname', onClick: () => renameDialog(p), 'aria-label': `Renommer ${p.name}` }, p.name, h('span', { class: 'cmode' }, p.mode === 'timer' ? ` · minuteur ${clockText(p.duration)}` : ' · chronomètre')),
    h('div', { class: 'cdigits' }, p.mode === 'timer' ? clockText(remaining(p), false) : clockText(elapsed(p))),
    C.display ? null : ctrl);
  return el;
}

registerView('chrono', () => {
  keepAwake();
  if (!C.ticker) C.ticker = setInterval(tick, 200);
  const anyRunning = C.panels.some(running);
  const allBtn = btn(anyRunning ? 'Tout en pause' : 'Tout démarrer', {
    icon: anyRunning ? 'pause' : 'play', disabled: !C.panels.length,
    onClick: () => { if (anyRunning) C.panels.forEach(stop); else C.panels.forEach(start); render(); } });
  const bar = h('div', { class: `topbar ${C.display ? 'hidden' : ''}` },
    iconBtn('back', 'Retour', tryLeave, '', { 'data-back': '1' }),
    h('div', { class: 'grow evtitle' }, h('h1', null, 'Chronomètre'), h('div', { class: 'sub' }, `${C.panels.length} / ${MAX} panneaux`)),
    allBtn,
    btn('Ajouter', { icon: 'plus', cls: 'primary', disabled: C.panels.length >= MAX, onClick: addDialog }),
    iconBtn('eye', 'Mode affichage (masque les boutons)', () => { C.display = true; render(); }, 'boxed', { disabled: !C.panels.length }),
    (() => { const m = iconBtn('more', 'Options', () => popMenu(m, [helpItem('chrono')]), 'boxed'); return m; })());
  const body = C.panels.length
    ? h('div', { class: `cgrid n${C.panels.length}` }, C.panels.map(panelEl))
    : h('div', { class: 'empty' }, h('h2', null, 'Aucun panneau'),
      h('p', null, 'Ajoutez un chronomètre ou un minuteur. Vous pouvez en afficher jusqu\'à 4 en même temps.'),
      btn('Ajouter un panneau', { icon: 'plus', cls: 'primary', onClick: addDialog }));
  const root = h('div', { class: `main chrono ${C.display ? 'display' : ''}` }, bar, body);
  if (C.display) { // appui long (1 s) n'importe où pour sortir du mode affichage
    let timer = null;
    const clear = () => { clearTimeout(timer); timer = null; };
    root.addEventListener('pointerdown', () => { clear(); timer = setTimeout(() => { C.display = false; render(); }, 1000); });
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) root.addEventListener(ev, clear);
    root.append(h('div', { class: 'cexit' }, 'Maintenez 1 seconde pour revenir aux boutons'));
    root.append(h('button', { type: 'button', class: 'sr-back', 'data-back': '1', onClick: () => { C.display = false; render(); }, 'aria-label': 'Quitter le mode affichage' }));
  }
  return root;
});
