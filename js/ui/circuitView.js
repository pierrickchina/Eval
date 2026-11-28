// Outil Circuit training : Chrono (cadenas, préréglages, circuit affiché) · Exercices (fiches, tri, hasard, matériel) · Circuits (créés et nommés).
import { app, registerView, go, render , back as navBack } from '../app.js';
import { h, btn, icon, iconBtn, openDialog, popMenu, toast, confirmDialog } from './dom.js';
import { uid } from '../util.js';
import { clockText } from './chronoView.js';
import { buzz } from './foundations.js';
import { helpItem } from './help.js';
import { presetFor, savePreset } from './presets.js';
import { activitiesOf } from '../logic/activities.js';
import { CT_PRESETS, CT_DEFAULT, CT_LIMITS, totalOf, setParam, toggleLock, intervalAt } from '../logic/intervals.js';
import { EXERCISES, EX_TYPES, MATERIAL, PICTS, exById, usable, randomExercise } from '../data/exercises.js';

const CFG_KEY = 'eps-circuit2';
const loadCfg = () => { try { return { ...CT_DEFAULT, ...(JSON.parse(localStorage.getItem(CFG_KEY) || 'null') || {}) }; } catch { return { ...CT_DEFAULT }; } };
const C = { cfg: loadCfg(), base: 0, startedAt: null, ticker: null, lastKey: null, lock: null, tab: 'chrono', type: null, lastRandom: null, routeKey: null };
const saveCfg = () => { try { localStorage.setItem(CFG_KEY, JSON.stringify(C.cfg)); } catch { /* sans importance */ } };
const elapsed = (t = Date.now()) => C.base + (C.startedAt ? t - C.startedAt : 0);
const running = () => !!C.startedAt;
const LABEL = { prep: 'Prêts ?', work: 'Travail', rest: 'Récupération', roundRest: 'Récupération entre tours', done: 'Terminé' };
const circuits = () => app.repo.getMeta('ctCircuits', null) || [];
const saveCircuits = (list) => app.repo.setMeta('ctCircuits', list);
const material = () => app.repo.getMeta('ctMaterial', null) || {};
const circuitOf = (id) => circuits().find((x) => x.id === id) || null;
const fmtDur = (s) => (s % 60 ? `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s` : `${s / 60} min`);

async function keepAwake() { try { if (!C.lock && navigator.wakeLock) C.lock = await navigator.wakeLock.request('screen'); } catch { /* */ } }
function release() { try { C.lock?.release?.(); } catch { /* */ } C.lock = null; }

/** Image d'un exercice : la photo de la fiche, ou le pictogramme dessiné. */
export function exPicture(e, cls = 'exapic') {
  if (e.img) return h('img', { class: cls, src: e.img, alt: e.name, loading: 'lazy' });
  const s = h('span', { class: `${cls} pict`, role: 'img', 'aria-label': e.name }); s.innerHTML = PICTS[e.pict] || ''; return s;
}
const typeDots = (e) => h('span', { class: 'extypes' }, e.types.map((t) => h('i', { style: { background: EX_TYPES[t].color }, title: EX_TYPES[t].label })));

// ---------- Battement ----------

function tick() {
  if (app.route.name !== 'circuit') { clearInterval(C.ticker); C.ticker = null; return; }
  const st = intervalAt(C.cfg, elapsed());
  const key = `${st.phase}-${st.round}-${st.station}-${st.slot || 0}`;
  if (key !== C.lastKey) {
    if (C.lastKey && running()) buzz(st.phase === 'done' ? 'end' : 'change');
    C.lastKey = key;
    if (st.phase === 'done') { C.base = elapsed(); C.startedAt = null; }
    if (C.tab === 'chrono') render();
    return;
  }
  const d = document.querySelector('.ctdigits'); if (d) { const txt = clockText(st.left, false); if (d.textContent !== txt) d.textContent = txt; }
  const tl = document.querySelector('.cttotal'); if (tl) { const tt = `Reste ${clockText(st.totalLeft, false)}`; if (tl.textContent !== tt) tl.textContent = tt; }
}

