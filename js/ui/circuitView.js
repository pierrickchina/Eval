// Outil Chrono Circuit training : minuteur travail / récupération, grand affichage, signal à chaque changement.
import { app, registerView, go, render } from '../app.js';
import { h, btn, icon, iconBtn, popMenu, confirmDialog } from './dom.js';
import { clockText } from './chronoView.js';
import { buzz } from './foundations.js';
import { helpItem } from './help.js';
import { CT_PRESETS, CT_DEFAULT, intervalAt } from '../logic/intervals.js';

const CFG_KEY = 'eps-circuit';
const loadCfg = () => { try { return { ...CT_DEFAULT, ...(JSON.parse(localStorage.getItem(CFG_KEY) || 'null') || {}) }; } catch { return { ...CT_DEFAULT }; } };
const C = { cfg: loadCfg(), base: 0, startedAt: null, ticker: null, lastPhase: null, lock: null };
const saveCfg = () => { try { localStorage.setItem(CFG_KEY, JSON.stringify(C.cfg)); } catch { /* sans importance */ } };
const elapsed = (t = Date.now()) => C.base + (C.startedAt ? t - C.startedAt : 0);
const running = () => !!C.startedAt;
const LABEL = { prep: 'Prêts ?', work: 'Travail', rest: 'Récupération', done: 'Terminé' };

async function keepAwake() { try { if (!C.lock && navigator.wakeLock) C.lock = await navigator.wakeLock.request('screen'); } catch { /* */ } }
function release() { try { C.lock?.release?.(); } catch { /* */ } C.lock = null; }

function tick() {
  if (app.route.name !== 'circuit') { clearInterval(C.ticker); C.ticker = null; return; }
  const st = intervalAt(C.cfg, elapsed());
  const root = document.querySelector('.ctimer');
  if (!root) return;
  if (st.phase !== C.lastPhase) {
    if (C.lastPhase && running()) buzz(st.phase === 'done' ? 'end' : 'change');
    C.lastPhase = st.phase;
    if (st.phase === 'done') { C.base = elapsed(); C.startedAt = null; }
    render(); return;
  }
  const d = root.querySelector('.ctdigits'); const txt = clockText(st.left, false);
  if (d && d.textContent !== txt) d.textContent = txt;
  const tl = root.querySelector('.cttotal'); const tt = `Reste ${clockText(st.totalLeft, false)}`;
  if (tl && tl.textContent !== tt) tl.textContent = tt;
}

function leave() {
  clearInterval(C.ticker); C.ticker = null; release();
  C.base = 0; C.startedAt = null; C.lastPhase = null;
  const r = app.route;
  if (r.from === 'classPage' && r.classId) go('classPage', { id: r.classId }); else go('home');
}

const num = (k, label, min, max, unit, stepv = 5) => h('div', { class: 'field' }, label, h('div', { class: 'stepper' },
  h('button', { type: 'button', 'aria-label': `${label} : moins`, disabled: running() || C.cfg[k] <= min, onClick: () => { C.cfg[k] = Math.max(min, C.cfg[k] - stepv); saveCfg(); render(); } }, icon('minus', 18)),
  h('output', null, `${C.cfg[k]} ${unit}`),
  h('button', { type: 'button', 'aria-label': `${label} : plus`, disabled: running() || C.cfg[k] >= max, onClick: () => { C.cfg[k] = Math.min(max, C.cfg[k] + stepv); saveCfg(); render(); } }, icon('plus', 18))));

registerView('circuit', () => {
  if (!C.ticker) C.ticker = setInterval(tick, 200);
  const st = intervalAt(C.cfg, elapsed());
  C.lastPhase = st.phase;
  const started = elapsed() > 0;
  const m = iconBtn('more', 'Options', () => popMenu(m, [helpItem('circuit')]), 'boxed');
  const back = async () => { if (running() && !(await confirmDialog('Le minuteur tourne encore. Quitter l\'arrête.', 'Quitter', { danger: true }))) return; leave(); };
  return h('div', { class: 'main circuit' },
    h('div', { class: 'topbar' }, iconBtn('back', 'Retour', back, '', { 'data-back': '1' }),
      h('div', { class: 'grow evtitle' }, h('h1', null, 'Circuit training'), h('div', { class: 'sub' }, `${C.cfg.work} s de travail · ${C.cfg.rest} s de récupération · ${C.cfg.total} min`)), m),
    h('div', { class: 'ctlayout' },
      h('section', { class: `ctimer ph-${st.phase}` },
        h('div', { class: 'ctphase' }, LABEL[st.phase], st.phase === 'work' || st.phase === 'rest' ? h('span', null, ` · série ${st.round} / ${st.rounds}`) : null),
        h('div', { class: 'ctdigits' }, clockText((st.phase === 'done' ? 0 : st.left), false)),
        h('div', { class: 'cttotal' }, `Reste ${clockText(st.totalLeft, false)}`),
        h('div', { class: 'cctrl' },
          btn(running() ? 'Pause' : started && st.phase !== 'done' ? 'Reprendre' : 'Démarrer', { icon: running() ? 'pause' : 'play', cls: 'primary bigbtn', disabled: st.phase === 'done',
            onClick: () => { if (running()) { C.base = elapsed(); C.startedAt = null; } else { C.startedAt = Date.now(); keepAwake(); } render(); } }),
          btn('Zéro', { icon: 'reset', cls: 'bigbtn', disabled: !started, onClick: () => { C.base = 0; C.startedAt = null; C.lastPhase = null; render(); } }))),
      h('aside', { class: 'ctset panel' },
        h('div', { class: 'field' }, 'Durée totale', h('div', { class: 'seg' }, CT_PRESETS.map((x) => h('button', { type: 'button', class: C.cfg.total === x ? 'on' : '', disabled: running(), onClick: () => { C.cfg.total = x; saveCfg(); render(); } }, `${x} min`)))),
        num('total', 'Ou durée au choix', 1, 60, 'min', 1),
        num('work', 'Travail', 5, 300, 's'),
        num('rest', 'Récupération', 0, 300, 's'),
        num('prep', 'Préparation', 0, 30, 's'))));
});
