// Forme de pratique scolaire Boxe française (3e) : horloge de rotation. 6 ateliers (2 × 3 : assaut en 1 touche, assaut normal,
// coaching), groupes A à F. Au bout des 6 minutes le chrono s'arrête et sonne ; l'enseignant lance la rotation suivante.
import { app, registerView, go, render } from '../app.js';
import { h, btn, icon, iconBtn, openDialog, popMenu, toast } from './dom.js';
import { clone } from '../util.js';
import { clockText } from './chronoView.js';
import { buzz } from './foundations.js';
import { helpItem } from './help.js';

export const BX_ATELIERS = ['Assaut en 1 touche', 'Assaut normal', 'Coaching', 'Assaut en 1 touche', 'Assaut normal', 'Coaching'];
const GROUPS = 'ABCDEF';
const GCOLORS = ['#e5484d', '#2f6fe0', '#2e9b4f', '#e0a800', '#7b4fc9', '#f08a24'];
const V = { ticker: null, lock: null };
const keyOf = (r) => `bx:${r.scope === 'act' ? r.actId : 'free'}`;
const stateOf = (r) => app.repo.getMeta(keyOf(r), null) || { durationMin: 6, ateliers: BX_ATELIERS.slice(), rot: 0, clock: { base: 0, startedAt: null } };
const elapsed = (st, t = Date.now()) => st.clock.base + (st.clock.startedAt ? t - st.clock.startedAt : 0);
/** Groupe présent à l'atelier i après `rot` rotations (le groupe A commence à l'atelier 1, B au 2…). */
export const groupAt = (i, rot, n = 6) => ((i - rot) % n + n) % n;
const backTo = (r) => (r.from === 'classPage' && r.classId ? go('classPage', { id: r.classId }) : go('home'));
async function keepAwake() { try { if (!V.lock && navigator.wakeLock) V.lock = await navigator.wakeLock.request('screen'); } catch { /* */ } }

function tick() {
  if (app.route.name !== 'boxefps') { clearInterval(V.ticker); V.ticker = null; return; }
  const st = stateOf(app.route);
  const left = st.durationMin * 60000 - elapsed(st);
  if (left <= 0 && st.clock.startedAt) { st.clock.base = st.durationMin * 60000; st.clock.startedAt = null; app.repo.setMeta(keyOf(app.route), st); buzz('end'); render(); return; }
  const el = document.querySelector('.bxclock'); if (el) { const txt = clockText(Math.max(0, left), false); if (el.textContent !== txt) el.textContent = txt; }
}

