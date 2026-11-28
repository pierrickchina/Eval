// Petits repères à côté du prénom : badge de chaque rôle certifié dans l'activité (1.13 : arbitre, juge-spectateur, coach),
// en bronze / argent / or.
import { h, icon } from './dom.js';
import { badgesOf } from '../logic/arbitre.js';

export function whistleBadge(act, sid, size = 16) {
  const list = act?.arbitre?.roles ? badgesOf(act.arbitre, sid) : [];
  if (!list.length) return null;
  return h('span', { class: 'rolebadges' }, list.map((b) => h('i', { class: `whistle ${b.metal.name}`, title: b.title, style: { '--w': b.metal.color } }, icon(b.icon, size))));
}
