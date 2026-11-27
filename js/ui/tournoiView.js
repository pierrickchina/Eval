// Outil Tournoi : liste, création (libre ou dans une activité, 1 ou 2 tournois en parallèle), écran de jeu en paysage.
// Un tournoi est un enregistrement autonome : équipes figées (nom, couleur, élèves), calendrier, scores, chronomètres.
import { app, registerView, go, render } from '../app.js';
import { h, btn, icon, iconBtn, openDialog, popMenu, toast, confirmDialog } from './dom.js';
import { fmtDate, todayISO, uid } from '../util.js';
import { VEST_COLORS, vestOf, teamsOnly, teamColorId, teamLabel } from '../logic/teams.js';
import { activitiesOf, touchTool } from '../logic/activities.js';
import * as TN from '../logic/tournament.js';
import { clockText } from './chronoView.js';
import { helpItem } from './help.js';
import { printNode } from './printView.js';

const K = { ticker: null, lock: null, active: [], setup: null };
const saveClass = (cls) => app.repo.save('classes', cls);

// ---------- Contexte : activité ou outil libre ----------

function ctxFor(r) {
  const repo = app.repo;
  if (r.scope === 'act') {
    const cls = repo.get('classes', r.classId);
    const act = cls && !cls.deleted ? activitiesOf(cls).find((a) => a.id === r.actId) : null;
    if (!act) return null;
    act.tournois ??= [];
    return {
      kind: 'act', cls, act, title: `${act.name} · ${cls.name}`,
      list: () => act.tournois,
      add: (t) => act.tournois.push(t),
      remove: (id) => { const i = act.tournois.findIndex((x) => x.id === id); const [x] = act.tournois.splice(i, 1); saveClass(cls); return () => { act.tournois.splice(Math.min(i, act.tournois.length), 0, x); return saveClass(cls); }; },
      save: () => { touchTool(act, 'tournoi'); return saveClass(cls); },
    };
  }
  const recs = () => repo.list('freetools').filter((x) => x.type === 'tournoi');
  return {
    kind: 'free', title: 'Tournois',
    list: () => recs().map((x) => x.t).sort((a, b) => b.createdAt - a.createdAt),
    add: (t) => repo.save('freetools', { id: uid(), type: 'tournoi', t }),
    remove: (id) => { const rec = recs().find((x) => x.t.id === id); repo.remove('freetools', rec.id); return () => repo.restore('freetools', rec.id); },
    save: (t) => repo.save('freetools', recs().find((x) => x.t.id === t.id)),
  };
}
const backTo = (r) => (r.from === 'classPage' && r.classId ? go('classPage', { id: r.classId }) : go('home'));
const partnerOf = (ctx, t) => (t.pairId ? ctx.list().find((x) => x.pairId === t.pairId && x.id !== t.id) || null : null);
const persist = (ctx, ...ts) => ts.filter(Boolean).forEach((t) => ctx.save(t));

// ---------- Aides d'affichage ----------

const vest = (t, id) => { const tm = t.teams.find((x) => x.id === id); return vestOf(tm?.color); };
const nameOf = (t, id) => t.teams.find((x) => x.id === id)?.name || '—';
const dot = (hex) => h('i', { class: 'tdot', style: { background: hex } });
const shirtIcon = (id) => { const v = vestOf(id); const sv = icon('teams', 20); sv.setAttribute('fill', v.hex); sv.setAttribute('stroke', v.id === 'sans' ? '#8b90a6' : 'rgba(0,0,0,.45)'); return sv; };
const STATE = { setup: 'à lancer', running: 'en cours', done: 'terminé' };
const statusOf = (t) => (t.matches.length && t.matches.every((m) => m.done) ? 'done' : t.matches.some((m) => m.done || t.live?.[m.court]?.matchId === m.id) ? 'running' : 'setup');
const ordinal = (n) => (n === 1 ? '1er' : `${n}e`);

// ---------- Liste ----------

