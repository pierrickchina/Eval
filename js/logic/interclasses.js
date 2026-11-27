// Interclasses (outil libre) : chaque classe = un club à deux équipes, deux tournois sur un même terrain (ou deux),
// classement V / N / D + bonus sponsor, titres de l'événement (d'après les mails de l'équipe EPS).
import { uid } from '../util.js';
import * as TN from './tournament.js';

export const IC_SPORTS = {
  ultimate: { label: 'Ultimate', levels: ['6e', '4e'], tourneys: ['Frisbee', 'Disque'], colors: ['#f4a25e', '#b07fe0'], sport: 'ultimate' },
  basket: { label: 'Basket', levels: ['5e', '3e'], tourneys: ['Filles', 'Garçons'], colors: ['#f08fb6', '#6fb0e6'], sport: 'basket' },
};
export const titlesFor = (sport, level) => (sport === 'ultimate'
  ? { best: `Meilleure équipe Ultimate ${level}`, mvp: 'Le disque d\'or', fair: 'L\'ultime « mate »', coach: 'L\'ultime Coach' }
  : { best: `Meilleure équipe Basket ${level}`, mvp: 'JJR MVP', fair: 'JJR Fair-play', coach: 'JJR Coach of the year' });
const COLORS = ['rouge', 'bleu-clair', 'jaune', 'vert', 'orange', 'violet', 'rose', 'bleu-fonce', 'noir'];

/** Crée l'événement et ses deux tournois (une équipe par classe dans chacun). */
export function newInterclasses({ name, date, sport, level, classes, shared = true, settings = {}, sponsorPts = 1 }) {
  const S = IC_SPORTS[sport];
  const cls = classes.map((c, i) => ({ id: uid(), name: c, color: COLORS[i % COLORS.length] }));
  const pairId = uid();
  const ts = S.tourneys.map((tn, k) => {
    const teams = cls.map((c) => ({ id: uid(), name: c.name, color: c.color, classId: c.id }));
    const t = TN.newTournament({ name: `${name} · ${tn}`, date, teams, scope: 'ic', pairId, side: k ? 'B' : 'A', settings: { sport: S.sport, board: 'suivi', halfMin: 6, ...settings } });
    t.shared = shared; t.label = tn; t.bonus = {};
    return t;
  });
  if (shared && settings.equalize !== false) {
    const [a, b] = ts; const many = a.matches.length > b.matches.length ? a : b.matches.length > a.matches.length ? b : null;
    if (many) many.halfMin = TN.equalizedMinutes(a.halfMin, Math.min(a.matches.length, b.matches.length), Math.max(a.matches.length, b.matches.length));
  }
  return { ic: { id: uid(), name, date, sport, level, classes: cls, sponsorPts, titles: { fair: null, mvpF: '', mvpG: '' }, proj: 'sec', createdAt: Date.now() }, ts };
}
/** Bonus sponsor d'une équipe (coché / décoché) : ajouté aux points de tournoi. */
export function setSponsor(rec, t, teamId, on) {
  t.bonus ||= {};
  if (on) t.bonus[teamId] = rec.ic.sponsorPts; else delete t.bonus[teamId];
}
/** Classement des classes : somme des points des deux équipes. */
export function classRanking(rec) {
  const pts = Object.fromEntries(rec.ic.classes.map((c) => [c.id, 0]));
  for (const t of rec.ts) for (const row of TN.standings(t)) { const team = t.teams.find((x) => x.id === row.id); if (team && pts[team.classId] != null) pts[team.classId] += row.pts; }
  const rows = rec.ic.classes.map((c) => ({ ...c, pts: pts[c.id] })).sort((a, b) => b.pts - a.pts);
  rows.forEach((x, i) => { x.rank = i && rows[i - 1].pts === x.pts ? rows[i - 1].rank : i + 1; });
  return rows;
}
const done = (t) => t.matches.length && t.matches.every((m) => m.done);
/** Vainqueur d'un tournoi (classe), une fois tous ses matchs joués. */
export function winnerOf(t) {
  if (!done(t)) return null;
  const top = TN.finalStandings(t)[0];
  return top ? t.teams.find((x) => x.id === top.id) : null;
}
/** Coach : la classe qui gagne les deux tournois (sinon personne). */
export function coachClass(rec) {
  const w = rec.ts.map(winnerOf);
  return w.every(Boolean) && w[0].classId === w[1].classId ? rec.ic.classes.find((c) => c.id === w[0].classId) : null;
}
/** Derniers résultats (tous tournois), du plus récent au plus ancien. */
export function lastResults(rec, n = 4) {
  return rec.ts.flatMap((t) => t.matches.filter((m) => m.done && m.a && m.b).map((m) => ({ t, m }))).sort((x, y) => (y.m.doneAt || 0) - (x.m.doneAt || 0) || y.m.slot - x.m.slot).slice(0, n);
}
/** Matchs à venir dans l'ordre de passage (alternance si terrain partagé). */
export function upcoming(rec, n = 4) {
  const q = rec.ts.map((t) => t.matches.filter((m) => !m.done && m.a && m.b).sort((a, b) => a.slot - b.slot || a.court - b.court).map((m) => ({ t, m })));
  const shared = rec.ts[0]?.shared;
  if (!shared) return q.flat().sort((a, b) => a.m.slot - b.m.slot).slice(0, n);
  const first = TN.sharedTurn(rec.ts);
  const order = first === rec.ts[1] ? [1, 0] : [0, 1];
  const out = [];
  const idx = [0, 0];
  while (out.length < n && (idx[0] < q[0].length || idx[1] < q[1].length)) for (const k of order) if (idx[k] < q[k].length && out.length < n) out.push(q[k][idx[k]++]);
  return out;
}
