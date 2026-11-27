// Accueil : deux onglets « Classes » (tuiles) et « Outils » (outils libres), tri/filtre des classes.
import { app, registerView, go, render, syncChip } from '../app.js';
import { h, btn, classBadge, openDialog } from './dom.js';
import { fmtDate, todayISO, collator } from '../util.js';
import { duplicateEvaluation } from '../logic/evaluation.js';
import { SCHOOL_LEVELS } from '../data/schema.js';
import { FREE_TOOLS, TOOLS, activitiesOf } from '../logic/activities.js';
import { shareBackup, backupText, backupNeedsAttention, changesSinceBackup } from './backup.js';

const F = { tab: 'classes', sort: 'level', level: '' }; // état conservé entre deux visites
const lvIdx = (l) => { const i = SCHOOL_LEVELS.indexOf(l); return i < 0 ? 99 : i; };

registerView('home', () => {
  const repo = app.repo;
  const classes = repo.list('classes');
  const evals = repo.list('evaluations').filter((e) => !e.deleted);
  const levels = SCHOOL_LEVELS.filter((l) => classes.some((c) => c.level === l));
  if (F.level && !levels.includes(F.level)) F.level = '';
  const list = classes.filter((c) => !F.level || c.level === F.level).sort(F.sort === 'name'
    ? (a, b) => collator.compare(a.name, b.name)
    : (a, b) => lvIdx(a.level) - lvIdx(b.level) || collator.compare(a.name, b.name));

  const tabs = h('div', { class: 'seg' }, [['classes', 'Classes'], ['tools', 'Outils']].map(([k, l]) =>
    h('button', { class: F.tab === k ? 'on' : '', onClick: () => { F.tab = k; render(); } }, l)));

  return h('div', { class: 'main' },
    h('div', { class: 'topbar' },
      h('div', { class: 'grow evtitle' }, h('h1', null, 'EPS'), h('div', { class: 'sub' }, F.tab === 'classes' ? 'Mes classes' : 'Outils')),
      syncChip(),
      btn('Réglages', { icon: 'gear', onClick: () => go('settings') })),
    classes.length || evals.length ? backupBar() : null,
    h('div', { class: 'toolbar' }, tabs,
      F.tab === 'classes' && classes.length ? [
        h('select', { 'aria-label': 'Niveau', value: F.level, onChange: (e) => { F.level = e.target.value; render(); } },
          h('option', { value: '' }, 'Tous les niveaux'), levels.map((l) => h('option', { value: l }, l))),
        h('div', { class: 'seg' }, [['level', 'Niveau'], ['name', 'Nom']].map(([k, l]) =>
          h('button', { class: F.sort === k ? 'on' : '', onClick: () => { F.sort = k; render(); } }, l))),
      ] : null),
    F.tab === 'classes' ? classesTab(list, classes, evals) : toolsTab());
});

function classesTab(list, classes, evals) {
  if (!classes.length) {
    return h('div', { class: 'empty' }, h('h2', null, 'Bienvenue 👋'),
      h('p', null, 'Pour commencer, créez vos classes et vos modèles d\'évaluation dans les réglages.'),
      btn('Ouvrir les réglages', { icon: 'gear', cls: 'primary', onClick: () => go('settings') }));
  }
  return h('div', { class: 'home-grid scroll grow', 'data-keep': 'home' }, list.map((c) => {
    const n = evals.filter((e) => e.classId === c.id).length;
    const na = activitiesOf(c).length;
    const open = () => go('classPage', { id: c.id });
    return h('div', { class: 'card', role: 'button', tabindex: 0, onClick: open, onKeydown: (e) => { if (e.key === 'Enter') open(); } },
      classBadge(c.color, 48),
      h('div', { class: 'body' }, h('div', { class: 't' }, c.name),
        h('div', { class: 'a' }, `${c.level}${c.year ? ' · ' + c.year : ''}`),
        h('div', { class: 'd' }, `${c.students.filter((s) => s.active !== false).length} élèves · ${na} activité${na > 1 ? 's' : ''} · ${n} évaluation${n > 1 ? 's' : ''}`)));
  }));
}

