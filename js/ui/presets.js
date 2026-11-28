// Préréglages de l'équipe EPS (1.12) : UN préréglage par OUTIL, valable pour toutes les activités et toutes les classes.
// Rangés dans les réglages (meta « toolPresets »), sauvegardés et synchronisés avec le reste.
// Les anciens préréglages « par activité » (meta « teamPresets », 1.10–1.11) sont repris une fois.
import { app } from '../app.js';

const KEY = 'toolPresets';
const LEGACY = 'teamPresets';
const clone = (x) => JSON.parse(JSON.stringify(x));
export const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

/** Tous les préréglages : { kivaou: {...}, mariokart: {...}, circuit: {...}, tournoi: {...}, kabaddi: {...}, boxefps: {...} } */
export function toolPresets() {
  const cur = app.repo?.getMeta(KEY, null);
  if (cur) return cur;
  // reprise des anciens préréglages par activité : le premier trouvé pour chaque outil
  const old = app.repo?.getMeta(LEGACY, null) || {};
  const out = {};
  for (const k of Object.keys(old)) for (const [t, v] of Object.entries(old[k] || {})) if (t !== 'label' && !out[t]) out[t] = clone(v);
  return out;
}
/** Préréglage d'un outil (le nom de l'activité n'est plus utilisé, gardé pour compatibilité des appels). */
export function presetFor(_activityName, tool) {
  const p = toolPresets()[tool];
  return p ? clone(p) : null;
}
export async function savePreset(_activityName, tool, value) {
  const all = clone(toolPresets());
  all[tool] = clone(value);
  await app.repo.setMeta(KEY, all);
}
/** « Restaurer » : l'outil reprend ses réglages d'origine. */
export async function resetPreset(tool) {
  const all = clone(toolPresets());
  delete all[tool];
  await app.repo.setMeta(KEY, all);
}
export const allPresets = toolPresets;
