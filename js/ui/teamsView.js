// Outil Équipes (et mode Clubs) : liste des compositions, tableau de composition (glisser-déposer), génération,
// rôles, contraintes, affichage plein écran, PDF. Utilisable seul (outil libre) ou dans une activité.
import { app, registerView, go, render } from '../app.js';
import { h, btn, icon, iconBtn, openDialog, popMenu, toast, confirmDialog } from './dom.js';
import { fmtDate, todayISO, collator, clone, uid, now } from '../util.js';
import { studentLabel } from '../data/schema.js';
import { activitiesOf, activityEvals, touchTool, hasTool } from '../logic/activities.js';
import {
  VEST_COLORS, vestOf, DEFAULT_ROLES, newSet, addTeam, addClub, removeTeam, removeClub, teamsOnly, teamColorId, teamLabel,
  studentsOf, syncStudents, unplaced, moveStudent, setStatus, statusOf, toggleRole, visibleRole, toggleLock, duplicateSet, rotateRoles,
  generate, levelScores, constraintText, copyIntoEvaluation, teamOfStudent, roleColor,
} from '../logic/teams.js';
import { printNode } from './printView.js';
import { helpItem } from './help.js';
import { attachDrag } from './drag.js';
import { latestSet } from '../logic/tournament.js';
import { suiviPanel } from './suiviView.js';

const T = { full: false, tab: 'comp', open: new Set() }; // open : zones « une ligne » dépliées (double-tap)
const roleDefs = () => app.repo.getMeta('teamRoles', null) || DEFAULT_ROLES;
const saveClass = (cls) => app.repo.save('classes', cls);

// ---------- Contexte : activité ou outil libre ----------

function ctxFor(r) {
  const repo = app.repo;
  if (r.scope === 'act') {
    const cls = repo.get('classes', r.classId);
    const act = cls && !cls.deleted ? activitiesOf(cls).find((a) => a.id === r.actId) : null;
    if (!act) return null;
    act.equipes ??= { sets: [] };
    return {
      kind: 'act', cls, act, title: `${act.name} · ${cls.name}`,
      sets: () => act.equipes.sets,
      add: (set) => act.equipes.sets.push(set),
      remove: (id) => { const i = act.equipes.sets.findIndex((s) => s.id === id); const [x] = act.equipes.sets.splice(i, 1); return () => { act.equipes.sets.splice(Math.min(i, act.equipes.sets.length), 0, x); return saveClass(cls); }; },
      save: (set) => { if (set) set.updatedAt = Date.now(); touchTool(act, 'equipes'); return saveClass(cls); },
      students: (set) => studentsOf(set, cls),
    };
  }
  const recs = () => repo.list('freetools').filter((t) => t.type === 'equipes');
  return {
    kind: 'free', title: 'Équipes',
    sets: () => recs().map((x) => x.set).sort((a, b) => b.createdAt - a.createdAt),
    add: (set) => repo.save('freetools', { id: uid(), type: 'equipes', set }),
    remove: (id) => { const rec = recs().find((x) => x.set.id === id); repo.remove('freetools', rec.id); return () => repo.restore('freetools', rec.id); },
    save: (set) => { set.updatedAt = Date.now(); return repo.save('freetools', recs().find((x) => x.set.id === set.id)); },
    students: (set) => studentsOf(set, null),
  };
}

const backTo = (r) => (r.from === 'classPage' && r.classId ? go('classPage', { id: r.classId }) : go('home'));

/** Annuler : instantané de la composition avant une action importante, restauré par le bouton du message. */
function undoable(ctx, set, label, fn) {
  const snap = clone(set);
  fn();
  render();
  ctx.save(set);
  toast(label, { action: 'Annuler', ms: 8000, onAction: () => { for (const k of Object.keys(set)) delete set[k]; Object.assign(set, snap); render(); ctx.save(set); } });
}

// ---------- Liste des compositions ----------

