// Outil Certificat de rôle (1.13), dans une activité : un certificat par rôle (arbitre, juge-spectateur, coach),
// 4 niveaux dans les mots de l'élève. Auto-évaluation (repère dans la liste) et validation par l'enseignant.
import { app, registerView, go, render, back as navBack } from '../app.js';
import { h, btn, icon, iconBtn, openDialog, popMenu, toast } from './dom.js';
import { collator, clone } from '../util.js';
import { studentLabel } from '../data/schema.js';
import { activitiesOf, touchTool } from '../logic/activities.js';
import { helpItem } from './help.js';
import { whistleBadge } from './badges.js';
import { practices } from '../logic/today.js';
import * as AR from '../logic/arbitre.js';

const V = { filter: null, role: null };

registerView('arbitre', (r) => {
  const cls = app.repo.get('classes', r.classId);
  const act = cls ? activitiesOf(cls).find((a) => a.id === r.actId) : null;
  if (!act) { queueMicrotask(() => go('home')); return h('div'); }
  const A = AR.arbitreOf(act);
  const role = AR.roleOf(A, V.role);
  const save = () => { touchTool(act, 'arbitre'); return app.repo.save('classes', cls); };
  const students = cls.students.filter((s) => s.active !== false).sort((a, b) => collator.compare(studentLabel(a), studentLabel(b)));
  const c = AR.counts(A, role.id, students.map((s) => s.id));
  const nSelf = students.filter((s) => AR.selfDone(A, s.id, role.id)).length;
  const shown = V.filter == null ? students : V.filter === 'self' ? students.filter((s) => !AR.selfDone(A, s.id, role.id)) : students.filter((s) => (AR.levelOf(A, s.id, role.id) ?? 0) === V.filter);
  const m = iconBtn('more', 'Options', () => popMenu(m, [
    { label: 'Réglages (rôles, niveaux, critères)…', onClick: () => settingsDialog(act, A, () => { save(); render(); }) },
    helpItem('arbitre'),
  ]), 'boxed');
  const metal = (lv, size = 18) => (lv ? h('i', { class: `whistle ${AR.WHISTLE[lv].name}`, style: { '--w': AR.WHISTLE[lv].color } }, icon(AR.KINDS[role.kind]?.icon || 'whistle', size)) : null);
  const chip = (lv, n) => h('button', { type: 'button', class: `arcount ${V.filter === lv ? 'on' : ''}`, onClick: () => { V.filter = V.filter === lv ? null : lv; render(); } }, metal(lv), h('span', null, `${role.levels[lv]} : ${n}`));
  const card = (s) => {
    const lv = AR.levelOf(A, s.id, role.id);
    const done = AR.selfDone(A, s.id, role.id);
    return h('button', { type: 'button', class: `arcard l${lv ?? 0} ${practices(cls, s.id) ? '' : 'off-today'}`, onClick: () => studentDialog(act, A, role, s, () => { save(); render(); }) },
      h('div', { class: 'arname' }, h('b', null, studentLabel(s)), metal(lv, 22)),
      h('div', { class: 'arlv' }, role.levels[lv ?? 0]),
      A.modes.self ? h('div', { class: `arself ${done ? 'on' : ''}` }, done ? '✓ Auto-évaluation faite' : 'Auto-évaluation à faire') : null);
  };
  return h('div', { class: 'main arbitre' },
    h('div', { class: 'topbar' }, iconBtn('back', 'Retour', () => navBack(() => go('classPage', { id: cls.id })), '', { 'data-back': '1' }),
      h('div', { class: 'grow evtitle' }, h('h1', null, 'Certificat de rôle'), h('div', { class: 'sub' }, `${act.name} · ${cls.name}`)),
      A.roles.length > 1 ? h('div', { class: 'seg' }, A.roles.map((ro) => h('button', { type: 'button', class: ro.id === role.id ? 'on' : '', onClick: () => { V.role = ro.id; V.filter = null; render(); } }, icon(AR.KINDS[ro.kind]?.icon || 'whistle', 18), ` ${ro.label}`))) : null, m),
    h('div', { class: 'toolbar arcounts' }, chip(0, c[0]), chip(1, c[1]), chip(2, c[2]), chip(3, c[3]),
      A.modes.self ? h('button', { type: 'button', class: `arcount ${V.filter === 'self' ? 'on' : ''}`, onClick: () => { V.filter = V.filter === 'self' ? null : 'self'; render(); } }, `Auto-éval. faites : ${nSelf} / ${students.length}`) : null),
    h('div', { class: 'scroll grow argrid', 'data-keep': 'ar' }, shown.length ? shown.map(card) : h('p', { class: 'muted' }, 'Aucun élève ici.')));
});