registerView('tournoi', (r) => {
  const ctx = ctxFor(r);
  if (!ctx) { queueMicrotask(() => go('home')); return h('div'); }
  if (r.setup && K.setup) return setupView(r, ctx);
  if (r.tid) { const t = ctx.list().find((x) => x.id === r.tid); if (t) return playView(r, ctx, t); }
  stopTicker();
  const all = ctx.list();
  const groups = []; const seen = new Set();
  for (const t of all) { if (seen.has(t.id)) continue; seen.add(t.id); const p = partnerOf(ctx, t); if (p) seen.add(p.id); groups.push(p ? [t, p].sort((a, b) => (a.side || '').localeCompare(b.side || '')) : [t]); }
  const row = (g) => {
    const t = g[0];
    const more = iconBtn('more', 'Actions', (e) => { e.stopPropagation(); popMenu(more, [
      { label: 'Dupliquer (mêmes équipes, nouveaux matchs)', onClick: () => duplicate(r, ctx, g) },
      { label: 'Supprimer', danger: true, onClick: () => deleteGroup(ctx, g) },
    ]); }, 'sm');
    const st = g.every((x) => statusOf(x) === 'done') ? 'done' : g.some((x) => statusOf(x) !== 'setup') ? 'running' : 'setup';
    const open = () => go('tournoi', { ...r, tid: t.id });
    return h('div', { class: 'evrow comprow', role: 'button', tabindex: 0, onClick: open, onKeydown: (e) => { if (e.key === 'Enter') open(); } },
      h('div', { class: 'grow' }, h('div', { class: 't' }, g.length > 1 ? g.map((x) => x.name).join(' + ') : t.name),
        h('div', { class: 'muted small' }, [fmtDate(t.date), TN.SPORTS[t.sport]?.label, g.map((x) => `${x.teams.length} équipes`).join(' + '), g.length > 1 ? 'en parallèle' : '', STATE[st]].filter(Boolean).join(' · '))),
      h('span', { class: 'shirts' }, g.flatMap((x) => x.teams.slice(0, 8).map((tm) => shirtIcon(tm.color)))), more);
  };
  const newBtn = btn('Nouveau tournoi', { icon: 'plus', cls: 'primary', onClick: () => { K.setup = initSetup(ctx); go('tournoi', { ...r, tid: undefined, setup: true }); } });
  const m = iconBtn('more', 'Options', () => popMenu(m, [helpItem('tournoi')]), 'boxed');
  return h('div', { class: 'main' },
    h('div', { class: 'topbar' }, iconBtn('back', 'Retour', () => backTo(r), '', { 'data-back': '1' }),
      h('div', { class: 'grow evtitle' }, h('h1', null, 'Tournois'), h('div', { class: 'sub' }, ctx.title)), newBtn, m),
    groups.length ? h('div', { class: 'scroll grow listpad', 'data-keep': 'tournois' }, groups.map(row))
      : h('div', { class: 'empty' }, h('h2', null, 'Aucun tournoi'),
        h('p', null, 'Choisissez les équipes, le sport et la durée : l\'outil prépare un calendrier équilibré (matchs, arbitrages, repos) et tient la table de marque.'), newBtn));
});

function deleteGroup(ctx, g) {
  const undos = g.map((t) => ctx.remove(t.id));
  render();
  toast(`Tournoi « ${g[0].name} » supprimé.`, { action: 'Annuler', ms: 9000, onAction: async () => { for (const u of undos) await u(); render(); } });
}
function duplicate(r, ctx, g) {
  const pairId = g.length > 1 ? uid() : null;
  const copies = g.map((t) => {
    const c = TN.newTournament({ name: `${t.name} (copie)`, date: todayISO(), teams: JSON.parse(JSON.stringify(t.teams)), scope: t.scope, pairId, side: t.side, ctx: { classId: t.classId, actId: t.actId, setId: t.setId },
      settings: { sport: t.sport, halves: t.halves, halfMin: t.halfMin, pauseMin: t.pauseMin, pts: t.pts, courts: t.courts, format: t.format, finals: t.finals, perTeam: t.perTeam, changeover: t.changeover, change: t.change, customButtons: t.customButtons } });
    ctx.add(c); return c;
  });
  persist(ctx, ...copies);
  go('tournoi', { ...r, tid: copies[0].id });
}

// ---------- Création ----------

function initSetup(ctx) {
  const S = {
    name: TN.defaultName(todayISO()), nameTouched: false, date: todayISO(), ...JSON.parse(JSON.stringify(TN.DEFAULT_SETTINGS)),
    parallel: false, minutes: '', plan: null, setId: null, rows: [], teamsA: [], teamsB: [],
  };
  if (ctx.kind === 'act') {
    S.sport = TN.sportFromActivity(ctx.act.name);
    const sets = ctx.act.equipes?.sets || [];
    if (sets.length) fillFromSet(S, sets.at(-1));
  } else S.teamsA = defaultTeams(4);
  return S;
}
function defaultTeams(n, from = 0) {
  const cols = VEST_COLORS.filter((c) => c.id !== 'sans');
  return Array.from({ length: n }, (_, i) => ({ id: uid(), name: `Équipe ${from + i + 1}`, color: cols[(from + i) % cols.length].id }));
}
/** Équipes d'une composition de l'outil Équipes (noms et couleurs repris). Un club donne 2 tournois : équipes 1 d'un côté, équipes 2 de l'autre. */
function fillFromSet(S, set) {
  S.setId = set.id;
  S.parallel = set.mode === 'clubs';
  S.rows = teamsOnly(set).map((t) => ({
    teamId: t.id, clubId: t.clubId || null, rank: t.rank || 0, name: teamLabel(set, t), color: teamColorId(set, t),
    members: t.members.filter((sid) => set.status[sid] !== 'absent'), // absent : aucun résultat ; dispensé : garde le résultat de son équipe
    include: t.members.length > 0, side: set.mode === 'clubs' && t.rank === 2 ? 'B' : 'A',
  }));
  if (S.parallel && S.rows.length && !S.rows.some((x) => x.side === 'B')) S.rows.forEach((x, i) => { x.side = i % 2 ? 'B' : 'A'; });
}
const teamsOfSide = (S, side, ctx) => (ctx.kind === 'act'
  ? S.rows.filter((x) => x.include && x.side === side).map((x) => ({ id: uid(), name: x.name, color: x.color, teamId: x.teamId, clubId: x.clubId, members: x.members }))
  : (side === 'A' ? S.teamsA : S.teamsB));

