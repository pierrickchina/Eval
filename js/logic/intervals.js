// Minuteur Circuit training : préparation, puis exercices (travail / récupération) en un ou plusieurs tours.
// Règle : chaque exercice est suivi de sa récupération, sauf le dernier ; entre deux tours, la récupération entre tours
// (si elle est réglée) remplace la récupération simple.
// Cadenas : un réglage verrouillé ne bouge pas ; quand on en change un autre, la durée totale verrouillée est conservée
// en ajustant le premier réglage libre (récupération, puis travail, puis tours, puis exercices).

export const CT_KEYS = ['work', 'rest', 'stations', 'rounds', 'roundRest'];
export const CT_LIMITS = { work: [5, 300, 5], rest: [0, 300, 5], stations: [1, 30, 1], rounds: [1, 20, 1], roundRest: [0, 600, 5], total: [30, 3600, 10], prep: [0, 30, 5] };
export const CT_PRESETS = [
  { id: 'wo5', label: '5 min Workout', cfg: { work: 20, rest: 20, stations: 3, rounds: 3, roundRest: 20 } },
  { id: 'wo8', label: '8 min Workout', cfg: { work: 30, rest: 10, stations: 12, rounds: 1, roundRest: 0 } },
  { id: 'alt30', label: '30 s / 30 s', cfg: { work: 30, rest: 30, stations: 8, rounds: 1, roundRest: 0 } },
];
export const CT_DEFAULT = { ...CT_PRESETS[1].cfg, prep: 5, locks: {}, circuit: null };

/** Durée totale (secondes), sans la préparation. */
export function totalOf(c) {
  const n = c.rounds * c.stations;
  const betweenRounds = c.roundRest > 0 ? c.roundRest : c.rest;
  return n * c.work + c.rounds * (c.stations - 1) * c.rest + (c.rounds - 1) * betweenRounds;
}

const clampStep = (k, v) => { const [lo, hi, st] = CT_LIMITS[k]; return Math.min(hi, Math.max(lo, Math.round(v / st) * st)); };

/**
 * Applique un changement (`key` ← `value`) en respectant les cadenas. Retourne la nouvelle configuration.
 * Si la durée totale est verrouillée (locks.total = secondes visées), le premier réglage libre est recalculé.
 */
export function setParam(cfg, key, value) {
  const c = { ...cfg, locks: { ...(cfg.locks || {}) } };
  if (key === 'total') { c.locks.total = clampStep('total', value); return solve(c, null); }
  c[key] = clampStep(key, value);
  return c.locks.total ? solve(c, key) : c;
}
export function toggleLock(cfg, key) {
  const c = { ...cfg, locks: { ...(cfg.locks || {}) } };
  if (c.locks[key]) delete c.locks[key];
  else c.locks[key] = key === 'total' ? totalOf(c) : true;
  return c;
}
/** Cherche, pour le premier réglage libre, la valeur qui approche au mieux la durée verrouillée. */
export function solve(cfg, changed) {
  const target = cfg.locks.total;
  const free = ['rest', 'work', 'rounds', 'stations'].filter((k) => k !== changed && !cfg.locks[k] && !(k === 'stations' && cfg.circuit));
  for (const k of free) {
    const [lo, hi, st] = CT_LIMITS[k];
    let best = null;
    for (let v = lo; v <= hi; v += st) {
      const d = Math.abs(totalOf({ ...cfg, [k]: v }) - target);
      if (!best || d < best.d) best = { v, d };
    }
    if (best && best.d <= Math.max(5, target * 0.04)) return { ...cfg, [k]: best.v };
  }
  return cfg; // aucun réglage libre ne permet d'y arriver : on garde, l'écran affiche l'écart
}

/** Déroulé complet : [{ phase: 'prep'|'work'|'rest'|'roundRest', dur (ms), round, station }]. */
export function timeline(c) {
  const out = [];
  if (c.prep) out.push({ phase: 'prep', dur: c.prep * 1000, round: 0, station: 0 });
  for (let r = 1; r <= c.rounds; r++) {
    for (let s = 1; s <= c.stations; s++) {
      out.push({ phase: 'work', dur: c.work * 1000, round: r, station: s });
      if (s < c.stations && c.rest) out.push({ phase: 'rest', dur: c.rest * 1000, round: r, station: s });
    }
    if (r < c.rounds) { const rr = c.roundRest > 0 ? c.roundRest : c.rest; if (rr) out.push({ phase: c.roundRest > 0 ? 'roundRest' : 'rest', dur: rr * 1000, round: r, station: c.stations }); }
  }
  return out;
}

/** Où en est-on à `ms` du départ : phase, temps restant dans la phase, exercice en cours / suivant, temps total restant. */
export function intervalAt(c, ms) {
  const tl = timeline(c);
  const all = tl.reduce((a, p) => a + p.dur, 0);
  const prep = tl[0]?.phase === 'prep' ? tl[0].dur : 0; // « Reste » : la préparation ne compte pas
  let t = 0;
  for (let i = 0; i < tl.length; i++) {
    const p = tl[i];
    if (ms < t + p.dur) {
      const nextWork = tl.slice(i + (p.phase === 'work' ? 1 : 0)).find((x) => x.phase === 'work');
      return { ...p, left: t + p.dur - ms, totalLeft: all - Math.max(ms, prep), rounds: c.rounds, stations: c.stations, next: nextWork ? nextWork.station : null };
    }
    t += p.dur;
  }
  return { phase: 'done', left: 0, totalLeft: 0, round: c.rounds, station: c.stations, rounds: c.rounds, stations: c.stations, next: null };
}