function leave() {
  clearInterval(C.ticker); C.ticker = null; release();
  C.base = 0; C.startedAt = null; C.lastKey = null;
  const r = app.route;
  navBack(() => (r.from === 'classPage' && r.classId ? go('classPage', { id: r.classId }) : go('home')));
}

// ---------- Écran ----------

registerView('circuit', (r) => {
  if (!C.ticker) C.ticker = setInterval(tick, 200);
  const act = r.scope === 'act' ? activitiesOf(app.repo.get('classes', r.classId) || { activities: [] }).find((a) => a.id === r.actId) : null;
  // préréglage de l'équipe EPS pour cette activité, appliqué à l'ouverture (si le chrono ne tourne pas)
  const rk = `${r.classId || ''}/${r.actId || ''}`;
  if (rk !== C.routeKey) { C.routeKey = rk; const p = presetFor(null, 'circuit'); if (p && !elapsed()) { C.cfg = { ...C.cfg, ...p, locks: {} }; saveCfg(); } }
  const tabs = h('div', { class: 'seg' }, [['chrono', 'Chrono'], ['exos', 'Exercices'], ['circuits', 'Circuits']].map(([k, l]) => h('button', { type: 'button', class: C.tab === k ? 'on' : '', onClick: () => { C.tab = k; render(); } }, l)));
  const m = iconBtn('more', 'Options', () => popMenu(m, [
    { label: 'Enregistrer comme préréglage de l\'équipe EPS', onClick: async () => { const { locks, circuit, ...p } = C.cfg; await savePreset(null, 'circuit', p); toast('Préréglage Circuit training enregistré (Réglages › Préréglages).'); } },
    helpItem('circuit'),
  ].filter(Boolean)), 'boxed');
  const back = async () => { if (running() && !(await confirmDialog('Le minuteur tourne encore. Quitter l\'arrête.', 'Quitter', { danger: true }))) return; leave(); };
  const top = h('div', { class: 'topbar' }, iconBtn('back', 'Retour', back, '', { 'data-back': '1' }),
    h('div', { class: 'grow evtitle' }, h('h1', null, 'Circuit training'), h('div', { class: 'sub' }, act ? act.name : `${C.cfg.work} s / ${C.cfg.rest} s · ${C.cfg.stations} exercices × ${C.cfg.rounds} tour${C.cfg.rounds > 1 ? 's' : ''}`)),
    tabs, m);
  const body = C.tab === 'exos' ? exercisesTab() : C.tab === 'circuits' ? circuitsTab() : chronoTab();
  return h('div', { class: `main circuit tab-${C.tab}` }, top, body);
});

// ---------- Onglet Chrono ----------