function setupView(r, ctx) {
  const S = K.setup;
  const re = () => render();
  const set = (k, v) => { S[k] = v; S.plan = null; re(); };
  const num = (v, d) => { const x = parseInt(v, 10); return Number.isFinite(x) && x > 0 ? x : d; };
  const seg = (items, cur, fn) => h('div', { class: 'seg' }, items.map(([k, l]) => h('button', { type: 'button', class: cur === k ? 'on' : '', onClick: () => fn(k) }, l)));
  const field = (label, input) => h('label', { class: 'field' }, label, input);
  const numIn = (val, fn, w = '90px', min = 1, max = 99) => h('input', { type: 'number', inputmode: 'numeric', min, max, value: val, style: { width: w }, onChange: (e) => fn(num(e.target.value, val)) });
  const sides = S.parallel ? ['A', 'B'] : ['A'];
  const nA = teamsOfSide(S, 'A', ctx).length, nB = S.parallel ? teamsOfSide(S, 'B', ctx).length : 0;
  const matchMin = TN.matchMinutes(S);
  const ok = (n) => n >= 2 && n <= 12;
  const valid = ok(nA) && (!S.parallel || ok(nB));

  // --- équipes ---
  const colorBtn = (tm) => { const b = h('button', { type: 'button', class: 'vestbtn', 'aria-label': 'Couleur du chasuble', style: { background: vestOf(tm.color).hex }, onClick: () => popMenu(b, VEST_COLORS.map((c) => ({ label: `${c.id === tm.color ? '● ' : ''}${c.label}`, onClick: () => { tm.color = c.id; re(); } }))) }); return b; };
  const freeList = (key, label) => {
    const list = S[key];
    return h('div', { class: 'panel' }, h('h3', null, label),
      list.map((tm, i) => h('div', { class: 'listrow' }, colorBtn(tm), h('input', { type: 'text', value: tm.name, style: { flex: 1 }, 'aria-label': `Nom de l'équipe ${i + 1}`, onChange: (e) => { tm.name = e.target.value.trim() || tm.name; re(); } }),
        iconBtn('trash', 'Retirer', () => { list.splice(i, 1); S.plan = null; re(); }, 'sm'))),
      h('div', { class: 'row' }, btn('Ajouter une équipe', { icon: 'plus', cls: 'small soft', disabled: list.length >= 12, onClick: () => { list.push(...defaultTeams(1, list.length)); S.plan = null; re(); } }),
        h('span', { class: `muted small ${ok(list.length) ? '' : 'bad'}` }, `${list.length} équipe${list.length > 1 ? 's' : ''} (2 à 12)`)));
  };
  const sets = ctx.kind === 'act' ? ctx.act.equipes?.sets || [] : [];
  const actTeams = () => {
    if (!sets.length) return h('div', { class: 'panel' }, h('h3', null, 'Équipes'), h('p', { class: 'muted' }, 'Créez d\'abord une composition dans l\'outil Équipes de cette activité : le tournoi en reprend les noms et les couleurs.'),
      btn('Ouvrir l\'outil Équipes', { onClick: () => go('equipes', { from: 'classPage', classId: ctx.cls.id, scope: 'act', actId: ctx.act.id }) }));
    return h('div', { class: 'panel' }, h('h3', null, 'Équipes'),
      field('Composition de l\'outil Équipes', h('select', { onChange: (e) => { fillFromSet(S, sets.find((x) => x.id === e.target.value)); S.plan = null; re(); } },
        sets.map((x) => h('option', { value: x.id, selected: x.id === S.setId }, `${x.name}${x.date ? ' · ' + fmtDate(x.date) : ''} (${x.mode === 'clubs' ? 'clubs' : 'équipes'})`)))),
      S.rows.map((x) => h('div', { class: 'listrow' },
        h('input', { type: 'checkbox', checked: x.include, style: { width: '22px', height: '22px' }, 'aria-label': `Inclure ${x.name}`, onChange: (e) => { x.include = e.target.checked; S.plan = null; re(); } }),
        dot(vestOf(x.color).hex), h('b', { class: 'grow' }, x.name), h('span', { class: 'muted small' }, `${x.members.length} élève${x.members.length > 1 ? 's' : ''}`),
        S.parallel ? seg([['A', 'Tournoi 1'], ['B', 'Tournoi 2']], x.side, (k) => { x.side = k; S.plan = null; re(); }) : null)));
  };

  // --- réglages ---
  const plan = S.plan;
  const settings = h('div', { class: 'panel' }, h('h3', null, 'Réglages'),
    h('div', { class: 'row wrap' },
      field('Sport', h('select', { onChange: (e) => set('sport', e.target.value) }, Object.entries(TN.SPORTS).map(([k, v]) => h('option', { value: k, selected: S.sport === k }, v.label)))),
      S.sport === 'autre' ? field('Boutons de points (ex. 1,2,3)', h('input', { type: 'text', value: S.customButtons, style: { width: '140px' }, onChange: (e) => { S.customButtons = e.target.value; re(); } })) : null,
      field('Format', seg([['single', 'Chacun contre chacun'], ['double', 'Aller-retour']], S.format, (k) => set('format', k))),
      field('Finale', h('select', { onChange: (e) => set('finals', e.target.value) }, [['none', 'Aucune'], ['final', 'Finale'], ['both', 'Finale et petite finale']].map(([k, l]) => h('option', { value: k, selected: S.finals === k }, l))))),
    h('div', { class: 'row wrap' },
      field('Mi-temps', seg([[1, 'Une'], [2, 'Deux']], S.halves, (k) => set('halves', k))),
      field(S.halves === 2 ? 'Durée d\'une mi-temps (min)' : 'Durée du match (min)', numIn(S.halfMin, (v) => set('halfMin', v))),
      S.halves === 2 ? field('Pause (min)', numIn(S.pauseMin, (v) => set('pauseMin', v))) : null,
      field('Changement entre matchs (min)', seg([[1, '1'], [2, '2'], [3, '3']], S.changeover, (k) => set('changeover', k))),
      field('Terrains', seg([[1, '1'], [2, '2']], S.parallel ? 1 : S.courts, (k) => { if (!S.parallel) set('courts', k); }))),
    h('div', { class: 'row wrap' }, h('b', null, 'Points de tournoi :'),
      ...[['w', 'victoire'], ['d', 'égalité'], ['l', 'défaite']].map(([k, l]) => h('label', { class: 'row' }, l, numIn(S.pts[k], (v) => { S.pts[k] = v; re(); }, '64px', 0, 20)))),
    h('div', { class: 'row wrap' },
      h('label', { class: 'row' }, h('input', { type: 'checkbox', checked: S.change.on, style: { width: '22px', height: '22px' }, onChange: (e) => { S.change.on = e.target.checked; re(); } }), 'Indicateur « Changement : » sur le chronomètre'),
      S.change.on ? h('select', { 'aria-label': 'Moment du changement', onChange: (e) => { S.change.mode = e.target.value; re(); } }, [['mid', 'À la moitié (de chaque mi-temps)'], ['thirds', 'Au tiers et aux deux tiers'], ['custom', 'À des temps choisis']].map(([k, l]) => h('option', { value: k, selected: S.change.mode === k }, l))) : null,
      S.change.on && S.change.mode === 'custom' ? h('input', { type: 'text', placeholder: '1:30, 3:00', value: S.change.custom, style: { width: '140px' }, 'aria-label': 'Temps écoulés des changements', onChange: (e) => { S.change.custom = e.target.value; re(); } }) : null),
    S.parallel ? h('p', { class: 'muted small', style: { margin: 0 } }, 'Deux tournois en parallèle : un terrain chacun, vue partagée, sans classement en direct.') : null);

  // --- j'ai X minutes ---
  const planBox = h('div', { class: 'panel' }, h('h3', null, 'J\'ai X minutes'),
    h('div', { class: 'row wrap' }, field('Temps disponible (min)', h('input', { type: 'number', inputmode: 'numeric', min: 5, value: S.minutes, style: { width: '110px' }, onChange: (e) => { S.minutes = e.target.value; S.plan = TN.planTime({ minutes: num(e.target.value, 0), n: Math.max(nA, nB, 2), courts: S.parallel ? 1 : S.courts, matchMin, changeover: S.changeover, format: S.format }); re(); } })),
      plan ? btn(plan.possible ? (plan.full ? 'Garder le tournoi complet' : `Appliquer : ${plan.perTeam} match${plan.perTeam > 1 ? 's' : ''} par équipe`) : 'Trop court', { cls: 'soft', disabled: !plan.possible, onClick: () => { S.perTeam = plan.full ? null : plan.perTeam; toast(plan.full ? 'Tournoi complet.' : `${plan.perTeam} matchs par équipe.`); re(); } }) : null),
    plan ? h('p', { class: 'small', style: { margin: '8px 0 0' } }, plan.possible
      ? `${plan.full ? 'Le tournoi complet rentre' : `Je propose ${plan.perTeam} match${plan.perTeam > 1 ? 's' : ''} par équipe`} : ${plan.totalMatches} matchs, environ ${plan.minutesUsed} min en comptant les changements (toujours à la baisse).${plan.uneven ? ' Avec un nombre impair d\'équipes, certaines joueront un match de moins.' : ''}`
      : 'Ce temps est trop court pour un seul match avec les changements.') : null,
    S.perTeam ? h('p', { class: 'small', style: { margin: '6px 0 0' } }, `Réglé sur ${S.perTeam} match${S.perTeam > 1 ? 's' : ''} par équipe. `, h('button', { type: 'button', class: 'linkbtn', onClick: () => { S.perTeam = null; S.plan = null; re(); } }, 'Revenir au tournoi complet')) : null);

  const estimate = (() => { const n = Math.max(nA, 2); const pool = TN.pairingPool(Array.from({ length: n }, (_, i) => i), { format: S.format, perTeam: S.perTeam }).length; const c = (S.parallel ? 1 : S.courts); const slots = Math.ceil(pool / (n < 4 ? 1 : c)) + (S.finals === 'both' && n >= 4 ? 2 : S.finals === 'final' && n >= 3 ? 1 : 0); return slots * (matchMin + S.changeover) - S.changeover; })();

  const create = () => {
    if (!valid) return toast('Chaque tournoi doit avoir de 2 à 12 équipes.');
    const pairId = S.parallel ? uid() : null;
    const settingsOut = { sport: S.sport, halves: S.halves, halfMin: S.halfMin, pauseMin: S.pauseMin, pts: S.pts, courts: S.parallel ? 1 : S.courts, format: S.format, finals: S.finals, perTeam: S.perTeam, changeover: S.changeover, change: S.change, customButtons: S.customButtons };
    const base = ctx.kind === 'act' ? { classId: ctx.cls.id, actId: ctx.act.id, setId: S.setId } : {};
    const made = sides.map((side) => TN.newTournament({ name: S.parallel ? `${S.name} · Tournoi ${side === 'A' ? 1 : 2}` : S.name, date: S.date, teams: teamsOfSide(S, side, ctx).map((x) => JSON.parse(JSON.stringify(x))), settings: settingsOut, scope: ctx.kind, pairId, side: S.parallel ? side : null, ctx: base }));
    made.forEach((t) => ctx.add(t)); persist(ctx, ...made);
    K.setup = null;
    go('tournoi', { ...r, setup: undefined, tid: made[0].id });
  };

  return h('div', { class: 'main' },
    h('div', { class: 'topbar' }, iconBtn('back', 'Retour', () => { K.setup = null; go('tournoi', { ...r, setup: undefined }); }, '', { 'data-back': '1' }),
      h('div', { class: 'grow evtitle' }, h('h1', null, 'Nouveau tournoi'), h('div', { class: 'sub' }, `${ctx.title} · durée estimée ${estimate} min`)),
      btn('Créer le tournoi', { icon: 'play', cls: 'primary', disabled: !valid, onClick: create })),
    h('div', { class: 'scroll grow listpad setup', 'data-keep': 'tsetup' },
      h('div', { class: 'panel' }, h('div', { class: 'row wrap' },
        field('Nom du tournoi', h('input', { type: 'text', value: S.name, style: { width: '280px' }, 'data-fid': 'tname', onInput: (e) => { S.name = e.target.value; } })),
        field('Date', h('input', { type: 'date', value: S.date, onChange: (e) => { S.date = e.target.value || todayISO(); if (!S.nameTouched && /^Tournoi \d/.test(S.name)) S.name = TN.defaultName(S.date); re(); } })),
        h('label', { class: 'row' }, h('input', { type: 'checkbox', checked: S.parallel, style: { width: '22px', height: '22px' }, onChange: (e) => { S.parallel = e.target.checked; if (S.parallel && ctx.kind === 'free' && !S.teamsB.length) S.teamsB = defaultTeams(4, S.teamsA.length); if (S.parallel && ctx.kind === 'act' && !S.rows.some((x) => x.side === 'B')) S.rows.forEach((x, i) => { x.side = i % 2 ? 'B' : 'A'; }); S.courts = 1; S.plan = null; re(); } }), 'Deux tournois en parallèle (un terrain chacun)'))),
      ctx.kind === 'act' ? actTeams() : h('div', { class: S.parallel ? 'twocols' : '' }, freeList('teamsA', S.parallel ? 'Équipes du tournoi 1' : 'Équipes'), S.parallel ? freeList('teamsB', 'Équipes du tournoi 2') : null),
      ctx.kind === 'act' && S.parallel ? h('p', { class: `muted small ${ok(nA) && ok(nB) ? '' : 'bad'}` }, `Tournoi 1 : ${nA} équipes · Tournoi 2 : ${nB} équipes (2 à 12 chacun)`) : null,
      settings, planBox));
}

