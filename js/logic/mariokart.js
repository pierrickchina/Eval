// Compteur Mario Kart : tours par groupe et compteurs de bonus réglables (liste par défaut : fiche « MK bonus »).
import { uid } from '../util.js';

export const MK_BONUS = ['Bill Ball', 'Champi', 'Banane', 'Triple champi', 'Étoile', 'Boo', 'Plante piranha', 'Champi Roi', 'Goomba'];
const COLORS = ['rouge', 'bleu-clair', 'jaune', 'vert', 'orange', 'violet', 'rose', 'bleu-fonce'];

export function newMK(groups = 4) {
  return { groups: Array.from({ length: groups }, (_, i) => newGroup(i)), bonus: MK_BONUS.slice(), updatedAt: Date.now() };
}
export const newGroup = (i) => ({ id: uid(), name: `Groupe ${i + 1}`, color: COLORS[i % COLORS.length], laps: 0, bonus: {} });
export function setGroupCount(st, n) {
  n = Math.max(1, Math.min(8, n));
  while (st.groups.length < n) st.groups.push(newGroup(st.groups.length));
  st.groups.length = n;
}
export const addLap = (g, d = 1) => { g.laps = Math.max(0, g.laps + d); };
export const addBonus = (g, b, d = 1) => { const v = Math.max(0, (g.bonus[b] || 0) + d); if (v) g.bonus[b] = v; else delete g.bonus[b]; };
export const resetMK = (st) => { for (const g of st.groups) { g.laps = 0; g.bonus = {}; } };
/** Niveau « Le groupe performant » (Mario Kart 5e) : moins de 6 tours, 6-7, 8-9, plus de 9. */
export const lapsLevel = (laps) => (laps > 9 ? 'de' : laps >= 8 ? 'ac' : laps >= 6 ? 'ec' : 'na');
