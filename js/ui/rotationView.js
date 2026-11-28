// Rotation d'ateliers (1.13), pour toutes les activités : même horloge que la rotation boxe.
// Réglages : nombre d'ateliers (2 à 8), titre et couleur de chacun (pré-remplis, couleurs toutes différentes),
// nombre de groupes et leurs noms, temps sur un atelier. Les ateliers restent fixes ; seuls les groupes tournent.
import { app, registerView, go, render, back as navBack } from '../app.js';
import { h, btn, icon, iconBtn, openDialog, popMenu, toast, tintVars } from './dom.js';
import { clone } from '../util.js';
import { clockText } from './chronoView.js';
import { buzz } from './foundations.js';
import { helpItem } from './help.js';
import { presetFor, savePreset } from './presets.js';

/** 8 couleurs d'atelier, toutes différentes (pastel, comme le reste de l'appli). */
export const ROT_COLORS = ['#cfe0f7', '#f7d3cf', '#d3ecd4', '#f6e3a0', '#e4dbf8', '#fbd9c0', '#cdeef0', '#f6d6e6'];
export const GCOLORS = ['#d92d33', '#1f5fd6', '#1f8a43', '#c98f00', '#6b3fc0', '#e0701a', '#0e8a8a', '#c2185b'];
const LETTERS = 'ABCDEFGH';
const V = { ticker: null, lock: null };

export function defaultRotation(n = 4) {
  return { durationMin: 6, ateliers: Array.from({ length: n }, (_, i) => ({ title: `Atelier ${i + 1}`, color: ROT_COLORS[i] })), groups: LETTERS.slice(0, n).split(''), rot: 0, clock: { base: 0, startedAt: null } };
}
/** Groupe présent sur l'atelier i à la rotation rot (null si l'atelier est libre : moins de groupes que d'ateliers). */
export const groupOn = (i, rot, nA, nG) => { const g = (((i - rot) % nA) + nA) % nA; return g < nG ? g : null; };
/** Petites flèches entre les ateliers : sens de rotation (aiguilles d'une montre). */
export function ringArrows(n, R) {
  return Array.from({ length: n }, (_, i) => {
    const mid = -90 + (i + 0.5) * (360 / n);
    const a = (mid * Math.PI) / 180;
    return h('span', { class: 'rarrow', 'aria-hidden': 'true', style: { left: `${50 + R * Math.cos(a)}%`, top: `${50 + R * Math.sin(a)}%`, transform: `translate(-50%, -50%) rotate(${mid + 90}deg)` } });
  });
}

const keyOf = (r) => `rot:${r.scope === 'act' ? r.actId : 'free'}`;
const stateOf = (r) => app.repo.getMeta(keyOf(r), null) || { ...defaultRotation(), ...(presetFor(null, 'rotation') || {}), rot: 0, clock: { base: 0, startedAt: null } };
const elapsed = (st, t = Date.now()) => st.clock.base + (st.clock.startedAt ? t - st.clock.startedAt : 0);
const backTo = (r) => navBack(() => (r.from === 'classPage' && r.classId ? go('classPage', { id: r.classId }) : go('home')));
async function keepAwake() { try { if (!V.lock && navigator.wakeLock) V.lock = await navigator.wakeLock.request('screen'); } catch { /* */ } }

function tick() {
  if (app.route.name !== 'rotation') { clearInterval(V.ticker); V.ticker = null; return; }
  const st = stateOf(app.route);
  const left = st.durationMin * 60000 - elapsed(st);
  if (left <= 0 && st.clock.startedAt) { st.clock.base = st.durationMin * 60000; st.clock.startedAt = null; app.repo.setMeta(keyOf(app.route), st); buzz('end'); render(); return; }
  const el = document.querySelector('.bxclock'); if (el) { const txt = clockText(Math.max(0, left), false); if (el.textContent !== txt) el.textContent = txt; }
}