registerView('equipes', (r) => {
  const ctx = ctxFor(r);
  if (!ctx) { queueMicrotask(() => go('home')); return h('div'); }
  // ouverture depuis le carnet : directement la composition la plus récente (la liste reste accessible par le titre)
  if (r.latest) { delete r.latest; const last = latestSet(ctx.sets()); if (last) r.setId = last.id; }
  if (r.setId) { const set = ctx.sets().find((s) => s.id === r.setId); if (set) return editor(r, ctx, set); }
  const sets = ctx.sets();
  /** Petits maillots aux couleurs des chasubles (un par club, ou par équipe). */
  const shirts = (set) => {
    const items = set.mode === 'clubs' ? set.clubs.map((c) => c.color) : teamsOnly(set).map((t) => teamColorId(set, t));
    const shown = items.slice(0, 10);
    return h('span', { class: 'shirts' }, shown.map((id) => { const v = vestOf(id); const sv = icon('teams', 22); sv.setAttribute('fill', v.hex); sv.setAttribute('stroke', v.id === 'sans' ? '#8b90a6' : 'rgba(0,0,0,.45)'); return sv; }),
      items.length > shown.length ? h('span', { class: 'muted small' }, `+${items.length - shown.length}`) : null);
  };
  const row = (set) => {
    const nT = teamsOnly(set).length;
    const detail = set.mode === 'clubs' ? `${set.clubs.length} club${set.clubs.length > 1 ? 's' : ''} · ${nT} équipe${nT > 1 ? 's' : ''}` : `${nT} équipe${nT > 1 ? 's' : ''}`;
    const more = iconBtn('more', 'Actions', (e) => {
      e.stopPropagation();
      popMenu(more, [
        { label: 'Dupliquer pour la leçon suivante', onClick: () => duplicate(r, ctx, set) },
        { label: 'Supprimer', danger: true, onClick: () => deleteSet(ctx, set) },
      ]);
    }, 'sm');
    const open = () => go('equipes', { ...r, setId: set.id });
    return h('div', { class: 'evrow comprow', role: 'button', tabindex: 0, onClick: open, onKeydown: (e) => { if (e.key === 'Enter') open(); } },
      h('div', { class: 'grow' },
        h('div', { class: 't' }, `${set.name || 'Sans nom'} – ${set.mode === 'clubs' ? 'Clubs' : 'Équipes'}`),
        h('div', { class: 'muted small' }, [set.date ? fmtDate(set.date) : '', detail].filter(Boolean).join(' · '))),
      shirts(set), more);
  };
  const listMore = iconBtn('more', 'Options', () => popMenu(listMore, [helpItem('equipes')]), 'boxed');
  const tabs = ctx.kind === 'act' ? h('div', { class: 'toolbar' }, h('div', { class: 'seg' }, [['comp', 'Compositions'], ['suivi', 'Suivi des résultats']].map(([k, l]) => h('button', { type: 'button', class: T.tab === k ? 'on' : '', onClick: () => { T.tab = k; render(); } }, l)))) : null;
  if (tabs && T.tab === 'suivi') {
    return h('div', { class: 'main' }, h('div', { class: 'topbar' }, iconBtn('back', 'Retour', () => backTo(r), '', { 'data-back': '1' }), h('div', { class: 'grow evtitle' }, h('h1', null, 'Équipes'), h('div', { class: 'sub' }, ctx.title)), listMore), tabs, suiviPanel(ctx.cls, ctx.act));
  }
  return h('div', { class: 'main' },
    h('div', { class: 'topbar' },
      iconBtn('back', 'Retour', () => backTo(r), '', { 'data-back': '1' }),
      h('div', { class: 'grow evtitle' }, h('h1', null, 'Équipes'), h('div', { class: 'sub' }, ctx.title)),
      btn('Nouvelle composition', { icon: 'plus', cls: 'primary', onClick: () => newSetDialog(r, ctx) }),
      listMore),
    tabs,
    sets.length
      ? h('div', { class: 'scroll grow listpad', 'data-keep': 'teamsets' }, sets.map(row))
      : h('div', { class: 'empty' }, h('h2', null, 'Aucune composition'),
        h('p', null, 'Une composition = les équipes d\'une leçon. Vous pourrez la dupliquer pour la leçon suivante et garder l\'historique.'),
        btn('Nouvelle composition', { icon: 'plus', cls: 'primary', onClick: () => newSetDialog(r, ctx) })));
});

function deleteSet(ctx, set) {
  const undo = ctx.remove(set.id);
  render();
  Promise.resolve(ctx.kind === 'act' ? ctx.save() : null);
  toast(`Composition « ${set.name || 'sans nom'} » supprimée.`, { action: 'Annuler', ms: 9000, onAction: async () => { await undo(); render(); } });
}

function duplicate(r, ctx, set) {
  const n = ctx.sets().length + 1;
  const copy = duplicateSet(set, { name: set.name.replace(/\d+\s*$/, '').trim() ? `${set.name.replace(/\s*\d+\s*$/, '')} ${n}`.trim() : `Leçon ${n}`, date: todayISO() });
  ctx.add(copy);
  ctx.save(copy);
  go('equipes', { ...r, setId: copy.id });
}

/** Prénoms collés : « Chloé D » → prénom + initiale du nom (jamais de nom complet). */
export function parseNames(text) {
  return String(text || '').split(/\n|;/).map((l) => l.trim()).filter(Boolean).map((l) => {
    const m = l.match(/^(.+?)\s+([A-Za-zÀ-ÿ])\.?$/);
    return m ? { id: uid(), first: m[1].trim(), initial: m[2].toUpperCase() } : { id: uid(), first: l, initial: '' };
  });
}

function newSetDialog(r, ctx) {
  const st = { name: ctx.kind === 'act' ? `Leçon ${ctx.sets().length + 1}` : `Équipes du ${fmtDate(todayISO())}`, mode: 'teams', classes: new Set(), names: '' };
  const classes = app.repo.list('classes').sort((a, b) => collator.compare(a.name, b.name));
  const modeBtns = h('div', { class: 'seg' });
  const paintMode = () => modeBtns.replaceChildren(...[['teams', 'Équipes'], ['clubs', 'Clubs']].map(([k, l]) => h('button', { type: 'button', class: st.mode === k ? 'on' : '', onClick: () => { st.mode = k; paintMode(); } }, l)));
  paintMode();
  const dlg = openDialog({
    title: 'Nouvelle composition',
    body: [
      h('label', { class: 'field' }, 'Nom', h('input', { type: 'text', value: st.name, onInput: (e) => { st.name = e.target.value; } })),
      h('div', { class: 'muted small' }, 'Type'), modeBtns,
      h('div', { class: 'muted small' }, st.mode === 'clubs' ? '' : ''),
      ctx.kind === 'free' ? [
        h('div', { class: 'muted small' }, 'Élèves : une ou plusieurs classes, et/ou une liste saisie'),
        h('div', { class: 'row wrap' }, classes.map((c) => h('label', { class: 'row chk' }, h('input', { type: 'checkbox', onChange: (e) => { e.target.checked ? st.classes.add(c.id) : st.classes.delete(c.id); } }), `${c.name} (${c.students.filter((s) => s.active !== false).length})`))),
        h('label', { class: 'field' }, 'Ajouter des prénoms (un par ligne, initiale du nom après un espace)', h('textarea', { rows: 4, placeholder: 'Léa\nChloé D\nChloé F', onInput: (e) => { st.names = e.target.value; } })),
      ] : null,
    ],
    actions: [{ label: 'Annuler' }, { label: 'Créer', primary: true, keepOpen: true, onClick: () => {
      const set = newSet({ name: st.name.trim() || 'Composition', date: todayISO(), mode: st.mode });
      if (ctx.kind === 'free') {
        const picked = classes.filter((c) => st.classes.has(c.id));
        set.classIds = picked.map((c) => c.id);
        set.students = [...picked.flatMap((c) => c.students.filter((s) => s.active !== false).map((s) => ({ id: s.id, first: s.first, initial: s.initial || '', classId: c.id }))), ...parseNames(st.names)];
        if (!set.students.length) { toast('Choisissez une classe ou saisissez des prénoms.'); return false; }
      }
      ctx.add(set); ctx.save(set); dlg.close(); go('equipes', { ...r, setId: set.id }); return false;
    } }],
  });
}

