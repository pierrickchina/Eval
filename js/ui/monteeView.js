// Outil Montée de niveau (tennis de table) : glisser-déposer des prénoms sur 10 niveaux ; toute l'échelle tient sur l'écran.
import { app, registerView, go, render } from '../app.js';
import { h, btn, iconBtn, openDialog, popMenu, toast } from './dom.js';
import { collator, clone } from '../util.js';
import { studentLabel } from '../data/schema.js';
import { activitiesOf, touchTool } from '../logic/activities.js';
import { helpItem } from './help.js';
import { attachDrag } from './drag.js';
import { buzz } from './foundations.js';
import * as MT from '../logic/montee.js';

registerView('montee', (r) => {
  const cls = app.repo.get('classes', r.classId);
  const act = cls ? activitiesOf(cls).find((a) => a.id === r.actId) : null;
  if (!act) { queueMicrotask(() => go('home')); return h('div'); }
  const M = MT.monteeOf(act);
  const students = cls.students.filter((s) => s.active !== false).sort((a, b) => collator.compare(studentLabel(a), studentLabel(b)));
  const save = () => { touchTool(act, 'montee'); return app.repo.save('classes', cls); };
  const apply = (fn) => { fn(); buzz('tap'); render(); save(); };
  const crit = MT.criteria(M);
  const place = MT.placeOf(M);
  const w = MT.weights(M, students.map((s) => s.id));
  const chip = (s) => h('div', { class: 'mtchip', 'data-sid': s.id, role: 'button', tabindex: 0 }, studentLabel(s));
  const unplaced = students.filter((s) => !place[s.id]);
  const rows = [];
  for (let lv = 10; lv >= 1; lv--) {
    const here = students.filter((s) => place[s.id] === lv);
    rows.push(h('div', { class: `mtrow ${here.length ? '' : 'empty'}`, 'data-zone': String(lv), style: { flexGrow: w[lv - 1] || 0, '--lc': MT.LEVEL_COLORS[lv - 1] } },
      h('div', { class: 'mtnum' }, String(lv)),
      h('div', { class: 'mtcrit' }, crit[lv - 1] || h('span', { class: 'muted' }, '—')),
      h('div', { class: 'mtkids' }, here.map(chip))));
  }
  const m = iconBtn('more', 'Options', () => popMenu(m, [
    ...MT.MONTEE_SHEETS.map((x) => ({ label: x.name, active: M.sheet === x.id, onClick: () => apply(() => { M.sheet = x.id; }) })),
    '-',
    { label: 'Modifier les défis de cette fiche…', onClick: () => critDialog(M, () => { render(); save(); }) },
    { label: 'Tout le monde au niveau 1', onClick: () => { const snap = clone(place); apply(() => { for (const s of students) place[s.id] = 1; }); toast('Tous au niveau 1.', { action: 'Annuler', ms: 8000, onAction: () => apply(() => { M.place[M.sheet] = snap; }) }); } },
    { label: 'Tout retirer de l\'échelle', danger: true, onClick: () => { const snap = clone(place); apply(() => { M.place[M.sheet] = {}; }); toast('Échelle vidée.', { action: 'Annuler', ms: 8000, onAction: () => apply(() => { M.place[M.sheet] = snap; }) }); } },
    helpItem('montee'),
  ]), 'boxed');
  const sheet = MT.MONTEE_SHEETS.find((x) => x.id === M.sheet);
  const root = h('div', { class: 'main montee' },
    h('div', { class: 'topbar' }, iconBtn('back', 'Retour', () => (r.from === 'classPage' ? go('classPage', { id: cls.id }) : go('home')), '', { 'data-back': '1' }),
      h('div', { class: 'grow evtitle' }, h('h1', null, 'Montée de niveau'), h('div', { class: 'sub' }, `${act.name} · ${cls.name} · ${sheet?.name || ''}`)), m),
    unplaced.length ? h('div', { class: 'mtpool', 'data-zone': '0' }, h('b', null, `À placer (${unplaced.length})`), unplaced.map(chip)) : h('div', { class: 'mtpool slim', 'data-zone': '0' }, h('span', { class: 'muted small' }, 'Glissez un élève ici pour le retirer de l\'échelle')),
    h('div', { class: 'mtladder' }, rows));
  attachDrag(root, (sid, zone) => apply(() => MT.setLevel(M, sid, Number(zone))), (sid, el) => {
    const lv = place[sid] || 0;
    popMenu(el, [
      { label: '↑ Monter d\'un niveau', disabled: lv >= 10, onClick: () => apply(() => MT.setLevel(M, sid, lv + 1)) },
      { label: '↓ Descendre d\'un niveau', disabled: lv <= 1, onClick: () => apply(() => MT.setLevel(M, sid, lv - 1)) },
      '-',
      ...[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((n) => ({ label: `Niveau ${n}`, active: lv === n, onClick: () => apply(() => MT.setLevel(M, sid, n)) })),
      lv ? { label: 'Retirer de l\'échelle', onClick: () => apply(() => MT.setLevel(M, sid, 0)) } : null,
    ].filter(Boolean));
  }, { chip: '.mtchip', key: 'sid' });
  return root;
});

function critDialog(M, done) {
  const list = MT.criteria(M).slice();
  const body = h('div', { class: 'dlg-body' }, [10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((n) => h('div', { class: 'listrow' }, h('b', { style: { width: '2em' } }, String(n)),
    h('input', { type: 'text', value: list[n - 1], style: { flex: 1 }, onChange: (e) => { list[n - 1] = e.target.value; } }))));
  openDialog({ title: 'Défis de la fiche', body, wide: true, actions: [
    { label: 'Fiche d\'origine', onClick: () => { delete M.sheets[M.sheet]; done(); } },
    { label: 'Enregistrer', primary: true, onClick: () => { M.sheets[M.sheet] = list; done(); } }] });
}
