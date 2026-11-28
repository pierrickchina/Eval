// Forme de pratique scolaire Boxe française (3e) : horloge de rotation. 6 ateliers (2 × 3 : assaut en 1 touche, assaut normal,
// coaching), groupes A à F. Au bout des 6 minutes le chrono s'arrête et sonne ; l'enseignant lance la rotation suivante.
// 1.12 : chaque atelier garde sa place, sa couleur et son icône ; seules les lettres des groupes tournent. Onglet Fiche.
import { app, registerView, go, render , back as navBack } from '../app.js';
import { h, btn, icon, iconBtn, openDialog, popMenu, toast } from './dom.js';
import { clone } from '../util.js';
import { clockText } from './chronoView.js';
import { buzz } from './foundations.js';
import { helpItem } from './help.js';
import { presetFor, savePreset } from './presets.js';

export const BX_ATELIERS = ['Assaut en 1 touche', 'Assaut normal', 'Coaching guidé', 'Assaut en 1 touche', 'Assaut normal', 'Coaching guidé'];
/** Trois types d'atelier (d'après la fiche d'observation Assaut) : icône, couleurs et consignes. */
export const BX_TYPES = {
  touche: { icon: 'bolt', label: 'Assaut en 1 touche', colors: ['#cfe0f7', '#b9d0f0'], ink: '#24508f',
    rules: ['1 touche réglementaire = 1 point, puis on se remet en garde.', 'L\'observateur note les points.'] },
  assaut: { icon: 'glove', label: 'Assaut normal', colors: ['#f7d3cf', '#f1bdb7'], ink: '#9b2f25',
    rules: ['Directs et fouettés contrôlés : on touche, on ne tape pas.', 'L\'observateur note les fautes.'] },
  coaching: { icon: 'users', label: 'Coaching guidé', colors: ['#d3ecd4', '#bfe2c2'], ink: '#2b6b37',
    rules: ['Le coach compte les touches non réglementaires.', 'Entre deux reprises : un conseil précis à son boxeur.'] },
};
export const typeOf = (label) => { const n = String(label).toLowerCase(); return /coach/.test(n) ? 'coaching' : /touche/.test(n) ? 'touche' : 'assaut'; };
const GROUPS = 'ABCDEF';
const GCOLORS = ['#d92d33', '#1f5fd6', '#1f8a43', '#c98f00', '#6b3fc0', '#e0701a'];
const V = { ticker: null, lock: null, tab: 'rot' };
const keyOf = (r) => `bx:${r.scope === 'act' ? r.actId : 'free'}`;
const stateOf = (r) => { const p = presetFor(null, 'boxefps') || {}; const st = app.repo.getMeta(keyOf(r), null) || { durationMin: p.durationMin || 6, ateliers: (p.ateliers || BX_ATELIERS).slice(), rot: 0, clock: { base: 0, startedAt: null } }; st.ateliers = st.ateliers.map((a) => (a === 'Coaching' ? 'Coaching guidé' : a)); return st; };
const elapsed = (st, t = Date.now()) => st.clock.base + (st.clock.startedAt ? t - st.clock.startedAt : 0);
/** Groupe présent à l'atelier i après `rot` rotations (le groupe A commence à l'atelier 1, B au 2…). */
export const groupAt = (i, rot, n = 6) => ((i - rot) % n + n) % n;
const backTo = (r) => navBack(() => (r.from === 'classPage' && r.classId ? go('classPage', { id: r.classId }) : go('home')));
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
    { label: 'Enregistrer comme préréglage de l\'équipe EPS', onClick: async () => { await savePreset(null, 'boxefps', { durationMin: st.durationMin, ateliers: st.ateliers }); toast('Préréglage Boxe enregistré.'); } },
    { label: 'Revenir à la 1re rotation', onClick: () => { const snap = clone(st); apply(() => { st.rot = 0; st.clock = { base: 0, startedAt: null }; }, 'undo'); toast('Retour à la rotation 1.', { action: 'Annuler', ms: 8000, onAction: () => { Object.assign(st, snap); save(); render(); } }); } },
    helpItem('boxefps'),
  ]), 'boxed');
  const R = 38; // rayon (en % de la moitié du cadran)
  const seen = {};
  const ateliers = st.ateliers.map((label, i) => {
    const ang = (-90 + i * (360 / n)) * Math.PI / 180;
    const g = groupAt(i, st.rot, n);
    const ty = typeOf(label), T = BX_TYPES[ty];
    const shade = T.colors[(seen[ty] = (seen[ty] ?? -1) + 1) % 2]; // 2 ateliers du même type : 2 nuances
    return h('div', { class: 'bxat', style: { left: `${50 + R * Math.cos(ang)}%`, top: `${50 + R * Math.sin(ang)}%`, '--a': shade, '--ai': T.ink } },
      h('div', { class: 'bxg', style: { '--g': GCOLORS[g % GCOLORS.length] } }, GROUPS[g] || String(g + 1)),
      icon(T.icon, 30), h('div', { class: 'bxn' }, `Atelier ${i + 1}`), h('em', null, label));
  });
  const types = [...new Set(st.ateliers.map(typeOf))];
  const tabs = h('div', { class: 'seg' }, [['rot', 'Rotation'], ['fiche', 'Fiche']].map(([k, l]) => h('button', { class: V.tab === k ? 'on' : '', onClick: () => { V.tab = k; render(); } }, l)));
  return h('div', { class: 'main boxefps' },
    h('div', { class: 'topbar' }, iconBtn('back', 'Retour', () => backTo(r), '', { 'data-back': '1' }),
      h('div', { class: 'grow evtitle' }, h('h1', null, 'Boxe française · rotation'), h('div', { class: 'sub' }, `${n} ateliers · ${st.durationMin} min · groupes ${GROUPS.slice(0, n).split('').join(', ')}`)), tabs, m),
    V.tab === 'fiche' ? h('div', { class: 'scroll grow listpad bxfiche' }, h('p', { class: 'muted' }, 'Fiche d\'observation (une par groupe, sur papier).'),
      h('img', { src: 'img/boxe/fiche-1.jpg', alt: 'Fiche Assaut normal' }), h('img', { src: 'img/boxe/fiche-2.jpg', alt: 'Fiche Assaut en 1 touche et Coaching guidé' }))
      : h('div', { class: 'bxwrap' },
        h('div', { class: `bxdial ${over ? 'over' : running ? 'run' : ''}` }, h('div', { class: 'bxring' }), ...ateliers,
          h('div', { class: 'bxcenter' },
            h('div', { class: 'bxrot' }, `Rotation ${st.rot + 1} / ${n}`),
            h('div', { class: 'bxclock' }, clockText(Math.max(0, left), false)),
            over ? btn('Rotation suivante', { icon: 'next', cls: 'primary bigbtn', onClick: next })
              : btn(running ? 'Pause' : elapsed(st) ? 'Reprendre' : 'Démarrer', { icon: running ? 'pause' : 'play', cls: `bigbtn ${running ? '' : 'primary'}`,
                onClick: () => apply(() => { if (running) { st.clock.base = elapsed(st); st.clock.startedAt = null; } else { st.clock.startedAt = Date.now(); keepAwake(); } }, 'change') }),
            !over && elapsed(st) && !running ? h('button', { type: 'button', class: 'linkbtn', onClick: next }, 'Passer à la rotation suivante') : null)),
        h('aside', { class: 'bxrules' }, types.map((ty) => { const T = BX_TYPES[ty]; return h('div', { class: 'bxrule', style: { '--a': T.colors[0], '--ai': T.ink } },
          h('div', { class: 'bxrhead' }, icon(T.icon, 28), h('b', null, T.label)), h('ul', null, T.rules.map((x) => h('li', null, x)))); }))));
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