// ---------- Tableau de composition ----------

function editor(r, ctx, set) {
  const students = ctx.students(set);
  syncStudents(set, students.map((s) => s.id)); // élèves partis retirés ; nouveaux élèves = « non placés »
  const byId = new Map(students.map((s) => [s.id, s]));
  const nameOf = (id) => (byId.get(id) ? studentLabel(byId.get(id)) : '?');
  const roles = roleDefs();
  const save = () => ctx.save(set);
  const apply = (fn) => { fn(); render(); save(); }; // affichage immédiat, enregistrement ensuite
  const back = () => { if (T.full) { T.full = false; render(); } else go('equipes', { ...r, setId: undefined }); };

  if (T.full) return fullScreen(set, nameOf, roles, back);

  const chip = (s, { zone }) => {
    const role = visibleRole(set, s.id, roles), st = statusOf(set, s.id), locked = !!set.locked[s.id];
    return h('div', { class: `schip ${st !== 'present' ? 'st-' + st : ''}`, 'data-sid': s.id, role: 'button', tabindex: 0, 'aria-label': studentLabel(s) },
      h('span', { class: 'sn' }, studentLabel(s), forbidden(ctx, set).has(s.id) ? h('i', { class: 'nomat', title: 'Matériel interdit' }) : null),
      role ? h('span', { class: 'sr', title: role.label, style: { '--rc': roleColor(role) } }, role.short) : null,
      st === 'dispense' ? h('span', { class: 'sb', title: 'Dispensé' }, 'D') : null,
      locked ? h('span', { class: 'sl', title: 'Verrouillé' }, icon('lock', 13)) : null);
  };
  const zone = (id, cls, kids) => h('div', { class: `zone ${cls}`, 'data-zone': id }, kids);
  /** Zone sur une seule ligne (non placés, dispensés, absents, à répartir) : double-tap ou toucher l'étiquette = tout afficher. */
  const lineZone = (id, cls, label, kids) => {
    const open = T.open.has(id);
    return zone(id, `${cls} oneline ${open ? 'open' : ''}`, [
      h('button', { type: 'button', class: 'zlabel', 'data-toggle': id, 'aria-expanded': String(open), title: open ? 'Replier' : 'Afficher tous les noms' }, label, icon(open ? 'up' : 'down', 14)),
      ...kids]);
  };
  const colorBtn = (t, isClub) => {
    const b = h('button', { type: 'button', class: 'vestbtn', 'aria-label': 'Couleur du chasuble', title: 'Couleur du chasuble', style: { background: vestOf(isClub ? t.color : teamColorId(set, t)).hex } });
    b.addEventListener('click', () => popMenu(b, VEST_COLORS.map((c) => ({ label: `${c.id === (isClub ? t.color : t.color) ? '● ' : ''}${c.label}`, onClick: () => apply(() => { t.color = c.id; if (!isClub) t.colorOwn = true; }) }))));
    return b;
  };
  const nameInput = (obj, label) => h('input', { type: 'text', class: 'tname', value: obj.name, 'aria-label': label, onChange: (e) => apply(() => { obj.name = e.target.value.trim() || obj.name; }) });
  const teamCard = (t) => {
    const hex = vestOf(teamColorId(set, t));
    return h('section', { class: 'tcard' },
      h('header', { style: { '--v': hex.hex } },
        nameInput(t, 'Nom de l\'équipe'),
        h('span', { class: 'tcount' }, t.members.length),
        colorBtn(t, false),
        iconBtn('trash', `Supprimer ${t.name}`, () => undoable(ctx, set, `Équipe « ${t.name} » supprimée.`, () => removeTeam(set, t.id)), 'sm')),
      zone(t.id, 'tz', t.members.filter((s) => byId.has(s)).map((s) => chip(byId.get(s), {}))));
  };
  const clubCard = (c) => {
    const hex = vestOf(c.color);
    const pool = set.teams.find((t) => t.kind === 'pool' && t.clubId === c.id);
    const subs = set.teams.filter((t) => t.kind === 'team' && t.clubId === c.id).sort((a, b) => a.rank - b.rank);
    const total = [pool, ...subs].reduce((a, t) => a + t.members.length, 0);
    return h('section', { class: 'tcard club' },
      h('header', { style: { '--v': hex.hex } },
        nameInput(c, 'Nom du club'), h('span', { class: 'tcount' }, total), colorBtn(c, true),
        iconBtn('trash', `Supprimer ${c.name}`, () => undoable(ctx, set, `Club « ${c.name} » supprimé.`, () => removeClub(set, c.id)), 'sm')),
      h('div', { class: 'cluboard' },
        lineZone(pool.id, 'tz clubpool', `À répartir (${pool.members.filter((s) => byId.has(s)).length})`, pool.members.filter((s) => byId.has(s)).map((s) => chip(byId.get(s), {}))),
        h('div', { class: 'subteams' }, subs.map((t) => h('div', { class: 'sub' }, nameInput(t, 'Nom de l\'équipe'), zone(t.id, 'tz', t.members.filter((s) => byId.has(s)).map((s) => chip(byId.get(s), {}))))))));
  };

  const free = unplaced(set, students).filter((s) => statusOf(set, s.id) === 'present');
  const disp = unplaced(set, students).filter((s) => statusOf(set, s.id) === 'dispense');
  const abs = students.filter((s) => statusOf(set, s.id) === 'absent');
  const side = h('aside', { class: 'tstrip', 'data-keep': 'tstrip' },
    lineZone('unplaced', 'tz zfree', `Non placés (${free.length})`, [...free.map((s) => chip(s, {})), free.length ? null : h('span', { class: 'muted small' }, 'Tout le monde est placé.')]),
    lineZone('dispense', `tz zdisp ${disp.length ? '' : 'empty'}`, `Dispensés (${disp.length})`, disp.map((s) => chip(s, {}))),
    lineZone('absent', `tz zabs ${abs.length ? '' : 'empty'}`, `Absents (${abs.length})`, abs.map((s) => chip(s, {}))));

  const cards = set.mode === 'clubs' ? set.clubs.map(clubCard) : teamsOnly(set).map(teamCard);
  const board = h('div', { class: `tgrid scroll ${set.mode === 'clubs' ? 'clubs' : ''}`, 'data-keep': 'tgrid' },
    cards.length ? cards : h('div', { class: 'empty' }, h('h2', null, set.mode === 'clubs' ? 'Aucun club' : 'Aucune équipe'),
      h('p', null, 'Ajoutez des équipes puis glissez les élèves dedans, ou ouvrez ⋮ › Générer.'),
      btn(set.mode === 'clubs' ? 'Ajouter un club' : 'Ajouter une équipe', { icon: 'plus', cls: 'primary', onClick: () => apply(() => (set.mode === 'clubs' ? addClub(set) : addTeam(set))) })));

  const more = iconBtn('more', 'Options', () => popMenu(more, [
    { label: set.mode === 'clubs' ? 'Générer les clubs…' : 'Générer les équipes…', onClick: () => generateDialog(r, ctx, set, students, apply, undoable) },
    '-',
    { label: 'Menu équipes (toutes les compositions)', onClick: () => { T.tab = 'comp'; go('equipes', { ...r, setId: undefined }); } },
    ctx.kind === 'act' ? { label: 'Suivi des résultats', onClick: () => { T.tab = 'suivi'; go('equipes', { ...r, setId: undefined }); } } : null,
    { label: 'Renommer la composition…', onClick: () => renameSetDialog(set, apply) },
    { label: 'Contraintes (ensemble / séparés)…', onClick: () => constraintsDialog(set, students, nameOf, apply) },
    { label: 'Rôles…', onClick: () => rolesHub(ctx, set, nameOf, apply) },
    ctx.kind === 'free' ? { label: 'Ajouter des élèves…', onClick: () => addStudentsDialog(set, apply) } : null,
    { label: 'Imprimer / PDF', onClick: () => printSet(set, nameOf, roles) },
    { label: 'Dupliquer pour la leçon suivante', onClick: () => duplicate(r, ctx, set) },
    helpItem('equipes'),
    '-',
    { label: 'Tout remettre en « non placés »', danger: true, onClick: () => undoable(ctx, set, 'Équipes vidées.', () => { for (const t of set.teams) t.members = []; }) },
  ].filter(Boolean)), 'boxed');

  const root = h('div', { class: 'main teams' },
    h('div', { class: 'topbar' },
      iconBtn('back', 'Retour', back, '', { 'data-back': '1' }),
      h('div', { class: 'grow evtitle' }, titleMenu(r, ctx, set), h('div', { class: 'sub' }, `${ctx.title}${set.date ? ' · ' + fmtDate(set.date) : ''} · ${set.mode === 'clubs' ? 'clubs' : 'équipes'}`)),
      btn('Mélanger', { icon: 'shuffle', onClick: () => reshuffle(ctx, set, students) }),
      btn(set.mode === 'clubs' ? 'Club' : 'Équipe', { icon: 'plus', onClick: () => apply(() => (set.mode === 'clubs' ? addClub(set) : addTeam(set))) }),
      iconBtn('expand', 'Affichage plein écran', () => { T.full = true; render(); }, 'boxed'),
      more),
    h('div', { class: 'tlayout' }, side, board));

  attachDrag(root, (sid, zoneId) => apply(() => {
    if (zoneId === 'unplaced') { moveStudent(set, sid, null); if (statusOf(set, sid) === 'absent') setStatus(set, sid, 'present'); }
    else if (zoneId === 'absent') setStatus(set, sid, 'absent');
    else if (zoneId === 'dispense') { moveStudent(set, sid, null); setStatus(set, sid, 'dispense'); }
    else moveStudent(set, sid, zoneId);
  }), (sid, anchor) => chipMenu(set, sid, anchor, nameOf, roles, apply, forbidden(ctx, set)));
  attachZoneToggle(root);
  return root;
}

