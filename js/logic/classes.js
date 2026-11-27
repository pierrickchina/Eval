// Page classe : tableau des notes finales, oublis de matériel (croix), trimestres.
// Les oublis sont stockés DANS l'enregistrement de la classe : ils sont donc inclus dans les sauvegardes
// et la synchronisation, sans rien changer d'autre.
import { now, r4, schoolYear } from '../util.js';
import { studentTotals } from './scoring.js';

// ---------- Oublis de matériel : une date par croix, comptage sur l'année ----------

export const forgetsOf = (cls, sid) => cls.forgets?.[sid] || [];
export const forgetCount = (cls, sid) => forgetsOf(cls, sid).length;

export function addForget(cls, sid, date) {
  cls.forgets ??= {};
  cls.forgets[sid] = [...(cls.forgets[sid] || []), date];
}

/** « − » : retire la dernière croix. Renvoie false s'il n'y en a plus. */
export function removeForget(cls, sid) {
  const l = cls.forgets?.[sid];
  if (!l?.length) return false;
  cls.forgets[sid] = l.slice(0, -1);
  if (!cls.forgets[sid].length) delete cls.forgets[sid];
  return true;
}

/** Couleur de la croix numéro i (0 = première) : 1 et 2 jaunes, 3 orange, 4 et suivantes rouges. */
export const forgetColor = (i) => (i < 2 ? 'y' : i === 2 ? 'o' : 'r');

// ---------- Trimestres (modifiables dans les réglages) ----------

/** Propositions par défaut (à vérifier avec le calendrier du collège, qui fixe ses trimestres). */
export function defaultTrimesters(year = schoolYear()) {
  const m = /^(\d{4})-(\d{4})$/.exec(year || '');
  const y1 = m ? +m[1] : new Date().getFullYear(), y2 = m ? +m[2] : y1 + 1;
  return [
    { start: `${y1}-09-01`, end: `${y1}-11-30` },
    { start: `${y1}-12-01`, end: `${y2}-03-15` },
    { start: `${y2}-03-16`, end: `${y2}-07-05` },
  ];
}

export function getTrimesters(settings, year) {
  const saved = settings?.trimesters?.[year];
  return Array.isArray(saved) && saved.length === 3 ? saved : defaultTrimesters(year);
}

// ---------- Tableau des notes finales d'une classe ----------

const dateCmp = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.createdAt || 0) - (b.createdAt || 0));
const mean = (xs) => (xs.length ? r4(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

/**
 * Une colonne par évaluation de la classe (nombre libre d'activités), une ligne par élève.
 * trim : null (année entière) ou { start, end } (dates ISO incluses).
 * Seules les notes FINALES sont reprises (pas le détail des compétences).
 */
export function classNotes(evals, cls, { trim = null } = {}) {
  const list = evals
    .filter((e) => !e.deleted && e.classId === cls.id && (!trim || (e.date >= trim.start && e.date <= trim.end)))
    .sort(dateCmp);
  // un ancien élève reste visible seulement s'il a des résultats dans ces évaluations
  const inAny = (sid) => list.some((e) => e.students.some((s) => s.id === sid) && studentTotals(e, sid).filled > 0);
  const active = cls.students.filter((s) => s.active !== false);
  const former = cls.students.filter((s) => s.active === false && inAny(s.id));
  const rows = [...active, ...former].map((student) => {
    const cells = list.map((ev) => {
      if (!ev.students.some((s) => s.id === student.id)) return null;
      const t = studentTotals(ev, student.id);
      return { status: t.status, final: t.final, points: t.points, maxFilled: t.maxFilled, filled: t.filled };
    });
    const finals = cells.filter((c) => c && c.status === 'present' && c.final != null).map((c) => c.final);
    return { student, former: student.active === false, cells, mean: mean(finals), n: finals.length };
  });
  const colMeans = list.map((_, j) => mean(rows.map((r) => r.cells[j]).filter((c) => c && c.status === 'present' && c.final != null).map((c) => c.final)));
  return { evals: list, rows, colMeans, overall: mean(rows.filter((r) => r.mean != null).map((r) => r.mean)) };
}
