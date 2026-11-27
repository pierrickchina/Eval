// Kabaddi (fiches « Pro Kabaddi ») : chaque équipe attaque chacune des autres pendant 2 minutes.
// Seuls les attaquants marquent : 1re élimination d'un raider +100, éliminations suivantes de ce raider +10,
// Ace (toute la défense éliminée avant 2 min) +1000, faute −1 (plus de 3 raiders, pas de « kabaddi », retouche).
import { uid } from '../util.js';

export const KB_POINTS = { first: 100, elim: 10, ace: 1000, faute: -1 };
export const KB_TEAMS = [
  { name: 'Pink Panthers', color: 'rose' },
  { name: 'Panta Pirates', color: 'vert' },
  { name: 'Dabang Delhi', color: 'orange' },
  { name: 'Équipe 4', color: 'bleu-clair' },
  { name: 'Équipe 5', color: 'violet' },
  { name: 'Équipe 6', color: 'jaune' },
];
export const ATTACK_MS = 2 * 60000;

const newTeam = (i) => ({ id: uid(), name: KB_TEAMS[i % KB_TEAMS.length].name, color: KB_TEAMS[i % KB_TEAMS.length].color, players: Array.from({ length: 9 }, (_, k) => ({ n: k + 1, name: '' })) });

export function newKabaddi(n = 3) {
  const st = { teams: Array.from({ length: n }, (_, i) => newTeam(i)), attacks: [], current: null, attackMin: 2, updatedAt: Date.now() };
  buildAttacks(st);
  return st;
}
/** Une attaque par couple (attaquant, défenseur) ; l'ordre alterne pour que personne n'attaque deux fois de suite si possible. */
export function buildAttacks(st) {
  const keep = new Map(st.attacks.map((a) => [`${a.att}>${a.def}`, a]));
  const ids = st.teams.map((t) => t.id);
  const pairs = [];
  for (let gap = 1; gap < ids.length; gap++) for (let i = 0; i < ids.length; i++) pairs.push([ids[i], ids[(i + gap) % ids.length]]);
  st.attacks = pairs.map(([att, def]) => keep.get(`${att}>${def}`) || { id: uid(), att, def, events: [], clock: { base: 0, startedAt: null }, done: false });
  if (!st.attacks.some((a) => a.id === st.current)) st.current = st.attacks.find((a) => !a.done)?.id || null;
}
export function setTeamCount(st, n) {
  n = Math.max(2, Math.min(6, n));
  while (st.teams.length < n) st.teams.push(newTeam(st.teams.length));
  st.teams.length = n;
  buildAttacks(st);
}
/** Le prochain bouton d'un attaquant : +100 s'il n'a encore éliminé personne pendant cette attaque, sinon +10. */
export const playerValue = (a, n) => (a.events.some((e) => e.player === n && (e.type === 'first' || e.type === 'elim')) ? KB_POINTS.elim : KB_POINTS.first);
export function tapPlayer(a, n) { a.events.push({ type: playerValue(a, n) === KB_POINTS.first ? 'first' : 'elim', player: n, at: Date.now() }); }
export const addAce = (a) => { if (!a.events.some((e) => e.type === 'ace')) a.events.push({ type: 'ace', at: Date.now() }); };
export const addFaute = (a) => a.events.push({ type: 'faute', at: Date.now() });
export const undo = (a) => a.events.pop();
export const scoreOf = (a) => a.events.reduce((s, e) => s + KB_POINTS[e.type], 0);
export const countOf = (a, type) => a.events.filter((e) => e.type === type).length;
/** Points d'une équipe : somme de ses attaques. */
export const teamTotal = (st, id) => st.attacks.filter((a) => a.att === id).reduce((s, a) => s + scoreOf(a), 0);
export const ranking = (st) => st.teams.map((t) => ({ id: t.id, total: teamTotal(st, t.id) })).sort((a, b) => b.total - a.total)
  .map((x, i, arr) => ({ ...x, rank: i && arr[i - 1].total === x.total ? arr.findIndex((y) => y.total === x.total) + 1 : i + 1 }));
export const elapsedMs = (a, t = Date.now()) => a.clock.base + (a.clock.startedAt ? t - a.clock.startedAt : 0);
