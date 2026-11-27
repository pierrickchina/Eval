// Aide courte (3 lignes) par outil : bouton « ? » discret.
import { h, openDialog, iconBtn } from './dom.js';
import { TOOLS } from '../logic/activities.js';

export function showHelp(type) {
  const t = TOOLS[type];
  if (!t?.help) return;
  openDialog({ title: t.label, body: h('ul', { class: 'helplist' }, t.help.map((l) => h('li', null, l))), actions: [{ label: 'Compris', primary: true }] });
}
export const helpButton = (type) => iconBtn('help', `Aide : ${TOOLS[type]?.label || ''}`, () => showHelp(type), 'boxed');

/** Entrée « Aide » à placer dans un menu ⋮ (l'aide n'apparaît plus dans la barre principale). */
export const helpItem = (type) => ({ label: 'Aide', onClick: () => showHelp(type) });
