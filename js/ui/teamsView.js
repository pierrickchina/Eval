// Outil Équipes (et mode Clubs) : liste des compositions, tableau de composition (glisser-déposer), génération,
// rôles, contraintes, affichage plein écran, PDF. Utilisable seul (outil libre) ou dans une activité.
import { app, registerView, go, render } from '../app.js';
import { h, btn, icon, iconBtn, openDialog, popMenu, toast, confirmDialog } from './dom.js';
import { fmtDate, todayISO, collator, clone, uid, now } from '../util.js';
import { studentLabel } from '../data/schema.js';
import { activitiesOf, activityEvals, touchTool, hasTool } from '../logic/activities.js';
import {
  VEST_COLORS, vestOf, DEFAULT_ROLES, newSet, addTeam, addClub, removeTeam, removeClub, teamsOnly, teamColorId, teamLabel,
  studentsOf, syncStudents, unplaced, moveStudent, setStatus, statusOf, toggleRole, visibleRole, toggleLock, duplicateSet,
  generate, levelScores, constraintText, copyIntoEvaluation, teamOfStudent,
} from '../logic/teams.js';
import { printNode } from './printView.js';
import { helpButton } from './help.js';

const T = { full: false };
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
      save: () => { touchTool(act, 'equipes'); return saveClass(cls); },
      students: (set) => studentsOf(set, cls),
    };
  }
  const recs = () => repo.list('freetools').filter((t) => t.type === 'equipes');
  return {
    kind: 'free', title: 'Équipes',
    sets: () => recs().map((x) => x.set).sort((a, b) => b.createdAt - a.createdAt),
    add: (set) => repo.save('freetools', { id: uid(), type: 'equipes', set }),
    remove: (id) => { const rec = recs().find((x) => x.set.id === id); repo.remove('freetools', rec.id); return () => repo.restore('freetools', rec.id); },
    save: (set) => repo.save('freetools', recs().find((x) => x.set.id === set.id)),
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
  if (r.setId) { const set = ctx.sets().find((s) => s.id === r.setId); if (set) return editor(r, ctx, set); }
  const sets = ctx.sets();
  const row = (set) => {
    const nT = teamsOnly(set).length, mode = set.mode === 'clubs' ? `${set.clubs.length} clubs · ${nT} équipes` : `${nT} équipes`;
    const more = iconBtn('more', 'Actions', (e) => {
      e.stopPropagation();
      popMenu(more, [
        { label: 'Dupliquer pour la leçon suivante', onClick: () => duplicate(r, ctx, set) },
        { label: 'Supprimer', danger: true, onClick: () => deleteSet(ctx, set) },
      ]);
    }, 'sm');
    const open = () => go('equipes', { ...r, setId: set.id });
    return h('div', { class: 'evrow', role: 'button', tabindex: 0, onClick: open, onKeydown: (e) => { if (e.key === 'Enter') open(); } },
      h('div', { class: 'grow' }, h('div', { class: 't' }, set.name || 'Sans nom'), h('div', { class: 'muted small' }, `${set.date ? fmtDate(set.date) + ' · ' : ''}${set.mode === 'clubs' ? 'Clubs' : 'Équipes'} · ${mode}`)), more);
  };
  return h('div', { class: 'main' },
    h('div', { class: 'topbar' },
      iconBtn('back', 'Retour', () => backTo(r), '', { 'data-back': '1' }),
      h('div', { class: 'grow evtitle' }, h('h1', null, 'Équipes'), h('div', { class: 'sub' }, ctx.title)),
      helpButton('equipes'),
      btn('Nouvelle composition', { icon: 'plus', cls: 'primary', onClick: () => newSetDialog(r, ctx) })),
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
      h('span', { class: 'sn' }, studentLabel(s)),
      role ? h('span', { class: 'sr', title: role.label }, role.short) : null,
      st === 'dispense' ? h('span', { class: 'sb', title: 'Dispensé' }, 'D') : null,
      locked ? h('span', { class: 'sl', title: 'Verrouillé' }, icon('lock', 13)) : null);
  };
  const zone = (id, cls, kids) => h('div', { class: `zone ${cls}`, 'data-zone': id }, kids);
  const colorBtn = (t, isClub) => {
    const b = h('button', { type: 'button', class: 'vestbtn', 'aria-label': 'Couleur du chasuble', title: 'Couleur du chasuble', style: { background: vestOf(isClub ? t.color : teamColorId(set, t)).hex } });
    b.addEventListener('click', () => popMenu(b, VEST_COLORS.map((c) => ({ label: `${c.id === (isClub ? t.color : t.color) ? '● ' : ''}${c.label}`, onClick: () => apply(() => { t.color = c.id; if (!isClub) t.colorOwn = true; }) }))));
    return b;
  };
  const nameInput = (obj, label) => h('input', { type: 'text', class: 'tname', value: obj.name, 'aria-label': label, onChange: (e) => apply(() => { obj.name = e.target.value.trim() || obj.name; }) });
  const teamCard = (t) => {
    const hex = vestOf(teamColorId(set, t));
    return h('section', { class: 'tcard' },
      h('header', { style: { background: hex.hex, color: hex.ink } },
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
      h('header', { style: { background: hex.hex, color: hex.ink } },
        nameInput(c, 'Nom du club'), h('span', { class: 'tcount' }, total), colorBtn(c, true),
        iconBtn('trash', `Supprimer ${c.name}`, () => undoable(ctx, set, `Club « ${c.name} » supprimé.`, () => removeClub(set, c.id)), 'sm')),
      h('div', { class: 'cluboard' },
        zone(pool.id, 'tz clubpool', [h('div', { class: 'zlabel' }, 'À répartir'), ...pool.members.filter((s) => byId.has(s)).map((s) => chip(byId.get(s), {}))]),
        h('div', { class: 'subteams' }, subs.map((t) => h('div', { class: 'sub' }, nameInput(t, 'Nom de l\'équipe'), zone(t.id, 'tz', t.members.filter((s) => byId.has(s)).map((s) => chip(byId.get(s), {}))))))));
  };

  const free = unplaced(set, students).filter((s) => statusOf(set, s.id) === 'present');
  const disp = unplaced(set, students).filter((s) => statusOf(set, s.id) === 'dispense');
  const abs = students.filter((s) => statusOf(set, s.id) === 'absent');
  const side = h('aside', { class: 'tside scroll', 'data-keep': 'tside' },
    zone('unplaced', 'tz', [h('div', { class: 'zlabel' }, `Non placés (${free.length})`), ...free.map((s) => chip(s, {})), free.length ? null : h('div', { class: 'muted small' }, 'Tout le monde est placé.')]),
    zone('dispense', 'tz zdisp', [h('div', { class: 'zlabel' }, `Dispensés (${disp.length})`), ...disp.map((s) => chip(s, {}))]),
    zone('absent', 'tz zabs', [h('div', { class: 'zlabel' }, `Absents (${abs.length})`), ...abs.map((s) => chip(s, {}))]));

  const cards = set.mode === 'clubs' ? set.clubs.map(clubCard) : teamsOnly(set).map(teamCard);
  const board = h('div', { class: 'tboard scroll', 'data-keep': 'tboard' },
    cards.length ? cards : h('div', { class: 'empty' }, h('h2', null, set.mode === 'clubs' ? 'Aucun club' : 'Aucune équipe'),
      h('p', null, 'Ajoutez des équipes puis glissez les élèves dedans, ou touchez « Générer ».'),
      btn(set.mode === 'clubs' ? 'Ajouter un club' : 'Ajouter une équipe', { icon: 'plus', cls: 'primary', onClick: () => apply(() => (set.mode === 'clubs' ? addClub(set) : addTeam(set))) })));

  const more = iconBtn('more', 'Options', () => popMenu(more, [
    { label: 'Renommer la composition…', onClick: () => renameSetDialog(set, apply) },
    { label: 'Contraintes (ensemble / séparés)…', onClick: () => constraintsDialog(set, students, nameOf, apply) },
    { label: 'Rôles (liste)…', onClick: () => rolesDialog(render) },
    ctx.kind === 'free' ? { label: 'Ajouter des élèves…', onClick: () => addStudentsDialog(set, apply) } : null,
    { label: 'Imprimer / PDF', onClick: () => printSet(set, nameOf, roles) },
    { label: 'Dupliquer pour la leçon suivante', onClick: () => duplicate(r, ctx, set) },
    '-',
    { label: 'Tout remettre en « non placés »', danger: true, onClick: () => undoable(ctx, set, 'Équipes vidées.', () => { for (const t of set.teams) t.members = []; }) },
  ].filter(Boolean)), 'boxed');

  const root = h('div', { class: 'main teams' },
    h('div', { class: 'topbar' },
      iconBtn('back', 'Retour', back, '', { 'data-back': '1' }),
      h('div', { class: 'grow evtitle' }, h('h1', null, set.name || 'Composition'), h('div', { class: 'sub' }, `${ctx.title}${set.date ? ' · ' + fmtDate(set.date) : ''} · ${set.mode === 'clubs' ? 'clubs' : 'équipes'}`)),
      helpButton('equipes'),
      btn('Générer', { icon: 'shuffle', cls: 'primary', onClick: () => generateDialog(r, ctx, set, students, apply, undoable) }),
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
  }), (sid, anchor) => chipMenu(set, sid, anchor, nameOf, roles, apply));
  return root;
}

