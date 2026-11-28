// Outil Test VMA « Léger navette 20 m » (1.12) : la tablette donne les bips, affiche le palier et la vitesse.
// Un toucher sur le prénom (dans une classe) ou sur « Arrêt » (outil libre) note le palier atteint et la VMA.
// Onglet Allures : distance à parcourir selon le % de VMA.
import { app, registerView, go, render, back as navBack } from '../app.js';
import { h, btn, icon, iconBtn, popMenu, toast, confirmDialog } from './dom.js';
import { collator } from '../util.js';
import { studentLabel } from '../data/schema.js';
import { activitiesOf, touchTool } from '../logic/activities.js';
import { helpItem } from './help.js';
import { tone } from './foundations.js';
import { clockText } from './chronoView.js';
import * as VM from '../logic/vma.js';

// Le test en cours vit en mémoire (un test dure < 20 min ; il ne se reprend pas après fermeture).
const T = { startedAt: null, countdown: null, ticker: null, lastLeg: -1, lastStage: 0, lock: null, tab: 'test', vma: 12 };
const keyOf = (r) => (r.scope === 'act' ? null : 'vma:free');
const elapsedS = () => (T.startedAt ? (Date.now() - T.startedAt) / 1000 : 0);
async function keepAwake() { try { if (!T.lock && navigator.wakeLock) T.lock = await navigator.wakeLock.request('screen'); } catch { /* */ } }
const release = () => { try { T.lock?.release?.(); } catch { /* */ } T.lock = null; };

function ctxOf(r) {
  if (r.scope === 'act') {
    const cls = app.repo.get('classes', r.classId);
    const act = cls ? activitiesOf(cls).find((a) => a.id === r.actId) : null;
    if (!act) return null;
    act.vma ??= { results: {} };
    return { cls, act, results: act.vma.results, save: () => { touchTool(act, 'vma'); return app.repo.save('classes', cls); } };
  }
  const st = app.repo.getMeta(keyOf(r), null) || { list: [] };
  return { free: true, st, save: () => app.repo.setMeta(keyOf(r), st) };
}

function tick() {
  if (app.route.name !== 'vma') { stop(false); return; }
  if (T.countdown != null) {
    const left = Math.ceil((T.countdown - Date.now()) / 1000);
    const el = document.querySelector('.vmbig'); if (el && left > 0) el.textContent = String(left);
    if (left <= 0) { T.countdown = null; T.startedAt = Date.now(); T.lastLeg = 0; T.lastStage = 1; tone(1046, 350); render(); }
    return;
  }
  if (!T.startedAt) return;
  const t = elapsedS(), s = VM.stateAt(t);
  if (s.done) { tone(520, 900); stop(false); render(); return; }
  if (s.totalLegs !== T.lastLeg) { // fin d'un aller de 20 m : bip ; changement de palier : 3 bips
    T.lastLeg = s.totalLegs;
    if (s.stage !== T.lastStage) { T.lastStage = s.stage; tone(988, 150); tone(988, 150, 200); tone(1318, 300, 400); render(); return; }
    tone(880, 160);
  }
  const bar = document.querySelector('.vmbar i'); if (bar) bar.style.width = `${Math.min(100, ((t - s.legStart) / (s.legEnd - s.legStart)) * 100)}%`;
  const clk = document.querySelector('.vmclock'); if (clk) { const txt = clockText(t * 1000, false); if (clk.textContent !== txt) clk.textContent = txt; }
  const lg = document.querySelector('.vmleg'); if (lg) { const txt = `Aller ${s.leg + 1} / ${s.legsInStage}`; if (lg.textContent !== txt) lg.textContent = txt; }
}
function stop(clear = true) { clearInterval(T.ticker); T.ticker = null; release(); if (clear) { T.startedAt = null; T.countdown = null; } }

