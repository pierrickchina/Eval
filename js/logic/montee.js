// Montée de niveau (tennis de table) : 10 niveaux, un défi par niveau ; les élèves montent d'un niveau à l'autre.
// Données dans l'activité : act.montee = { sheet: id, sheets: { [id]: [10 critères, du niveau 1 au 10] } (copie modifiable), place: { [sheet]: { sid: niveau } } }.
export const MONTEE_SHEETS = [
  { id: 'matchs', name: 'Fiche 1 · Matchs', levels: ['Match en 3 points', 'Match en double', '2 chances au service', '2 points au service', 'Gagner un match en double contre un niveau 6 (ou 5 s\'il n\'y a pas de 6)', 'Gagner un match contre 2 niveaux 5', 'Match sur demi-table (poser une pastille)', 'Match avec sur-filet (jouer seulement en dessous)', 'Match avec un « bingo » (compte triple si marqué)', 'Match en 21 points'] },
  { id: 'defis', name: 'Fiche 2 · Défis', levels: ['Tournante à 3, 4 ou 5', 'Jouer avec une main en permanence sur la table', 'Match en 1 point', 'Catchball en 3 points', 'Catchball en 5 points', 'Double point si je fais une figure', 'Match assis', 'Jouer de la mauvaise main', 'Changer de main à chaque coup', 'Tir de sniper : si je marque en smashant et que ça touche l\'adversaire, je gagne'] },
  { id: 'catchball', name: 'Fiche 3 · Catchball', levels: ['Catchball en 3 points', 'Catchball en 5 points', 'Catchball en 11 points', 'Catchball en double, 8 points', 'Catchball en double à 2 balles, 11 points', 'Double avec une seule raquette', 'Jouer à cloche-pied', 'Faire un tour sur soi-même entre 2 touches', 'Match avec sur-filet (passer au-dessus)', 'Tu perds le point si tu fais ralentir la balle'] },
  { id: 'vierge', name: 'Fiche vierge', levels: Array(10).fill('') },
];
/** Couleurs des niveaux (comme les fiches : du cyan en bas au rose en haut). */
export const LEVEL_COLORS = ['#d3f3f6', '#d0eef8', '#d2e6fa', '#d6dffb', '#dcd8fb', '#e3d3f9', '#ead0f5', '#f1cdee', '#f6cce3', '#f8ced6'];

export function monteeOf(act) {
  act.montee ??= { sheet: 'matchs', sheets: {}, place: {} };
  return act.montee;
}
export const criteria = (M, id = M.sheet) => M.sheets[id] || MONTEE_SHEETS.find((s) => s.id === id)?.levels || Array(10).fill('');
export const placeOf = (M, id = M.sheet) => (M.place[id] ??= {});
export function setLevel(M, sid, level) {
  const p = placeOf(M);
  if (level == null || level < 1) delete p[sid]; else p[sid] = Math.min(10, Math.max(1, level));
}
/** Hauteur relative de chaque niveau à l'écran : un niveau vide reste petit, un niveau occupé grandit avec ses élèves. */
export function weights(M, sids) {
  const p = placeOf(M);
  const counts = Array(10).fill(0);
  for (const s of sids) if (p[s]) counts[p[s] - 1]++;
  return counts.map((n) => (n ? 1 + n * 0.55 : 0));
}
