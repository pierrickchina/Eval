// Compteur Mario Kart (fiches MK V1, V2, V3) : tours, malus, objectif (cc), pièces (V3), cadeaux tirés au hasard, total.
// Total = tours × 2 − malus + points de l'objectif s'il est validé.
import { uid } from '../util.js';

export const MK_BONUS = ['Bill Ball', 'Champi', 'Banane', 'Triple champi', 'Étoile', 'Boo', 'Plante piranha', 'Champi Roi', 'Goomba'];
/** Effet de chaque bonus (fiche « MK bonus »). */
export const MK_BONUS_DESC = {
  'Bill Ball': 'L\'enseignant part faire le tour à la place de l\'équipe.',
  Champi: 'Permis de prendre le petit raccourci.',
  Banane: 'Toute l\'équipe fait 5 sauts en extension avant de partir.',
  'Triple champi': 'Permis de couper sur la moitié du terrain.',
  Étoile: 'Un seul élève part faire ce tour.',
  Boo: '1 élève de plus a le droit de rester au stand sur ce tour.',
  'Plante piranha': 'Vous devez faire le grand tour ce tour-ci.',
  'Champi Roi': 'Permis de prendre le super raccourci.',
  Goomba: 'Pas d\'élève de votre groupe au stand pendant 1 tour.',
};
/** Images des bonus (fiche « MK bonus » de l'enseignant). */
export const MK_BONUS_IMG = { 'Bill Ball': 'bill-ball', Champi: 'champi', Banane: 'banane', 'Triple champi': 'triple-champi', Étoile: 'etoile', Boo: 'boo', 'Plante piranha': 'plante-piranha', 'Champi Roi': 'champi-roi', Goomba: 'goomba' };
export const bonusImg = (b) => (MK_BONUS_IMG[b] ? `img/mk/${MK_BONUS_IMG[b]}.png` : null);
export const MK_VERSIONS = {
  v1: { label: 'V1', hint: 'Tours, malus, objectif' },
  v2: { label: 'V2', hint: '+ cadeaux (bonus tirés au hasard)' },
  v3: { label: 'V3', hint: '+ lancer de vortex : pièces, 10 pièces = 1 cadeau' },
};
export const CC = ['50', '100', '150', '200'];
export const CC_POINTS = { 50: 1, 100: 3, 150: 4, 200: 6 };
export const CC_VMA = { 50: 9, 100: 11, 150: 13, 200: 15 };
export const COINS_PER_GIFT = 10;
const COLORS = ['rouge', 'bleu-clair', 'jaune', 'vert', 'orange', 'violet', 'rose', 'bleu-fonce'];

/** Objectifs : tours à faire selon les cc et le nombre d'élèves du groupe (cases vides tant qu'elles ne sont pas remplies). */
export const emptyObjectives = () => Object.fromEntries(CC.map((cc) => [cc, { 3: null, 4: null, 5: null }]));

export function newMK(groups = 4) {
  return { version: 'v1', durationMin: 12, groups: Array.from({ length: groups }, (_, i) => newGroup(i)), bonus: MK_BONUS.slice(), objectives: emptyObjectives(), clock: { base: 0, startedAt: null }, updatedAt: Date.now() };
}
export const newGroup = (i) => ({ id: uid(), name: `Groupe ${i + 1}`, color: COLORS[i % COLORS.length], size: 4, laps: 0, malus: 0, objective: null, objOk: null, coins: 0, gifts: 0, bonus: {} });
/** Complète un état ancien (1.9) avec les nouveaux champs. */
export function normalizeMK(st) {
  st.version ||= 'v1'; st.durationMin ||= 12; st.objectives ||= emptyObjectives(); st.clock ||= { base: 0, startedAt: null };
  for (const g of st.groups) { g.size ??= 4; g.malus ??= 0; g.objective ??= null; g.objOk ??= null; g.coins ??= 0; g.gifts ??= 0; g.bonus ??= {}; }
  return st;
}
export function setGroupCount(st, n) {
  n = Math.max(1, Math.min(8, n));
  while (st.groups.length < n) st.groups.push(newGroup(st.groups.length));
  st.groups.length = n;
}
export const addLap = (g, d = 1) => { g.laps = Math.max(0, g.laps + d); };
export const addMalus = (g, d = 1) => { g.malus = Math.max(0, (g.malus || 0) + d); };
export const addBonus = (g, b, d = 1) => { const v = Math.max(0, (g.bonus[b] || 0) + d); if (v) g.bonus[b] = v; else delete g.bonus[b]; };
/** Pièces (V3) : renvoie le nombre de cadeaux gagnés par cet ajout (palier de 10 franchi). */
export function addCoins(g, d) {
  const before = Math.floor((g.coins || 0) / COINS_PER_GIFT);
  g.coins = Math.max(0, (g.coins || 0) + d);
  return Math.max(0, Math.floor(g.coins / COINS_PER_GIFT) - before);
}
export const resetMK = (st) => { for (const g of st.groups) Object.assign(g, { laps: 0, malus: 0, objOk: null, coins: 0, gifts: 0, bonus: {} }); st.clock = { base: 0, startedAt: null }; };
/** Tours à faire pour l'objectif choisi (null si la case n'est pas remplie). */
export const objectiveLaps = (st, g) => (g.objective ? st.objectives?.[g.objective]?.[g.size] ?? null : null);
/** Objectif validé : automatiquement si la case est remplie, sinon d'après le choix de l'enseignant (objOk). */
export function objectiveMet(st, g) {
  if (!g.objective) return false;
  const need = objectiveLaps(st, g);
  return need != null ? g.laps >= need : !!g.objOk;
}
export const totalOf = (st, g) => g.laps * 2 - (g.malus || 0) + (objectiveMet(st, g) ? CC_POINTS[g.objective] : 0);
/** Cadeau tiré au hasard dans la liste des bonus. */
export const drawGift = (st, rnd = Math.random) => (st.bonus.length ? st.bonus[Math.floor(rnd() * st.bonus.length)] : null);
/** Niveau « Le groupe performant » (Mario Kart 5e) : moins de 6 tours, 6-7, 8-9, plus de 9. */
export const lapsLevel = (laps) => (laps > 9 ? 'de' : laps >= 8 ? 'ac' : laps >= 6 ? 'ec' : 'na');
export const elapsedMs = (st, t = Date.now()) => st.clock.base + (st.clock.startedAt ? t - st.clock.startedAt : 0);