/** Fiche d'un élève pour un rôle : validation de l'enseignant, puis auto-évaluation (niveau + critères). */
function studentDialog(act, A, role, s, done) {
  const rec = clone(AR.recOf(A, s.id, role.id));
  const body = h('div', { class: 'ardlg' });
  const paint = () => body.replaceChildren(
    A.modes.teacher ? h('div', { class: 'field arteach' }, 'Validation de l\'enseignant (niveau retenu)', h('div', { class: 'arlvbtns' }, role.levels.map((l, i) => h('button', { type: 'button', class: `arlvbtn l${i} ${rec.level === i ? 'on' : ''}`, onClick: () => { rec.level = rec.level === i ? null : i; rec.levelAt = Date.now(); paint(); } },
      i ? h('i', { class: `whistle ${AR.WHISTLE[i].name}`, style: { '--w': AR.WHISTLE[i].color } }, icon(AR.KINDS[role.kind]?.icon || 'whistle', 22)) : h('i', { class: 'whistle' }, icon('close', 22)), h('span', null, l))))) : null,
    A.modes.self ? h('div', { class: 'field' }, 'Auto-évaluation : je pense être…', h('div', { class: 'seg arself4' }, role.levels.map((l, i) => h('button', { type: 'button', class: rec.selfLevel === i ? 'on' : '', onClick: () => { rec.selfLevel = i; paint(); } }, l)))) : null,
    A.modes.self ? h('div', { class: 'arcrits' }, role.criteria.map((c) => h('div', { class: 'arcrit' }, h('b', null, c.name), h('span', null, c.text),
      h('div', { class: 'seg arscale' }, AR.SELF_SCALE.map((l, i) => h('button', { type: 'button', class: rec.self[c.id] === i ? 'on' : '', onClick: () => { rec.self[c.id] = i; paint(); } }, l)))))) : null);
  paint();
  openDialog({ title: `${studentLabel(s)} · ${role.label}`, wide: true, body, actions: [{ label: 'Annuler' }, { label: 'Enregistrer', primary: true, onClick: () => { (A.students[s.id] ??= {})[role.id] = rec; done(); } }] });
}

function settingsDialog(act, A, done) {
  const S = clone({ roles: A.roles, modes: A.modes });
  const body = h('div', { class: 'dlg-body kvdlg' });
  const sw = (k, label) => h('label', { class: 'row' }, h('input', { type: 'checkbox', checked: S.modes[k] !== false, style: { width: '22px', height: '22px' }, onChange: (e) => { S.modes[k] = e.target.checked; } }), h('span', null, label));
  const paint = () => body.replaceChildren(
    h('div', { class: 'field' }, 'Évaluation', sw('self', 'Auto-évaluation par l\'élève'), sw('teacher', 'Validation par l\'enseignant (c\'est elle qui fixe le niveau)')),
    ...S.roles.map((ro, ri) => h('div', { class: 'panel', style: { padding: '10px' } },
      h('div', { class: 'row' }, h('select', { 'aria-label': 'Type de rôle', onChange: (e) => { ro.kind = e.target.value; } }, Object.entries(AR.KINDS).map(([k, x]) => h('option', { value: k, selected: ro.kind === k }, x.label))),
        h('input', { type: 'text', value: ro.label, 'aria-label': 'Nom du rôle', style: { flex: 1 }, onChange: (e) => { ro.label = e.target.value.trim() || ro.label; } }),
        S.roles.length > 1 ? iconBtn('trash', 'Retirer ce rôle', () => { S.roles.splice(ri, 1); paint(); }, 'sm') : null),
      h('div', { class: 'field' }, 'Niveaux (dans les mots de l\'élève)', h('div', { class: 'arlvedit' }, ro.levels.map((l, i) => h('input', { type: 'text', value: l, 'aria-label': `Niveau ${i + 1}`, onChange: (e) => { ro.levels[i] = e.target.value.trim() || l; } })))),
      h('div', { class: 'field' }, 'Critères d\'auto-évaluation', ...ro.criteria.map((c) => h('div', { class: 'row' },
        h('input', { type: 'text', value: c.name, 'aria-label': 'Nom du critère', style: { width: '9em' }, onChange: (e) => { c.name = e.target.value.trim() || c.name; } }),
        h('input', { type: 'text', value: c.text, 'aria-label': 'Description', style: { flex: 1 }, onChange: (e) => { c.text = e.target.value; } })))))),
    h('div', { class: 'row wrap' },
      btn('Ajouter un rôle', { icon: 'plus', cls: 'small soft', disabled: S.roles.length >= 3, onClick: () => { const used = new Set(S.roles.map((x) => x.kind)); const kind = ['arbitre', 'coach', 'juge'].find((k) => !used.has(k)) || 'arbitre'; const base = AR.defaultRoles(kind === 'coach' ? 'circuit' : kind === 'juge' ? 'acrosport' : '')[0]; S.roles.push({ id: `r${Date.now().toString(36)}`, ...clone(base) }); paint(); } }),
      btn('Rôles d\'origine pour cette activité', { cls: 'small soft', onClick: () => { S.roles = AR.defaultRoles(act.name).map((x, i) => ({ id: S.roles[i]?.id || `r${i + 1}`, ...x })); paint(); } })));
  paint();
  openDialog({ title: 'Réglages du certificat de rôle', body, wide: true, actions: [{ label: 'Annuler' }, { label: 'Enregistrer', primary: true, onClick: () => { A.roles = S.roles; A.modes = S.modes; done(); toast('Réglages enregistrés.'); } }] });
}
