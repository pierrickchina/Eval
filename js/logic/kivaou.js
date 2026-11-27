// Kivaou (course d'orientation) : groupes partis, minuteurs, retours, résultats (balises) et bilan.
// Données rangées dans l'activité : act.kivaou = { settings, sessions: [{ id, date, groups: [groupe] }] }.
// Groupe : { id, n, sids: [], course: id du parcours, start: ms | null, end: ms | null, found: n | null, sought: n | null }.
import { uid, now } from '../util.js';

export const KV_DEFAULT = {
  maxMin: 20, // temps maximum (minutes)
  malusMin: 2, // malus par balise manquée (minutes)
  grouped: false, // départ groupé : un GO pour toute la classe
  courses: [
    { id: 'defi', name: 'Défi', balises: 10 },
    { id: 'A', name: 'Boucle A', balises: 6 },
    { id: 'B', name: 'Boucle B', balises: 6 },
    { id: 'C', name: 'Boucle C', balises: 6 },
  ],
};
export const WARN_MS = [2 * 60000, 60000]; // orange à 2 min, rouge à 1 min

export function kivaouOf(act, defaults = KV_DEFAULT) {
  act.kivaou ??= { settings: JSON.parse(JSON.stringify(defaults)), sessions: [] };
  return act.kivaou;
}
/** Séance du jour (créée au besoin). */
export function todaySession(K, date) {
  let s = K.sessions.find((x) => x.date === date);
  if (!s) { s = { id: uid(), date, groups: [], createdAt: now() }; K.sessions.push(s); }
  return s;
}
export const courseOf = (K, id) => K.settings.courses.find((c) => c.id === id) || { id, name: '?', balises: 0 };

export function addGroup(K, s, sids, course) {
  const g = { id: uid(), n: (Math.max(0, ...s.groups.map((x) => x.n)) + 1), sids: sids.slice(), course, start: null, end: null, found: null, sought: courseOf(K, course).balises || null };
  s.groups.push(g);
  return g;
}
export const go = (g, t = now()) => { if (!g.start) { g.start = t; g.end = null; } };
export const arrive = (g, t = now()) => { if (g.start && !g.end) g.end = t; };
export const undoArrive = (g) => { g.end = null; };

/** État d'un groupe : ready (pas parti), run, warn2 (≤ 2 min), warn1 (≤ 1 min), over (temps dépassé), back (rentré). */
export function stateOf(K, g, t = now()) {
  if (!g.start) return 'ready';
  if (g.end) return 'back';
  const left = g.start + K.settings.maxMin * 60000 - t;
  if (left < 0) return 'over';
  if (left <= WARN_MS[1]) return 'warn1';
  if (left <= WARN_MS[0]) return 'warn2';
  return 'run';
}
export const leftMs = (K, g, t = now()) => g.start + K.settings.maxMin * 60000 - (g.end || t);
export const outGroups = (s) => s.groups.filter((g) => g.start && !g.end);
/** Élèves disponibles pour un nouveau groupe : ni partis, ni déjà dans un groupe prêt à partir. */
export function busyStudents(s) {
  return new Set(s.groups.filter((g) => !g.end).flatMap((g) => g.sids));
}

/** Résultat d'un groupe rentré : temps, balises manquées, total (temps + malus), hors temps. */
export function resultOf(K, g) {
  if (!g.start || !g.end) return null;
  const time = g.end - g.start;
  const missed = g.sought != null && g.found != null ? Math.max(0, g.sought - g.found) : 0;
  const total = time + missed * K.settings.malusMin * 60000;
  return { time, missed, total, late: time > K.settings.maxMin * 60000, scored: g.found != null };
}

/**
 * Bilan d'une séance : une ligne par élève et par passage. Les élèves hors temps sont toujours derniers,
 * quel que soit leur total ; sinon classement au total (temps + malus).
 */
export function bilan(K, s) {
  const rows = [];
  for (const g of s.groups) {
    const r = resultOf(K, g);
    for (const sid of g.sids) rows.push({ sid, group: g.n, gid: g.id, course: courseOf(K, g.course).name, ...(r || {}), found: g.found, sought: g.sought, done: !!r });
  }
  const done = rows.filter((x) => x.done).sort((a, b) => (a.late - b.late) || (a.total - b.total));
  done.forEach((x, i) => { x.rank = i > 0 && done[i - 1].total === x.total && done[i - 1].late === x.late ? done[i - 1].rank : i + 1; });
  return [...done, ...rows.filter((x) => !x.done)];
}

/** Bilan depuis le début, par élève : sorties, parcours faits, balises trouvées / cherchées, meilleur temps, hors temps. */
export function overall(K, sids) {
  return sids.map((sid) => {
    const out = { sid, runs: 0, found: 0, sought: 0, best: null, late: 0, byCourse: {} };
    for (const s of K.sessions) for (const g of s.groups) {
      if (!g.sids.includes(sid)) continue;
      const r = resultOf(K, g); if (!r) continue;
      out.runs++;
      const name = courseOf(K, g.course).name;
      out.byCourse[name] = (out.byCourse[name] || 0) + 1;
      if (g.found != null) { out.found += g.found; out.sought += g.sought || 0; }
      if (r.late) out.late++; else if (out.best == null || r.time < out.best) out.best = r.time;
    }
    out.courses = Object.entries(out.byCourse).map(([k, n]) => (n > 1 ? `${k} ×${n}` : k)).join(', ');
    return out;
  });
}