registerView('vma', (r) => {
  const c = ctxOf(r);
  if (!c) { queueMicrotask(() => go('home')); return h('div'); }
  const running = !!T.startedAt || T.countdown != null;
  if (running && !T.ticker) T.ticker = setInterval(tick, 50);
  const s = VM.stateAt(elapsedS());
  const back = async () => { if (running && !(await confirmDialog('Le test est en cours. Quitter l\'arrête.', 'Quitter', { danger: true }))) return; stop(); navBack(() => (r.from === 'classPage' && r.classId ? go('classPage', { id: r.classId }) : go('home'))); };
  const start = () => { tone(660, 120); T.countdown = Date.now() + 3000; T.lastLeg = -1; T.lastStage = 0; keepAwake(); render(); };
  const finish = async () => { if (!(await confirmDialog('Arrêter le test pour tout le monde ?', 'Arrêter', { danger: true }))) return; stop(); render(); };
  const mark = (sid) => { // arrêt d'un élève : palier en cours
    if (!T.startedAt) return toast('Le test n\'a pas commencé.');
    const s = VM.stateAt(elapsedS());
    const res = { stage: s.stage, vma: VM.vmaOf(s.stage), dist: s.totalLegs * VM.LEG_M, date: new Date().toISOString().slice(0, 10) };
    if (c.free) c.st.list.push({ n: c.st.list.length + 1, ...res }); else c.results[sid] = res;
    tone(440, 120); c.save(); render();
  };
  const m = iconBtn('more', 'Options', () => popMenu(m, [
    c.free ? { label: 'Effacer la liste des arrêts', danger: true, disabled: !c.st.list.length, onClick: () => { const snap = c.st.list.slice(); c.st.list = []; c.save(); render(); toast('Liste effacée.', { action: 'Annuler', ms: 8000, onAction: () => { c.st.list = snap; c.save(); render(); } }); } }
      : { label: 'Effacer les résultats de la classe', danger: true, onClick: () => { const snap = { ...c.results }; for (const k of Object.keys(c.results)) delete c.results[k]; c.save(); render(); toast('Résultats effacés.', { action: 'Annuler', ms: 8000, onAction: () => { Object.assign(c.results, snap); c.save(); render(); } }); } },
    helpItem('vma'),
  ]), 'boxed');
  const tabs = h('div', { class: 'seg' }, [['test', 'Test'], ['allures', 'Allures']].map(([k, l]) => h('button', { class: T.tab === k ? 'on' : '', onClick: () => { T.tab = k; render(); } }, l)));
  return h('div', { class: 'main vma' },
    h('div', { class: 'topbar' }, iconBtn('back', 'Retour', back, '', { 'data-back': '1' }),
      h('div', { class: 'grow evtitle' }, h('h1', null, 'Test VMA'), h('div', { class: 'sub' }, `Léger navette 20 m${c.act ? ` · ${c.act.name} · ${c.cls.name}` : ''}`)), tabs, m),
    T.tab === 'allures' ? allures() : h('div', { class: 'vmlayout' }, testPanel(s, running, start, finish), c.free ? freeList(c, mark, running) : classList(c, mark, running)));
});

function testPanel(s, running, start, finish) {
  if (T.countdown != null) return h('section', { class: 'vmpanel' }, h('div', { class: 'vmlbl' }, 'Départ dans'), h('div', { class: 'vmbig' }, String(Math.max(1, Math.ceil((T.countdown - Date.now()) / 1000)))));
  if (!running) return h('section', { class: 'vmpanel' },
    h('div', { class: 'vmlbl' }, 'Palier 1'), h('div', { class: 'vmbig' }, `${VM.fmtKmh(VM.START_KMH)} km/h`),
    h('p', { class: 'muted' }, 'Un bip à chaque aller de 20 m ; trois bips quand on change de palier (+0,5 km/h chaque minute).'),
    btn('Départ', { icon: 'play', cls: 'primary vmgo', onClick: start }));
  return h('section', { class: 'vmpanel run' },
    h('div', { class: 'vmlbl' }, `Palier ${s.stage}`),
    h('div', { class: 'vmbig' }, `${VM.fmtKmh(s.kmh)} km/h`),
    h('div', { class: 'vmbar' }, h('i')),
    h('div', { class: 'vmrow' }, h('span', { class: 'vmleg' }, `Aller ${s.leg + 1} / ${s.legsInStage}`), h('span', { class: 'vmclock' }, clockText(elapsedS() * 1000, false))),
    btn('Arrêter le test', { icon: 'pause', cls: 'vmstop', onClick: finish }));
}

