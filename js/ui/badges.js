// Petits repères à côté du prénom (1.12) : sifflet de certification d'arbitre (bronze / argent / or) de l'activité.
import { h, icon } from './dom.js';
import { whistleOf, AR_LEVELS } from '../logic/arbitre.js';

/** Sifflet de l'élève dans cette activité (rien s'il n'est pas certifié ou si l'activité n'a pas l'outil). */
export function whistleBadge(act, sid, size = 16) {
  const A = act?.arbitre;
  if (!A) return null;
  const w = whistleOf(A, sid);
  if (!w) return null;
  const lv = ['', 'bronze', 'argent', 'or'].indexOf(w.name);
  return h('i', { class: `whistle ${w.name}`, title: `${(A.levels || AR_LEVELS)[lv]} (sifflet ${w.name})`, style: { '--w': w.color } }, icon('whistle', size));
}