/** Titre = menu déroulant : passer à une autre composition de l'activité, ou au « Menu équipes ». */
function titleMenu(r, ctx, set) {
  const b = h('button', { type: 'button', class: 'titlemenu', 'aria-label': 'Changer de composition' }, h('h1', null, set.name || 'Composition'), icon('down', 18));
  b.addEventListener('click', () => {
    const others = [...ctx.sets()].sort((x, y) => String(y.date || '').localeCompare(String(x.date || '')) || (y.createdAt || 0) - (x.createdAt || 0));
    popMenu(b, [
      ...others.map((x) => ({ label: `${x.name || 'Sans nom'}${x.date ? ' · ' + fmtDate(x.date) : ''}`, active: x.id === set.id, onClick: () => go('equipes', { ...r, setId: x.id }) })),
      '-',
      { label: 'Menu équipes (toutes les compositions)', onClick: () => go('equipes', { ...r, setId: undefined }) },
      { label: 'Nouvelle composition…', onClick: () => newSetDialog({ ...r, setId: undefined }, ctx) },
    ]);
  });
  return b;
}

function reshuffle(ctx, set, students) {
  const opts = { ...(set.lastGen || { mode: 'random' }), seed: null };
  if (opts.mode === 'tutor') opts.mode = 'random';
  opts.scores = scoresFor(ctx, set, opts.source);
  if (!teamsOnly(set).length && set.mode !== 'clubs') return toast('Ajoutez des équipes ou ouvrez ⋮ › Générer.');
  if (set.mode !== 'clubs') opts.teams = teamsOnly(set).length;
  else opts.teams = set.clubs.length;
  undoable(ctx, set, 'Équipes mélangées (les élèves verrouillés n\'ont pas bougé).', () => {
    const res = generate(set, students, opts);
    if (res.violated.length) toast(`${res.violated.length} contrainte(s) n'ont pas pu être respectées.`);
  });
}