// ---------- Écran de jeu ----------

const matchLabel = (t, m) => `${nameOf(t, m.a)} – ${nameOf(t, m.b)}`;
const pending = (t, court) => t.matches.filter((m) => m.court === court && !m.done && m.a && m.b).sort((x, y) => x.slot - y.slot);
const currentOf = (t, court) => pending(t, court)[0] || null;
const courtsOf = (t) => (t.courts === 2 && t.teams.length >= 4 ? [0, 1] : [0]);
const phaseText = { h1: '', pause: 'Pause', h2: '2e mi-temps', fin: 'Temps écoulé' };

function playView(r, ctx, t) {
  const partner = partnerOf(ctx, t);
  const ts = partner ? [t, partner].sort((a, b) => (a.side || '').localeCompare(b.side || '')) : [t];
  K.active = ts; K.ctx = ctx; startTicker(); keepAwake();
  for (const x of ts) if (TN.resolveFinals(x)) persist(ctx, x);
  const leave = async () => {
    for (const x of ts) for (const c of courtsOf(x)) if (TN.liveRunning(x.live?.[c])) x.live[c] = TN.livePause(x.live[c]);
    persist(ctx, ...ts); stopTicker(); go('tournoi', { ...r, tid: undefined });
  };
  const more = iconBtn('more', 'Options', () => popMenu(more, [
    { label: 'Classement…', onClick: () => rankDialog(ts[0]) },
    partner ? { label: 'Classement du tournoi 2…', onClick: () => rankDialog(ts[1]) } : null,
    { label: 'Imprimer calendrier et classement', onClick: () => printTournoi(ts) },
    { label: 'Renommer…', onClick: () => renameDialog(ctx, t) },
    helpItem('tournoi'),
  ].filter(Boolean)), 'boxed');
  const est = TN.estimateMinutes(t);
  return h('div', { class: `main tplay ${partner ? 'split' : ''}` },
    h('div', { class: 'topbar' }, iconBtn('back', 'Retour', leave, '', { 'data-back': '1' }),
      h('div', { class: 'grow evtitle' }, h('h1', null, partner ? ts.map((x) => x.name).join(' + ') : t.name),
        h('div', { class: 'sub' }, `${TN.SPORTS[t.sport]?.label} · ${t.teams.length} équipes${partner ? ` + ${partner.teams.length}` : ''} · ~${est} min`)),
      partner ? null : btn('Classement', { icon: 'trophy', onClick: () => rankDialog(t) }), more),
    h('div', { class: 'tpanels' }, ts.map((x) => tournamentPanel(ctx, x, !!partner))));
}

