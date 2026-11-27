// Note calculée à partir d'une performance (Duathlon : temps, zone de lancer, écart au projet).
// Fonctions pures : elles renvoient l'indice du niveau (0 non acquis … 3 dépassé).
import { PERF } from '../data/library.js';

/** « 7'42 », « 7:42 », « 7.42 », « 7 42 » ou « 462 » (secondes) → secondes. */
export function parseTime(txt) {
  const s = String(txt ?? '').trim().replace(/["s]+$/i, '');
  if (!s) return null;
  const m = s.match(/^(\d{1,2})\s*['’:.,hm ]\s*(\d{1,2})$/i);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  if (/^\d+$/.test(s)) { const n = Number(s); return n < 30 ? n * 60 : n; } // « 8 » = 8 min ; « 462 » = secondes
  return null;
}
export const fmtTime = (sec) => sec == null ? '' : `${Math.floor(sec / 60)}'${String(Math.round(sec % 60)).padStart(2, '0')}`;

/** Écart au projet : un nombre seul = secondes (« 45 »), sinon minutes'secondes (« 1'10 »). */
export const parseGap = (txt) => /^\s*\d+\s*s?\s*$/i.test(String(txt ?? '')) ? Number(String(txt).replace(/\D/g, '')) : parseTime(txt);

/** Temps de course → niveau (barèmes garçons / filles du Projet EPS). Les bornes appartiennent au niveau supérieur. */
export function timeLevel(sec, sex) {
  if (sec == null) return null;
  const t = sex === 'F' ? PERF.TIME_F : PERF.TIME_G;
  if (sec > t.na) return 0;
  if (sec > t.ec) return 1;
  if (sec >= t.ac) return 2;
  return 3;
}
/** Zone de lancer (0 à 5) → niveau. En 3e, une seule échelle (zone 1 / 2 / 3-4 / 5). */
export function zoneLevel(zone, sex, grade = '4e') {
  if (zone == null || zone === '') return null;
  const z = Math.max(0, Math.min(5, Math.round(Number(zone))));
  if (grade === '3e') return PERF.ZONE_G[z];
  return (sex === 'F' ? PERF.ZONE_F : PERF.ZONE_G)[z];
}
/** Écart au projet (secondes) et nombre de zones de lancer respectées (0, 1, 2) → niveau. */
export function gapLevel(gapSec, zonesOk) {
  if (gapSec == null) return null;
  const g = Math.abs(gapSec);
  const byGap = g > 60 ? 0 : g > 30 ? 1 : g > 10 ? 2 : 3;
  const byZone = zonesOk == null ? 3 : zonesOk <= 0 ? 0 : zonesOk === 1 ? 1 : 3;
  return Math.min(byGap, byZone);
}

/**
 * Résultat pour une compétence munie de `perf` : { level: 'na'|'ec'|'ac'|'de', score?: number } ou null si saisie incomplète.
 * Pour « temps + zone » (3e), la note est la moyenne des points des deux niveaux.
 */
export function perfResult(comp, input = {}, grade = '4e') {
  const KEYS = ['na', 'ec', 'ac', 'de'];
  const val = (i) => comp.levels[i]?.value ?? 0;
  const type = comp.perf?.type;
  if (type === 'time') { const i = timeLevel(parseTime(input.time), input.sex); return i == null ? null : { level: KEYS[i] }; }
  if (type === 'zone') { const i = comp.perf.single ? zoneLevel(input.zone, 'G') : zoneLevel(input.zone, input.sex, grade); return i == null ? null : { level: KEYS[i] }; }
  if (type === 'gap') { const i = gapLevel(parseGap(input.gap), input.zonesOk == null ? null : Number(input.zonesOk)); return i == null ? null : { level: KEYS[i] }; }
  if (type === 'timezone') {
    const a = timeLevel(parseTime(input.time), input.sex), b = zoneLevel(input.zone, input.sex, '3e');
    if (a == null || b == null) return null;
    if (a === b) return { level: KEYS[a] };
    return { score: (val(a) + val(b)) / 2 };
  }
  return null;
}
