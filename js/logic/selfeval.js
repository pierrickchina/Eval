// Auto-évaluation des élèves : stockée dans l'évaluation (ev.selfEval), totalement séparée des notes de l'enseignant.
//   ev.selfEval[sid] = { cells: { [cid]: { level, score } }, done: bool, u: horodatage }
// Elle n'influence jamais la note finale ni les moyennes.
import { now, r4 } from '../util.js';
import { proposedScore } from './model.js';

export const getSelf = (ev, sid) => ev.selfEval?.[sid] || null;
export const selfCell = (ev, sid, cid) => ev.selfEval?.[sid]?.cells?.[cid] || null;
export const selfDone = (ev, sid) => !!ev.selfEval?.[sid]?.done;

/** L'élève choisit un degré pour une compétence : la note est celle proposée par le modèle pour ce degré. */
export function setSelfLevel(ev, sid, cid, key, stamp = now()) {
  const comp = ev.model.competences.find((c) => c.id === cid);
  if (!comp) return false;
  ev.selfEval ??= {};
  const s = (ev.selfEval[sid] ??= { cells: {}, done: false, u: 0 });
  if (s.done) return false; // validée : verrouillée (l'enseignant peut la rouvrir)
  s.cells[cid] = { level: key, score: proposedScore(comp, key) };
  s.u = stamp;
  return true;
}

/** Totaux de l'auto-évaluation : note sur 20 seulement quand toutes les compétences sont renseignées. */
export function selfTotals(ev, sid) {
  const comps = ev.model.competences;
  let points = 0, filled = 0;
  for (const c of comps) {
    const cell = selfCell(ev, sid, c.id);
    if (cell?.score != null) { points += cell.score; filled++; }
  }
  const complete = comps.length > 0 && filled === comps.length;
  return { points: r4(points), filled, total: comps.length, complete, final: complete ? r4(points) : null, done: selfDone(ev, sid) };
}

/** Valide l'auto-évaluation (impossible tant que tout n'est pas renseigné). */
export function validateSelf(ev, sid, stamp = now()) {
  if (!selfTotals(ev, sid).complete) return false;
  ev.selfEval[sid].done = true;
  ev.selfEval[sid].u = stamp;
  return true;
}

/** Réservé à l'enseignant : rouvre l'auto-évaluation d'un élève (ou l'efface). */
export function reopenSelf(ev, sid, stamp = now()) {
  if (!ev.selfEval?.[sid]) return false;
  ev.selfEval[sid].done = false;
  ev.selfEval[sid].u = stamp;
  return true;
}

export function clearSelf(ev, sid, stamp = now()) {
  ev.selfEval ??= {};
  ev.selfEval[sid] = { cells: {}, done: false, u: stamp };
}
