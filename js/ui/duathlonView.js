// Fiches d'observation Duathlon (EN TRAVAUX) : affichage seul des fiches élèves 4e / 3e et de leurs barèmes.
// Rien à remplir pour l'instant : les élèves utilisent les fiches papier ; la note se calcule dans l'évaluation.
import { app, registerView, go, render } from '../app.js';
import { h, iconBtn, popMenu } from './dom.js';
import { LEVELS, defaultLevels } from '../data/schema.js';
import { libraryModels } from '../data/library.js';
import { helpItem } from './help.js';
import { uid } from '../util.js';

const V = { grade: '4e' };

registerView('duathlon', (r) => {
  const grid = libraryModels({ uid, defaultLevels }).find((m) => m.activity === 'Duathlon').levels[V.grade].competences;
  const back = () => (r.from === 'classPage' && r.classId ? go('classPage', { id: r.classId }) : go('home'));
  const m = iconBtn('more', 'Options', () => popMenu(m, [helpItem('duathlon')]), 'boxed');
  const zones = (label) => h('div', { class: 'dufield' }, h('span', null, label), h('div', { class: 'duzones' }, [1, 2, 3, 4, 5].map((z) => h('i', null, String(z)))));
  const fiche = h('section', { class: 'dufiche' },
    h('h2', null, `Duathlon ${V.grade}`),
    h('div', { class: 'dufield' }, h('span', null, 'Athlète'), h('i', { class: 'dline' })),
    h('div', { class: 'dufield' }, h('span', null, 'Coach'), h('i', { class: 'dline' })),
    h('div', { class: 'dufield' }, h('span', null, 'Projet temps'), h('i', { class: 'dline short' })),
    zones('Projet lancer'),
    h('div', { class: 'durun' },
      h('div', { class: 'dustep' }, h('b', null, '4 tours')), h('div', { class: 'duarrow' }, '→'),
      h('div', { class: 'dustep throw' }, h('b', null, 'Lancer')), h('div', { class: 'duarrow' }, '→'),
      h('div', { class: 'dustep' }, h('b', null, '2 tours')), h('div', { class: 'duarrow' }, '→'),
      h('div', { class: 'dustep throw' }, h('b', null, 'Lancer')), h('div', { class: 'duarrow' }, '→'),
      h('div', { class: 'dustep' }, h('b', null, '1 tour'))),
    h('p', { class: 'muted small', style: { textAlign: 'center', margin: '4px 0 10px' } }, '1400 m et 2 lancers'),
    h('div', { class: 'dufield' }, h('span', null, 'Temps total'), h('i', { class: 'dline short' }), h('span', null, 'min'), h('i', { class: 'dline short' }), h('span', null, 's')),
    zones('Zone de lancer 1'), zones('Zone de lancer 2'));
  const bareme = h('section', { class: 'dubareme' },
    h('h2', null, `Évaluation ${V.grade} · ${grid.reduce((a, c) => a + c.max, 0)} points`),
    h('div', { style: { overflowX: 'auto' } }, h('table', { class: 'edit dutab' },
      h('thead', null, h('tr', null, h('th', null, 'Compétence'), LEVELS.map((l) => h('th', { class: `lvh-${l.key}` }, `${l.symbol} ${l.label}`)))),
      h('tbody', null, grid.map((c) => h('tr', null, h('th', null, `${c.name} /${c.max}`), c.levels.map((l) => h('td', null, l.text))))))));
  return h('div', { class: 'main duathlon' },
    h('div', { class: 'topbar' }, iconBtn('back', 'Retour', back, '', { 'data-back': '1' }),
      h('div', { class: 'grow evtitle' }, h('h1', null, 'Fiches Duathlon'), h('div', { class: 'sub' }, 'En travaux : affichage seul')),
      h('div', { class: 'seg' }, ['4e', '3e'].map((g) => h('button', { type: 'button', class: V.grade === g ? 'on' : '', onClick: () => { V.grade = g; render(); } }, g))), m),
    h('div', { class: 'ldhint warnbg' }, 'Outil en travaux : rien à remplir ici pour l\'instant. Les élèves utilisent les fiches papier ; la note se calcule dans l\'évaluation (fiche de l\'élève › Saisir).'),
    h('div', { class: 'scroll grow dulayout', 'data-keep': 'du' }, fiche, bareme,
      h('div', { class: 'duimgs' }, [1, 2].map((p) => h('figure', null, h('figcaption', null, p === 1 ? `Fiche élève ${V.grade} (recto)` : `Fiche élève ${V.grade} (barème)`),
        h('img', { src: `img/duathlon/fiche-${V.grade}-${p}.jpg`, alt: `Fiche duathlon ${V.grade}, page ${p}`, loading: 'lazy' }))))));
});
