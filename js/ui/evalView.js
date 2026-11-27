// Écran d'une évaluation : tableau général, saisie rapide, fiche élève, groupes, statuts.
import { evTitle } from '../logic/activities.js';
import { app, registerView, go, render, syncChip } from '../app.js';
import { h, btn, icon, iconBtn, openDialog, popMenu, toast, hasDialog, confirmDialog } from './dom.js';
import { fmt, fmtDate, parseNum, todayISO } from '../util.js';
import { LEVELS, STATUSES, levelInfo, studentLabel, newStudent } from '../data/schema.js';
import {
  setLevel, setScore, validateCell, clearCell, setStatus, studentTotals, classStats, getCell, cellState,
  addObs, removeObs, obsCounts, toPlaceCount, getNote, setNote,
} from '../logic/scoring.js';
import {
  orderedStudents, addGroup, removeGroup, assignGroup, groupOf, addStudentToEvaluation, removeStudentFromEvaluation,
} from '../logic/evaluation.js';
import { EvalSession } from '../logic/history.js';
import { studentHistoryDialog } from './historyView.js';
import { duplicateDialog } from './home.js';
import { studentSummaryDialog } from './summaryView.js';
import { printEvaluation } from './printView.js';
import { startSelfEval } from './selfEval.js';
import { selfCell, selfTotals, selfDone, reopenSelf } from '../logic/selfeval.js';

let V = null; // état de l'évaluation ouverte

function open(id) {
  const ev = app.repo.get('evaluations', id);
  if (!ev || ev.deleted) return null;
  if (!V || V.id !== id || V.ev !== ev) {
    V = {
      id, ev, mode: 'table', sid: null, sel: null,
      sort: 'list', dir: 'desc', key: 'total', filter: null, toPlace: false,
      sess: new EvalSession(ev, { onChange: (e) => app.repo.save('evaluations', e) }),
    };
  }
  return V;
}

const act = (label, fn) => { const changed = V.sess.do(label, fn); if (changed) render(); return changed; };
const statusInfo = (k) => STATUSES.find((s) => s.key === k);
const opts = () => app.repo.getMeta('settings', {}) || {};

function undo() {
  const l = V.sess.undo();
  if (l) { render(); toast(`Annulé : ${l}`, { ms: 1800 }); }
}
function redo() {
  const l = V.sess.redo();
  if (l) { render(); toast(`Rétabli : ${l}`, { ms: 1800 }); }
}