function tournamentPanel(ctx, t, compact) {
  const courts = courtsOf(t);
  const done = t.matches.every((m) => m.done);
  const rows = TN.finalStandings(t);
  const mini = compact ? null : h('div', { class: 'trank', role: 'button', tabindex: 0, onClick: () => rankDialog(t), 'aria-label': 'Ouvrir le classement' },
    rows.map((x) => h('div', { class: 'trow' }, h('span', { class: 'rk' }, x.rank), dot(vest(t, x.id).hex), h('span', { class: 'nm' }, nameOf(t, x.id)), h('b', null, x.pts))));
  return h('section', { class: 'tpanel' },
    compact ? h('div', { class: 'tphead' }, h('b', null, t.name), btn('Classement', { icon: 'trophy', cls: 'small', onClick: () => rankDialog(t) })) : null,
    done ? h('div', { class: 'tdone' }, icon('trophy', 20), `Tournoi terminé — 1er : ${nameOf(t, rows[0]?.id)}`) : null,
    h('div', { class: `boards n${courts.length}` }, courts.map((c) => board(ctx, t, c, compact))),
    h('div', { class: 'tbottom' }, matchList(ctx, t, courts), mini));
}

function board(ctx, t, court, compact) {
  const m = currentOf(t, court);
  if (!m) {
    const waiting = t.matches.some((x) => !x.done);
    return h('div', { class: 'tboard idle' }, h('div', { class: 'muted' }, waiting ? 'En attente des autres matchs (finale à venir)…' : 'Tous les matchs sont joués.'));
  }
  const lv = t.live?.[court]?.matchId === m.id ? t.live[court] : null;
  const total = TN.matchMinutes(t) * 60000;
  const running = TN.liveRunning(lv);
  const ref = m.ref ? vest(t, m.ref) : null;
  const frame = ref ? ref.hex : '#c9ccdc';
  const side = (sd, id) => {
    const v = vest(t, id), score = sd === 'a' ? m.sa : m.sb;
    const btns = TN.scoreButtons(t).map((d) => h('button', { type: 'button', class: `pbtn ${d < 0 ? 'minus' : ''}`, 'aria-label': `${d > 0 ? '+' : '−'}${Math.abs(d)} ${nameOf(t, id)}`, onClick: () => { if (TN.addPoint(m, sd, d)) { render(); persist(ctx, t); } } }, `${d > 0 ? '+' : '−'}${Math.abs(d)}`));
    return h('div', { class: 'tside' }, h('div', { class: 'tname', style: { color: 'var(--ink)' } }, dot(v.hex), nameOf(t, id)),
      h('div', { class: 'tscore', style: { background: v.hex, color: v.ink, borderColor: v.id === 'sans' ? '#2b2d42' : v.hex } }, score), h('div', { class: 'pbtns' }, btns));
  };
  const elapsed = TN.liveElapsed(lv);
  const startBtn = btn(running ? 'Pause' : elapsed > 0 ? 'Reprendre' : 'Démarrer', { icon: running ? 'pause' : 'play', cls: 'primary bigbtn',
    disabled: elapsed >= total,
    onClick: () => { t.live ||= {}; t.live[court] = running ? TN.livePause(lv) : TN.liveStart(lv, m.id); keepAwake(); render(); persist(ctx, t); } });
  const validate = btn('Valider le match', { icon: 'check', cls: 'bigbtn', onClick: async () => {
    if (elapsed < total && !(await confirmDialog('Le temps n\'est pas écoulé. Valider quand même ce match ?', 'Valider', { danger: false }))) return;
    m.done = true; if (t.live) delete t.live[court];
    TN.resolveFinals(t); render(); persist(ctx, t);
    if (t.matches.every((x) => x.done)) toast('Tournoi terminé.');
  } });
  return h('div', { class: `tboard ${compact ? 'compact' : ''}`, style: { borderColor: frame } },
    h('div', { class: 'tmeta' }, h('span', null, `${m.phase === 'finale' ? 'Finale' : m.phase === 'petite' ? 'Petite finale' : `Match ${t.matches.filter((x) => x.phase === 'poule').sort((x, y) => x.slot - y.slot || x.court - y.court).indexOf(m) + 1}`}${t.courts === 2 ? ` · Terrain ${court + 1}` : ''}`),
      h('span', null, m.ref ? ['Arbitre : ', dot(ref.hex), nameOf(t, m.ref)] : 'Sans arbitre')),
    h('div', { class: 'tmain' }, side('a', m.a),
      h('div', { class: 'tclock' }, h('div', { class: 'clk', 'data-clk': `${t.id}:${court}` }, clockText(total - Math.min(elapsed, total), false)),
        h('div', { class: 'phase', 'data-phase': `${t.id}:${court}` }, phaseText[TN.phaseAt(t, elapsed)] || ''),
        t.change?.on ? h('div', { class: 'chg', 'data-chg': `${t.id}:${court}` }) : null),
      side('b', m.b)),
    h('div', { class: 'tctrl' }, startBtn, btn('Annuler le dernier point', { cls: 'small', disabled: !(m.log || []).length, onClick: () => { if (TN.undoPoint(m)) { render(); persist(ctx, t); } } }),
      btn('Zéro', { icon: 'reset', cls: 'small', disabled: !elapsed, onClick: () => { if (t.live) delete t.live[court]; render(); persist(ctx, t); } }), validate));
}