function chronoTab() {
  const cfg = C.cfg;
  const st = intervalAt(cfg, elapsed());
  C.lastKey = `${st.phase}-${st.round}-${st.station}-${st.slot || 0}`;
  const started = elapsed() > 0;
  const circ = cfg.circuit ? circuitOf(cfg.circuit) : null;
  const exAt = (station) => (circ && station ? exById(circ.ids[(station - 1) % circ.ids.length]) : null);
  const cur = st.phase === 'work' ? exAt(st.station) : null;
  const nxt = exAt(st.next || (st.phase === 'prep' ? 1 : null));
  const set = (k, v) => { C.cfg = setParam(C.cfg, k, v); saveCfg(); render(); };
  const lockBtn = (k) => h('button', { type: 'button', class: `ctlock ${cfg.locks?.[k] ? 'on' : ''}`, 'aria-label': cfg.locks?.[k] ? 'Déverrouiller' : 'Verrouiller', title: cfg.locks?.[k] ? 'Verrouillé : ne bouge pas' : 'Verrouiller ce réglage', disabled: running(),
    onClick: () => { C.cfg = toggleLock(C.cfg, k); saveCfg(); render(); } }, icon('lock', 16));
  const row = (k, label, unit, val = cfg[k]) => {
    const [lo, hi, stp] = CT_LIMITS[k];
    const locked = !!cfg.locks?.[k] || (k === 'stations' && circ);
    return h('div', { class: `ctrow ${locked ? 'locked' : ''}` }, h('span', { class: 'ctl' }, label),
      h('div', { class: 'stepper' },
        h('button', { type: 'button', 'aria-label': `${label} : moins`, disabled: running() || locked || val <= lo, onClick: () => set(k, val - stp) }, icon('minus', 18)),
        h('output', null, k === 'total' ? fmtDur(val) : `${val}${unit}`),
        h('button', { type: 'button', 'aria-label': `${label} : plus`, disabled: running() || locked || val >= hi, onClick: () => set(k, val + stp) }, icon('plus', 18))),
      k === 'stations' && circ ? h('span', { class: 'muted small' }, 'circuit') : lockBtn(k));
  };
  const total = totalOf(cfg);
  const target = cfg.locks?.total;
  const preset = CT_PRESETS.find((p) => Object.entries(p.cfg).every(([k, v]) => cfg[k] === v));
  return h('div', { class: 'ctlayout' },
    h('section', { class: `ctimer ph-${st.phase}` },
      h('div', { class: 'ctphase' }, st.slot ? `Élève ${st.slot} / ${st.relay}` : LABEL[st.phase], st.phase === 'work' || st.phase === 'rest' ? h('span', null, ` · exercice ${st.station}/${st.stations}${st.rounds > 1 ? ` · ${cfg.relay > 1 ? 'bloc' : 'tour'} ${st.round}/${st.rounds}` : ''}`) : null),
      st.slot ? h('div', { class: 'ctrelay' }, Array.from({ length: st.relay }, (_, k) => h('i', { class: k + 1 < st.slot ? 'done' : k + 1 === st.slot ? 'on' : '' }, String(k + 1))), h('span', null, 'Les autres comptent et notent sur la feuille')) : null,
      cur ? h('div', { class: 'ctnow' }, exPicture(cur, 'ctpic'), h('b', null, cur.name)) : null,
      h('div', { class: 'ctdigits' }, clockText(st.left, false)),
      nxt && st.phase !== 'done' ? h('div', { class: 'ctnext' }, 'Ensuite : ', h('b', null, nxt.name)) : null,
      h('div', { class: 'cttotal' }, `Reste ${clockText(st.totalLeft, false)}`),
      h('div', { class: 'cctrl' },
        btn(running() ? 'Pause' : started && st.phase !== 'done' ? 'Reprendre' : 'Démarrer', { icon: running() ? 'pause' : 'play', cls: 'primary bigbtn', disabled: st.phase === 'done',
          onClick: () => { if (running()) { C.base = elapsed(); C.startedAt = null; } else { C.startedAt = Date.now(); keepAwake(); } render(); } }),
        btn('Zéro', { icon: 'reset', cls: 'bigbtn', disabled: !started, onClick: () => { C.base = 0; C.startedAt = null; C.lastKey = null; render(); } }))),
    h('aside', { class: 'ctset panel' },
      h('div', { class: 'field' }, 'Préréglages', h('div', { class: 'seg wrap' }, CT_PRESETS.map((p) => h('button', { type: 'button', class: preset?.id === p.id ? 'on' : '', disabled: running(),
        onClick: () => { C.cfg = { ...C.cfg, ...p.cfg, locks: {} }; if (circuitOf(C.cfg.circuit)) C.cfg.stations = circuitOf(C.cfg.circuit).ids.length; saveCfg(); render(); } }, p.label)))),
      h('div', { class: 'field' }, 'Circuit affiché', h('select', { 'aria-label': 'Circuit', disabled: running(), onChange: (e) => { C.cfg.circuit = e.target.value || null; const c2 = circuitOf(C.cfg.circuit); if (c2) C.cfg = setParam(C.cfg, 'stations', c2.ids.length); saveCfg(); render(); } },
        h('option', { value: '' }, 'Aucun (chrono seul)'), circuits().map((x) => h('option', { value: x.id, selected: x.id === cfg.circuit }, `${x.name} (${x.ids.length})`)))),
      h('div', { class: 'ctrow' }, h('span', { class: 'ctl' }, 'Relais (élèves)'), h('div', { class: 'stepper' },
        h('button', { type: 'button', 'aria-label': 'Relais : moins', disabled: running() || !(cfg.relay > 1), onClick: () => { C.cfg = { ...C.cfg, relay: cfg.relay > 2 ? cfg.relay - 1 : 0, locks: {} }; saveCfg(); render(); } }, icon('minus', 18)),
        h('output', null, cfg.relay > 1 ? `${cfg.relay}` : 'non'),
        h('button', { type: 'button', 'aria-label': 'Relais : plus', disabled: running() || cfg.relay >= 8, onClick: () => { C.cfg = { ...C.cfg, relay: cfg.relay > 1 ? cfg.relay + 1 : 2, locks: {} }; saveCfg(); render(); } }, icon('plus', 18))), h('span')),
      row('work', cfg.relay > 1 ? 'Travail (par élève)' : 'Travail', ' s'), row('rest', cfg.relay > 1 ? 'Transition' : 'Récupération', ' s'), row('stations', 'Exercices', ''), row('rounds', cfg.relay > 1 ? 'Blocs' : 'Tours', ''),
      cfg.rounds > 1 ? row('roundRest', cfg.relay > 1 ? 'Pause entre blocs' : 'Récup. entre tours', ' s') : null,
      row('total', 'Durée totale', '', target || total),
      target && Math.abs(target - total) > 0 ? h('p', { class: 'muted small' }, `Durée réelle : ${fmtDur(total)}`) : h('p', { class: 'muted small' }, 'Cadenas : le réglage ne bouge plus ; les autres s\'ajustent pour tenir la durée.'),
      h('div', { class: 'ctrow' }, h('span', { class: 'ctl' }, 'Préparation'), h('div', { class: 'stepper' },
        h('button', { type: 'button', 'aria-label': 'Préparation : moins', disabled: running() || cfg.prep <= 0, onClick: () => { C.cfg.prep = Math.max(0, cfg.prep - 5); saveCfg(); render(); } }, icon('minus', 18)),
        h('output', null, `${cfg.prep} s`),
        h('button', { type: 'button', 'aria-label': 'Préparation : plus', disabled: running() || cfg.prep >= 30, onClick: () => { C.cfg.prep = Math.min(30, cfg.prep + 5); saveCfg(); render(); } }, icon('plus', 18))))));
}

