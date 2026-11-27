// Résultats d'activité : équipes et clubs (entités durables), bonus/malus, palmarès des élèves. Logique pure, testée.
import { finalStandings, standings } from './tournament.js';

export const isDone = (t) => t.matches.length > 0 && t.matches.every((m) => m.done);
/** Tournois terminés d'une activité (les tournois en cours ne comptent pas encore). */
export const doneTournaments = (act) => (act.tournois || []).filter(isDone);

const blank = (id, name, color, clubId) => ({ id, name, color, clubId: clubId || null, tournaments: 0, w: 0, d: 0, l: 0, pts: 0, bonus: 0, total: 0, ranks: [] });

/**
 * Résultats par équipe (identifiant d'équipe de l'outil Équipes) et par club.
 * setId : ne garder que les tournois d'une composition (« cette leçon seulement »).
 * Une équipe reste la même entité même si ses élèves changent. Club = somme de ses équipes, plus son bonus propre.
 */
export function summarize(act, { setId = null } = {}) {
  const teams = new Map(), clubs = new Map();
  const sets = act.equipes?.sets || [];
  for (const s of sets) for (const c of s.clubs || []) clubs.set(c.id, { ...blank(c.id, c.name, c.color), teams: [] });
  for (const t of doneTournaments(act)) {
    if (setId && t.setId !== setId) continue;
    const rows = finalStandings(t), byId = new Map(rows.map((r) => [r.id, r]));
    for (const tm of t.teams) {
      const key = tm.teamId || tm.id;
      if (!teams.has(key)) teams.set(key, blank(key, tm.name, tm.color, tm.clubId));
      const e = teams.get(key), r = byId.get(tm.id);
      e.name = tm.name; e.color = tm.color; e.clubId = tm.clubId || e.clubId;
      e.tournaments++; e.w += r.w; e.d += r.d; e.l += r.l; e.pts += r.pts;
      e.ranks.push({ tid: t.id, name: t.name, date: t.date, rank: r.rank, of: t.teams.length });
    }
  }
  for (const b of act.equipes?.bonus || []) {
    if (setId && b.setId !== setId) continue;
    const target = b.kind === 'club' ? clubs.get(b.ref) : teams.get(b.ref);
    if (target) target.bonus += b.pts;
    else if (b.kind === 'team') { const e = blank(b.ref, b.label || 'Équipe', 'sans'); e.bonus = b.pts; teams.set(b.ref, e); }
  }
  for (const e of teams.values()) e.total = e.pts + e.bonus;
  for (const e of teams.values()) if (e.clubId && clubs.has(e.clubId)) clubs.get(e.clubId).teams.push(e);
  for (const c of clubs.values()) {
    for (const k of ['tournaments', 'w', 'd', 'l', 'pts']) c[k] = c.teams.reduce((a, x) => a + x[k], 0);
    c.total = c.pts + c.bonus + c.teams.reduce((a, x) => a + x.bonus, 0);
    c.teamBonus = c.teams.reduce((a, x) => a + x.bonus, 0);
  }
  const clubList = [...clubs.values()].filter((c) => c.teams.length || c.bonus).sort((a, b) => b.total - a.total);
  const loose = [...teams.values()].filter((e) => !e.clubId || !clubs.has(e.clubId)).sort((a, b) => b.total - a.total);
  return { clubs: clubList, teams: loose, all: [...teams.values()] };
}

export function addBonus(act, { kind, ref, pts, reason = '', label = '', setId = null, date = '' }) {
  const eq = (act.equipes ||= { sets: [] });
  (eq.bonus ||= []).push({ id: Math.random().toString(36).slice(2, 10), kind, ref, pts, reason, label, setId, date });
}
export const bonusesFor = (act, kind, ref) => (act.equipes?.bonus || []).filter((b) => b.kind === kind && b.ref === ref);
export function removeBonus(act, id) { act.equipes.bonus = (act.equipes.bonus || []).filter((b) => b.id !== id); }

/** Palmarès d'un élève : un résultat par tournoi terminé où il figurait dans une équipe (absents exclus à la création du tournoi). */
export function palmares(act, sid) {
  const out = [];
  for (const t of doneTournaments(act)) {
    const tm = t.teams.find((x) => (x.members || []).includes(sid));
    if (!tm) continue;
    const r = finalStandings(t).find((x) => x.id === tm.id);
    out.push({ tid: t.id, name: t.name, date: t.date, team: tm.name, color: tm.color, rank: r.rank, of: t.teams.length });
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}
export const ordinalFr = (n) => (n === 1 ? '1er' : `${n}e`);
export { standings };