function scoresFor(ctx, set, source = 'mean') {
  const evals = app.repo.list('evaluations');
  const out = new Map();
  const classes = ctx.kind === 'act' ? [ctx.cls] : (set.classIds || []).map((id) => app.repo.get('classes', id)).filter(Boolean);
  for (const c of classes) for (const [k, v] of levelScores(c, evals, source)) out.set(k, v);
  return out;
}

// ---------- Menu d'un élève ----------

function chipMenu(set, sid, anchor, nameOf, roles, apply, forb) {
  const st = statusOf(set, sid), team = teamOfStudent(set, sid);
  popMenu(anchor, [
    { label: 'Placer dans…', onClick: () => placeDialog(set, sid, nameOf, apply) },
    team ? { label: 'Retirer de l\'équipe', onClick: () => apply(() => moveStudent(set, sid, null)) } : null,
    '-',
    { label: 'Présent', active: st === 'present', onClick: () => apply(() => setStatus(set, sid, 'present')) },
    { label: 'Dispensé (reste utile : rôle possible)', active: st === 'dispense', onClick: () => apply(() => setStatus(set, sid, 'dispense')) },
    { label: 'Absent', active: st === 'absent', onClick: () => apply(() => setStatus(set, sid, 'absent')) },
    '-',
    ...roles.map((ro) => ({ label: `Rôle : ${ro.label}`, active: (set.roles[sid] || []).includes(ro.id), onClick: () => apply(() => toggleRole(set, sid, ro.id)) })),
    { label: set.locked[sid] ? 'Déverrouiller' : 'Verrouiller à sa place', disabled: !team, onClick: () => apply(() => toggleLock(set, sid)) },
    forb ? { label: forb.has(sid) ? 'Matériel autorisé de nouveau' : 'Matériel interdit (point rouge, jusqu\'à la fin de la séquence)', onClick: () => apply(() => forb.toggle(sid)) } : null,
  ].filter(Boolean));
}

function placeDialog(set, sid, nameOf, apply) {
  const dlg = openDialog({
    title: `Placer ${nameOf(sid)}`,
    body: h('div', { class: 'row wrap' }, set.teams.filter((t) => t.kind !== 'pool' || true).map((t) => {
      const hex = vestOf(teamColorId(set, t));
      return h('button', { type: 'button', class: 'btn bigbtn', style: { background: hex.hex, color: hex.ink, borderColor: hex.hex }, onClick: () => { dlg.close(); apply(() => moveStudent(set, sid, t.id)); } },
        t.kind === 'pool' ? `${set.clubs.find((c) => c.id === t.clubId)?.name} · à répartir` : teamLabel(set, t));
    })),
    actions: [{ label: 'Annuler' }],
  });
}


// ---------- Fenêtres : génération, contraintes, rôles, noms ----------

