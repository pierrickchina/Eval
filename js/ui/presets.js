// Préréglages de l'équipe EPS : par activité, les valeurs de départ des outils (Kivaou, Mario Kart, Circuit training, Tournoi…).
// Rangés dans les réglages de la tablette (meta « teamPresets ») ; plus tard, partageables entre collègues.
import { app } from '../app.js';

const KEY = 'teamPresets';
export const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
export const allPresets = () => app.repo?.getMeta(KEY, null) || {};

/** Préréglage d'un outil pour une activité : nom exact d'abord, sinon une activité dont le nom contient celui du préréglage (« Basket 3e » → « Basket »). */
export function presetFor(activityName, tool) {
  const all = allPresets();
  const n = norm(activityName);
  if (all[n]?.[tool]) return clone(all[n][tool]);
  const k = Object.keys(all).filter((x) => x && (n.includes(x) || x.includes(n)) && all[x][tool]).sort((a, b) => b.length - a.length)[0];
  return k ? clone(all[k][tool]) : null;
}
export async function savePreset(activityName, tool, value) {
  const all = allPresets();
  const n = norm(activityName);
  all[n] = { ...(all[n] || {}), label: all[n]?.label || activityName, [tool]: clone(value) };
  await app.repo.setMeta(KEY, all);
}
export async function removePreset(activityKey, tool = null) {
  const all = allPresets();
  if (!all[activityKey]) return;
  if (tool) { delete all[activityKey][tool]; if (Object.keys(all[activityKey]).filter((k) => k !== 'label').length === 0) delete all[activityKey]; } else delete all[activityKey];
  await app.repo.setMeta(KEY, all);
}
const clone = (x) => JSON.parse(JSON.stringify(x));
