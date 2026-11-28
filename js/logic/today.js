// Séance du jour (1.13) : présents, absents, dispensés, inaptes de la classe pour AUJOURD'HUI.
// cls.today = { date: 'AAAA-MM-JJ', status: { sid: 'absent' | 'dispense' | 'inapte' } } ; un nouveau jour repart de « tous présents ».
// Tous les outils de la classe en tiennent compte (équipes, tables / rings, VMA, Kivaou, Kabaddi, montée de niveau).
import { todayISO } from '../util.js';

export const TODAY_ST = { present: 'Présent', absent: 'Absent', dispense: 'Dispensé', inapte: 'Inapte' };
export const CYCLE = ['present', 'absent', 'dispense', 'inapte'];

export function todayOf(cls) {
  const d = todayISO();
  if (cls.today?.date !== d) cls.today = { date: d, status: {} };
  return cls.today;
}
/** Statut du jour d'un élève ('present' par défaut, et pour tout autre jour). */
export const statusToday = (cls, sid) => (cls?.today?.date === todayISO() && cls.today.status[sid]) || 'present';
/** Pratique aujourd'hui ? (ni absent, ni dispensé, ni inapte) */
export const practices = (cls, sid) => statusToday(cls, sid) === 'present';
export function setToday(cls, sid, st) { const t = todayOf(cls); if (!st || st === 'present') delete t.status[sid]; else t.status[sid] = st; }
export const nextStatus = (st) => CYCLE[(CYCLE.indexOf(st) + 1) % CYCLE.length];
export function countsToday(cls, students) {
  const c = { present: 0, absent: 0, dispense: 0, inapte: 0 };
  for (const s of students) c[statusToday(cls, s.id)]++;
  return c;
}
/** Tirage au sort parmi les élèves qui pratiquent (sans répéter le dernier tiré si possible). */
export function draw(cls, students, last = null, rnd = Math.random) {
  const pool = students.filter((s) => practices(cls, s.id));
  const cand = pool.length > 1 ? pool.filter((s) => s.id !== last) : pool;
  return cand.length ? cand[Math.floor(rnd() * cand.length)] : null;
}
