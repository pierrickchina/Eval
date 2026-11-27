// Accueil : deux onglets « Classes » (tuiles) et « Outils » (outils libres), tri/filtre des classes.
import { app, registerView, go, render, syncChip } from '../app.js';
import { pinnedTools, togglePin, openFreeTool, pinnedStrip, resumeChip, createDemo, lastTask } from './foundations.js';
import { h, btn, icon, classBadge, openDialog, toast } from './dom.js';
import { fmtDate, todayISO, collator } from '../util.js';
import { duplicateEvaluation } from '../logic/evaluation.js';
import { SCHOOL_LEVELS } from '../data/schema.js';
import { TOOLS, toolColor, activitiesOf } from '../logic/activities.js';
import { shareBackup, backupText, backupNeedsAttention, changesSinceBackup } from './backup.js';

const F = { tab: 'classes', sort: 'level', level: '' }; // état conservé entre deux visites
const lvIdx = (l) => { const i = SCHOOL_LEVELS.indexOf(l); return i < 0 ? 99 : i; };

registerView('home', () => {
  const repo = app.repo;
  const classes = repo.list('classes');
  const evals = repo.list('evaluations').filter((e) => !e.deleted);
  const levels = SCHOOL_LEVELS.filter((l) => classes.some((c) => c.level === l));
  if (F.level && !levels.includes(F.level)) F.level = '';
  const list = classes.filter((c) => !F.level || c.level === F.level).sort((a, b) => lvIdx(a.level) - lvIdx(b.level) || collator.compare(a.name, b.name));

  const tabs = h('div', { class: 'seg' }, [['classes', 'Classes'], ['tools', 'Outils']].map(([k, l]) =>
    h('button', { class: F.tab === k ? 'on' : '', onClick: () => { F.tab = k; render(); } }, l)));

  return h('div', { class: 'main' },
    h('div', { class: 'topbar' },
      h('div', { class: 'brand', 'aria-label': 'PEPS' }, h('img', { src: 'icons/logo.svg', alt: '', width: 34, height: 34 }), h('span', null, 'PEPS')),
      h('div', { class: 'grow evtitle' }, h('h1', null, F.tab === 'classes' ? 'Mes classes' : 'Outils')),
      syncChip(),
      classes.length || evals.length ? backupChip() : null,
      btn('Réglages', { icon: 'gear', onClick: () => go('settings') })),
    pinnedRow(),
    h('div', { class: 'toolbar' }, tabs,
      F.tab === 'classes' && classes.length ? h('select', { 'aria-label': 'Niveau', value: F.level, onChange: (e) => { F.level = e.target.value; render(); } },
        h('option', { value: '' }, 'Tous les niveaux'), levels.map((l) => h('option', { value: l }, l))) : null,
      resumeChip({ compact: true })),
    F.tab === 'classes' ? classesTab(list, classes, evals) : toolsTab());
});

/** Outils épinglés (☆ de l'onglet Outils) : une ligne discrète sous la barre principale. */
function pinnedRow() {
  const b = pinnedStrip();
  return b ? h('div', { class: 'quickrow' }, b) : null;
}

function classesTab(list, classes, evals) {
  if (!classes.length) {
    return h('div', { class: 'empty' }, h('h2', null, 'Bienvenue 👋'),
      h('p', null, 'Pour commencer, créez vos classes et vos modèles d\'évaluation dans les réglages.'),
      h('div', { class: 'row', style: { justifyContent: 'center', flexWrap: 'wrap' } },
        btn('Ouvrir les réglages', { icon: 'gear', cls: 'primary', onClick: () => go('settings') }),
        btn('Essayer avec une classe de démonstration', { onClick: createDemo })));
  }
  return h('div', { class: 'home-grid scroll grow', 'data-keep': 'home' }, list.map((c) => {
    const nEl = c.students.filter((x) => x.active !== false).length;
    const open = () => go('classPage', { id: c.id });
    const lt = lastTask(c);
    return h('div', { class: 'card big', role: 'button', tabindex: 0, onClick: open, onKeydown: (e) => { if (e.key === 'Enter') open(); } },
      classBadge(c.color, 56),
      h('div', { class: 'body' }, h('div', { class: 't' }, c.name),
        h('div', { class: 'd' }, `${nEl} élève${nEl > 1 ? 's' : ''}`),
        lt ? h('button', { type: 'button', class: 'lasttask', onClick: (e) => { e.stopPropagation(); go(lt.route.name, lt.route); } }, icon('resume', 16), h('span', null, lt.label)) : null));
  }));
}

/** Outils libres : une tuile par outil (icône pastel, étoile pour épingler en haut de l'accueil) ; les outils à venir sont grisés. */
function toolsTab() {
  const pins = pinnedTools();
  const tile = ([type, t]) => {
    const pinned = pins.includes(type);
    const star = t.available ? h('button', { type: 'button', class: `pinbtn ${pinned ? 'on' : ''}`, 'aria-label': pinned ? 'Retirer de l\'accueil' : 'Épingler en haut de l\'accueil', 'aria-pressed': pinned,
      onClick: async (e) => { e.stopPropagation(); await togglePin(type); render(); } }, icon('star', 20)) : null;
    return h('div', { class: `tooltile big ${t.available ? '' : 'soon'}`, role: 'button', tabindex: 0, style: { '--tc': toolColor(type) },
      onClick: () => (t.available && t.free ? openFreeTool(type) : toast(t.available ? 'Cet outil se trouve dans le carnet de bord d\'une classe.' : `${t.label} : bientôt disponible.`)),
      onKeydown: (e) => { if (e.key === 'Enter') e.currentTarget.click(); } },
    h('div', { class: 'tilehead' }, icon(t.icon, 34), star), h('b', null, t.label), h('span', { class: 'muted small' }, t.available ? t.hint : 'bientôt'));
  };
  return h('div', { class: 'scroll grow listpad', 'data-keep': 'tools' },
    h('div', { class: 'tooltiles big' }, Object.entries(TOOLS).filter(([, t]) => t.free || !t.available).map(tile)),
    h('p', { class: 'muted small' }, 'Les outils libres s\'utilisent sans classe. L\'évaluation, elle, se trouve dans le carnet de bord de chaque classe.'));
}

/** Sauvegarde : une petite pastille dans la barre principale, juste avant « Réglages » (orange si une sauvegarde est conseillée). */
function backupChip() {
  const warn = backupNeedsAttention(), n = changesSinceBackup();
  const short = backupText().replace('Dernière sauvegarde : ', '').replace('Aucune sauvegarde pour l\'instant', 'jamais sauvegardé');
  return h('button', { type: 'button', class: `backupchip ${warn ? 'warn' : ''}`, title: `${backupText()}${n && warn ? ` · ${n} élément(s) modifié(s) depuis` : ''}. Toucher pour sauvegarder.`,
    onClick: async () => { await shareBackup(); render(); } },
  icon('cloud', 18), h('span', null, h('b', null, 'Sauvegarder'), h('small', null, short)));
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