// ---------- Onglet Exercices ----------

function exercisesTab() {
  const have = material();
  const list = usable(have).filter((e) => !C.type || e.types.includes(C.type));
  const chips = h('div', { class: 'extfilter' },
    h('button', { type: 'button', class: `extchip ${!C.type ? 'on' : ''}`, onClick: () => { C.type = null; render(); } }, `Tous (${usable(have).length})`),
    Object.entries(EX_TYPES).map(([k, t]) => h('button', { type: 'button', class: `extchip ${C.type === k ? 'on' : ''}`, style: { '--tc': t.color, '--ts': t.soft }, onClick: () => { C.type = C.type === k ? null : k; render(); } },
      h('i', { style: { background: t.color } }), `${t.label} (${usable(have).filter((e) => e.types.includes(k)).length})`)));
  const mat = h('div', { class: 'exmat' }, h('b', null, 'Matériel disponible :'), Object.entries(MATERIAL).map(([k, l]) => h('label', { class: 'row' },
    h('input', { type: 'checkbox', checked: have[k] !== false, style: { width: '22px', height: '22px' }, onChange: async (e) => { await app.repo.setMeta('ctMaterial', { ...material(), [k]: e.target.checked }); render(); } }), h('span', null, l))));
  return h('div', { class: 'scroll grow listpad', 'data-keep': 'exos' },
    h('div', { class: 'row wrap', style: { alignItems: 'center', gap: '10px', marginBottom: '10px' } }, chips,
      btn(C.type ? `Au hasard : ${EX_TYPES[C.type].label.toLowerCase()}` : 'Au hasard', { icon: 'shuffle', cls: 'primary', onClick: () => { const e = randomExercise(C.type, have, C.lastRandom); if (e) { C.lastRandom = e.id; exerciseDialog(e, true); } } })),
    mat,
    h('div', { class: 'exgrid' }, list.map((e) => h('button', { type: 'button', class: 'excard', onClick: () => exerciseDialog(e) },
      exPicture(e), h('div', { class: 'exname' }, h('span', { class: 'exn' }, String(e.n)), h('b', null, e.name)), typeDots(e)))));
}