/** Outils libres : pas encore d'outil disponible ; le « + » ouvre la liste des outils (structure prête). */
function toolsTab() {
  const add = () => openDialog({
    title: 'Ajouter un outil',
    body: [
      FREE_TOOLS.length ? null : h('p', { class: 'dlg-msg' }, 'Aucun outil libre n\'est disponible pour le moment. Ils arriveront dans les prochaines versions.'),
      h('p', { class: 'muted small', style: { margin: 0 } }, 'Prévus :'),
      Object.entries(TOOLS).filter(([, t]) => !t.available).map(([, t]) => h('div', { class: 'row', style: { opacity: .6 } }, h('span', null, t.label), h('span', { class: 'muted small' }, 'bientôt'))),
    ],
    actions: [{ label: 'Fermer', primary: true }],
  });
  return h('div', { class: 'scroll grow' },
    h('div', { class: 'empty' }, h('h2', null, 'Pas encore d\'outil libre'),
      h('p', null, 'Les outils utilisables sans classe (chronomètre, tirage au sort…) apparaîtront ici. Les outils liés à une classe se trouvent dans son carnet de bord.'),
      btn('Ajouter un outil', { icon: 'plus', cls: 'primary', onClick: add })));
}

/** Rappel discret de la dernière sauvegarde, avec bouton de partage (Drive…) en une touche. */
function backupBar() {
  const warn = backupNeedsAttention(), n = changesSinceBackup();
  return h('div', { class: `backupbar ${warn ? 'warn' : ''}` },
    h('span', { class: 'grow' }, `${warn ? '⚠ ' : '✓ '}${backupText()}`, n && warn ? ` · ${n} élément(s) modifié(s) depuis` : ''),
    btn('Sauvegarder', { icon: 'cloud', cls: 'small', onClick: async () => { await shareBackup(); render(); } }));
}

// ---------- Duplication ----------

export function duplicateDialog(ev) {
  const repo = app.repo;
  const cls = repo.get('classes', ev.classId);
  const o = { date: todayISO(), groups: true, results: false, sync: !!cls && !cls.deleted };
  const chk = (key, label, hint) =>
    h('label', { class: 'row', style: { alignItems: 'flex-start' } },
      h('input', { type: 'checkbox', checked: o[key], style: { width: '22px', height: '22px', marginTop: '2px' }, onChange: (e) => { o[key] = e.target.checked; } }),
      h('span', null, label, hint ? h('div', { class: 'muted small' }, hint) : null));
  openDialog({
    title: 'Dupliquer l\'évaluation',
    body: [
      h('p', { class: 'muted', style: { margin: 0 } }, `${ev.classInfo.name} · ${ev.model.activity} (${fmtDate(ev.date)})`),
      h('label', { class: 'field' }, 'Date de la nouvelle évaluation', h('input', { type: 'date', value: o.date, onChange: (e) => { o.date = e.target.value || todayISO(); } })),
      chk('groups', 'Reprendre les équipes et groupes de niveau'),
      cls && !cls.deleted ? chk('sync', 'Mettre à jour la liste d\'élèves avec la classe actuelle', 'Inclut les élèves arrivés depuis ; retire ceux qui sont partis.') : null,
      chk('results', 'Copier aussi les résultats et statuts', 'Par défaut, la nouvelle évaluation démarre vide.'),
    ],
    actions: [{ label: 'Annuler' }, { label: 'Dupliquer', primary: true, onClick: async () => {
      const copy = duplicateEvaluation(ev, { date: o.date, cls: o.sync ? cls : null, keepGroups: o.groups, keepResults: o.results, syncStudents: o.sync });
      await repo.save('evaluations', copy);
      go('eval', { id: copy.id, from: 'classPage', classId: ev.classId });
    } }],
  });
}
