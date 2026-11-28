// Onglet « Séance du jour » de la classe (1.13) : présents / absents / dispensés / inaptes d'un toucher,
// dernières équipes de la séquence, tirage au sort d'un élève. Tous les outils de la classe en tiennent compte.
import { app, go, render } from '../app.js';
import { h, btn, icon, toast } from './dom.js';
import { collator } from '../util.js';
import { studentLabel } from '../data/schema.js';
import { activitiesOf } from '../logic/activities.js';
import { teamsOnly, teamLabel, teamColorId, vestOf } from '../logic/teams.js';
import { buzz } from './foundations.js';
import * as TD from '../logic/today.js';

const D = { last: null, shown: null };

/** Dernière composition d'équipes de la classe (toutes activités), avec son activité. */
export function latestTeams(cls) {
  let best = null;
  for (const a of activitiesOf(cls)) for (const s of a.equipes?.sets || []) if (!best || (s.createdAt || 0) > (best.set.createdAt || 0)) best = { act: a, set: s };
  return best;
}

export function todayTab(cls) {
  const students = cls.students.filter((s) => s.active !== false).sort((a, b) => collator.compare(studentLabel(a), studentLabel(b)));
  const c = TD.countsToday(cls, students);
  const save = () => app.repo.save('classes', cls);
  const tapStudent = (s) => { TD.setToday(cls, s.id, TD.nextStatus(TD.statusToday(cls, s.id))); buzz('tap'); save(); render(); };
  const lt = latestTeams(cls);
  const pick = () => { const s = TD.draw(cls, students, D.last); if (!s) return toast('Aucun élève présent.'); D.last = s.id; D.shown = s.id; buzz('change'); render(); };
  const shown = students.find((s) => s.id === D.shown);
  return h('div', { class: 'today grow' },
    h('section', { class: 'tdmain' },
      h('div', { class: 'tdcounts' }, ['present', 'absent', 'dispense', 'inapte'].map((k) => h('span', { class: `tdc ${k}` }, h('b', null, String(c[k])), ` ${TD.TODAY_ST[k]}${c[k] > 1 && k !== 'present' ? 's' : c[k] > 1 ? 's' : ''}`)),
        h('span', { class: 'muted small grow', style: { textAlign: 'right' } }, 'Toucher un prénom : présent → absent → dispensé → inapte')),
      h('div', { class: 'tdgrid' }, students.map((s) => { const st = TD.statusToday(cls, s.id); return h('button', { type: 'button', class: `tdst ${st}`, 'data-sid': s.id, onClick: () => tapStudent(s) },
        h('b', null, studentLabel(s)), h('span', null, TD.TODAY_ST[st])); }))),
    h('aside', { class: 'tdside' },
      h('div', { class: 'panel tddraw' }, h('h3', null, 'Tirer un élève au sort'),
        shown ? h('div', { class: 'tdname' }, studentLabel(shown)) : h('p', { class: 'muted small' }, 'Parmi les élèves qui pratiquent aujourd\'hui.'),
        btn(shown ? 'Un autre' : 'Tirer au sort', { icon: 'shuffle', cls: 'primary bigbtn', onClick: pick })),
      h('div', { class: 'panel tdteams' }, h('h3', null, 'Dernières équipes'),
        lt ? [h('div', { class: 'muted small' }, `${lt.act.name} · ${lt.set.name || 'Composition'}`),
          h('div', { class: 'tdtlist' }, teamsOnly(lt.set).map((t) => h('div', { class: 'tdteam', style: { '--v': vestOf(teamColorId(lt.set, t)).hex } },
            h('b', null, teamLabel(lt.set, t)), h('span', null, t.members.map((sid) => { const s = cls.students.find((x) => x.id === sid); return s ? (TD.practices(cls, sid) ? studentLabel(s) : `(${studentLabel(s)})`) : null; }).filter(Boolean).join(', '))))),
          btn('Ouvrir les équipes', { icon: 'teams', onClick: () => go('equipes', { from: 'classPage', classId: cls.id, scope: 'act', actId: lt.act.id, setId: lt.set.id, direct: 1 }) })]
          : h('p', { class: 'muted small' }, 'Aucune composition pour l\'instant (outil Équipes d\'une activité).')),
      c.absent + c.dispense + c.inapte ? btn('Tout le monde présent', { cls: 'small soft', onClick: () => { const snap = { ...TD.todayOf(cls).status }; TD.todayOf(cls).status = {}; save(); render(); toast('Tout le monde est présent.', { action: 'Annuler', ms: 8000, onAction: () => { TD.todayOf(cls).status = snap; save(); render(); } }); } }) : null));
}
