// Test VMA « Léger navette 20 m » (1.12) : départ 8,5 km/h, +0,5 km/h par palier d'environ 1 minute.
// Chaque palier compte un nombre entier d'allers de 20 m (≈ 60 s) ; la VMA retenue = vitesse du palier atteint.
export const START_KMH = 8.5, STEP_KMH = 0.5, LEG_M = 20, MAX_STAGE = 20;

export const speedAt = (stage) => START_KMH + (stage - 1) * STEP_KMH;
export const legSeconds = (kmh) => LEG_M / (kmh / 3.6);

/** Plan du test : [{ stage, kmh, leg (s), n (allers), start (s), end (s) }] */
export function stagePlan(max = MAX_STAGE) {
  const out = [];
  let t = 0;
  for (let s = 1; s <= max; s++) {
    const kmh = speedAt(s), leg = legSeconds(kmh), n = Math.round(60 / leg);
    out.push({ stage: s, kmh, leg, n, start: t, end: t + n * leg });
    t += n * leg;
  }
  return out;
}
const PLAN = stagePlan();

/** Où en est le test au temps t (secondes depuis le départ) ? */
export function stateAt(t) {
  if (t < 0) return { stage: 1, kmh: START_KMH, leg: 0, legsInStage: PLAN[0].n, legStart: 0, legEnd: PLAN[0].leg, totalLegs: 0, done: false };
  const p = PLAN.find((x) => t < x.end) || null;
  if (!p) { const last = PLAN.at(-1); return { stage: last.stage, kmh: last.kmh, leg: last.n, legsInStage: last.n, legStart: last.end, legEnd: last.end, totalLegs: PLAN.reduce((a, x) => a + x.n, 0), done: true }; }
  const leg = Math.floor((t - p.start) / p.leg); // aller en cours (0-based) dans le palier
  const before = PLAN.filter((x) => x.stage < p.stage).reduce((a, x) => a + x.n, 0);
  return { stage: p.stage, kmh: p.kmh, leg, legsInStage: p.n, legStart: p.start + leg * p.leg, legEnd: p.start + (leg + 1) * p.leg, totalLegs: before + leg, done: false };
}
/** VMA d'un élève qui s'arrête pendant le palier `stage`. */
export const vmaOf = (stage) => speedAt(stage);
/** Distance totale parcourue (m) au moment de l'arrêt. */
export const distanceAt = (t) => stateAt(t).totalLegs * LEG_M;
/** Allure : mètres à parcourir en `sec` secondes à `pct` % de la VMA (arrondi à 5 m). */
export const allure = (vma, pct, sec) => Math.round((vma / 3.6) * (pct / 100) * sec / 5) * 5;
export const fmtKmh = (v) => String(v).replace('.', ',');
