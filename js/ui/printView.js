// Impression / export PDF : on prépare une page A4 dédiée puis on ouvre l'impression du navigateur
// (sur Android : « Enregistrer au format PDF »).
import { evTitle } from '../logic/activities.js';
import { h } from './dom.js';
import { fmt, fmtDate } from '../util.js';
import { studentLabel, levelInfo } from '../data/schema.js';
import { orderedStudents, groupOf } from '../logic/evaluation.js';
import { studentTotals, getCell, cellState, classStats, getNote } from '../logic/scoring.js';

/** Affiche `node` dans la zone d'impression puis lance l'impression. */
export function printNode(node, { landscape = false } = {}) {
  let root = document.getElementById('print-root');
  if (!root) { root = h('div', { id: 'print-root' }); document.body.append(root); }
  const style = h('style', null, `@page { size: A4 ${landscape ? 'landscape' : 'portrait'}; margin: 10mm; }`);
  root.replaceChildren(style, node);
  document.body.classList.add('printing');
  const done = () => { document.body.classList.remove('printing'); root.replaceChildren(); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  setTimeout(() => window.print(), 60);
}

/** Évaluation complète : tableau élèves × compétences, notes, niveaux, moyenne de classe, remarques. */
export function printEvaluation(ev) {
  const comps = ev.model.competences;
  const list = orderedStudents(ev, { sort: 'list' });
  const stats = classStats(ev);
  const hasNotes = list.some((s) => getNote(ev, s.id));
  const head = h('tr', null, h('th', { class: 'l' }, 'Élève'),
    comps.map((c) => h('th', null, c.name, h('div', null, `/${fmt(c.max)}`))), h('th', null, 'Note', h('div', null, '/20')),
    hasNotes ? h('th', { class: 'l' }, 'Remarque') : null);
  const rows = list.map((s) => {
    const t = studentTotals(ev, s.id);
    const team = groupOf(ev, s.id, 'team');
    return h('tr', null,
      h('td', { class: 'l' }, studentLabel(s), team ? ` (${team.name})` : ''),
      comps.map((c) => {
        const cell = getCell(ev, s.id, c.id);
        if (!t.usable) return h('td', null);
        if (cellState(cell) === 'empty') return h('td', null);
        return h('td', { class: cell.level || '' }, `${fmt(cell.score)} ${cell.level ? levelInfo(cell.level).symbol : ''}`);
      }),
      h('td', null, !t.usable ? { absent: 'Abs.', dispense: 'Disp.', nonEvalue: 'N.É.' }[t.status] : t.final != null ? h('b', null, fmt(t.final)) : t.filled ? `${fmt(t.points)}/${fmt(t.maxFilled)}` : ''),
      hasNotes ? h('td', { class: 'l' }, getNote(ev, s.id)) : null);
  });
  const foot = h('tr', null, h('th', { class: 'l' }, 'Moyenne de classe'),
    comps.map((c) => h('th', null, stats.perComp[c.id].n ? fmt(stats.perComp[c.id].mean) : '–')),
    h('th', null, stats.overall.n ? fmt(stats.overall.mean) : '–'), hasNotes ? h('th') : null);
  printNode(h('div', null,
    h('h1', null, `${ev.classInfo.name} · ${evTitle(ev)}`),
    h('div', { class: 'sub' }, `${ev.model.name} — ${fmtDate(ev.date)} — ✕ non acquis · ≈ en cours · ✓ acquis · ★ dépassé`),
    h('table', null, h('thead', null, head), h('tbody', null, rows), h('tfoot', null, foot))), { landscape: true });
}