function classList(c, mark, running) {
  const students = c.cls.students.filter((x) => x.active !== false).sort((a, b) => collator.compare(studentLabel(a), studentLabel(b)));
  const inRun = students.filter((x) => !c.results[x.id]);
  const out = students.filter((x) => c.results[x.id]).sort((a, b) => c.results[b.id].stage - c.results[a.id].stage);
  return h('section', { class: 'vmside' },
    h('h3', null, running ? `En course (${inRun.length}) — touchez le prénom à l'arrêt` : `Élèves (${students.length})`),
    h('div', { class: 'vmchips' }, inRun.map((x) => h('button', { type: 'button', class: 'vmchip', disabled: !running, onClick: () => mark(x.id) }, studentLabel(x)))),
    out.length ? [h('h3', null, 'Résultats'), h('div', { class: 'vmres' }, out.map((x) => { const rr = c.results[x.id]; return h('button', { type: 'button', class: 'vmresrow', onClick: (e) => popMenu(e.currentTarget, [{ label: 'Retirer ce résultat', onClick: () => { delete c.results[x.id]; c.save(); render(); } }]) },
      h('b', null, studentLabel(x)), h('span', null, `palier ${rr.stage}`), h('strong', null, `${VM.fmtKmh(rr.vma)} km/h`)); }))] : null);
}

function freeList(c, mark, running) {
  return h('section', { class: 'vmside' },
    btn('Arrêt d\'un élève', { icon: 'plus', cls: 'primary vmarret', disabled: !running, onClick: () => mark() }),
    h('p', { class: 'muted small' }, 'Chaque toucher note le palier atteint. Dans le carnet d\'une classe, on touche directement le prénom.'),
    c.st.list.length ? h('div', { class: 'vmres' }, c.st.list.slice().reverse().map((x) => h('div', { class: 'vmresrow' }, h('b', null, `n° ${x.n}`), h('span', null, `palier ${x.stage}`), h('strong', null, `${VM.fmtKmh(x.vma)} km/h`)))) : null);
}

function allures() {
  const pcts = [60, 70, 80, 90, 100, 110], secs = [[30, '30 s'], [60, '1 min'], [120, '2 min'], [180, '3 min'], [360, '6 min']];
  return h('div', { class: 'scroll grow listpad vmall' },
    h('div', { class: 'ctrow' }, h('span', { class: 'ctl' }, 'VMA'), h('div', { class: 'stepper' },
      h('button', { type: 'button', 'aria-label': 'VMA : moins', disabled: T.vma <= 6, onClick: () => { T.vma -= 0.5; render(); } }, icon('minus', 18)), h('output', null, `${VM.fmtKmh(T.vma)} km/h`),
      h('button', { type: 'button', 'aria-label': 'VMA : plus', disabled: T.vma >= 22, onClick: () => { T.vma += 0.5; render(); } }, icon('plus', 18))), h('span')),
    h('table', { class: 'edit vmtab' }, h('thead', null, h('tr', null, h('th', null, '% VMA'), h('th', null, 'Vitesse'), secs.map(([, l]) => h('th', null, l)))),
      h('tbody', null, pcts.map((p) => h('tr', { class: p === 100 ? 'hl' : '' }, h('th', null, `${p} %`), h('td', null, `${VM.fmtKmh(Math.round(T.vma * p) / 100)} km/h`), secs.map(([sec]) => h('td', null, `${VM.allure(T.vma, p, sec)} m`)))))),
    h('p', { class: 'muted small' }, 'Distances arrondies à 5 m.'));
}