export function exerciseDialog(e, random = false) {
  const body = h('div', { class: 'dlg-body exdetail' },
    h('div', { class: 'exhead' }, typeDots(e), h('span', { class: 'muted small' }, e.types.map((t) => EX_TYPES[t].label).join(' · ')), e.material ? h('span', { class: 'tag' }, MATERIAL[e.material]) : null),
    h('div', { class: 'expics' }, exPicture(e, 'exbig'), e.img2 ? h('img', { class: 'exbig', src: e.img2, alt: `${e.name} (niveau 2)` }) : null),
    h('ul', { class: 'exhow' }, e.how.map(([t, safe]) => h('li', { class: safe ? 'safe' : '' }, t))),
    e.levels.length ? h('div', { class: 'exlevels' }, e.levels.map((l, i) => h('div', null, h('b', null, `Niveau ${i + 1} : `), l))) : null,
    h('p', { class: 'muted small' }, 'En gras : consignes de sécurité.'));
  openDialog({ title: `${random ? 'Tiré au hasard · ' : ''}${e.n}. ${e.name}`, body, wide: true,
    actions: random ? [{ label: 'Fermer' }, { label: 'Un autre', primary: true, onClick: () => { const n = randomExercise(C.type, material(), e.id); if (n) { C.lastRandom = n.id; setTimeout(() => exerciseDialog(n, true), 0); } } }] : [{ label: 'Fermer', primary: true }] });
}

// ---------- Onglet Circuits ----------

function circuitsTab() {
  const list = circuits();
  const row = (x) => {
    const more = iconBtn('more', 'Actions', (ev) => { ev.stopPropagation(); popMenu(more, [
      { label: 'Afficher dans le chrono', onClick: () => { C.cfg.circuit = x.id; C.cfg = setParam(C.cfg, 'stations', x.ids.length); saveCfg(); C.tab = 'chrono'; render(); } },
      { label: 'Modifier…', onClick: () => circuitDialog(x) },
      { label: 'Dupliquer', onClick: async () => { await saveCircuits([...circuits(), { ...x, id: uid(), name: `${x.name} (copie)` }]); render(); } },
      { label: 'Supprimer', danger: true, onClick: async () => { const all = circuits(); await saveCircuits(all.filter((y) => y.id !== x.id)); if (C.cfg.circuit === x.id) { C.cfg.circuit = null; saveCfg(); } render(); toast(`Circuit « ${x.name} » supprimé.`, { action: 'Annuler', ms: 8000, onAction: async () => { await saveCircuits(all); render(); } }); } },
    ]); }, 'sm');
    return h('div', { class: 'evrow', role: 'button', tabindex: 0, onClick: () => circuitDialog(x) },
      h('div', { class: 'grow' }, h('div', { class: 't' }, x.name, C.cfg.circuit === x.id ? h('span', { class: 'tag' }, 'dans le chrono') : null),
        h('div', { class: 'ctstrip' }, x.ids.map((id, i) => { const e = exById(id); return e ? h('span', { class: 'ctpill', style: { '--tc': EX_TYPES[e.types[0]].color, '--ts': EX_TYPES[e.types[0]].soft } }, `${i + 1}. ${e.name}`) : null; }))),
      more);
  };
  return h('div', { class: 'scroll grow listpad', 'data-keep': 'circuits' },
    h('div', { class: 'row wrap', style: { marginBottom: '10px' } }, btn('Nouveau circuit', { icon: 'plus', cls: 'primary', onClick: () => circuitDialog(null) }),
      h('span', { class: 'muted small' }, 'Un circuit = une suite d\'exercices nommée. Choisi dans le chrono, il affiche l\'exercice en cours et le suivant.')),
    list.length ? list.map(row) : h('div', { class: 'empty' }, h('h2', null, 'Aucun circuit'), h('p', null, 'Créez un circuit : un nom, puis touchez les exercices dans l\'ordre.')));
}