window.addEventListener('keydown', (e) => {
  if (app.route.name !== 'eval' || !V || hasDialog()) return;
  if (e.target.matches?.('input, textarea, select')) return;
  const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
  if (mod && k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
  else if (mod && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
});

registerView('eval', ({ id }) => {
  const v = open(id);
  if (!v) { queueMicrotask(() => go('home')); return h('div'); }
  return h('div', { class: 'main' }, topbar(), v.mode === 'student' ? studentMode() : tableMode());
});

// ---------- Barre supérieure ----------

function topbar() {
  const ev = V.ev;
  // Options rarement utilisées : regroupées derrière un seul bouton « ⋮ » pour garder la page lisible
  const more = iconBtn('more', 'Options de l\'évaluation', () => popMenu(more, [
    { label: 'Nom de l\'évaluation…', onClick: titleDialog },
    { label: `Date : ${fmtDate(ev.date)}…`, onClick: dateDialog },
    { label: 'Équipes et groupes de niveau…', onClick: groupsDialog },
    { label: 'Ajouter un élève…', onClick: addStudentDialog },
    { label: 'Dupliquer…', onClick: () => duplicateDialog(ev) },
    { label: 'Imprimer / exporter en PDF', onClick: () => printEvaluation(ev) },
    '-',
    { label: 'Auto-évaluation des élèves…', onClick: () => startSelfEval(ev) },
    '-',
    { label: 'Supprimer l\'évaluation…', danger: true, onClick: deleteThis },
  ]), 'boxed');
  return h('div', { class: 'topbar' },
    iconBtn('back', 'Retour', () => { V.sel = null; const r = app.route; if (r.from === 'classPage' && r.classId) go('classPage', { id: r.classId }); else go('home'); }, '', { 'data-back': '1' }),
    h('div', { class: 'grow evtitle' },
      h('h1', null, `${ev.classInfo.name} · ${evTitle(ev)}`),
      h('div', { class: 'sub' }, `${ev.model.name} — ${ev.students.length} élèves — ${fmtDate(ev.date)}`)),
    iconBtn('undo', V.sess.canUndo ? `Annuler : ${V.sess.undoLabel}` : 'Annuler', undo, 'boxed', { disabled: !V.sess.canUndo }),
    iconBtn('redo', V.sess.canRedo ? `Rétablir : ${V.sess.redoLabel}` : 'Rétablir', redo, 'boxed', { disabled: !V.sess.canRedo }),
    more);
}

function titleDialog() {
  let t = V.ev.title || '';
  openDialog({ title: 'Nom de l\'évaluation',
    body: h('label', { class: 'field' }, 'Nom (vide = nom de l\'activité)', h('input', { type: 'text', value: t, placeholder: V.ev.model.activity, autofocus: true, onInput: (e) => { t = e.target.value; } })),
    actions: [{ label: 'Annuler' }, { label: 'Enregistrer', primary: true, onClick: () => { act('Nom', (x) => { x.title = t.trim(); }); } }] });
}

async function deleteThis() {
  const ev = V.ev;
  const ok = await confirmDialog(`Supprimer l'évaluation « ${evTitle(ev)} » du ${fmtDate(ev.date)} et tous ses résultats ? Cette action est définitive.`, 'Supprimer', { danger: true });
  if (!ok) return;
  await app.repo.remove('evaluations', ev.id);
  V.sel = null;
  const r = app.route;
  if (r.from === 'classPage' && r.classId) go('classPage', { id: r.classId }); else go('home');
}

function dateDialog() {
  let d = V.ev.date;
  openDialog({ title: 'Date de l\'évaluation', body: h('input', { type: 'date', value: d, 'aria-label': 'Date', onChange: (e) => { d = e.target.value || todayISO(); } }),
    actions: [{ label: 'Annuler' }, { label: 'Enregistrer', primary: true, onClick: () => { act('Date', (x) => { x.date = d; }); } }] });
}

// ---------- Tableau général ----------

function tableMode() {
  const ev = V.ev;
  const comps = ev.model.competences;
  const all = orderedStudents(ev, { sort: V.sort, dir: V.dir, filter: V.filter, key: V.key });
  const toPlaceN = all.filter((x) => toPlaceCount(ev, x.id) > 0).length;
  if (V.toPlace && !toPlaceN) V.toPlace = false;
  const list = V.toPlace ? all.filter((x) => toPlaceCount(ev, x.id) > 0) : all;
  const stats = classStats(ev);

  const sorts = [['list', 'Liste'], ['alpha', 'A → Z'], ['teams', 'Équipes'], ['levels', 'Niveaux'], ['results', 'Résultats']];
  const toolbar = h('div', { class: 'toolbar' },
    h('div', { class: 'seg' }, sorts.map(([k, l]) => h('button', { class: V.sort === k ? 'on' : '', onClick: () => { V.sort = k; render(); } }, l))),
    V.sort === 'results' ? [
      h('select', { 'aria-label': 'Trier selon', value: V.key, onChange: (e) => { V.key = e.target.value; render(); } },
        h('option', { value: 'total' }, 'Note globale'), comps.map((c) => h('option', { value: c.id }, c.name))),
      iconBtn(V.dir === 'desc' ? 'down' : 'up', V.dir === 'desc' ? 'Du plus haut au plus bas' : 'Du plus bas au plus haut', () => { V.dir = V.dir === 'desc' ? 'asc' : 'desc'; render(); }, 'boxed'),
    ] : null,
    ev.groups.length ? h('select', { 'aria-label': 'Filtrer', value: V.filter ? `${V.filter.type}:${V.filter.id}` : '', onChange: (e) => {
      const [t, i] = e.target.value.split(':'); V.filter = t ? { type: t, id: i } : null; render(); } },
    h('option', { value: '' }, 'Tous les élèves'),
    ['team', 'level'].map((type) => ev.groups.some((g) => g.type === type) ? h('optgroup', { label: type === 'team' ? 'Équipes' : 'Groupes de niveau' },
      ev.groups.filter((g) => g.type === type).map((g) => h('option', { value: `${type}:${g.id}` }, g.name))) : null)) : null,
    toPlaceN || V.toPlace ? h('button', { type: 'button', class: `toplace ${V.toPlace ? 'on' : ''}`, title: 'Élèves ayant des observations brouillon mais sans degré',
      onClick: () => { V.toPlace = !V.toPlace; render(); } }, `✎ À placer (${toPlaceN})`) : null,
    h('span', { class: 'muted small' }, V.filter || V.toPlace ? `${list.length} / ${ev.students.length} élèves` : ''));

  const head = h('tr', null,
    h('th', { class: 'sticky' }, h('div', { style: { padding: '0 12px' } }, 'Élève')),
    comps.map((c) => h('th', { title: c.name + (c.afc ? ` — ${c.afc}` : '') }, h('div', { class: 'cn' }, c.name), h('div', { class: 'cm' }, `/${fmt(c.max)}`))),
    h('th', { class: 'totalh' }, h('div', { class: 'cn' }, 'Note'), h('div', { class: 'cm' }, '/20')));

  const foot = h('tr', null,
    h('th', { class: 'sticky' }, h('div', { style: { padding: '0 6px' } }, 'Moyenne de classe')),
    comps.map((c) => { const p = stats.perComp[c.id];
      return h('td', null, p.n ? [h('b', null, `${fmt(p.mean)}/${fmt(c.max)}`), h('div', { class: 'muted' }, `n = ${p.n}`)] : '–'); }),
    h('td', null, stats.overall.n ? [h('b', null, `${fmt(stats.overall.mean)}/20`), h('div', { class: 'muted' }, `n = ${stats.overall.n}`)] : '–'));

  const wrap = h('div', { class: 'tablewrap', 'data-keep': 'evtable' },
    list.length
      ? h('table', { class: 'grid' }, h('thead', null, head), h('tbody', null, list.map((s) => studentRow(s, comps))), h('tfoot', null, foot))
      : h('div', { class: 'empty' }, ev.students.length ? 'Aucun élève dans ce filtre.' : [h('h2', null, 'Aucun élève'), h('p', null, 'Ajoutez des élèves avec le bouton « Élève ».')]));
  ensureVisible();
  return h('div', { class: 'main' }, toolbar, wrap, sheet());
}

function studentRow(s, comps) {
  const ev = V.ev;
  const t = studentTotals(ev, s.id);
  const team = groupOf(ev, s.id, 'team'), lvl = groupOf(ev, s.id, 'level');
  const more = h('button', { type: 'button', class: 'st', title: 'Statut et options', 'aria-label': `Options pour ${s.first}`, onClick: (e) => { e.stopPropagation(); studentMenu(more, s); } }, icon('more', 20));
  const label = studentLabel(s);
  const tr = h('tr', { class: t.usable ? '' : 'inactive' },
    h('th', { class: 'sticky', scope: 'row' }, h('div', { class: 'namecell' },
      h('button', { type: 'button', class: 'nm', onClick: () => openStudent(s.id), title: 'Ouvrir la fiche' }, label,
        team ? h('span', { class: 'tag team' }, team.name) : null, lvl ? h('span', { class: 'tag level' }, lvl.name) : null,
        getNote(ev, s.id) ? h('span', { class: 'notemark', title: getNote(ev, s.id) }, '✎') : null),
      more)),
    comps.map((c) => {
      const cell = getCell(ev, s.id, c.id);
      const state = cellState(cell);
      const selected = V.sel?.sid === s.id && V.sel?.cid === c.id;
      if (!t.usable) return h('td', { class: 'cell', onClick: () => toast(`${s.first} est « ${statusInfo(t.status).label} » : changez son statut pour saisir des notes.`, { ms: 3000 }) });
      const obs = cell?.obs || [];
      return h('td', { class: `cell ${state} ${state !== 'empty' && cell.level ? 'lv-' + cell.level : ''} ${selected ? 'sel' : ''} ${obs.length ? 'hasobs' : ''}`,
        'aria-label': `${label}, ${c.name}`, onClick: () => { V.sel = { sid: s.id, cid: c.id }; render(); } },
      state === 'empty' ? '' : fmt(cell.score),
      state !== 'empty' && cell.level ? h('span', { class: 'sym' }, levelInfo(cell.level).symbol) : null,
      obs.length ? h('span', { class: 'obs', title: 'Observations brouillon' }, obs.map((k) => levelInfo(k).symbol).join('')) : null,
      selfCell(ev, s.id, c.id) ? h('span', { class: 'self', title: `Auto-évaluation de l'élève : ${levelInfo(selfCell(ev, s.id, c.id).level).label}` }, levelInfo(selfCell(ev, s.id, c.id).level).symbol) : null);
    }),
    totalCell(t));
  return tr;
}

function totalCell(t) {
  if (!t.usable) return h('td', { class: 'total' }, h('span', { class: 'tag' }, statusInfo(t.status).short));
  if (t.complete) return h('td', { class: `total ${t.allValidated ? '' : 'draft'}` }, `${fmt(t.final)}/20`);
  if (t.filled) {
    return h('td', { class: 'total draft' }, `${fmt(t.points)}/${fmt(t.maxFilled)}`,
      h('span', { class: 'part' }, `${t.remaining} restante${t.remaining > 1 ? 's' : ''}`),
      opts().showProvisional ? h('span', { class: 'prov' }, `≈ ${fmt(t.provisional, 1)}/20 (prov.)`) : null);
  }
  return h('td', { class: 'total' });
}

function ensureVisible() {
  requestAnimationFrame(() => {
    const td = document.querySelector('td.cell.sel');
    const wrap = document.querySelector('.tablewrap');
    if (!td || !wrap) return;
    const r = td.getBoundingClientRect(), w = wrap.getBoundingClientRect();
    const headH = wrap.querySelector('thead')?.offsetHeight || 0;
    const footH = wrap.querySelector('tfoot')?.offsetHeight || 0;
    const colW = wrap.querySelector('th.sticky')?.offsetWidth || 0;
    if (r.top < w.top + headH) wrap.scrollTop -= w.top + headH - r.top;
    else if (r.bottom > w.bottom - footH) wrap.scrollTop += r.bottom - (w.bottom - footH);
    if (r.left < w.left + colW) wrap.scrollLeft -= w.left + colW - r.left;
    else if (r.right > w.right) wrap.scrollLeft += r.right - w.right;
  });
}

// ---------- Panneau de saisie rapide ----------

function nextStudentId(sid) {
  const list = orderedStudents(V.ev, { sort: V.sort, dir: V.dir, filter: V.filter, key: V.key })
    .filter((s) => studentTotals(V.ev, s.id).usable);
  const i = list.findIndex((s) => s.id === sid);
  const after = list.slice(i + 1);
  return (V.toPlace ? after.find((s) => toPlaceCount(V.ev, s.id) > 0) : after[0])?.id ?? null;
}

// ---------- Observations brouillon (communes à la saisie rapide et à la fiche) ----------

/** Petit bouton « brouillon » : même couleur que le degré, mais discret ; il ne place PAS l'élève. */
function draftBtn(sid, cid, l, cell) {
  const n = (cell?.obs || []).filter((k) => k === l.key).length;
  return h('button', { type: 'button', class: `lvdraft ${l.key}`, 'aria-label': `Noter une observation « ${l.label} » (brouillon)`, title: `Observation « ${l.label} » (brouillon, sans placer l'élève)`,
    onClick: (e) => { e.stopPropagation(); act('Observation', (x) => addObs(x, sid, cid, l.key)); } },
  `+ ${l.symbol}`, n ? h('b', { class: 'cnt' }, n) : null);
}

/** Ligne des observations déjà notées : toucher un symbole le retire. */
function obsRow(sid, cid, cell) {
  const obs = cell?.obs || [];
  if (!obs.length) return null;
  const c = obsCounts(obs);
  const summary = LEVELS.filter((l) => c[l.key]).map((l) => `${c[l.key]} ${l.symbol}`).join('  ');
  return h('div', { class: 'obsrow' },
    h('span', { class: 'muted small' }, 'Brouillon : '),
    obs.map((k, i) => h('button', { type: 'button', class: `obschip ${k}`, 'aria-label': `Retirer l'observation ${levelInfo(k).label}`, title: 'Toucher pour retirer',
      onClick: () => act('Observation retirée', (x) => removeObs(x, sid, cid, i)) }, levelInfo(k).symbol)),
    h('span', { class: 'muted small' }, `= ${summary}`));
}

/** Rappel de l'auto-évaluation de l'élève (grisé, italique) : jamais comptée dans la note. */
function selfLine(sid, cid) {
  const sc = selfCell(V.ev, sid, cid);
  if (!sc) return null;
  const l = levelInfo(sc.level), c = V.ev.model.competences.find((x) => x.id === cid);
  return h('div', { class: 'selfline' }, `Auto-évaluation de l'élève : ${l.symbol} ${l.label} (${fmt(sc.score)}/${fmt(c.max)})${selfDone(V.ev, sid) ? '' : ' — non validée'}`);
}

function noteDialog(s) {
  let text = getNote(V.ev, s.id);
  const ta = h('textarea', { rows: 7, placeholder: 'Écrivez ou dessinez au stylet (la saisie manuscrite est convertie en texte)…', autofocus: true, onInput: (e) => { text = e.target.value; } });
  ta.value = text;
  openDialog({ title: `Remarque — ${studentLabel(s)}`, body: [h('p', { class: 'dlg-msg' }, 'Remarque libre sur cet élève, pour cette évaluation seulement.'), ta],
    actions: [{ label: 'Annuler' }, { label: 'Enregistrer', primary: true, onClick: () => { act('Remarque', (e) => setNote(e, s.id, text)); } }] });
}

function sheet() {
  if (!V.sel) return null;
  const ev = V.ev;
  const { sid, cid } = V.sel;
  const s = ev.students.find((x) => x.id === sid);
  const c = ev.model.competences.find((x) => x.id === cid);
  if (!s || !c) { V.sel = null; return null; }
  const cell = getCell(ev, sid, cid);
  const state = cellState(cell);
  const step = ev.step || 0.5;
  const setSc = (v) => act('Note', (e) => setScore(e, sid, cid, v));

  const lvButtons = h('div', { class: 'lvbtns' }, LEVELS.map((l) => {
    const def = c.levels.find((x) => x.key === l.key);
    return h('div', { class: 'lvcol' },
      draftBtn(sid, cid, l, cell),
      h('button', { type: 'button', class: `lvbtn ${l.key} ${cell?.level === l.key && state !== 'empty' ? 'on' : ''}`, title: def.text || l.label,
        onClick: () => act('Niveau', (e) => setLevel(e, sid, cid, l.key)) },
      h('span', null, `${l.symbol} ${l.label}`), h('small', null, `≈ ${fmt(def.value)} / ${fmt(c.max)}`)));
  }));

  const input = h('input', { type: 'text', inputmode: 'decimal', 'aria-label': 'Note', value: cell?.score != null ? String(cell.score).replace('.', ',') : '', placeholder: '–',
    onChange: (e) => {
      if (e.target.value.trim() === '') return act('Note effacée', (x) => clearCell(x, sid, cid)) || render();
      const v = parseNum(e.target.value);
      if (Number.isNaN(v)) return render();
      if (!act('Note', (x) => setScore(x, sid, cid, v))) render();
    } });

  const next = nextStudentId(sid);
  return h('div', { class: 'sheet' },
    h('div', { class: 'row' },
      h('div', { class: 'grow' }, h('span', { class: 'who' }, studentLabel(s)), h('span', { class: 'muted' }, ` — ${c.name} (/${fmt(c.max)})`),
        c.afc ? h('span', { class: 'muted small' }, ` · ${c.afc}`) : null),
      state !== 'empty' ? h('span', { class: `statepill ${state}` }, state === 'validated' ? 'Validée' : 'Non validée') : null,
      iconBtn('close', 'Fermer la saisie', () => { V.sel = null; render(); }, 'sm')),
    lvButtons,
    obsRow(sid, cid, cell),
    selfLine(sid, cid),
    h('div', { class: 'row wrap' },
      h('div', { class: 'stepper' },
        h('button', { type: 'button', class: 'sm', 'aria-label': 'Moins', onClick: () => setSc(Math.max(0, (cell?.score ?? 0) - step)) }, '−'),
        input,
        h('button', { type: 'button', class: 'sm', 'aria-label': 'Plus', onClick: () => setSc(Math.min(c.max, (cell?.score ?? 0) + step)) }, '+'),
        h('span', { class: 'muted' }, `/ ${fmt(c.max)}`)),
      h('div', { class: 'grow' }),
      btn(getNote(ev, sid) ? 'Remarque ✎' : 'Remarque', { onClick: () => noteDialog(s) }),
      btn('Effacer', { icon: 'close', disabled: state === 'empty', onClick: () => act('Effacement', (e) => clearCell(e, sid, cid)) }),
      state === 'validated'
        ? btn('Validée — modifier', { icon: 'check', cls: 'soft', onClick: () => act('Annulation de validation', (e) => validateCell(e, sid, cid, false)) })
        : btn('Valider', { icon: 'check', cls: 'primary', disabled: state === 'empty', onClick: () => act('Validation', (e) => validateCell(e, sid, cid, true)) }),
      btn(next ? 'Valider et suivant' : 'Valider et fermer', { icon: next ? 'down' : 'check', cls: 'primary', disabled: state === 'empty', onClick: () => {
        V.sess.do('Validation', (e) => validateCell(e, sid, cid, true));
        V.sel = next ? { sid: next, cid } : null;
        render();
      } })));
}

// ---------- Menu d'un élève : statut, fiche, historique, retrait ----------

function studentMenu(anchor, s) {
  const cur = studentTotals(V.ev, s.id).status;
  popMenu(anchor, [
    ...STATUSES.map((st) => ({ label: st.label, active: st.key === cur, onClick: () => act('Statut', (e) => setStatus(e, s.id, st.key)) })),
    '-',
    { label: 'Ouvrir la fiche', onClick: () => openStudent(s.id) },
    { label: 'Remarque…', onClick: () => noteDialog(s) },
    { label: 'Résumé de l\'année', onClick: () => studentSummaryDialog(s.id, V.ev) },
    { label: 'Historique de l\'élève', onClick: () => studentHistoryDialog(s.id, V.ev) },
    '-',
    { label: 'Retirer de cette évaluation', danger: true, onClick: () => {
      if (act('Retrait de ' + s.first, (e) => removeStudentFromEvaluation(e, s.id))) {
        if (V.sel?.sid === s.id) V.sel = null;
        if (V.sid === s.id) V.mode = 'table';
        render();
        toast(`${s.first} retiré(e) de l'évaluation.`, { action: 'Annuler', onAction: undo, ms: 7000 });
      }
    } },
  ]);
}

function openStudent(sid) { V.mode = 'student'; V.sid = sid; V.sel = null; render(); }

// ---------- Fiche individuelle ----------

function studentMode() {
  const ev = V.ev;
  const list = orderedStudents(ev, { sort: V.sort, dir: V.dir, filter: V.filter, key: V.key });
  let s = ev.students.find((x) => x.id === V.sid) || list[0];
  if (!s) { V.mode = 'table'; return tableMode(); }
  V.sid = s.id;
  const idx = list.findIndex((x) => x.id === s.id);
  const go2 = (i) => { const t = list[i]; if (t) { V.sid = t.id; render(); } };
  const t = studentTotals(ev, s.id);
  const comps = ev.model.competences;

  const side = h('div', { class: 'sidelist', 'data-keep': 'sidelist' }, list.map((x) => {
    const tt = studentTotals(ev, x.id);
    return h('button', { type: 'button', class: x.id === s.id ? 'on' : '', onClick: () => { V.sid = x.id; render(); } },
      h('span', null, studentLabel(x)),
      h('span', { class: 'tt' }, !tt.usable ? statusInfo(tt.status).short : tt.complete ? `${fmt(tt.final)}/20` : tt.filled ? `${fmt(tt.points)}/${fmt(tt.maxFilled)}` : ''));
  }));

  const head = h('div', { class: 'head' },
    btn('Tableau', { icon: 'back', 'data-back': '1', onClick: () => { V.mode = 'table'; render(); } }),
    iconBtn('back', 'Élève précédent', () => go2(idx - 1), 'boxed', { disabled: idx <= 0 }),
    h('h2', { class: 'grow' }, studentLabel(s)),
    iconBtn('next', 'Élève suivant', () => go2(idx + 1), 'boxed', { disabled: idx >= list.length - 1 }),
    (() => {
      const more = iconBtn('more', 'Plus d\'options', () => popMenu(more, [
        { label: 'Résumé de l\'année', onClick: () => studentSummaryDialog(s.id, ev) },
        { label: 'Historique de l\'élève', onClick: () => studentHistoryDialog(s.id, ev) },
        { label: getNote(ev, s.id) ? 'Remarque ✎…' : 'Remarque…', onClick: () => noteDialog(s) },
        '-',
        ...STATUSES.map((st) => ({ label: `Statut : ${st.label}`, active: st.key === t.status, onClick: () => act('Statut', (e) => setStatus(e, s.id, st.key)) })),
        ...(selfDone(ev, s.id) ? ['-', { label: 'Rouvrir son auto-évaluation', onClick: () => { reopenSelf(ev, s.id); app.repo.save('evaluations', ev); render(); toast('Auto-évaluation rouverte : l\'élève pourra la modifier.'); } }] : []),
      ]), 'boxed');
      return more;
    })());

  const warn = !t.usable ? h('div', { class: 'totalbar', style: { background: '#fff7e0' } },
    `Élève « ${statusInfo(t.status).label} » : ses notes ne sont pas comptées dans les moyennes.`,
    btn('Repasser en présent', { cls: 'small', onClick: () => act('Statut', (e) => setStatus(e, s.id, 'present')) })) : null;

  const total = h('div', { class: 'totalbar' },
    t.complete ? [h('span', null, `Note : ${fmt(t.final)}/20`), h('span', { class: `statepill ${t.allValidated ? 'validated' : 'draft'}` }, t.allValidated ? 'toutes validées' : 'à valider')]
      : [h('span', null, `${fmt(t.points)}/${fmt(t.maxFilled)} pts`), h('span', { class: 'muted' }, t.remaining ? `${t.remaining} compétence${t.remaining > 1 ? 's' : ''} restante${t.remaining > 1 ? 's' : ''} — note finale quand tout est renseigné` : ''),
        opts().showProvisional && t.provisional != null ? h('span', { class: 'statepill draft' }, `estimation ≈ ${fmt(t.provisional, 1)}/20 (provisoire)`) : null]);

  const st2 = selfTotals(ev, s.id);
  if (st2.filled) total.append(h('span', { class: 'selfline', style: { marginLeft: 'auto' } },
    `Auto-évaluation : ${st2.complete ? `${fmt(st2.final)}/20` : `${st2.filled}/${st2.total} compétences`}${st2.done ? ' (validée)' : ''}`));

  return h('div', { class: 'split' }, side,
    h('div', { class: 'detail' }, head, warn, h('div', { class: 'comps c2', 'data-keep': 'comps' }, comps.map((c) => compCard(s, c))), total));
}

function compCard(s, c) {
  const ev = V.ev;
  const cell = getCell(ev, s.id, c.id);
  const state = cellState(cell);
  const step = ev.step || 0.5;
  const setSc = (v) => act('Note', (e) => setScore(e, s.id, c.id, v));
  const input = h('input', { type: 'text', inputmode: 'decimal', 'aria-label': `Note ${c.name}`, value: cell?.score != null ? String(cell.score).replace('.', ',') : '', placeholder: '–', style: { width: '78px', textAlign: 'center', fontWeight: 650, fontSize: '18px' },
    onChange: (e) => {
      if (e.target.value.trim() === '') return act('Note effacée', (x) => clearCell(x, s.id, c.id)) || render();
      const v = parseNum(e.target.value);
      if (Number.isNaN(v)) return render();
      if (!act('Note', (x) => setScore(x, s.id, c.id, v))) render();
    } });
  return h('div', { class: 'compcard' },
    h('div', { class: 'ch' }, h('b', null, c.name), h('span', { class: 'muted' }, `/${fmt(c.max)}`)),
    c.afc ? h('div', { class: 'afc' }, c.afc) : null,
    LEVELS.map((l) => {
      const d = c.levels.find((x) => x.key === l.key);
      const n = (cell?.obs || []).filter((k) => k === l.key).length;
      const mine = selfCell(ev, s.id, c.id)?.level === l.key;
      return h('div', { class: 'lvwrap' },
        h('button', { type: 'button', class: `lvrow ${l.key} ${cell?.level === l.key && state !== 'empty' ? 'on' : ''}`, onClick: () => act('Niveau', (e) => setLevel(e, s.id, c.id, l.key)) },
          // titre en gras en haut, puis le texte COMPLET sur toute la largeur de la case
          h('span', { class: 'lvh' }, `${l.symbol} ${l.label}`, h('small', null, d.min === d.max ? `${fmt(d.value)} pt` : `${fmt(d.min)}–${fmt(d.max)} pts`),
            mine ? h('i', { class: 'selfmark' }, 'auto-éval. de l\'élève') : null),
          h('span', { class: 'crit' }, d.text || h('span', { class: 'muted' }, 'Critère non renseigné'))),
        // petit bouton brouillon, discret (usage principal : vue tableau)
        h('button', { type: 'button', class: `lvdraft side ${l.key}`, 'aria-label': `Noter une observation « ${l.label} » (brouillon)`, title: 'Observation brouillon (ne place pas l\'élève)',
          onClick: () => act('Observation', (e) => addObs(e, s.id, c.id, l.key)) }, `+${l.symbol}`, n ? h('b', { class: 'cnt' }, n) : null));
    }),
    obsRow(s.id, c.id, cell),
    h('div', { class: 'foot' },
      h('div', { class: 'stepper' },
        h('button', { type: 'button', class: 'sm', 'aria-label': 'Moins', onClick: () => setSc(Math.max(0, (cell?.score ?? 0) - step)) }, '−'),
        input,
        h('button', { type: 'button', class: 'sm', 'aria-label': 'Plus', onClick: () => setSc(Math.min(c.max, (cell?.score ?? 0) + step)) }, '+')),
      state !== 'empty' ? h('span', { class: `statepill ${state}` }, state === 'validated' ? 'Validée' : 'Non validée') : null,
      state === 'validated'
        ? btn('Modifier', { cls: 'small soft', onClick: () => act('Annulation de validation', (e) => validateCell(e, s.id, c.id, false)) })
        : btn('Valider', { icon: 'check', cls: 'small primary', disabled: state === 'empty', onClick: () => act('Validation', (e) => validateCell(e, s.id, c.id, true)) })));
}

// ---------- Équipes et groupes de niveau ----------

function groupsDialog() {
  const body = h('div', { class: 'dlg-body', style: { padding: 0 } });
  const act2 = (label, fn) => { if (V.sess.do(label, fn)) { render(); } paint(); };
  const paint = () => {
    const ev = V.ev;
    const section = (type, title, noun) => {
      const gs = ev.groups.filter((g) => g.type === type);
      return h('div', { class: 'panel', style: { boxShadow: 'none', border: '1px solid var(--line)', marginBottom: 0 } },
        h('h3', null, title),
        gs.map((g) => h('div', { class: 'listrow' },
          h('input', { type: 'text', value: g.name, 'aria-label': 'Nom', style: { flex: 1 }, onChange: (e) => act2('Renommage', (x) => { const t = x.groups.find((y) => y.id === g.id); if (t && e.target.value.trim()) t.name = e.target.value.trim(); }) }),
          h('span', { class: 'muted small' }, `${ev.students.filter((s) => ev.membership[s.id]?.[type] === g.id).length} élève(s)`),
          iconBtn('trash', 'Supprimer ' + g.name, () => act2('Suppression de groupe', (x) => removeGroup(x, g.id)), 'sm'))),
        btn(`Ajouter ${noun}`, { icon: 'plus', cls: 'small soft', onClick: () => act2('Nouveau groupe', (x) => addGroup(x, type, `${type === 'team' ? 'Équipe' : 'Niveau'} ${gs.length + 1}`)) }));
    };
    const sel = (s, type) => {
      const gs = ev.groups.filter((g) => g.type === type);
      return h('select', { 'aria-label': `${type === 'team' ? 'Équipe' : 'Niveau'} de ${s.first}`, value: ev.membership[s.id]?.[type] || '', disabled: !gs.length,
        onChange: (e) => act2('Affectation', (x) => assignGroup(x, s.id, type, e.target.value || null)) },
      h('option', { value: '' }, '—'), gs.map((g) => h('option', { value: g.id }, g.name)));
    };
    body.replaceChildren(
      h('p', { class: 'muted small', style: { margin: 0 } }, 'Ces groupes n\'existent que dans cette évaluation : la composition de la classe n\'est pas modifiée.'),
      h('div', { class: 'row wrap', style: { alignItems: 'stretch' } },
        h('div', { style: { flex: '1 1 300px' } }, section('team', 'Équipes', 'une équipe')),
        h('div', { style: { flex: '1 1 300px' } }, section('level', 'Groupes de niveau', 'un groupe de niveau'))),
      h('table', { class: 'edit' }, h('thead', null, h('tr', null, h('th', null, 'Élève'), h('th', null, 'Équipe'), h('th', null, 'Niveau'))),
        h('tbody', null, orderedStudents(ev, { sort: 'list' }).map((s) => h('tr', null, h('td', null, studentLabel(s)), h('td', null, sel(s, 'team')), h('td', null, sel(s, 'level')))))));
  };
  openDialog({ title: 'Équipes et groupes de niveau', body, wide: true, actions: [{ label: 'Terminé', primary: true }] });
  paint();
}

// ---------- Ajouter un élève à l'évaluation ----------

function addStudentDialog() {
  const ev = V.ev;
  const cls = app.repo.get('classes', ev.classId);
  const avail = cls && !cls.deleted ? cls.students.filter((s) => s.active !== false && !ev.students.some((x) => x.id === s.id)) : [];
  const picked = new Set();
  const guest = { first: '', initial: '' };
  openDialog({
    title: 'Ajouter un élève à cette évaluation',
    body: [
      avail.length ? h('div', null, h('b', null, 'Élèves de la classe absents de la liste'),
        avail.map((s) => h('label', { class: 'listrow' }, h('input', { type: 'checkbox', style: { width: '22px', height: '22px' }, onChange: (e) => (e.target.checked ? picked.add(s.id) : picked.delete(s.id)) }), studentLabel(s)))) : null,
      h('div', null, h('b', null, 'Nouvel élève (cette évaluation uniquement)'),
        h('div', { class: 'row', style: { marginTop: '6px' } },
          h('input', { type: 'text', placeholder: 'Prénom', 'aria-label': 'Prénom', style: { flex: 1 }, autofocus: true, onInput: (e) => { guest.first = e.target.value; } }),
          h('input', { type: 'text', placeholder: 'Initiale', 'aria-label': 'Initiale du nom', maxlength: 1, style: { width: '80px' }, onInput: (e) => { guest.initial = e.target.value; } })),
        h('p', { class: 'muted small' }, 'Pour une arrivée en cours d\'année, ajoutez plutôt l\'élève à la classe (Réglages › Classes) : il sera disponible dans toutes les nouvelles évaluations.')),
    ],
    actions: [{ label: 'Annuler' }, { label: 'Ajouter', primary: true, onClick: () => {
      act('Ajout d\'élève', (e) => {
        for (const s of avail) if (picked.has(s.id)) addStudentToEvaluation(e, s);
        if (guest.first.trim()) addStudentToEvaluation(e, newStudent(guest.first.trim(), guest.initial.trim()));
      });
    } }],
  });
}