function generateDialog(r, ctx, set, students, apply, undoableFn) {
  const st = { mode: 'random', teams: 0, size: 0, source: 'mean', ...(set.lastGen || {}) };
  const clubs = set.mode === 'clubs';
  const evals = ctx.kind === 'act' ? activityEvals(app.repo.list('evaluations'), ctx.cls, ctx.act) : [];
  const modes = [['random', 'Au hasard'], ['balanced', 'Par niveau : équipes équilibrées'], ['levels', 'Par niveau : groupes de niveau'], ...(clubs ? [] : [['tutor', 'Duos de tutorat']])];
  const body = h('div', { class: 'dlg-body', style: { padding: 0 } });
  const paint = () => body.replaceChildren(...[
    h('div', { class: 'muted small' }, 'Méthode'),
    h('div', { class: 'row wrap' }, modes.map(([k, l]) => h('button', { type: 'button', class: `btn ${st.mode === k ? 'primary' : ''}`, onClick: () => { st.mode = k; paint(); } }, l))),
    st.mode === 'tutor' ? h('p', { class: 'muted small' }, 'Le 1er du classement est associé à l\'élève du milieu, et ainsi de suite. Nombre impair : un trio.') : [
      h('div', { class: 'row' },
        h('label', { class: 'field', style: { width: '170px' } }, clubs ? 'Nombre de clubs' : 'Nombre d\'équipes', h('input', { type: 'number', inputmode: 'numeric', min: 0, value: st.teams || '', placeholder: 'au choix', onInput: (e) => { st.teams = parseInt(e.target.value, 10) || 0; } })),
        h('label', { class: 'field', style: { width: '170px' } }, 'Taille visée', h('input', { type: 'number', inputmode: 'numeric', min: 0, value: st.size || '', placeholder: 'au choix', onInput: (e) => { st.size = parseInt(e.target.value, 10) || 0; } }))),
      h('p', { class: 'muted small', style: { margin: 0 } }, 'Un seul des deux suffit. Avec les deux, le nombre d\'équipes prime et les tailles s\'équilibrent au plus près.')],
    st.mode === 'balanced' || st.mode === 'levels' || st.mode === 'tutor' ? h('label', { class: 'field' }, 'Niveau d\'après',
      h('select', { onChange: (e) => { st.source = e.target.value; } }, h('option', { value: 'mean', selected: st.source === 'mean' }, 'La moyenne des évaluations'),
        evals.map((ev) => h('option', { value: ev.id, selected: st.source === ev.id }, `Évaluation : ${ev.title || ev.model.name} (${fmtDate(ev.date)})`)))) : null,
    h('p', { class: 'muted small' }, 'Les élèves absents ou dispensés ne sont pas placés ; les élèves verrouillés gardent leur place.')].flat(Infinity).filter(Boolean));
  paint();
  const dlg = openDialog({ title: clubs ? 'Générer les clubs' : 'Générer les équipes', body, actions: [{ label: 'Annuler' }, { label: 'Générer', primary: true, keepOpen: true, onClick: () => {
    dlg.close();
    set.lastGen = { mode: st.mode, teams: st.teams, size: st.size, source: st.source };
    const scores = scoresFor(ctx, set, st.source);
    undoableFn(ctx, set, 'Équipes générées.', () => {
      const res = generate(set, students, { mode: st.mode, teams: st.teams, size: st.size, scores });
      if (res.violated.length) toast(`${res.violated.length} contrainte(s) n'ont pas pu être respectées.`);
      else if (res.note) toast(res.note);
    });
    return false;
  } }] });
}

function constraintsDialog(set, students, nameOf, apply) {
  const st = { a: students[0]?.id, b: students[1]?.id, type: 'together' };
  const dlg = openDialog({ title: 'Contraintes', body: h('div'), wide: true, actions: [{ label: 'Terminé', primary: true }] });
  const sel = (key) => h('select', { onChange: (e) => { st[key] = e.target.value; } }, students.map((s) => h('option', { value: s.id, selected: st[key] === s.id }, studentLabel(s))));
  const paint = () => dlg.content.replaceChildren(
    h('p', { class: 'muted small', style: { margin: 0 } }, 'Respectées au tirage dans la mesure du possible (si elles se contredisent, un maximum est respecté).'),
    ...set.constraints.map((c, i) => h('div', { class: 'listrow' }, h('span', { class: 'grow' }, constraintText(c, nameOf)),
      iconBtn('trash', 'Supprimer cette contrainte', () => { apply(() => set.constraints.splice(i, 1)); paint(); }, 'sm'))),
    h('div', { class: 'row wrap' }, sel('a'),
      h('select', { onChange: (e) => { st.type = e.target.value; } }, h('option', { value: 'together' }, 'ensemble'), h('option', { value: 'apart' }, 'séparés')), sel('b'),
      btn('Ajouter', { icon: 'plus', onClick: () => { if (!st.a || !st.b || st.a === st.b) return toast('Choisissez deux élèves différents.'); apply(() => set.constraints.push({ a: st.a, b: st.b, type: st.type })); paint(); } })));
  paint();
}

/** Matériel interdit : marqué sur l'activité (toute la séquence, tous ses outils) ; outil libre : sur la composition. */
export function forbidden(ctx, set) {
  const store = ctx.kind === 'act' ? (ctx.act.forbidden ??= {}) : (set.forbidden ??= {});
  return { has: (sid) => !!store[sid], toggle: (sid) => { if (store[sid]) delete store[sid]; else store[sid] = Date.now(); } };
}