function matchList(ctx, t, courts) {
  const cur = new Set(courts.map((c) => currentOf(t, c)?.id));
  const ordered = t.matches.slice().sort((a, b) => a.slot - b.slot || a.court - b.court);
  let n = 0;
  const label = (m) => (m.phase === 'finale' ? 'Finale' : m.phase === 'petite' ? 'Petite finale' : String(++n));
  const rows = ordered.map((m) => {
    const lab = label(m);
    const known = m.a && m.b;
    const row = h('div', { class: `mrow ${m.done ? 'done' : ''} ${cur.has(m.id) ? 'cur' : ''}`, role: 'button', tabindex: 0, onClick: () => matchMenu(ctx, t, m, row) },
      h('span', { class: 'mn' }, lab), t.courts === 2 && m.phase === 'poule' ? h('span', { class: 'mc' }, `T${m.court + 1}`) : null,
      known ? [h('span', { class: 'mt' }, dot(vest(t, m.a).hex), nameOf(t, m.a)), h('span', { class: 'mv' }, m.done || cur.has(m.id) || m.sa || m.sb ? `${m.sa} – ${m.sb}` : 'vs'), h('span', { class: 'mt' }, dot(vest(t, m.b).hex), nameOf(t, m.b))]
        : h('span', { class: 'mt muted' }, `${m.phase === 'finale' ? '1er contre 2e' : '3e contre 4e'} (après la poule)`),
      h('span', { class: 'mr' }, m.ref ? ['arb. ', dot(vest(t, m.ref).hex), nameOf(t, m.ref)] : known ? 'sans arbitre' : ''));
    return row;
  });
  return h('div', { class: 'tlist scroll', 'data-keep': `tlist-${t.id}` }, rows);
}