registerView('rotation', (r) => {
  const st = stateOf(r);
  if (!V.ticker) V.ticker = setInterval(tick, 250);
  const save = () => app.repo.setMeta(keyOf(r), st);
  const apply = (fn, kind = 'tap') => { fn(); buzz(kind); save(); render(); };
  const left = st.durationMin * 60000 - elapsed(st);
  const running = !!st.clock.startedAt;
  const over = left <= 0;
  const nA = st.ateliers.length, nG = Math.min(st.groups.length, nA);
  const next = () => { const snap = clone(st); apply(() => { st.rot = (st.rot + 1) % nA; st.clock = { base: 0, startedAt: Date.now() }; keepAwake(); }, 'change');
    toast(`Rotation ${st.rot + 1} : c'est parti.`, { action: 'Annuler', ms: 8000, onAction: () => { Object.assign(st, snap); save(); render(); } }); };
  const m = iconBtn('more', 'Options', () => popMenu(m, [
    { label: 'Réglages (ateliers, groupes, durée)…', onClick: () => settingsDialog(st, () => { save(); render(); }) },
    { label: 'Enregistrer comme préréglage de l\'équipe EPS', onClick: async () => { await savePreset(null, 'rotation', { durationMin: st.durationMin, ateliers: st.ateliers, groups: st.groups }); toast('Préréglage Rotation enregistré.'); } },
    { label: 'Revenir à la 1re rotation', onClick: () => { const snap = clone(st); apply(() => { st.rot = 0; st.clock = { base: 0, startedAt: null }; }, 'undo'); toast('Retour à la rotation 1.', { action: 'Annuler', ms: 8000, onAction: () => { Object.assign(st, snap); save(); render(); } }); } },
    helpItem('rotation'),
  ]), 'boxed');
  const R = 38;
  const ateliers = st.ateliers.map((a, i) => {
    const ang = ((-90 + i * (360 / nA)) * Math.PI) / 180;
    const g = groupOn(i, st.rot, nA, nG);
    const tv = tintVars(a.color);
    return h('div', { class: `bxat ${nA > 6 ? 'sm' : ''}`, style: { left: `${50 + R * Math.cos(ang)}%`, top: `${50 + R * Math.sin(ang)}%`, '--a': a.color, '--ai': tv['--ti'] } },
      g != null ? h('div', { class: `bxg ${st.groups[g].length > 2 ? 'long' : ''}`, style: { '--g': GCOLORS[g % GCOLORS.length] } }, st.groups[g]) : h('div', { class: 'bxg free' }, '—'),
      h('div', { class: 'bxn' }, `Atelier ${i + 1}`), a.title && a.title !== `Atelier ${i + 1}` ? h('em', { class: 'rtitle' }, a.title) : null);
  });
  return h('div', { class: 'main boxefps rotation' },
    h('div', { class: 'topbar' }, iconBtn('back', 'Retour', () => backTo(r), '', { 'data-back': '1' }),
      h('div', { class: 'grow evtitle' }, h('h1', null, 'Rotation d\'ateliers'), h('div', { class: 'sub' }, `${nA} ateliers · ${nG} groupes · ${st.durationMin} min par atelier`)), m),
    h('div', { class: 'bxwrap solo' },
      h('div', { class: `bxdial ${over ? 'over' : running ? 'run' : ''}` }, h('div', { class: 'bxring' }), ...ringArrows(nA, R), ...ateliers,
        h('div', { class: 'bxcenter' },
          h('div', { class: 'bxrot' }, `Rotation ${st.rot + 1} / ${nA}`),
          h('div', { class: 'bxclock' }, clockText(Math.max(0, left), false)),
          over ? btn('Rotation suivante', { icon: 'next', cls: 'primary bigbtn', onClick: next })
            : btn(running ? 'Pause' : elapsed(st) ? 'Reprendre' : 'Démarrer', { icon: running ? 'pause' : 'play', cls: `bigbtn ${running ? '' : 'primary'}`,
              onClick: () => apply(() => { if (running) { st.clock.base = elapsed(st); st.clock.startedAt = null; } else { st.clock.startedAt = Date.now(); keepAwake(); } }, 'change') }),
          !over && elapsed(st) && !running ? h('button', { type: 'button', class: 'linkbtn', onClick: next }, 'Passer à la rotation suivante') : null))));
});

export function settingsDialog(st, done) {
  const S = clone({ durationMin: st.durationMin, ateliers: st.ateliers, groups: st.groups });
  const body = h('div', { class: 'dlg-body kvdlg rotdlg' });
  const stepper = (label, get, setv, lo, hi, unit = '') => h('div', { class: 'ctrow' }, h('span', { class: 'ctl' }, label), h('div', { class: 'stepper' },
    h('button', { type: 'button', 'aria-label': `${label} : moins`, disabled: get() <= lo, onClick: () => { setv(get() - 1); paint(); } }, icon('minus', 18)), h('output', null, `${get()}${unit}`),
    h('button', { type: 'button', 'aria-label': `${label} : plus`, disabled: get() >= hi, onClick: () => { setv(get() + 1); paint(); } }, icon('plus', 18))), h('span'));
  const setAteliers = (n) => {
    while (S.ateliers.length < n) { const used = new Set(S.ateliers.map((a) => a.color)); S.ateliers.push({ title: `Atelier ${S.ateliers.length + 1}`, color: ROT_COLORS.find((c) => !used.has(c)) || ROT_COLORS[S.ateliers.length % 8] }); }
    S.ateliers.length = n;
    if (S.groups.length > n) S.groups.length = n;
  };
  const setGroups = (n) => { while (S.groups.length < n) S.groups.push(LETTERS[S.groups.length]); S.groups.length = n; };
  const paint = () => body.replaceChildren(
    stepper('Temps sur un atelier', () => S.durationMin, (v) => { S.durationMin = v; }, 1, 30, ' min'),
    stepper('Ateliers', () => S.ateliers.length, setAteliers, 2, 8),
    h('div', { class: 'rotlist' }, S.ateliers.map((a, i) => h('div', { class: 'rotrow', style: { '--a': a.color } },
      h('b', null, String(i + 1)),
      h('input', { type: 'text', value: a.title, 'aria-label': `Titre de l'atelier ${i + 1}`, onChange: (e) => { a.title = e.target.value.trim() || a.title; } }),
      h('div', { class: 'rotsw' }, ROT_COLORS.map((c) => h('button', { type: 'button', class: `sw ${a.color === c ? 'on' : ''}`, style: { background: c }, 'aria-label': `Couleur ${c}`, onClick: () => { a.color = c; paint(); } })))))),
    stepper('Groupes', () => S.groups.length, setGroups, 1, S.ateliers.length),
    h('div', { class: 'rotgroups' }, S.groups.map((g, i) => h('input', { type: 'text', value: g, maxLength: 12, style: { '--g': GCOLORS[i % 8] }, 'aria-label': `Nom du groupe ${i + 1}`, onChange: (e) => { S.groups[i] = e.target.value.trim() || g; } }))));
  paint();
  openDialog({ title: 'Réglages de la rotation', body, wide: true, actions: [{ label: 'Annuler' }, { label: 'Enregistrer', primary: true, onClick: () => { Object.assign(st, S); st.rot %= S.ateliers.length; done(); } }] });
}