/** ⋮ › Rôles : tableau équipes × rôles, rotation d'une leçon à l'autre, liste des rôles. */
function rolesHub(ctx, set, nameOf, apply) {
  const dlg = openDialog({ title: 'Rôles', wide: true, body: h('div'), actions: [{ label: 'Fermer', primary: true }] });
  const previous = () => {
    if (Object.keys(set.roles).length) return set.roles;
    const others = ctx.sets().filter((x) => x.id !== set.id && Object.keys(x.roles || {}).length)
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
    return others[0]?.roles || {};
  };
  const paint = () => {
    const roles = roleDefs();
    const teams = teamsOnly(set).filter((t) => t.members.length);
    const cell = (t, roId) => t.members.filter((sid) => (set.roles[sid] || [])[0] === roId).map(nameOf).join(', ');
    dlg.content.replaceChildren(
      teams.length ? h('div', { class: 'rtable-wrap' }, h('table', { class: 'rtable' },
        h('thead', null, h('tr', null, h('th', null, 'Équipe'), roles.map((ro) => h('th', null, h('span', { class: 'sr', style: { '--rc': roleColor(ro) } }, ro.short), ' ', ro.label)), h('th', null, 'Sans rôle'))),
        h('tbody', null, teams.map((t) => h('tr', null,
          h('th', null, h('i', { class: 'tdot', style: { background: vestOf(teamColorId(set, t)).hex } }), ' ', teamLabel(set, t)),
          roles.map((ro) => h('td', { class: 'rcell', role: 'button', tabindex: 0, title: 'Toucher pour choisir l\'élève', onClick: (e) => popMenu(e.currentTarget, t.members.filter((sid) => statusOf(set, sid) !== 'absent').map((sid) => ({
            label: nameOf(sid), active: (set.roles[sid] || [])[0] === ro.id,
            onClick: () => { apply(() => { const cur = (set.roles[sid] || []).filter((x) => x !== ro.id); if ((set.roles[sid] || [])[0] === ro.id) { if (cur.length) set.roles[sid] = cur; else delete set.roles[sid]; } else set.roles[sid] = [ro.id, ...cur]; }); paint(); },
          }))) }, cell(t, ro.id) || h('span', { class: 'muted' }, '+'))),
          h('td', { class: 'muted' }, t.members.filter((sid) => !(set.roles[sid] || []).length && statusOf(set, sid) !== 'absent').map(nameOf).join(', ') || '—')))))) : h('p', { class: 'muted' }, 'Placez d\'abord les élèves dans les équipes.'),
      h('div', { class: 'row wrap', style: { marginTop: '12px', gap: '8px' } },
        btn('Faire tourner les rôles', { icon: 'shuffle', cls: 'primary', disabled: !teams.length || !roles.length, onClick: () => {
          const prev = previous();
          let kept = 0;
          apply(() => { kept = rotateRoles(set, roles.map((r) => r.id), prev); });
          toast(kept ? `Rôles attribués : ${kept} élève(s) gardent le même rôle (équipe plus grande que la liste des rôles).` : 'Rôles attribués : chacun change de rôle par rapport à la dernière leçon.');
          paint();
        } }),
        btn('Effacer les rôles', { cls: 'soft', disabled: !Object.keys(set.roles).length, onClick: () => { apply(() => { set.roles = {}; }); paint(); } }),
        btn('Gérer la liste des rôles…', { icon: 'edit', cls: 'soft', onClick: () => rolesDialog(() => { render(); paint(); }) })),
      h('p', { class: 'muted small' }, 'La rotation part des rôles de cette composition, ou de la dernière leçon qui en avait : personne ne garde le même rôle quand l\'équipe n\'est pas plus grande que la liste.'));
  };
  paint();
}

function rolesDialog(done) {
  const list = clone(roleDefs());
  const dlg = openDialog({ title: 'Rôles proposés', body: h('div'), actions: [{ label: 'Enregistrer', primary: true, onClick: async () => { await app.repo.setMeta('teamRoles', list.filter((x) => x.label.trim())); done?.(); } }, ] });
  const paint = () => dlg.content.replaceChildren(
    ...list.map((ro, i) => h('div', { class: 'listrow' },
      h('input', { type: 'text', value: ro.label, 'aria-label': 'Rôle', style: { flex: 1 }, onChange: (e) => { ro.label = e.target.value; } }),
      h('input', { type: 'text', value: ro.short, 'aria-label': 'Abréviation', maxlength: 3, style: { width: '64px' }, onChange: (e) => { ro.short = e.target.value || ro.label.slice(0, 1); } }),
      iconBtn('trash', 'Supprimer', () => { list.splice(i, 1); paint(); }, 'sm'))),
    btn('Ajouter un rôle', { icon: 'plus', cls: 'small soft', onClick: () => { list.push({ id: 'r' + uid().slice(0, 6), label: 'Nouveau rôle', short: 'N' }); paint(); } }));
  paint();
}

function renameSetDialog(set, apply) {
  let name = set.name, date = set.date || todayISO();
  const dlg = openDialog({ title: 'Composition', body: [
    h('label', { class: 'field' }, 'Nom', h('input', { type: 'text', value: name, autofocus: true, onInput: (e) => { name = e.target.value; } })),
    h('label', { class: 'field' }, 'Date', h('input', { type: 'date', value: date, onChange: (e) => { date = e.target.value; } }))],
  actions: [{ label: 'Annuler' }, { label: 'Enregistrer', primary: true, keepOpen: true, onClick: () => { dlg.close(); apply(() => { set.name = name.trim() || set.name; set.date = date; }); return false; } }] });
}

function addStudentsDialog(set, apply) {
  let text = '';
  openDialog({ title: 'Ajouter des élèves', body: h('label', { class: 'field' }, 'Un prénom par ligne (initiale du nom après un espace)', h('textarea', { rows: 5, onInput: (e) => { text = e.target.value; } })),
    actions: [{ label: 'Annuler' }, { label: 'Ajouter', primary: true, onClick: () => apply(() => { set.students = [...(set.students || []), ...parseNames(text)]; }) }] });
}

// ---------- Plein écran, impression ----------

