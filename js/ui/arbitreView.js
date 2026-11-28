// Outil Certification d'arbitre (1.12), dans une activité : un certificat par activité, 4 niveaux, 4 critères pré-remplis.
// Auto-évaluation, avis des pairs, validation par l'enseignant : chacun s'active ou non (⋮ › Réglages) et se combine.
import { app, registerView, go, render, back as navBack } from '../app.js';
import { h, btn, icon, iconBtn, openDialog, popMenu, toast } from './dom.js';
import { collator, clone } from '../util.js';
import { studentLabel } from '../data/schema.js';
import { activitiesOf, touchTool } from '../logic/activities.js';
import { helpItem } from './help.js';
import { buzz } from './foundations.js';
import { whistleBadge } from './badges.js';
import * as AR from '../logic/arbitre.js';

const V = { filter: null };

registerView('arbitre', (r) => {
  const cls = app.repo.get('classes', r.classId);
  const act = cls ? activitiesOf(cls).find((a) => a.id === r.actId) : null;
  if (!act) { queueMicrotask(() => go('home')); return h('div'); }
  const A = AR.arbitreOf(act);
  const save = () => { touchTool(act, 'arbitre'); return app.repo.save('classes', cls); };
  const students = cls.students.filter((s) => s.active !== false).sort((a, b) => collator.compare(studentLabel(a), studentLabel(b)));
  const { c, none } = AR.counts(A, students.map((s) => s.id));
  const shown = V.filter == null ? students : students.filter((s) => (AR.levelOf(A, s.id) ?? 0) === V.filter);
  const m = iconBtn('more', 'Options', () => popMenu(m, [
    { label: 'Réglages (évaluations, niveaux, critères)…', onClick: () => settingsDialog(act, A, () => { save(); render(); }) },
    helpItem('arbitre'),
  ]), 'boxed');
  const chip = (lv, n) => h('button', { type: 'button', class: `arcount ${V.filter === lv ? 'on' : ''}`, onClick: () => { V.filter = V.filter === lv ? null : lv; render(); } },
    lv ? h('i', { class: `whistle ${AR.WHISTLE[lv].name}`, style: { '--w': AR.WHISTLE[lv].color } }, icon('whistle', 18)) : null, h('span', null, `${A.levels[lv]} : ${n}`));
  const card = (s) => {
    const lv = AR.levelOf(A, s.id);
    const rec = A.students[s.id];
    const nPeer = rec?.peers?.length || 0;
    const selfDone = rec && Object.keys(rec.self || {}).length;
    return h('button', { type: 'button', class: `arcard l${lv ?? 0}`, onClick: () => studentDialog(act, A, s, () => { save(); render(); }) },
      h('div', { class: 'arname' }, h('b', null, studentLabel(s)), whistleBadge(act, s.id, 22)),
      h('div', { class: 'arlv' }, A.levels[lv ?? 0]),
      h('div', { class: 'armarks' },
        A.modes.self ? h('span', { class: selfDone ? 'on' : '' }, selfDone ? '✓ auto-éval.' : 'auto-éval. —') : null,
        A.modes.peer ? h('span', { class: nPeer ? 'on' : '' }, `${nPeer} avis`) : null));
  };
  return h('div', { class: 'main arbitre' },
    h('div', { class: 'topbar' }, iconBtn('back', 'Retour', () => navBack(() => go('classPage', { id: cls.id })), '', { 'data-back': '1' }),
      h('div', { class: 'grow evtitle' }, h('h1', null, 'Certification d\'arbitre'), h('div', { class: 'sub' }, `${act.name} · ${cls.name}`)), m),
    h('div', { class: 'toolbar arcounts' }, chip(0, c[0] + none), chip(1, c[1]), chip(2, c[2]), chip(3, c[3])),
    h('div', { class: 'scroll grow argrid', 'data-keep': 'ar' }, shown.length ? shown.map(card) : h('p', { class: 'muted' }, 'Aucun élève à ce niveau.')));
});

