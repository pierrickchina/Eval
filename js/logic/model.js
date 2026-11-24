// Règles sur les modèles d'évaluation : barèmes, somme = 20, répartition, niveaux.
import { r4, roundTo } from '../util.js';
import { TOTAL_POINTS, DEFAULT_STEP, defaultLevels } from '../data/schema.js';

export const sumMax = (comps) => r4(comps.reduce((s, c) => s + (Number(c.max) || 0), 0));

/** Valide un tableau de compétences. ok = true seulement si la somme vaut exactement 20. */
export function validateTable(comps) {
  const errors = [];
  const sum = sumMax(comps);
  if (!comps.length) errors.push('Ajoutez au moins une compétence.');
  comps.forEach((c, i) => {
    if (!String(c.name || '').trim()) errors.push(`Compétence ${i + 1} : nom manquant.`);
    if (!(Number(c.max) > 0)) errors.push(`Compétence ${i + 1} : barème invalide.`);
  });
  if (comps.length && Math.abs(sum - TOTAL_POINTS) > 1e-6) {
    const diff = r4(TOTAL_POINTS - sum);
    errors.push(
      diff > 0
        ? `Total des barèmes : ${sum} / 20 — il manque ${diff} point(s).`
        : `Total des barèmes : ${sum} / 20 — ${-diff} point(s) en trop.`,
    );
  }
  return { ok: errors.length === 0, sum, diff: r4(TOTAL_POINTS - sum), errors };
}

/** Valide l'ensemble d'un modèle : nom, activité, au moins un niveau scolaire, chaque tableau juste. */
export function validateModel(model) {
  const errors = [];
  if (!String(model.name || '').trim()) errors.push('Nom du modèle manquant.');
  if (!String(model.activity || '').trim()) errors.push('Activité sportive manquante.');
  const levels = Object.keys(model.levels || {});
  if (!levels.length) errors.push('Choisissez au moins un niveau scolaire.');
  const perLevel = {};
  for (const lv of levels) {
    perLevel[lv] = validateTable(model.levels[lv].competences);
    if (!perLevel[lv].ok) errors.push(`Niveau ${lv} : ${perLevel[lv].errors[0]}`);
  }
  return { ok: errors.length === 0, errors, perLevel };
}

/**
 * Répartit `total` points selon des poids, en multiples de `step`, somme exacte
 * (méthode du plus fort reste).
 */
export function distributeByWeights(weights, total = TOTAL_POINTS, step = DEFAULT_STEP) {
  const units = Math.round(total / step);
  const w = weights.map((x) => (Number(x) > 0 ? Number(x) : 0));
  const sw = w.reduce((a, b) => a + b, 0);
  if (!w.length) return [];
  if (sw === 0) return distributeByWeights(w.map(() => 1), total, step);
  const raw = w.map((x) => (x / sw) * units);
  const base = raw.map(Math.floor);
  let left = units - base.reduce((a, b) => a + b, 0);
  const order = raw.map((x, i) => [x - Math.floor(x), i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let k = 0; k < left; k++) base[order[k % order.length][1]]++;
  return base.map((u) => r4(u * step));
}

/** Change le barème d'une compétence et remet les plages de niveaux à l'échelle. */
export function setCompetenceMax(comp, newMax, step = DEFAULT_STEP) {
  const old = Number(comp.max) || 0;
  comp.max = newMax;
  if (!(newMax > 0)) return;
  if (!(old > 0)) {
    comp.levels.forEach((l, i) => Object.assign(l, defaultLevels(newMax, step)[i], { text: l.text }));
    return;
  }
  const k = newMax / old;
  const sc = (v) => Math.min(newMax, roundTo(v * k, step));
  for (const l of comp.levels) {
    l.min = sc(l.min);
    l.max = sc(l.max);
    l.value = sc(l.value);
  }
  const de = comp.levels.find((l) => l.key === 'de');
  if (de) de.min = de.max = de.value = newMax;
}

/** Applique la répartition selon les coefficients : modifie les barèmes pour totaliser 20. */
export function applyCoefficients(comps, step = DEFAULT_STEP) {
  const parts = distributeByWeights(comps.map((c) => c.coef), TOTAL_POINTS, step);
  comps.forEach((c, i) => setCompetenceMax(c, parts[i], step));
}

/** Pour l'import : met à l'échelle des barèmes quelconques vers un total de 20. */
export function rescaleTo20(comps, step = DEFAULT_STEP) {
  const parts = distributeByWeights(comps.map((c) => c.max), TOTAL_POINTS, step);
  comps.forEach((c, i) => setCompetenceMax(c, parts[i], step));
}

/** Niveau correspondant à une note : plage contenant la note, sinon la plus proche. */
export function levelForScore(comp, score) {
  if (score == null || Number.isNaN(score)) return null;
  let best = null;
  comp.levels.forEach((l, i) => {
    const d = score < l.min ? l.min - score : score > l.max ? score - l.max : 0;
    const dv = Math.abs(score - l.value);
    if (!best || d < best.d || (d === best.d && (dv < best.dv || (dv === best.dv && i > best.i)))) {
      best = { d, dv, i, key: l.key };
    }
  });
  return best?.key ?? null;
}

export function proposedScore(comp, key) {
  const l = comp.levels.find((x) => x.key === key);
  return l ? Math.min(l.value, comp.max) : null;
}