function matchMenu(ctx, t, m, anchor) {
  const items = [];
  if (m.done) items.push({ label: 'Corriger le score…', onClick: () => scoreDialog(ctx, t, m) });
  else if (m.a && m.b) {
    items.push({ label: 'Échanger avec un autre match…', onClick: () => swapDialog(ctx, t, m) });
    items.push({ label: 'Changer l\'arbitre…', onClick: () => refDialog(ctx, t, m) });
  } else return toast('Ce match sera complété à la fin de la poule.');
  popMenu(anchor, items);
}

function balanceNote(t) {
  const b = TN.balance(t.teams.map((x) => x.id), t.matches);
  return `Équilibre : jeu ${b.playSpread === 0 ? 'identique' : `écart ${b.playSpread}`}, arbitrages ${b.refSpread === 0 ? 'identiques' : `écart ${b.refSpread}`}, série max ${b.maxRun}.`;
}
function swapDialog(ctx, t, m) {
  const others = t.matches.filter((x) => !x.done && x.a && x.b && x.id !== m.id && x.phase === 'poule' && m.phase === 'poule').sort((a, b) => a.slot - b.slot);
  const dlg = openDialog({ title: 'Échanger avec quel match ?', body: [h('p', { class: 'muted small', style: { margin: 0 } }, `${matchLabel(t, m)} change de place avec :`), ...others.map((x) => btn(matchLabel(t, x), { cls: 'bigbtn', onClick: () => {
    const keep = (o) => ({ slot: o.slot, court: o.court });
    const A = keep(m), B = keep(x); Object.assign(m, B); Object.assign(x, A);
    if (t.live) for (const c of Object.keys(t.live)) if ([m.id, x.id].includes(t.live[c]?.matchId)) delete t.live[c];
    dlg.close(); render(); persist(ctx, t); toast(balanceNote(t), { ms: 7000 });
  } }))], actions: [{ label: 'Annuler' }] });
}
function refDialog(ctx, t, m) {
  const busy = new Set([m.a, m.b, ...t.matches.filter((x) => x.slot === m.slot && x.id !== m.id).flatMap((x) => [x.a, x.b, x.ref])]);
  const count = (id) => t.matches.filter((x) => x.ref === id).length;
  const cands = t.teams.filter((x) => !busy.has(x.id));
  const dlg = openDialog({ title: 'Changer l\'arbitre', body: [h('div', { class: 'row wrap' }, cands.length ? cands.map((x) => btn(`${x.name} (${count(x.id)} arb.)`, { cls: `bigbtn ${x.id === m.ref ? 'primary' : ''}`, onClick: () => { m.ref = x.id; dlg.close(); render(); persist(ctx, t); toast(balanceNote(t), { ms: 7000 }); } })) : [h('p', { class: 'muted' }, 'Aucune équipe disponible pendant ce match.')]), m.ref ? btn('Aucun arbitre', { cls: 'small', onClick: () => { m.ref = null; dlg.close(); render(); persist(ctx, t); } }) : null], actions: [{ label: 'Annuler' }] });
}
function scoreDialog(ctx, t, m) {
  let sa = m.sa, sb = m.sb;
  const inp = (v, fn) => h('input', { type: 'number', inputmode: 'numeric', min: 0, value: v, style: { width: '90px', fontSize: '22px' }, onInput: (e) => fn(Math.max(0, parseInt(e.target.value, 10) || 0)) });
  const dlg = openDialog({ title: 'Corriger le score', body: [h('div', { class: 'row', style: { justifyContent: 'center' } }, h('b', null, nameOf(t, m.a)), inp(sa, (v) => { sa = v; }), '–', inp(sb, (v) => { sb = v; }), h('b', null, nameOf(t, m.b)))],
    actions: [{ label: 'Annuler' }, { label: 'Rouvrir le match', onClick: () => { m.done = false; render(); persist(ctx, t); } }, { label: 'Enregistrer', primary: true, onClick: () => { m.sa = sa; m.sb = sb; m.log = []; render(); persist(ctx, t); } }] });
  return dlg;
}
function renameDialog(ctx, t) {
  let name = t.name;
  openDialog({ title: 'Nom du tournoi', body: h('input', { type: 'text', value: t.name, onInput: (e) => { name = e.target.value; } }), actions: [{ label: 'Annuler' }, { label: 'Enregistrer', primary: true, onClick: () => { t.name = name.trim() || t.name; render(); persist(ctx, t); } }] });
}

