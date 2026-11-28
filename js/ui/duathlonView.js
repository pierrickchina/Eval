// Fiches Duathlon : affichage des fiches élèves 4e / 3e importées (images), rien d'autre.
// Les élèves remplissent les fiches papier ; la note se calcule dans l'évaluation.
import { registerView, go, render, back as navBack } from '../app.js';
import { h, iconBtn, popMenu } from './dom.js';
import { helpItem } from './help.js';

const V = { grade: '4e' };

registerView('duathlon', (r) => {
  const back = () => navBack(() => (r.from === 'classPage' && r.classId ? go('classPage', { id: r.classId }) : go('home')));
  const m = iconBtn('more', 'Options', () => popMenu(m, [helpItem('duathlon')]), 'boxed');
  return h('div', { class: 'main duathlon' },
    h('div', { class: 'topbar' }, iconBtn('back', 'Retour', back, '', { 'data-back': '1' }),
      h('div', { class: 'grow evtitle' }, h('h1', null, 'Fiches Duathlon'), h('div', { class: 'sub' }, `Fiches élèves ${V.grade}`)),
      h('div', { class: 'seg' }, ['4e', '3e'].map((g) => h('button', { type: 'button', class: V.grade === g ? 'on' : '', onClick: () => { V.grade = g; render(); } }, g))), m),
    h('div', { class: 'scroll grow', 'data-keep': 'du' },
      h('div', { class: 'duimgs' }, [1, 2].map((p) => h('figure', null,
        h('img', { src: `img/duathlon/fiche-${V.grade}-${p}.jpg`, alt: `Fiche duathlon ${V.grade}, page ${p}`, loading: 'lazy' }))))));
});
