// Page d'une classe : Carnet de bord · Séance du jour · Oublis de matériel · Notes · Résultats.
import { resultsTab } from './suiviView.js';
import { app, registerView, go, render , back as navBack } from '../app.js';
import { h, btn, iconBtn, popMenu, toast, download } from './dom.js';
import { studentTotals } from '../logic/scoring.js';
import { hubTab, repairActivities, newActivityDialog } from './carnet.js';
import { todayTab } from './todayView.js';
import { evTitle } from '../logic/activities.js';
import { fmt, fmtDate, collator, todayISO, schoolYear } from '../util.js';
import { studentLabel } from '../data/schema.js';
import {
  forgetsOf, forgetCount, addForget, removeForget, forgetColor, getTrimesters, classNotes,
} from '../logic/classes.js';
import { studentSummaryDialog } from './summaryView.js';
import { printNode } from './printView.js';

const P = { cls: null, tab: 'hub', trim: 'all', sort: 'list', onlyMany: false }; // état de la page (conservé entre deux visites)
const settings = () => app.repo.getMeta('settings', {}) || {};
const activeStudents = (cls) => cls.students.filter((s) => s.active !== false);
const saveClass = (cls) => app.repo.save('classes', cls);

// ---------- Page d'une classe ----------

registerView('classPage', (r) => {
  const { id } = r;
  const cls = app.repo.get('classes', id);
  if (!cls || cls.deleted) { queueMicrotask(() => go('home')); return h('div'); }
  const more = iconBtn('more', 'Options de la classe', () => popMenu(more, [
    { label: 'Modifier la classe et ses élèves…', onClick: () => go('classEdit', { id: cls.id, from: 'classPage' }) },
    { label: 'Exporter les notes (tableur CSV)', onClick: () => exportNotes(cls) },
  ]), 'boxed');
  if (P.cls !== id) { P.cls = id; P.tab = 'hub'; }
  if (r.tab) { P.tab = r.tab; delete r.tab; } // ouverture directe d'un onglet (ex. Résultats depuis le Test VMA) // l'onglet est mémorisé dans la classe, pas d'une classe à l'autre
  repairActivities(cls);
  const tabs = [['hub', 'Carnet de bord'], ['today', 'Séance du jour'], ['forgets', 'Oublis'], ['notes', 'Notes'], ['results', 'Résultats']];
  return h('div', { class: 'main' },
    h('div', { class: 'topbar' },
      iconBtn('back', 'Retour', () => navBack(), '', { 'data-back': '1' }),
      h('div', { class: 'grow evtitle' }, h('h1', null, cls.name),
        h('div', { class: 'sub' }, `${cls.level}${cls.year ? ' · ' + cls.year : ''} — ${activeStudents(cls).length} élèves`)),
      more),
    h('div', { class: 'toolbar' }, h('div', { class: 'seg' }, tabs.map(([k, l]) => h('button', { class: P.tab === k ? 'on' : '', onClick: () => { P.tab = k; render(); } }, l))),
      P.tab === 'hub' ? btn('Nouvelle activité', { icon: 'plus', cls: 'primary', onClick: () => newActivityDialog(cls) }) : null,
      P.tab === 'notes' ? notesToolbar(cls) : null,
      P.tab === 'forgets' ? forgetsToolbar(cls) : null),
    P.tab === 'hub' ? hubTab(cls) : P.tab === 'today' ? todayTab(cls) : P.tab === 'forgets' ? forgetsTab(cls) : P.tab === 'results' ? resultsTab(cls) : notesTab(cls));
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
    h('select', { 'aria-label': 'Tri des élèves', value: P.sort, onChange: (e) => { P.sort = e.target.value; render(); } },
      h('option', { value: 'list' }, 'Élèves : ordre de la liste'), h('option', { value: 'alpha' }, 'Élèves : A → Z'),
      h('option', { value: 'mean' }, 'Élèves : meilleure moyenne')),
    btn('PDF', { icon: 'file', cls: 'small', title: 'Imprimer / PDF', onClick: () => printNotes(cls) }),
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
  if (P.sort === 'alpha') data.rows.sort((a, b) => collator.compare(studentLabel(a.student), studentLabel(b.student)));
  else if (P.sort === 'mean') data.rows.sort((a, b) => (b.mean ?? -1) - (a.mean ?? -1) || collator.compare(studentLabel(a.student), studentLabel(b.student)));
  const head = h('tr', null, h('th', { class: `sticky ${forPrint ? 'l' : ''}` }, h('div', { style: forPrint ? {} : { padding: '0 12px' } }, 'Élève')),
    data.evals.map((ev) => h('th', { title: forPrint ? '' : 'Ouvrir cette évaluation' },
      forPrint ? [h('b', null, evTitle(ev)), h('div', null, fmtDate(ev.date))]
        : h('button', { type: 'button', class: 'colbtn', onClick: () => go('eval', { id: ev.id, from: 'classPage', classId: cls.id }) }, h('div', { class: 'cn' }, evTitle(ev)), h('div', { class: 'cm' }, fmtDate(ev.date))))),
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

/** À la suite des onglets : total de l'année, légende des couleurs, filtre « 3 croix et + ». */
function forgetsToolbar(cls) {
  const total = activeStudents(cls).reduce((a, s) => a + forgetCount(cls, s.id), 0);
  return [
    h('span', { class: 'muted' }, `${total} oubli${total > 1 ? 's' : ''} depuis le début de l'année`),
    h('span', { class: 'legend' }, h('span', { class: 'xmark y' }, '✕'), '1-2 ', h('span', { class: 'xmark o' }, '✕'), '3 ', h('span', { class: 'xmark r' }, '✕'), '4 et +'),
    h('button', { type: 'button', class: `toplace ${P.onlyMany ? 'on' : ''}`, onClick: () => { P.onlyMany = !P.onlyMany; render(); } }, '3 croix et +'),
  ];
}

function forgetsTab(cls) {
  const list = activeStudents(cls);
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
      h('span', { class: `fcount ${l.length ? forgetColor(l.length - 1) : ''}` }, l.length ? String(l.length) : '0'),
      h('div', { class: 'crosses', style: { '--xs': `${l.length <= 5 ? 22 : l.length <= 8 ? 17 : l.length <= 12 ? 13 : 10}px` }, 'aria-label': `${l.length} oubli${l.length > 1 ? 's' : ''}` }, l.length
        ? l.map((d, i) => h('span', { class: `xmark ${forgetColor(i)}`, title: fmtDate(d) }, '✕'))
        : h('span', { class: 'muted small' }, 'aucun')),
      iconBtn('minus', `Retirer un oubli à ${s.first}`, () => change(s, -1), 'boxed fbtn', { disabled: !l.length }),
      iconBtn('plus', `Ajouter un oubli à ${s.first}`, () => change(s, 1), 'boxed fbtn primaryish'),
      h('span', { class: 'muted small flast' }, l.length ? `dernier : ${fmtDate(l.at(-1))}` : ''));
  };
  // toute la classe sur une page : plusieurs colonnes et lignes resserrées quand il y a beaucoup d'élèves
  const density = shown.length > 24 ? 'dense2' : shown.length > 12 ? 'dense' : '';
  return h('div', { class: `forgets scroll ${density}`, 'data-keep': 'forgets' },
    shown.length ? shown.map(row) : h('div', { class: 'empty' }, list.length ? 'Aucun élève à 3 croix ou plus.' : 'Cette classe n\'a pas encore d\'élèves.'));
}

// ---------- Export des notes (1.13) : un tableur, une ligne par élève, une colonne par évaluation (note sur 20) ----------
function exportNotes(cls) {
  const evs = app.repo.list('evaluations').filter((e) => e.classId === cls.id && !e.deleted).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  if (!evs.length) return toast('Aucune évaluation dans cette classe.');
  const students = activeStudents(cls).slice().sort((a, b) => collator.compare(studentLabel(a), studentLabel(b)));
  const q = (x) => `"${String(x ?? '').replace(/"/g, '""')}"`;
  const num = (v) => (v == null ? '' : String(Math.round(v * 100) / 100).replace('.', ','));
  const head = ['Élève', ...evs.map((e) => evTitle(e))];
  const rows = students.map((s) => [studentLabel(s), ...evs.map((e) => { const t = studentTotals(e, s.id); return t.status !== 'present' ? (t.status === 'absent' ? 'ABS' : 'DISP') : t.noScore ? '' : num(t.final ?? t.provisional); })]);
  const csv = '\ufeff' + [head, ...rows].map((r) => r.map(q).join(';')).join('\r\n');
  download(`notes-${cls.name.replace(/\s+/g, '-')}.csv`, csv, 'text/csv;charset=utf-8');
  toast('Notes exportées (séparateur « ; », s\'ouvre dans Sheets ou Excel).');
}
