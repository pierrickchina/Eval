// Historique individuel d'un élève : évaluations, niveaux, notes, évolution par activité.
import { app } from '../app.js';
import { h, openDialog } from './dom.js';
import { fmt, fmtDate, collator } from '../util.js';
import { studentHistory, currentStudent } from '../logic/evaluation.js';
import { studentLabel, levelInfo } from '../data/schema.js';

const SVGNS = 'http://www.w3.org/2000/svg';
const s = (tag, attrs = {}, text) => {
  const el = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (text != null) el.textContent = text;
  return el;
};

export function studentHistoryDialog(sid, fromEv) {
  const repo = app.repo;
  const evals = repo.list('evaluations');
  const rows = studentHistory(evals, sid);
  const cur = currentStudent(repo.list('classes'), fromEv || rows.at(-1)?.ev || { students: [] }, sid);
  const name = cur ? studentLabel(cur) : 'Élève';
  const activities = [...new Set(rows.map((r) => r.activity))].sort(collator.compare);
  const st = { act: '' };
  const body = h('div', { class: 'dlg-body', style: { padding: 0 } });

  const paint = () => {
    const shown = rows.filter((r) => !st.act || r.activity === st.act);
    body.replaceChildren(
      h('div', { class: 'row wrap' },
        h('label', { class: 'field', style: { minWidth: '240px' } }, 'Activité',
          h('select', { value: st.act, onChange: (e) => { st.act = e.target.value; paint(); } },
            h('option', { value: '' }, 'Toutes les activités'), activities.map((a) => h('option', { value: a }, a)))),
        h('span', { class: 'muted small' }, `${shown.length} évaluation${shown.length > 1 ? 's' : ''}`)),
      shown.length ? chart(shown) : h('p', { class: 'muted' }, 'Aucune évaluation pour cet élève.'),
      shown.length ? table(shown) : null);
  };
  openDialog({ title: `Historique — ${name}`, body, wide: true, actions: [{ label: 'Fermer', primary: true }] });
  paint();
}

function table(rows) {
  return h('div', { style: { overflow: 'auto' } }, h('table', { class: 'hist' },
    h('thead', null, h('tr', null, ['Date', 'Activité', 'Classe', 'Compétences (niveau · note)', 'Note'].map((t) => h('th', null, t)))),
    h('tbody', null, [...rows].reverse().map((r) => h('tr', null,
      h('td', null, fmtDate(r.date)),
      h('td', null, r.activity),
      h('td', null, r.className),
      h('td', null, h('div', { class: 'row wrap', style: { gap: '6px' } }, r.comps.map(({ comp, cell }) => {
        const lv = cell?.level ? levelInfo(cell.level) : null;
        return h('span', { class: `lvchip ${cell?.score != null ? cell.level || 'none' : 'none'}`, title: `${comp.name}${lv ? ' — ' + lv.label : ''}` },
          cell?.score != null ? `${fmt(cell.score)}/${fmt(comp.max)} ${lv?.symbol || ''}` : '–');
      }))),
      h('td', null, r.totals.status !== 'present'
        ? h('span', { class: 'tag' }, { absent: 'ABS', dispense: 'DISP', nonEvalue: 'N.É.' }[r.totals.status])
        : r.totals.final != null ? h('b', null, `${fmt(r.totals.final)}/20`)
          : r.totals.filled ? h('span', { class: 'muted' }, `${fmt(r.totals.points)}/${fmt(r.totals.maxFilled)}`) : '–'))))));
}

function chart(rows) {
  const pts = rows.filter((r) => r.totals.status === 'present' && r.totals.final != null);
  const W = 640, H = 200, L = 36, R = 14, T = 14, B = 28;
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Évolution des notes sur 20' });
  for (const v of [0, 5, 10, 15, 20]) {
    const y = T + (1 - v / 20) * (H - T - B);
    svg.append(s('line', { x1: L, x2: W - R, y1: y, y2: y, stroke: '#e3e0ef' }), s('text', { x: L - 6, y: y + 4, 'text-anchor': 'end', 'font-size': 11, fill: '#7a7f94' }, v));
  }
  if (pts.length < 1) {
    svg.append(s('text', { x: W / 2, y: H / 2, 'text-anchor': 'middle', fill: '#7a7f94', 'font-size': 13 }, 'Pas encore de note finale complète'));
  } else {
    const xs = (i) => (pts.length === 1 ? (L + W - R) / 2 : L + 20 + (i / (pts.length - 1)) * (W - L - R - 40));
    const ys = (v) => T + (1 - v / 20) * (H - T - B);
    svg.append(s('polyline', { points: pts.map((p, i) => `${xs(i)},${ys(p.totals.final)}`).join(' '), fill: 'none', stroke: '#8e9cf0', 'stroke-width': 3, 'stroke-linejoin': 'round' }));
    pts.forEach((p, i) => {
      const c = s('circle', { cx: xs(i), cy: ys(p.totals.final), r: 6, fill: '#fff', stroke: '#8e9cf0', 'stroke-width': 3 });
      c.append(s('title', {}, `${fmtDate(p.date)} · ${p.activity} : ${fmt(p.totals.final)}/20`));
      svg.append(c, s('text', { x: xs(i), y: ys(p.totals.final) - 11, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 700, fill: '#232a7a' }, fmt(p.totals.final)));
      if (pts.length <= 8 || i % Math.ceil(pts.length / 8) === 0) {
        svg.append(s('text', { x: xs(i), y: H - 8, 'text-anchor': 'middle', 'font-size': 10, fill: '#7a7f94' }, fmtDate(p.date).replace(/ \d{4}$/, '')));
      }
    });
  }
  return h('div', { class: 'charts' }, svg);
}
