// Création, duplication, groupes, tri et historique des évaluations.
import { uid, now, clone, collator } from '../util.js';
import { SCHEMA_VERSION, DEFAULT_STEP, studentLabel } from '../data/schema.js';
import { studentTotals, getCell, cellState } from './scoring.js';

/** Crée une évaluation INDÉPENDANTE : le modèle et la liste d'élèves sont copiés (figés). */
export function createEvaluation({ cls, model, date, step = DEFAULT_STEP }) {
  const table = model.levels?.[cls.level];
  if (!table) throw new Error(`Le modèle « ${model.name} » n'a pas de tableau pour le niveau ${cls.level}.`);
  return {
    id: uid(),
    schema: SCHEMA_VERSION,
    classId: cls.id,
    modelId: model.id,
    date,
    step,
    classInfo: { name: cls.name, level: cls.level, color: cls.color },
    model: { name: model.name, activity: model.activity, level: cls.level, competences: clone(table.competences) },
    students: cls.students
      .filter((s) => s.active !== false)
      .map((s) => ({ id: s.id, first: s.first, initial: s.initial || '' })),
    groups: [],
    membership: {},
    status: {},
    statusU: {},
    results: {},
    createdAt: now(),
  };
}

/**
 * Duplique une évaluation. Par défaut : pas de résultats ; équipes/groupes repris ;
 * élèves resynchronisés avec la classe actuelle si elle est fournie.
 */
export function duplicateEvaluation(src, { date, cls = null, keepGroups = true, keepResults = false, syncStudents = true } = {}) {
  const copy = clone(src);
  copy.id = uid();
  copy.createdAt = now();
  delete copy.deleted;
  copy.date = date || src.date;
  copy.sourceEvaluationId = src.id;
  if (cls) copy.classInfo = { name: cls.name, level: cls.level, color: cls.color };
  if (syncStudents && cls) {
    copy.students = cls.students
      .filter((s) => s.active !== false)
      .map((s) => ({ id: s.id, first: s.first, initial: s.initial || '' }));
  }
  const ids = new Set(copy.students.map((s) => s.id));
  if (!keepGroups) {
    copy.groups = [];
    copy.membership = {};
  } else {
    for (const k of Object.keys(copy.membership)) if (!ids.has(k)) delete copy.membership[k];
  }
  if (!keepResults) {
    copy.results = {};
    copy.status = {};
    copy.statusU = {};
  } else {
    for (const k of Object.keys(copy.results)) if (!ids.has(k)) delete copy.results[k];
    for (const k of Object.keys(copy.status)) if (!ids.has(k)) delete copy.status[k];
  }
  return copy;
}

// ---- Équipes et groupes de niveau (propres à l'évaluation) ----

export function addGroup(ev, type, name, color = '#cfd3ee') {
  const g = { id: uid(), type, name, color };
  ev.groups.push(g);
  return g;
}

export function removeGroup(ev, gid) {
  ev.groups = ev.groups.filter((g) => g.id !== gid);
  for (const m of Object.values(ev.membership)) for (const t of ['team', 'level']) if (m[t] === gid) delete m[t];
}

export function assignGroup(ev, sid, type, gid) {
  ev.membership[sid] ??= {};
  if (gid) ev.membership[sid][type] = gid;
  else delete ev.membership[sid][type];
}

export const groupOf = (ev, sid, type) => {
  const gid = ev.membership?.[sid]?.[type];
  return gid ? ev.groups.find((g) => g.id === gid) || null : null;
};

// ---- Élèves dans l'évaluation (sans toucher à la classe d'origine) ----

export function addStudentToEvaluation(ev, student) {
  if (ev.students.some((s) => s.id === student.id)) return false;
  ev.students.push({ id: student.id, first: student.first, initial: student.initial || '' });
  return true;
}

export function removeStudentFromEvaluation(ev, sid) {
  ev.students = ev.students.filter((s) => s.id !== sid);
  delete ev.results[sid];
  delete ev.status[sid];
  delete ev.membership[sid];
}

// ---- Tri / filtre du tableau ----

/**
 * sort : 'list' | 'alpha' | 'teams' | 'levels' | 'results'
 * filter : null | { type:'team'|'level', id }
 * key : 'total' ou id de compétence (pour le tri par résultats)
 */
export function orderedStudents(ev, { sort = 'list', dir = 'asc', filter = null, key = 'total' } = {}) {
  let list = ev.students.slice();
  if (filter) list = list.filter((s) => ev.membership?.[s.id]?.[filter.type] === filter.id);
  const alpha = (a, b) => collator.compare(studentLabel(a), studentLabel(b));
  if (sort === 'alpha') list.sort(alpha);
  else if (sort === 'teams' || sort === 'levels') {
    const type = sort === 'teams' ? 'team' : 'level';
    const order = ev.groups.filter((g) => g.type === type).map((g) => g.id);
    const rank = (s) => {
      const i = order.indexOf(ev.membership?.[s.id]?.[type]);
      return i < 0 ? 1e9 : i;
    };
    list.sort((a, b) => rank(a) - rank(b) || alpha(a, b));
  } else if (sort === 'results') {
    const val = (s) => {
      if (ev.status?.[s.id] && ev.status[s.id] !== 'present') return null;
      if (key === 'total') {
        const t = studentTotals(ev, s.id);
        return t.filled ? t.points : null;
      }
      const c = getCell(ev, s.id, key);
      return cellState(c) === 'empty' ? null : c.score;
    };
    list.sort((a, b) => {
      const va = val(a), vb = val(b);
      if (va == null && vb == null) return alpha(a, b);
      if (va == null) return 1;
      if (vb == null) return -1;
      return (dir === 'asc' ? va - vb : vb - va) || alpha(a, b);
    });
  }
  return list;
}

// ---- Historique individuel ----

/** Toutes les évaluations (non supprimées) où figure l'élève, triées par date. */
export function studentHistory(evaluations, sid) {
  const rows = [];
  for (const ev of evaluations) {
    if (ev.deleted || !ev.students.some((s) => s.id === sid)) continue;
    const t = studentTotals(ev, sid);
    rows.push({
      ev,
      date: ev.date,
      activity: ev.model.activity,
      className: ev.classInfo?.name,
      totals: t,
      comps: ev.model.competences.map((c) => ({ comp: c, cell: getCell(ev, sid, c.id) })),
    });
  }
  return rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.ev.createdAt - b.ev.createdAt));
}

/** Prénom actuel d'un élève (classes à jour) ou à défaut celui figé dans l'évaluation. */
export function currentStudent(classes, ev, sid) {
  for (const c of classes) {
    if (c.deleted) continue;
    const s = c.students.find((x) => x.id === sid);
    if (s) return s;
  }
  return ev.students.find((x) => x.id === sid) || null;
}