function groupsForDisplay(set) {
  if (set.mode === 'clubs') {
    return set.clubs.map((c) => ({ title: c.name, color: c.color, subs: set.teams.filter((t) => t.kind === 'team' && t.clubId === c.id).sort((a, b) => a.rank - b.rank).map((t) => ({ title: t.name, ids: t.members })), extra: set.teams.find((t) => t.kind === 'pool' && t.clubId === c.id)?.members || [] }));
  }
  return teamsOnly(set).map((t) => ({ title: t.name, color: teamColorId(set, t), subs: [{ title: '', ids: t.members }], extra: [] }));
}

function fullScreen(set, nameOf, roles, back) {
  const groups = groupsForDisplay(set);
  const n = groups.length;
  const cols = n <= 1 ? 1 : n <= 4 ? 2 : n <= 6 ? 3 : 4;
  const member = (id) => { const ro = visibleRole(set, id, roles); return h('li', { class: statusOf(set, id) === 'dispense' ? 'disp' : '' }, nameOf(id), ro ? h('span', { class: 'sr', style: { '--rc': roleColor(ro) } }, ro.short) : null); };
  return h('div', { class: 'main teamsfull' },
    h('div', { class: 'fullbar' }, h('span', { class: 'fulltitle' }, set.name), iconBtn('close', 'Fermer l\'affichage plein écran', back, 'boxed', { 'data-back': '1' })),
    h('div', { class: 'fullgrid scroll', style: { gridTemplateColumns: `repeat(${cols}, 1fr)` } }, groups.map((g) => {
      const hex = vestOf(g.color);
      return h('section', { class: 'fcard', style: { background: hex.hex, color: hex.ink, borderColor: hex.id === 'sans' ? '#2b2d42' : hex.hex } },
        h('h2', null, g.title),
        g.subs.map((s) => h('div', { class: 'fsub' }, s.title ? h('h3', null, s.title) : null, h('ul', null, s.ids.map(member)))),
        g.extra.length ? h('div', { class: 'fsub' }, h('h3', null, 'À répartir'), h('ul', null, g.extra.map(member))) : null);
    })));
}

function printSet(set, nameOf, roles) {
  const groups = groupsForDisplay(set);
  printNode(h('div', null, h('h1', null, set.name), h('div', { class: 'sub' }, set.date ? fmtDate(set.date) : ''),
    h('div', { class: 'printteams' }, groups.map((g) => h('div', { class: 'pt' }, h('h2', { style: { borderBottom: `6px solid ${vestOf(g.color).hex}` } }, g.title),
      g.subs.map((s) => h('div', null, s.title ? h('h3', null, s.title) : null, h('ul', null, s.ids.map((id) => h('li', null, nameOf(id), visibleRole(set, id, roles) ? ` (${visibleRole(set, id, roles).label})` : ''))))))))), { landscape: true });
}

// ---------- Zones « une ligne » : déplier / replier ----------

/** Toucher l'étiquette, ou double-tap n'importe où dans la zone (hors élève) : affiche tous les noms sur plusieurs lignes. */
function attachZoneToggle(root) {
  let last = { id: null, at: 0 };
  const toggle = (id) => { if (T.open.has(id)) T.open.delete(id); else T.open.add(id); render(); };
  root.addEventListener('click', (e) => { const b = e.target.closest('[data-toggle]'); if (b) toggle(b.dataset.toggle); });
  root.addEventListener('pointerup', (e) => {
    if (e.target.closest('.schip, [data-toggle]')) return;
    const z = e.target.closest('.zone.oneline');
    if (!z) return;
    const t = performance.now();
    if (last.id === z.dataset.zone && t - last.at < 380) { last = { id: null, at: 0 }; toggle(z.dataset.zone); }
    else last = { id: z.dataset.zone, at: t };
  });
  root.addEventListener('dblclick', (e) => e.preventDefault());
}

// ---------- Glisser-déposer (doigt ou stylet) ----------

// ---------- Lien avec l'évaluation (appelé par l'écran d'une évaluation) ----------

/** Compositions d'équipes de l'activité d'une évaluation (pour « Reprendre les équipes »). */
export function setsForEvaluation(ev) {
  const cls = app.repo.get('classes', ev.classId);
  const act = cls ? activitiesOf(cls).find((a) => a.id === ev.activityId) : null;
  return act?.equipes?.sets || [];
}
export { copyIntoEvaluation };

/**
 * Évaluation liée à une composition (ev.teamSet) : les équipes de l'évaluation suivent celles de l'outil Équipes.
 * Appelée à chaque affichage de l'évaluation ; ne fait rien si rien n'a changé. Retourne true si l'évaluation a été mise à jour.
 */
export function syncLinkedTeams(ev) {
  if (!ev.teamSet?.setId) return false;
  const set = setsForEvaluation(ev).find((x) => x.id === ev.teamSet.setId);
  if (!set) return false; // composition supprimée : on garde les équipes telles quelles
  const sig = (e) => JSON.stringify([e.groups.filter((g) => g.type === 'team').map((g) => [g.id, g.name, g.color]), e.students.map((s) => e.membership?.[s.id]?.team || '')]);
  const before = sig(ev);
  const probe = { groups: clone(ev.groups), membership: clone(ev.membership), students: ev.students, teamSet: ev.teamSet };
  copyIntoEvaluation(probe, set);
  if (sig(probe) === before && probe.teamSet.name === ev.teamSet.name) return false;
  ev.groups = probe.groups; ev.membership = probe.membership; ev.teamSet = { ...probe.teamSet, at: ev.teamSet.at };
  ev.updatedAt = now();
  app.repo.save('evaluations', ev);
  return true;
}