// ---------- Classement et impression ----------

function rankTable(t) {
  const rows = TN.finalStandings(t);
  return h('table', { class: 'edit ranktab' }, h('thead', null, h('tr', null, ['#', 'Équipe', 'J', 'V', 'N', 'D', '+', '−', 'Diff', 'Pts'].map((x) => h('th', null, x)))),
    h('tbody', null, rows.map((x) => h('tr', null, h('td', null, x.rank), h('td', null, dot(vest(t, x.id).hex), nameOf(t, x.id)), [x.played, x.w, x.d, x.l, x.pf, x.pa, x.diff > 0 ? `+${x.diff}` : x.diff].map((v) => h('td', null, v)), h('td', null, h('b', null, x.pts))))));
}
function rankDialog(t) { openDialog({ title: `Classement — ${t.name}`, wide: true, body: [rankTable(t), h('p', { class: 'muted small', style: { margin: '6px 0 0' } }, 'Égalité : points de tournoi, puis différence, points marqués, résultat entre les équipes.')], actions: [{ label: 'Fermer', primary: true }] }); }
function printTournoi(ts) {
  const matchRows = (t) => t.matches.slice().sort((a, b) => a.slot - b.slot || a.court - b.court).map((m, i) => h('tr', null,
    h('td', null, i + 1), h('td', null, m.a ? matchLabel(t, m) : (m.phase === 'finale' ? 'Finale' : 'Petite finale')),
    h('td', null, m.done ? `${m.sa} – ${m.sb}` : ''), h('td', null, m.ref ? `arb. ${nameOf(t, m.ref)}` : '')));
  printNode(h('div', null, ts.map((t) => h('div', { style: { marginBottom: '16px' } },
    h('h1', null, t.name), h('div', { class: 'sub' }, `${fmtDate(t.date)} · ${TN.SPORTS[t.sport]?.label}`),
    h('h2', null, 'Classement'), rankTable(t), h('h2', null, 'Matchs'),
    h('table', { class: 'edit' }, h('tbody', null, matchRows(t)))))), { landscape: false });
}

// ---------- Ticker, écran allumé ----------

async function keepAwake() { try { if (!K.lock && navigator.wakeLock) { K.lock = await navigator.wakeLock.request('screen'); K.lock.addEventListener?.('release', () => { K.lock = null; }); } } catch { /* sans importance */ } }
function stopTicker() { clearInterval(K.ticker); K.ticker = null; try { K.lock?.release?.(); } catch { /* */ } K.lock = null; }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && app.route.name === 'tournoi' && K.ticker) keepAwake(); });
function startTicker() { if (!K.ticker) K.ticker = setInterval(tick, 200); }
function tick() {
  if (app.route.name !== 'tournoi' || !K.active.length) { if (app.route.name !== 'tournoi') stopTicker(); return; }
  let rerender = false;
  for (const t of K.active) for (const court of courtsOf(t)) {
    const m = currentOf(t, court);
    const key = `${t.id}:${court}`;
    const clk = document.querySelector(`[data-clk="${key}"]`);
    if (!m || !clk) continue;
    const lv = t.live?.[court]?.matchId === m.id ? t.live[court] : null;
    const total = TN.matchMinutes(t) * 60000, el = TN.liveElapsed(lv);
    if (TN.liveRunning(lv) && el >= total) { t.live[court] = { matchId: m.id, base: total, since: null }; persist(K.ctx, t); rerender = true; continue; }
    const txt = clockText(total - Math.min(el, total), false);
    if (clk.textContent !== txt) clk.textContent = txt;
    const board = clk.closest('.tboard');
    const state = el >= total ? 'over' : TN.liveRunning(lv) ? 'run' : 'idle';
    if (board.dataset.st !== state) board.dataset.st = state;
    const ph = document.querySelector(`[data-phase="${key}"]`);
    if (ph) { const p = phaseText[TN.phaseAt(t, el)] || ''; if (ph.textContent !== p) ph.textContent = p; }
    const chg = document.querySelector(`[data-chg="${key}"]`);
    if (chg) {
      const cs = TN.changeState(t, el);
      const text = cs ? `Changement : ${clockText(total - cs.at, false)}` : '';
      if (chg.textContent !== text) chg.textContent = text;
      chg.classList.toggle('now', !!cs?.now);
    }
  }
  if (rerender) render();
}

export { balanceNote };