function circuitDialog(x) {
  const st = { name: x?.name || `Circuit ${circuits().length + 1}`, ids: x ? x.ids.slice() : [], type: null };
  const body = h('div', { class: 'dlg-body ctdlg' });
  const paint = () => {
    const have = material();
    body.replaceChildren(
      h('label', { class: 'field' }, 'Nom du circuit', h('input', { type: 'text', value: st.name, onInput: (e) => { st.name = e.target.value; } })),
      h('div', { class: 'field' }, `Ordre (${st.ids.length} exercice${st.ids.length > 1 ? 's' : ''})`,
        h('div', { class: 'ctstrip' }, st.ids.length ? st.ids.map((id, i) => { const e = exById(id); return h('button', { type: 'button', class: 'ctpill', style: { '--tc': EX_TYPES[e.types[0]].color, '--ts': EX_TYPES[e.types[0]].soft }, title: 'Retirer', onClick: () => { st.ids.splice(i, 1); paint(); } }, `${i + 1}. ${e.name} ✕`); })
          : h('span', { class: 'muted small' }, 'Touchez les exercices ci-dessous dans l\'ordre.'))),
      h('div', { class: 'row wrap' },
        h('div', { class: 'extfilter' }, h('button', { type: 'button', class: `extchip ${!st.type ? 'on' : ''}`, onClick: () => { st.type = null; paint(); } }, 'Tous'),
          Object.entries(EX_TYPES).map(([k, t]) => h('button', { type: 'button', class: `extchip ${st.type === k ? 'on' : ''}`, style: { '--tc': t.color, '--ts': t.soft }, onClick: () => { st.type = st.type === k ? null : k; paint(); } }, h('i', { style: { background: t.color } }), t.label))),
        btn('1 de chaque type', { icon: 'shuffle', cls: 'small soft', onClick: () => { for (const k of Object.keys(EX_TYPES)) { const e = randomExercise(k, have, null); if (e) st.ids.push(e.id); } paint(); } })),
      h('div', { class: 'exgrid small' }, usable(have).filter((e) => !st.type || e.types.includes(st.type)).map((e) => h('button', { type: 'button', class: 'excard', onClick: () => { st.ids.push(e.id); paint(); } },
        exPicture(e), h('div', { class: 'exname' }, h('b', null, e.name)), typeDots(e)))));
  };
  paint();
  openDialog({ title: x ? 'Modifier le circuit' : 'Nouveau circuit', body, wide: true, actions: [{ label: 'Annuler' }, { label: 'Enregistrer', primary: true, onClick: async () => {
    if (!st.ids.length) { toast('Ajoutez au moins un exercice.'); return; }
    const rec = { id: x?.id || uid(), name: st.name.trim() || 'Circuit', ids: st.ids };
    const all = circuits(); const i = all.findIndex((y) => y.id === rec.id);
    if (i >= 0) all[i] = rec; else all.push(rec);
    await saveCircuits(all);
    if (C.cfg.circuit === rec.id) { C.cfg = setParam(C.cfg, 'stations', rec.ids.length); saveCfg(); }
    render();
  } }] });
}
