// Page d'une classe : 3 onglets — Carnet de bord · Oublis de matériel · Notes.
import { app, registerView, go, render } from '../app.js';
import { h, btn, iconBtn, popMenu, toast } from './dom.js';
import { hubTab, repairActivities } from './carnet.js';
import { fmt, fmtDate, collator, todayISO, schoolYear } from '../util.js';
import { studentLabel } from '../data/schema.js';
import {
  forgetsOf, forgetCount, addForget, removeForget, forgetColor, getTrimesters, classNotes,
} from '../logic/classes.js';
import { studentSummaryDialog } from './summaryView.js';
import { printNode } from './printView.js';

const P = { tab: 'hub', trim: 'all', onlyMany: false }; // état de la page (conservé entre deux visites)
const settings = () => app.repo.getMeta('settings', {}) || {};
const activeStudents = (cls) => cls.students.filter((s) => s.active !== false);
const saveClass = (cls) => app.repo.save('classes', cls);

// ---------- Page d'une classe ----------

registerView('classPage', ({ id }) => {
  const cls = app.repo.get('classes', id);
  if (!cls || cls.deleted) { queueMicrotask(() => go('home')); return h('div'); }
  const more = iconBtn('more', 'Options de la classe', () => popMenu(more, [
    { label: 'Modifier la classe et ses élèves…', onClick: () => go('classEdit', { id: cls.id, from: 'classPage' }) },
  ]), 'boxed');
  repairActivities(cls);
  const tabs = [['hub', 'Carnet de bord'], ['forgets', 'Oublis de matériel'], ['notes', 'Notes']];
  return h('div', { class: 'main' },
    h('div', { class: 'topbar' },
      iconBtn('back', 'Retour', () => go('home'), '', { 'data-back': '1' }),
      h('div', { class: 'grow evtitle' }, h('h1', null, cls.name),
        h('div', { class: 'sub' }, `${cls.level}${cls.year ? ' · ' + cls.year : ''} — ${activeStudents(cls).length} élèves`)),
      more),
    h('div', { class: 'toolbar' }, h('div', { class: 'seg' }, tabs.map(([k, l]) => h('button', { class: P.tab === k ? 'on' : '', onClick: () => { P.tab = k; render(); } }, l))),
      P.tab === 'notes' ? notesToolbar(cls) : null),
    P.tab === 'hub' ? hubTab(cls) : P.tab === 'forgets' ? forgetsTab(cls) : notesTab(cls));
});

// ---------- Onglet Notes ----------

function currentTrim(cls) {
  if (P.trim === 'all') return null;
  return getTrimesters(settings(), cls.year || schoolYear())[Number(P.trim)] || null;
}

function notesToolbar(cls) {
  const trims = getTrimesters(settings(), cls.year || schoolYear());
  return [
    h('select', { 'aria-label': 'Période', value: P.trim, onChange: (e) => { P.trim = e.target.value; render(); } },
      h('option', { value: 'all' }, 'Année entière'),
      trims.map((t, i) => h('option', { value: String(i) }, `Trimestre ${i + 1} (${fmtDate(t.start)} → ${fmtDate(t.end)})`))),
    btn('Imprimer / PDF', { icon: 'file', cls: 'small', onClick: () => printNotes(cls) }),
  ];
}

const cellText = (c) => {
  if (!c) return { t: '—', cls: 'na-cell' };
  if (c.status !== 'present') return { t: { absent: 'Abs.', dispense: 'Disp.', nonEvalue: 'N.É.' }[c.status], cls: 'st-cell' };
  if (c.final != null) return { t: fmt(c.final), cls: '' };
  if (c.filled) return { t: `${fmt(c.points)}/${fmt(c.maxFilled)}`, cls: 'part-cell' };
  return { t: '', cls: '' };
};