function reshuffle(ctx, set, students) {
  const opts = { ...(set.lastGen || { mode: 'random' }), seed: null };
  if (opts.mode === 'tutor') opts.mode = 'random';
  opts.scores = scoresFor(ctx, set, opts.source);
  if (!teamsOnly(set).length && set.mode !== 'clubs') return toast('Ajoutez des équipes ou touchez « Générer ».');
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

function chipMenu(set, sid, anchor, nameOf, roles, apply) {
  const st = statusOf(set, sid), team = teamOfStudent(set, sid);
  popMenu(anchor, [
    { label: 'Placer dans…', onClick: () => placeDialog(set, sid, nameOf, apply) },
    team ? { label: 'Retirer de l\'équipe', onClick: () => apply(() => moveStudent(set, sid, null)) } : null,
    '-',
    { label: 'Présent', active: st === 'present', onClick: () => apply(() => setStatus(set, sid, 'present')) },
    { label: 'Dispensé (reste utile : rôle possible)', active: st === 'dispense', onClick: () => apply(() => setStatus(set, sid, 'dispense')) },
    { label: 'Absent', active: st === 'absent', onClick: () => apply(() => setStatus(set, sid, 'absent')) },
    '-',
    { label: `Rôles… ${(set.roles[sid] || []).length ? '(' + (set.roles[sid] || []).length + ')' : ''}`, onClick: () => studentRolesDialog(set, sid, nameOf, roles, apply) },
    { label: set.locked[sid] ? 'Déverrouiller' : 'Verrouiller à sa place', disabled: !team, onClick: () => apply(() => toggleLock(set, sid)) },
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

function studentRolesDialog(set, sid, nameOf, roles, apply) {
  const dlg = openDialog({ title: `Rôles de ${nameOf(sid)}`, body: h('div', null), actions: [{ label: 'Terminé', primary: true }] });
  const paint = () => dlg.content.replaceChildren(
    h('p', { class: 'muted small', style: { margin: 0 } }, 'Plusieurs rôles possibles ; le premier choisi est celui qui s\'affiche sur la tuile.'),
    ...roles.map((ro) => { const on = (set.roles[sid] || []).includes(ro.id), first = (set.roles[sid] || [])[0] === ro.id;
      return h('button', { type: 'button', class: `btn ${on ? 'primary' : ''}`, style: { display: 'block', width: '100%', margin: '6px 0', textAlign: 'left' },
        onClick: () => { apply(() => toggleRole(set, sid, ro.id)); paint(); } }, `${on ? '✓ ' : ''}${ro.label}${first ? '  (affiché)' : ''}`); }));
  paint();
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
  const member = (id) => { const ro = visibleRole(set, id, roles); return h('li', { class: statusOf(set, id) === 'dispense' ? 'disp' : '' }, nameOf(id), ro ? h('span', { class: 'sr' }, ro.short) : null); };
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

// ---------- Glisser-déposer (doigt ou stylet) ----------

function attachDrag(root, onDrop, onTap) {
  root.addEventListener('pointerdown', (e) => {
    const chipEl = e.target.closest('.schip');
    if (!chipEl || e.button > 0) return;
    const sid = chipEl.dataset.sid, sx = e.clientX, sy = e.clientY;
    let ghost = null, moved = false, over = null;
    try { chipEl.setPointerCapture(e.pointerId); } catch { /* ok */ }
    const zoneAt = (x, y) => { if (ghost) ghost.style.display = 'none'; const z = document.elementFromPoint(x, y)?.closest('[data-zone]'); if (ghost) ghost.style.display = ''; return z; };
    const onMove = (ev) => {
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 8) {
        moved = true;
        document.body.classList.add('dragchip'); ghost = chipEl.cloneNode(true); ghost.classList.add('ghost'); document.body.append(ghost); chipEl.classList.add('dragging');
      }
      if (!moved) return;
      ghost.style.left = ev.clientX + 'px'; ghost.style.top = ev.clientY + 'px';
      const z = zoneAt(ev.clientX, ev.clientY);
      if (z !== over) { over?.classList.remove('over'); over = z; over?.classList.add('over'); }
      const sc = z?.closest('.scroll'); // défilement automatique près des bords
      if (sc) { const b = sc.getBoundingClientRect(); if (ev.clientY < b.top + 50) sc.scrollTop -= 14; else if (ev.clientY > b.bottom - 50) sc.scrollTop += 14; }
    };
    const end = (ev) => {
      chipEl.removeEventListener('pointermove', onMove); chipEl.removeEventListener('pointerup', end); chipEl.removeEventListener('pointercancel', cancel);
      if (!moved) { onTap(sid, chipEl); return; }
      const z = zoneAt(ev.clientX, ev.clientY);
      document.body.classList.remove('dragchip'); over?.classList.remove('over'); ghost.remove(); chipEl.classList.remove('dragging');
      if (z) onDrop(sid, z.dataset.zone);
    };
    const cancel = () => { chipEl.removeEventListener('pointermove', onMove); chipEl.removeEventListener('pointerup', end); chipEl.removeEventListener('pointercancel', cancel); document.body.classList.remove('dragchip'); over?.classList.remove('over'); ghost?.remove(); chipEl.classList.remove('dragging'); };
    chipEl.addEventListener('pointermove', onMove); chipEl.addEventListener('pointerup', end); chipEl.addEventListener('pointercancel', cancel);
  });
}

// ---------- Lien avec l'évaluation (appelé par l'écran d'une évaluation) ----------

/** Compositions d'équipes de l'activité d'une évaluation (pour « Reprendre les équipes »). */
export function setsForEvaluation(ev) {
  const cls = app.repo.get('classes', ev.classId);
  const act = cls ? activitiesOf(cls).find((a) => a.id === ev.activityId) : null;
  return act?.equipes?.sets || [];
}
export { copyIntoEvaluation };