registerView('boxefps', (r) => {
  const st = stateOf(r);
  if (!V.ticker) V.ticker = setInterval(tick, 250);
  const save = () => app.repo.setMeta(keyOf(r), st);
  const apply = (fn, kind = 'tap') => { fn(); buzz(kind); save(); render(); };
  const left = st.durationMin * 60000 - elapsed(st);
  const running = !!st.clock.startedAt;
  const over = left <= 0;
  const n = st.ateliers.length;
  const next = () => { const snap = clone(st); apply(() => { st.rot = (st.rot + 1) % n; st.clock = { base: 0, startedAt: Date.now() }; keepAwake(); }, 'change');
    toast(`Rotation ${st.rot + 1} : c'est parti.`, { action: 'Annuler', ms: 8000, onAction: () => { Object.assign(st, snap); save(); render(); } }); };
  const m = iconBtn('more', 'Options', () => popMenu(m, [
    { label: 'Réglages (durée, ateliers)…', onClick: () => settingsDialog(st, () => { save(); render(); }) },
    { label: 'Revenir à la 1re rotation', onClick: () => { const snap = clone(st); apply(() => { st.rot = 0; st.clock = { base: 0, startedAt: null }; }, 'undo'); toast('Retour à la rotation 1.', { action: 'Annuler', ms: 8000, onAction: () => { Object.assign(st, snap); save(); render(); } }); } },
    helpItem('boxefps'),
  ]), 'boxed');
  const R = 40; // rayon (en % de la moitié du cadran)
  const ateliers = st.ateliers.map((label, i) => {
    const ang = (-90 + i * (360 / n)) * Math.PI / 180;
    const g = groupAt(i, st.rot, n);
    return h('div', { class: 'bxat', style: { left: `${50 + R * Math.cos(ang)}%`, top: `${50 + R * Math.sin(ang)}%`, '--g': GCOLORS[g % GCOLORS.length] } },
      h('div', { class: 'bxg' }, GROUPS[g] || String(g + 1)),
      h('div', { class: 'bxn' }, `Atelier ${i + 1}`), h('em', null, label));
  });
  return h('div', { class: 'main boxefps' },
    h('div', { class: 'topbar' }, iconBtn('back', 'Retour', () => backTo(r), '', { 'data-back': '1' }),
      h('div', { class: 'grow evtitle' }, h('h1', null, 'Boxe française · rotation'), h('div', { class: 'sub' }, `${n} ateliers · ${st.durationMin} min · groupes ${GROUPS.slice(0, n).split('').join(', ')}`)), m),
    h('div', { class: 'bxwrap' },
      h('div', { class: `bxdial ${over ? 'over' : running ? 'run' : ''}` }, h('div', { class: 'bxring' }), ...ateliers,
        h('div', { class: 'bxcenter' },
          h('div', { class: 'bxrot' }, `Rotation ${st.rot + 1} / ${n}`),
          h('div', { class: 'bxclock' }, clockText(Math.max(0, left), false)),
          over ? btn('Rotation suivante', { icon: 'next', cls: 'primary bigbtn', onClick: next })
            : btn(running ? 'Pause' : elapsed(st) ? 'Reprendre' : 'Démarrer', { icon: running ? 'pause' : 'play', cls: `bigbtn ${running ? '' : 'primary'}`,
              onClick: () => apply(() => { if (running) { st.clock.base = elapsed(st); st.clock.startedAt = null; } else { st.clock.startedAt = Date.now(); keepAwake(); } }, 'change') }),
          !over && elapsed(st) && !running ? h('button', { type: 'button', class: 'linkbtn', onClick: next }, 'Passer à la rotation suivante') : null))));
});

function settingsDialog(st, done) {
  const S = { durationMin: st.durationMin, ateliers: st.ateliers.slice() };
  const body = h('div', { class: 'dlg-body kvdlg' });
  const paint = () => body.replaceChildren(
    h('div', { class: 'field' }, 'Durée d\'une rotation', h('div', { class: 'stepper' },
      h('button', { type: 'button', 'aria-label': 'Moins', disabled: S.durationMin <= 1, onClick: () => { S.durationMin--; paint(); } }, icon('minus', 18)), h('output', null, `${S.durationMin} min`),
      h('button', { type: 'button', 'aria-label': 'Plus', onClick: () => { S.durationMin++; paint(); } }, icon('plus', 18)))),
    h('div', { class: 'field' }, 'Ateliers (un groupe par atelier)', ...S.ateliers.map((a, i) => h('div', { class: 'listrow' }, h('b', { style: { width: '6em' } }, `Atelier ${i + 1}`),
      h('input', { type: 'text', value: a, style: { flex: 1 }, onChange: (e) => { S.ateliers[i] = e.target.value.trim() || a; } }),
      iconBtn('trash', 'Retirer', () => { S.ateliers.splice(i, 1); paint(); }, 'sm', { disabled: S.ateliers.length <= 2 }))),
      btn('Ajouter un atelier', { icon: 'plus', cls: 'small soft', disabled: S.ateliers.length >= 6, onClick: () => { S.ateliers.push('Atelier'); paint(); } }),
      btn('Ateliers du Projet EPS', { cls: 'small soft', onClick: () => { S.ateliers = BX_ATELIERS.slice(); paint(); } })));
  paint();
  openDialog({ title: 'Réglages de la rotation', body, actions: [{ label: 'Annuler' }, { label: 'Enregistrer', primary: true, onClick: () => { st.durationMin = S.durationMin; st.ateliers = S.ateliers; st.rot %= S.ateliers.length; done(); } }] });
}