/** Fiche d'un élève : les sections actives (auto-évaluation, avis des pairs, validation). */
function studentDialog(act, A, s, done) {
  const rec = clone(AR.recOf(A, s.id));
  const body = h('div', { class: 'ardlg' });
  const peerDraft = {};
  const paint = () => {
    const sum = (() => { const tmp = { ...A, students: { [s.id]: rec } }; return AR.peerSummary(tmp, s.id); })();
    body.replaceChildren(
      A.modes.teacher ? h('div', { class: 'field arteach' }, 'Validation de l\'enseignant (niveau retenu)', h('div', { class: 'arlvbtns' }, A.levels.map((l, i) => h('button', { type: 'button', class: `arlvbtn l${i} ${rec.level === i ? 'on' : ''}`, onClick: () => { rec.level = rec.level === i ? null : i; rec.levelAt = Date.now(); paint(); } },
        i ? h('i', { class: `whistle ${AR.WHISTLE[i].name}`, style: { '--w': AR.WHISTLE[i].color } }, icon('whistle', 22)) : h('i', { class: 'whistle' }, icon('close', 22)), h('span', null, l))))) : null,
      A.modes.self ? h('div', { class: 'field' }, 'Auto-évaluation : je pense être…', h('div', { class: 'seg arself' }, A.levels.map((l, i) => h('button', { type: 'button', class: rec.selfLevel === i ? 'on' : '', onClick: () => { rec.selfLevel = i; paint(); } }, l)))) : null,
      h('div', { class: 'arcrits' }, A.criteria.map((c) => h('div', { class: 'arcrit' }, h('b', null, c.name), h('span', null, c.text),
        A.modes.self ? h('div', { class: 'seg arscale' }, AR.SELF_SCALE.map((l, i) => h('button', { type: 'button', class: rec.self[c.id] === i ? 'on' : '', onClick: () => { rec.self[c.id] = i; paint(); } }, l))) : null,
        A.modes.peer ? h('div', { class: 'arpeer' },
          h('span', { class: 'muted small' }, 'Pairs : ', Object.entries(AR.PEER).map(([k, e]) => `${e} ${sum[c.id][k]}`).join('  ')),
          h('div', { class: 'seg sm' }, Object.entries(AR.PEER).map(([k, e]) => h('button', { type: 'button', class: peerDraft[c.id] === k ? 'on' : '', 'aria-label': `Avis ${k}`, onClick: () => { peerDraft[c.id] = k; paint(); } }, e)))) : null))),
      A.modes.peer ? h('div', { class: 'row', style: { justifyContent: 'flex-end' } }, btn('Ajouter cet avis d\'un camarade', { icon: 'plus', disabled: !Object.keys(peerDraft).length, onClick: () => { rec.peers.push({ at: Date.now(), crit: { ...peerDraft } }); for (const k of Object.keys(peerDraft)) delete peerDraft[k]; buzz('tap'); paint(); } })) : null);
  };
  paint();
  openDialog({ title: `${studentLabel(s)} · ${act.name}`, wide: true, body, actions: [{ label: 'Annuler' }, { label: 'Enregistrer', primary: true, onClick: () => { A.students[s.id] = rec; done(); } }] });
}

function settingsDialog(act, A, done) {
  const S = clone({ levels: A.levels, criteria: A.criteria, modes: A.modes });
  const body = h('div', { class: 'dlg-body kvdlg' });
  const sw = (k, label) => h('label', { class: 'row' }, h('input', { type: 'checkbox', checked: S.modes[k] !== false, style: { width: '22px', height: '22px' }, onChange: (e) => { S.modes[k] = e.target.checked; } }), h('span', null, label));
  const paint = () => body.replaceChildren(
    h('div', { class: 'field' }, 'Façons d\'évaluer (au choix, combinables)', sw('self', 'Auto-évaluation'), sw('peer', 'Avis des pairs'), sw('teacher', 'Validation par l\'enseignant (c\'est elle qui fixe le niveau)')),
    h('div', { class: 'field' }, 'Noms des niveaux', ...S.levels.map((l, i) => h('input', { type: 'text', value: l, onChange: (e) => { S.levels[i] = e.target.value.trim() || l; } }))),
    h('div', { class: 'field' }, 'Critères', ...S.criteria.map((c) => h('div', { class: 'panel', style: { padding: '8px' } },
      h('input', { type: 'text', value: c.name, 'aria-label': 'Nom du critère', onChange: (e) => { c.name = e.target.value.trim() || c.name; } }),
      h('textarea', { rows: 2, 'aria-label': 'Description', onInput: (e) => { c.text = e.target.value; } }, c.text)))),
    btn('Critères d\'origine pour cette activité', { cls: 'small soft', onClick: () => { S.criteria = AR.defaultCriteria(act.name); S.levels = AR.AR_LEVELS.slice(); paint(); } }));
  paint();
  openDialog({ title: 'Réglages de la certification', body, wide: true, actions: [{ label: 'Annuler' }, { label: 'Enregistrer', primary: true, onClick: () => { Object.assign(A, S); done(); toast('Réglages enregistrés.'); } }] });
}