function notesTable(cls, forPrint = false) {
  const data = classNotes(app.repo.list('evaluations'), cls, { trim: currentTrim(cls) });
  if (!data.evals.length) return { data, el: null };
  const head = h('tr', null, h('th', { class: `sticky ${forPrint ? 'l' : ''}` }, h('div', { style: forPrint ? {} : { padding: '0 12px' } }, 'Élève')),
    data.evals.map((ev) => h('th', { title: forPrint ? '' : 'Ouvrir cette évaluation' },
      forPrint ? [h('b', null, ev.model.activity), h('div', null, fmtDate(ev.date))]
        : h('button', { type: 'button', class: 'colbtn', onClick: () => go('eval', { id: ev.id, from: 'classPage', classId: cls.id }) }, h('div', { class: 'cn' }, ev.model.activity), h('div', { class: 'cm' }, fmtDate(ev.date))))),
    h('th', { class: 'totalh' }, h('div', { class: 'cn' }, 'Moyenne'), h('div', { class: 'cm' }, '/20')));
  const rows = data.rows.map((r) => h('tr', { class: r.former ? 'inactive' : '' },
    h('th', { class: 'sticky l', scope: 'row' }, forPrint ? studentLabel(r.student) + (r.former ? ' (parti)' : '')
      : h('div', { class: 'namecell' }, h('button', { type: 'button', class: 'nm', title: 'Résumé de l\'année', onClick: () => studentSummaryDialog(r.student.id, data.evals.at(-1)) },
        studentLabel(r.student), r.former ? h('span', { class: 'tag' }, 'parti') : null))),
    r.cells.map((c) => { const x = cellText(c); return h('td', { class: `ncell ${x.cls}` }, x.t); }),
    h('td', { class: 'total' }, r.mean != null ? h('b', null, fmt(r.mean, 2)) : '–')));
  const foot = h('tr', null, h('th', { class: 'sticky l' }, h('div', { style: forPrint ? {} : { padding: '0 6px' } }, 'Moyenne de classe')),
    data.colMeans.map((m) => h('td', null, m != null ? h('b', null, fmt(m, 2)) : '–')), h('td', null, data.overall != null ? h('b', null, fmt(data.overall, 2)) : '–'));
  return { data, el: h('table', { class: 'grid notes' }, h('thead', null, head), h('tbody', null, rows), h('tfoot', null, foot)) };
}

function notesTab(cls) {
  const { el } = notesTable(cls);
  return h('div', { class: 'tablewrap', 'data-keep': 'classnotes' }, el || h('div', { class: 'empty' },
    h('h2', null, 'Aucune évaluation'),
    h('p', null, P.trim === 'all' ? 'Les évaluations de cette classe apparaîtront ici, une colonne par évaluation.' : 'Aucune évaluation de cette classe sur cette période.')));
}

function printNotes(cls) {
  const { data, el } = notesTable(cls, true);
  if (!el) return toast('Aucune évaluation à imprimer.');
  const t = currentTrim(cls);
  printNode(h('div', null, h('h1', null, `${cls.name} — notes finales`),
    h('div', { class: 'sub' }, `${cls.year || ''} · ${t ? `${fmtDate(t.start)} → ${fmtDate(t.end)}` : 'année entière'} · ${data.evals.length} évaluation(s)`), el), { landscape: true });
}

// ---------- Onglet Oublis de matériel ----------

function forgetsTab(cls) {
  const list = activeStudents(cls);
  const total = list.reduce((a, s) => a + forgetCount(cls, s.id), 0);
  const shown = P.onlyMany ? list.filter((s) => forgetCount(cls, s.id) >= 3) : list;
  const change = (s, delta) => { // affichage immédiat (aucun appui perdu en tapant vite), enregistrement ensuite
    if (delta > 0) addForget(cls, s.id, todayISO());
    else if (!removeForget(cls, s.id)) return;
    render();
    saveClass(cls);
  };
  const row = (s) => {
    const l = forgetsOf(cls, s.id);
    return h('div', { class: 'forgetrow' },
      h('span', { class: 'fname' }, studentLabel(s)),
      h('div', { class: 'crosses', 'aria-label': `${l.length} oubli${l.length > 1 ? 's' : ''}` }, l.length
        ? l.map((d, i) => h('span', { class: `xmark ${forgetColor(i)}`, title: fmtDate(d) }, '✕'))
        : h('span', { class: 'muted small' }, 'aucun')),
      h('span', { class: `fcount ${l.length ? forgetColor(l.length - 1) : ''}` }, l.length || ''),
      iconBtn('minus', `Retirer un oubli à ${s.first}`, () => change(s, -1), 'boxed fbtn', { disabled: !l.length }),
      iconBtn('plus', `Ajouter un oubli à ${s.first}`, () => change(s, 1), 'boxed fbtn primaryish'),
      h('span', { class: 'muted small flast' }, l.length ? `dernier : ${fmtDate(l.at(-1))}` : ''));
  };
  return h('div', { class: 'forgets scroll', 'data-keep': 'forgets' },
    h('div', { class: 'row wrap forgethead' },
      h('span', { class: 'muted' }, `${total} oubli${total > 1 ? 's' : ''} depuis le début de l'année · ${cls.year || ''}`),
      h('div', { class: 'grow' }),
      h('span', { class: 'legend' }, h('span', { class: 'xmark y' }, '✕'), '1-2 ', h('span', { class: 'xmark o' }, '✕'), '3 ', h('span', { class: 'xmark r' }, '✕'), '4 et +'),
      h('button', { type: 'button', class: `toplace ${P.onlyMany ? 'on' : ''}`, onClick: () => { P.onlyMany = !P.onlyMany; render(); } }, '3 croix et +')),
    shown.length ? shown.map(row) : h('div', { class: 'empty' }, list.length ? 'Aucun élève à 3 croix ou plus.' : 'Cette classe n\'a pas encore d\'élèves.'));
}
