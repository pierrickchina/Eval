// Outil Tournoi : liste, création (libre ou dans une activité, 1 ou 2 tournois en parallèle), écran de jeu en paysage.
// Un tournoi est un enregistrement autonome : équipes figées (nom, couleur, élèves), calendrier, scores, chronomètres.
import { app, registerView, go, render , back as navBack } from '../app.js';
import { h, btn, icon, iconBtn, openDialog, popMenu, toast, confirmDialog } from './dom.js';
import { fmtDate, todayISO, uid } from '../util.js';
import { VEST_COLORS, vestOf, teamsOnly, teamColorId, teamLabel } from '../logic/teams.js';
import { activitiesOf, touchTool } from '../logic/activities.js';
import * as TN from '../logic/tournament.js';
import { clockText } from './chronoView.js';
import { helpItem } from './help.js';
import { printNode } from './printView.js';
import { buzz } from './foundations.js';
import { presetFor, savePreset } from './presets.js';

const K = { ticker: null, lock: null, active: [], setup: null, lastCur: {}, chgSig: {} };
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
  if (r.scope === 'ic') { // Interclasses : les deux tournois sont rangés dans l'événement
    const rec = repo.get('freetools', r.icId);
    if (!rec || rec.deleted) return null;
    return {
      kind: 'ic', rec, title: rec.ic.name,
      list: () => rec.ts,
      add: (t) => rec.ts.push(t),
      remove: () => () => {},
      save: () => repo.save('freetools', rec),
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
const backTo = (r) => navBack(() => (r.from === 'classPage' && r.classId ? go('classPage', { id: r.classId }) : go('home')));
const partnerOf = (ctx, t) => (t.pairId ? ctx.list().find((x) => x.pairId === t.pairId && x.id !== t.id) || null : null);
const persist = (ctx, ...ts) => ts.filter(Boolean).forEach((t) => ctx.save(t));

// ---------- Aides d'affichage ----------

const vest = (t, id) => { const tm = t.teams.find((x) => x.id === id); return vestOf(tm?.color); };
/** Nom affiché : si toutes les équipes finissent pareil (« Club 1 · Équipe 1 », « Club 2 · Équipe 1 »…), la fin commune est retirée (« Club 1 »). */
const shortNames = new WeakMap();
const nameOf = (t, id) => {
  if (!shortNames.has(t.teams)) {
    const tails = t.teams.map((x) => (x.name.includes(' · ') ? x.name.slice(x.name.lastIndexOf(' · ')) : null));
    const same = t.teams.length > 1 && tails[0] && tails.every((x) => x === tails[0]);
    shortNames.set(t.teams, new Map(t.teams.map((x) => [x.id, same ? x.name.slice(0, -tails[0].length) : x.name])));
  }
  return shortNames.get(t.teams).get(id) || '—';
};
/** Version courte pour les listes serrées : « Club 1 · Équipe 2 » → « Club 1 · É2 ». */
const tinyName = (t, id) => nameOf(t, id).replace(/ · Équipe (\d+)$/, ' · É$1');
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
  const newBtn = () => btn('Nouveau tournoi', { icon: 'plus', cls: 'primary', onClick: () => { K.setup = initSetup(ctx); go('tournoi', { ...r, tid: undefined, setup: true }); } });
  const m = iconBtn('more', 'Options', () => popMenu(m, [helpItem('tournoi')]), 'boxed');
  return h('div', { class: 'main' },
    h('div', { class: 'topbar' }, iconBtn('back', 'Retour', () => backTo(r), '', { 'data-back': '1' }),
      h('div', { class: 'grow evtitle' }, h('h1', null, 'Tournois'), h('div', { class: 'sub' }, ctx.title)), groups.length ? newBtn() : null, m),
    groups.length ? h('div', { class: 'scroll grow listpad', 'data-keep': 'tournois' }, groups.map(row))
      : h('div', { class: 'empty' }, h('h2', null, 'Aucun tournoi'),
        h('p', null, 'Choisissez les équipes, le sport et la durée : l\'outil prépare un calendrier équilibré (matchs, arbitrages, repos) et tient la table de marque.'), newBtn()));
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
      settings: TN.settingsOf(t) });
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
  // réglages du dernier tournoi (de l'activité, ou des tournois libres)
  const last = [...ctx.list()].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];
  if (last) Object.assign(S, TN.settingsOf(last));
  if (!last) { const p = presetFor(null, 'tournoi'); if (p) { const { sport, ...rest } = p; Object.assign(S, rest); } } // préréglage de l'équipe EPS (sauf le sport)
  if (ctx.kind === 'act') {
    if (!last) S.sport = TN.sportFromActivity(ctx.act.name, ctx.cls.level);
    const set = TN.latestSet(ctx.act.equipes?.sets);
    if (set) fillFromSet(S, set); // clubs : « 2 tournois en parallèle » est coché
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
  ? S.rows.filter((x) => x.include && (!S.parallel || x.side === side)).map((x) => ({ id: uid(), name: x.name, color: x.color, teamId: x.teamId, clubId: x.clubId, members: x.members }))
  : (side === 'A' ? S.teamsA : S.teamsB));

/** Compteur tactile [−] valeur [+] : plus sûr au doigt qu'un champ numérique. */
function stepper(value, fn, { min = 1, max = 99, unit = '', label }) {
  return h('div', { class: 'stepper', role: 'group', 'aria-label': label },
    h('button', { type: 'button', 'aria-label': `${label} : moins`, disabled: value <= min, onClick: () => fn(Math.max(min, value - 1)) }, icon('minus', 18)),
    h('output', null, `${value}${unit}`),
    h('button', { type: 'button', 'aria-label': `${label} : plus`, disabled: value >= max, onClick: () => fn(Math.min(max, value + 1)) }, icon('plus', 18)));
}
/** Nouvelle équipe : 1re couleur de chasuble pas encore prise, numéro suivant. */
function nextTeam(list, offset = 0) {
  const used = new Set(list.map((x) => x.color));
  const cols = VEST_COLORS.filter((c) => c.id !== 'sans');
  const c = cols.find((x) => !used.has(x.id)) || cols[(list.length + offset) % cols.length];
  const names = new Set(list.map((x) => x.name));
  let n = list.length + 1 + offset; while (names.has(`Équipe ${n}`)) n++;
  return { id: uid(), name: `Équipe ${n}`, color: c.id };
}
/** Nombre de matchs d'un côté (poule + finales), pour le résumé. */
function countMatches(S, n) {
  if (n < 2) return { total: 0, perTeam: 0 };
  const pool = TN.pairingPool(Array.from({ length: n }, (_, i) => `e${i}`), { format: S.format, perTeam: S.perTeam }).length;
  const fin = S.finals === 'both' && n >= 4 ? 2 : S.finals !== 'none' && n >= 3 ? 1 : 0;
  return { total: pool + fin, pool, perTeam: S.perTeam || (n - 1) * (S.format === 'double' ? 2 : 1) };
}

function setupView(r, ctx) {
  const S = K.setup;
  const re = () => render();
  const set = (k, v) => { S[k] = v; S.plan = null; re(); };
  const num = (v, d) => { const x = parseInt(v, 10); return Number.isFinite(x) && x > 0 ? x : d; };
  const seg = (items, cur, fn, extra = '') => h('div', { class: `seg ${extra}` }, items.map(([k, l]) => h('button', { type: 'button', class: cur === k ? 'on' : '', 'aria-pressed': String(cur === k), onClick: () => fn(k) }, l)));
  const field = (label, input) => h('label', { class: 'field' }, label, input);
  const opt = (label, control, note) => h('div', { class: 'opt' }, h('div', { class: 'optl' }, label, note ? h('small', null, note) : null), control);
  const sides = S.parallel ? ['A', 'B'] : ['A'];
  const nA = teamsOfSide(S, 'A', ctx).length, nB = S.parallel ? teamsOfSide(S, 'B', ctx).length : 0;
  const matchMin = TN.matchMinutes(S);
  const ok = (n) => n >= 2 && n <= 12;
  const valid = ok(nA) && (!S.parallel || ok(nB));
  const courts = S.parallel ? 1 : S.courts;

  // --- équipes ---
  const colorBtn = (tm) => { const b = h('button', { type: 'button', class: 'vestbtn', 'aria-label': `Couleur du chasuble de ${tm.name}`, style: { background: vestOf(tm.color).hex }, onClick: () => popMenu(b, VEST_COLORS.map((c) => ({ label: `${c.id === tm.color ? '● ' : ''}${c.label}`, onClick: () => { tm.color = c.id; re(); } }))) }); return b; };
  const freeList = (key, label) => {
    const list = S[key];
    const offset = key === 'teamsB' ? S.teamsA.length : 0;
    const setCount = (n) => { while (list.length < n) list.push(nextTeam(list, offset)); list.length = n; S.plan = null; re(); };
    return h('div', { class: 'panel' },
      h('div', { class: 'panelhead' }, h('h3', null, label), stepper(list.length, setCount, { min: 2, max: 12, label: `Nombre d'équipes${key === 'teamsB' ? ' du tournoi 2' : ''}` })),
      h('div', { class: 'tn-teamgrid' }, list.map((tm, i) => h('div', { class: 'listrow' }, colorBtn(tm),
        h('input', { type: 'text', value: tm.name, style: { flex: 1, minWidth: 0 }, 'aria-label': `Nom de l'équipe ${i + 1}`, onChange: (e) => { tm.name = e.target.value.trim() || tm.name; re(); } }),
        list.length > 2 ? iconBtn('trash', `Retirer ${tm.name}`, () => { list.splice(i, 1); S.plan = null; re(); }, 'sm') : null))));
  };
  const sets = ctx.kind === 'act' ? ctx.act.equipes?.sets || [] : [];
  const actTeams = () => {
    if (!sets.length) return h('div', { class: 'panel' }, h('h3', null, 'Équipes'), h('p', { class: 'muted' }, 'Créez d\'abord une composition dans l\'outil Équipes de cette activité : le tournoi en reprend les noms et les couleurs.'),
      btn('Ouvrir l\'outil Équipes', { onClick: () => go('equipes', { from: 'classPage', classId: ctx.cls.id, scope: 'act', actId: ctx.act.id }) }));
    return h('div', { class: 'panel' }, h('h3', null, 'Équipes'),
      field('Composition de l\'outil Équipes', h('select', { onChange: (e) => { fillFromSet(S, sets.find((x) => x.id === e.target.value)); S.plan = null; re(); } },
        sets.map((x) => h('option', { value: x.id, selected: x.id === S.setId }, `${x.name}${x.date ? ' · ' + fmtDate(x.date) : ''} (${x.mode === 'clubs' ? 'clubs' : 'équipes'})`)))),
      h('div', { class: 'tn-teamgrid acts' }, S.rows.map((x) => h('div', { class: `listrow ${x.include ? '' : 'off'}` },
        h('input', { type: 'checkbox', checked: x.include, class: 'bigchk', 'aria-label': `Inclure ${x.name}`, onChange: (e) => { x.include = e.target.checked; S.plan = null; re(); } }),
        dot(vestOf(x.color).hex), h('b', { class: 'grow ell' }, x.name), h('span', { class: 'muted small' }, `${x.members.length} él.`),
        S.parallel ? seg([['A', 'Tournoi 1'], ['B', 'Tournoi 2']], x.side, (k) => { x.side = k; S.plan = null; re(); }, 'sm') : null))));
  };

  // --- résumé + « j'ai X minutes » ---
  const cA = countMatches(S, nA), cB = S.parallel ? countMatches(S, nB) : null;
  const estimate = (() => { const n = Math.max(nA, nB, 2); const c = countMatches(S, n); const per = n < 4 ? 1 : courts; const slots = Math.ceil(c.pool / per) + (c.total - c.pool); return slots * (matchMin + S.changeover) - S.changeover; })();
  const plan = S.plan;
  const summary = h('div', { class: 'panel tn-sum' },
    h('div', { class: 'tn-sumbig' }, S.parallel ? `${cA.total} + ${cB.total} matchs` : `${cA.total} matchs`, h('small', null, ` · ≈ ${Math.max(0, estimate)} min`)),
    h('div', { class: 'muted small' }, [
      S.parallel ? `${nA} + ${nB} équipes` : `${nA} équipes`,
      `${cA.perTeam} match${cA.perTeam > 1 ? 's' : ''} par équipe`,
      `${matchMin} min par match + ${S.changeover} min de changement`,
      S.parallel ? (S.shared ? '1 seul terrain, matchs en alternance' : '1 terrain par tournoi') : `${courts} terrain${courts > 1 ? 's' : ''}`,
    ].join(' · ')),
    valid ? null : h('div', { class: 'bad small' }, 'Chaque tournoi doit avoir de 2 à 12 équipes.'),
    h('div', { class: 'tn-plan' },
      h('span', null, 'J\'ai X minutes'),
      h('input', { type: 'number', inputmode: 'numeric', min: 5, value: S.minutes, placeholder: 'min', 'aria-label': 'Temps disponible', style: { width: '96px' },
        onChange: (e) => { S.minutes = e.target.value; S.plan = e.target.value ? TN.planTime({ minutes: num(e.target.value, 0), n: Math.max(nA, nB, 2), courts, matchMin, changeover: S.changeover, format: S.format }) : null; re(); } }),
      plan && plan.possible ? btn(plan.full ? 'Garder le tournoi complet' : `Appliquer : ${plan.perTeam} match${plan.perTeam > 1 ? 's' : ''} par équipe`, { cls: 'small primary', onClick: () => { S.perTeam = plan.full ? null : plan.perTeam; toast(plan.full ? 'Tournoi complet.' : `${plan.perTeam} matchs par équipe.`); re(); } }) : null),
    plan ? h('p', { class: 'small', style: { margin: '6px 0 0' } }, plan.possible
      ? `${plan.full ? 'Le tournoi complet rentre' : `Je propose ${plan.perTeam} match${plan.perTeam > 1 ? 's' : ''} par équipe`} : ${plan.totalMatches} matchs, environ ${plan.minutesUsed} min avec les changements (toujours arrondi à la baisse).${plan.uneven ? ' Nombre impair d\'équipes : certaines joueront un match de moins.' : ''}`
      : 'Ce temps est trop court pour un seul match avec les changements.') : null,
    S.perTeam ? h('p', { class: 'small', style: { margin: '6px 0 0' } }, `Réglé sur ${S.perTeam} match${S.perTeam > 1 ? 's' : ''} par équipe. `, h('button', { type: 'button', class: 'linkbtn', onClick: () => { S.perTeam = null; S.plan = null; re(); } }, 'Revenir au tournoi complet')) : null);

  // --- réglages du jeu ---
  const game = h('div', { class: 'panel' }, h('h3', null, 'Jeu'),
    opt('Sport', seg(Object.entries(TN.SPORTS).map(([k, v]) => [k, v.label]), S.sport, (k) => set('sport', k), 'wrap')),
    S.sport === 'autre' ? opt('Boutons de points', h('input', { type: 'text', value: S.customButtons, style: { width: '120px' }, 'aria-label': 'Boutons de points', onChange: (e) => { S.customButtons = e.target.value; re(); } }), 'ex. 1, 2, 3') : null,
    opt('Mi-temps', seg([[1, 'Une'], [2, 'Deux']], S.halves, (k) => set('halves', k))),
    opt(S.halves === 2 ? 'Durée d\'une mi-temps' : 'Durée du match', stepper(S.halfMin, (v) => set('halfMin', v), { min: 1, max: 60, unit: ' min', label: 'Durée' })),
    S.halves === 2 ? opt('Pause', stepper(S.pauseMin, (v) => set('pauseMin', v), { min: 0, max: 15, unit: ' min', label: 'Pause' })) : null,
    opt('Changement entre matchs', seg([[1, '1 min'], [2, '2 min'], [3, '3 min']], S.changeover, (k) => set('changeover', k))),
    opt('Terrains', S.parallel ? seg([[false, '1 par tournoi'], [true, '1 seul, en alternance']], !!S.shared, (k) => set('shared', k), 'wrap') : seg([[1, '1'], [2, '2']], S.courts, (k) => set('courts', k)), !S.parallel && S.courts === 2 && nA < 6 ? 'moins de 6 équipes : certains matchs sans arbitre' : S.parallel && S.shared ? 'un match du tournoi 1, un match du tournoi 2… ; chaque tournoi arbitre ses propres matchs' : null),
    S.parallel && S.shared ? h('div', { class: 'opt' }, h('label', { class: 'row' }, h('input', { type: 'checkbox', class: 'bigchk', checked: !!S.equalize, onChange: (e) => { S.equalize = e.target.checked; re(); } }),
      h('span', null, 'Égaliser le temps', h('small', { class: 'muted' }, cA.total !== cB.total ? ` — le tournoi qui a le plus de matchs joue ${TN.equalizedMinutes(S.halfMin, Math.min(cA.total, cB.total), Math.max(cA.total, cB.total))} min au lieu de ${S.halfMin}` : ' — même nombre de matchs : rien à changer')))) : null,
    opt('Table de marque', seg([['table', 'Sur la tablette'], ['suivi', 'Sans (résultats seulement)']], S.board || 'table', (k) => set('board', k), 'wrap'), (S.board || 'table') === 'suivi' ? 'pas de chrono : le tableau des matchs prend l\'écran, on note le score de chaque rencontre' : 'chrono et points en direct'),
    opt('Format', seg([['single', 'Chacun contre chacun'], ['double', 'Aller-retour']], S.format, (k) => set('format', k), 'wrap')),
    opt('Finale', seg([['none', 'Aucune'], ['final', 'Finale'], ['both', '+ petite finale']], S.finals, (k) => set('finals', k), 'wrap')));
  const more = h('details', { class: 'panel tn-more', open: S.moreOpen || null, onToggle: (e) => { S.moreOpen = e.target.open; } },
    h('summary', null, 'Plus d\'options : points de tournoi, indicateur de changement'),
    opt('Points de tournoi', h('div', { class: 'row wrap' }, [['w', 'V'], ['d', 'N'], ['l', 'D']].map(([k, l]) => h('span', { class: 'row', style: { gap: '4px' } }, h('b', null, l), stepper(S.pts[k], (v) => { S.pts[k] = v; re(); }, { min: 0, max: 20, label: `Points ${l}` }))))),
    h('div', { class: 'opt' }, h('label', { class: 'row' }, h('input', { type: 'checkbox', class: 'bigchk', checked: S.change.on, onChange: (e) => { S.change.on = e.target.checked; re(); } }), 'Indicateur « Changement : » sur le chronomètre'),
      S.change.on ? h('select', { 'aria-label': 'Moment du changement', onChange: (e) => { S.change.mode = e.target.value; re(); } }, [['mid', 'À la moitié (de chaque mi-temps)'], ['thirds', 'Au tiers et aux deux tiers'], ['custom', 'À des temps choisis']].map(([k, l]) => h('option', { value: k, selected: S.change.mode === k }, l))) : null,
      S.change.on && S.change.mode === 'custom' ? h('input', { type: 'text', placeholder: '1:30, 3:00', value: S.change.custom, style: { width: '140px' }, 'aria-label': 'Temps écoulés des changements', onChange: (e) => { S.change.custom = e.target.value; re(); } }) : null));

  const create = () => {
    if (!valid) return toast('Chaque tournoi doit avoir de 2 à 12 équipes.');
    const pairId = S.parallel ? uid() : null;
    const settingsOut = { sport: S.sport, halves: S.halves, halfMin: S.halfMin, pauseMin: S.pauseMin, pts: S.pts, courts, format: S.format, finals: S.finals, perTeam: S.perTeam, changeover: S.changeover, change: S.change, customButtons: S.customButtons, board: S.board || 'table' };
    const base = ctx.kind === 'act' ? { classId: ctx.cls.id, actId: ctx.act.id, setId: S.setId } : {};
    const made = sides.map((side) => TN.newTournament({ name: S.parallel ? `${S.name} · Tournoi ${side === 'A' ? 1 : 2}` : S.name, date: S.date, teams: teamsOfSide(S, side, ctx).map((x) => JSON.parse(JSON.stringify(x))), settings: settingsOut, scope: ctx.kind, pairId, side: S.parallel ? side : null, ctx: base }));
    if (S.parallel && S.shared) {
      for (const t of made) t.shared = true;
      if (S.equalize) { // le tournoi qui a le plus de matchs joue des matchs plus courts
        const [a, b] = made; const na = a.matches.length, nb = b.matches.length;
        const many = na > nb ? a : nb > na ? b : null;
        if (many) many.halfMin = TN.equalizedMinutes(S.halfMin, Math.min(na, nb), Math.max(na, nb));
      }
    }
    made.forEach((t) => ctx.add(t)); persist(ctx, ...made);
    K.setup = null;
    go('tournoi', { ...r, setup: undefined, tid: made[0].id });
  };

  const head = h('div', { class: 'panel' },
    h('div', { class: 'row wrap', style: { alignItems: 'flex-end' } },
      field('Nom du tournoi', h('input', { type: 'text', value: S.name, style: { width: '260px' }, 'data-fid': 'tname', onInput: (e) => { S.name = e.target.value; S.nameTouched = true; } })),
      field('Date', h('input', { type: 'date', value: S.date, onChange: (e) => { S.date = e.target.value || todayISO(); if (!S.nameTouched && /^Tournoi \d/.test(S.name)) S.name = TN.defaultName(S.date); re(); } }))),
    h('label', { class: 'row switchrow' }, h('input', { type: 'checkbox', class: 'bigchk', checked: S.parallel, onChange: (e) => { S.parallel = e.target.checked; if (S.parallel && ctx.kind === 'free' && !S.teamsB.length) S.teamsB = defaultTeams(4, S.teamsA.length); if (S.parallel && ctx.kind === 'act' && !S.rows.some((x) => x.side === 'B')) S.rows.forEach((x, i) => { x.side = i % 2 ? 'B' : 'A'; }); S.courts = 1; S.plan = null; re(); } }),
      h('span', null, h('b', null, 'Deux tournois en parallèle'), h('small', { class: 'muted' }, ' — un terrain chacun, écran partagé'))));

  return h('div', { class: 'main' },
    h('div', { class: 'topbar' }, iconBtn('back', 'Retour', () => { K.setup = null; navBack(() => go('tournoi', { ...r, setup: undefined })); }, '', { 'data-back': '1' }),
      h('div', { class: 'grow evtitle' }, h('h1', null, 'Nouveau tournoi'), h('div', { class: 'sub' }, `${ctx.title} · durée estimée ${Math.max(0, estimate)} min`)),
      btn('Créer le tournoi', { icon: 'play', cls: 'primary', disabled: !valid, onClick: create })),
    h('div', { class: 'scroll grow listpad setup', 'data-keep': 'tsetup' },
      h('div', { class: 'tn-setup' },
        h('div', { class: 'tn-col' }, head,
          ctx.kind === 'act' ? actTeams() : h('div', { class: S.parallel ? 'twocols' : '' }, freeList('teamsA', S.parallel ? 'Tournoi 1' : 'Équipes'), S.parallel ? freeList('teamsB', 'Tournoi 2') : null)),
        h('div', { class: 'tn-col right' }, summary, game, more))));
}

// ---------- Écran de jeu ----------

const matchLabel = (t, m) => `${nameOf(t, m.a)} – ${nameOf(t, m.b)}`;
const pending = (t, court) => t.matches.filter((m) => m.court === court && !m.done && m.a && m.b).sort((x, y) => x.slot - y.slot);
const currentOf = (t, court) => pending(t, court)[0] || null;
const courtsOf = (t) => (t.courts === 2 && t.teams.length >= 4 ? [0, 1] : [0]);
const phaseLabel = (t, el) => ({ h1: t.halves === 2 ? '1re mi-temps' : '', pause: 'Pause', h2: '2e mi-temps', fin: 'Temps écoulé' })[TN.phaseAt(t, el)] || '';
const poolOrder = (t) => t.matches.filter((x) => x.phase === 'poule').sort((x, y) => x.slot - y.slot || x.court - y.court);
const matchTitle = (t, m) => (m.phase === 'finale' ? 'Finale' : m.phase === 'petite' ? 'Petite finale' : `Match ${poolOrder(t).indexOf(m) + 1}`);
/** Minutes restantes (créneaux non joués × durée d'un créneau). */
const remainingMin = (t) => { const left = new Set(t.matches.filter((m) => !m.done).map((m) => m.slot)).size; return left ? left * (TN.matchMinutes(t) + t.changeover) - t.changeover : 0; };

function playView(r, ctx, t) {
  const partner = partnerOf(ctx, t);
  const ts = partner ? [t, partner].sort((a, b) => (a.side || '').localeCompare(b.side || '')) : [t];
  K.active = ts; K.ctx = ctx; startTicker(); keepAwake();
  for (const x of ts) if (TN.resolveFinals(x)) persist(ctx, x);
  const leave = async () => {
    for (const x of ts) for (const c of courtsOf(x)) if (TN.liveRunning(x.live?.[c])) x.live[c] = TN.livePause(x.live[c]);
    persist(ctx, ...ts); stopTicker();
    navBack(() => (r.scope === 'ic' ? go('interclasses', { icId: r.icId, from: r.from }) : go('tournoi', { ...r, tid: undefined })));
  };
  const more = iconBtn('more', 'Options', () => popMenu(more, [
    ...ts.map((x, i) => ({ label: ts.length > 1 ? `Classement du tournoi ${i + 1}…` : 'Classement détaillé…', onClick: () => rankDialog(x) })),
    { label: 'Imprimer calendrier et classement', onClick: () => printTournoi(ts) },
    { label: 'Renommer…', onClick: () => renameDialog(ctx, t) },
    { label: 'Enregistrer comme préréglage de l\'équipe EPS', onClick: async () => { const { sport, ...p } = TN.settingsOf(t); await savePreset(null, 'tournoi', p); toast('Préréglage Tournoi enregistré (Réglages › Préréglages).'); } },
    helpItem('tournoi'),
  ].filter(Boolean)), 'boxed');
  const played = ts.map((x) => `${x.matches.filter((m) => m.done).length}/${x.matches.length}`).join(' + ');
  const left = Math.max(...ts.map(remainingMin));
  return h('div', { class: `main tplay ${partner && !t.shared ? 'tn-split' : ''}` },
    h('div', { class: 'topbar' }, iconBtn('back', 'Retour', leave, '', { 'data-back': '1' }),
      h('div', { class: 'grow evtitle' }, h('h1', null, partner ? `${t.name.replace(/\s*·\s*Tournoi [12]$/, '')} · 2 tournois en parallèle` : t.name),
        h('div', { class: 'sub' }, `${TN.SPORTS[t.sport]?.label} · ${played} matchs joués${left ? ` · reste ≈ ${left} min` : ''}`)),
      more),
    t.board === 'suivi' ? resultsPanel(ctx, ts) : t.shared && partner ? sharedPanel(ctx, ts) : h('div', { class: 'tn-body' }, ts.map((x) => tournamentPanel(ctx, x, !!partner))));
}

// ---------- Sans table de marque (1.12) : le tableau des matchs prend l'écran, classement en bas à droite ----------
const ordered = (t) => t.matches.slice().sort((a, b) => a.slot - b.slot || a.court - b.court);
const nextMatch = (t) => ordered(t).find((m) => !m.done && m.a && m.b) || null;

function resultsPanel(ctx, ts) {
  const turn = ts.length > 1 && ts[0].shared ? TN.sharedTurn(ts) : null;
  const nows = turn ? [[turn, nextMatch(turn)]] : ts.map((t) => [t, nextMatch(t)]);
  const col = (t) => {
    const nx = nextMatch(t);
    let n = 0;
    const cards = ordered(t).map((m) => {
      const lab = m.phase === 'finale' ? 'Finale' : m.phase === 'petite' ? 'Petite finale' : `Match ${++n}`;
      const known = m.a && m.b;
      const team = (id) => h('span', { class: 'rs-team' }, dot(vest(t, id).hex), h('span', null, nameOf(t, id)));
      const win = m.done ? (m.sa > m.sb ? 'a' : m.sb > m.sa ? 'b' : '') : '';
      return h('button', { type: 'button', class: `rscard ${m.done ? 'done' : ''} ${nx && m.id === nx.id && (!turn || turn === t) ? 'next' : ''}`, 'data-mid': m.id,
        onClick: () => (known ? resultDialog(ctx, t, m) : toast('Ce match sera complété à la fin de la poule.')) },
      h('span', { class: 'rs-top' }, h('b', null, lab), t.courts === 2 && m.phase === 'poule' ? h('span', null, `Terrain ${m.court + 1}`) : null, m.ref ? h('span', { class: 'rs-ref' }, 'arb. ', nameOf(t, m.ref)) : null),
      known ? h('span', { class: 'rs-mid' }, h('span', { class: `rs-side a ${win === 'a' ? 'win' : ''}` }, team(m.a)), h('b', { class: 'rs-score' }, m.done ? `${m.sa} – ${m.sb}` : '–'), h('span', { class: `rs-side b ${win === 'b' ? 'win' : ''}` }, team(m.b)))
        : h('span', { class: 'rs-mid muted' }, m.phase === 'finale' ? '1er contre 2e' : '3e contre 4e'));
    });
    return h('section', { class: `rs-col ${t.side ? `side-${t.side}` : ''}` },
      ts.length > 1 ? h('div', { class: 'rs-head' }, h('b', null, t.label || t.name), h('span', { class: 'muted small' }, `${t.matches.filter((m) => m.done).length}/${t.matches.length} joués`)) : null,
      h('div', { class: 'rs-grid scroll', 'data-keep': `rs-${t.id}` }, cards));
  };
  const nowCard = h('div', { class: 'tn-card rs-now' }, h('div', { class: 'tn-cardhead' }, h('b', null, 'À jouer')),
    nows.some(([, m]) => m) ? nows.filter(([, m]) => m).map(([t, m]) => h('button', { type: 'button', class: 'rs-nowbtn', onClick: () => resultDialog(ctx, t, m) },
      ts.length > 1 ? h('small', null, t.label || t.name) : null,
      h('span', null, dot(vest(t, m.a).hex), nameOf(t, m.a), h('i', null, ' – '), dot(vest(t, m.b).hex), nameOf(t, m.b)),
      h('em', null, 'Noter le résultat')))
      : h('p', { class: 'muted' }, 'Tous les matchs sont joués.'));
  return h('div', { class: `tn-body rs ${ts.length > 1 ? 'two' : ''} ${ts.reduce((a, t) => a + t.matches.length, 0) > 12 ? 'dense' : ''}` },
    h('div', { class: 'rs-main' }, ts.map(col)),
    h('aside', { class: 'rs-aside' }, nowCard, h('div', { class: 'rs-ranks' }, ts.map((t) => rankCard(t, ts.length > 1 ? (t.label || t.name) : 'Classement')))));
}

/** Résultat d'une rencontre : deux grands compteurs, puis Valider (ou corriger un match déjà joué). */
function resultDialog(ctx, t, m) {
  let sa = m.sa || 0, sb = m.sb || 0;
  const body = h('div', { class: 'rs-dlg' });
  const side = (id, get, setv) => h('div', { class: 'rs-dside', style: { '--v': vest(t, id).hex } },
    h('div', { class: 'rs-dname' }, h('span', { class: 'vdot' }), nameOf(t, id)),
    h('div', { class: 'rs-dstep' },
      h('button', { type: 'button', class: 'tn-sbtn', 'aria-label': `−1 ${nameOf(t, id)}`, onClick: () => { setv(Math.max(0, get() - 1)); paint(); } }, '−'),
      h('b', null, String(get())),
      h('button', { type: 'button', class: 'tn-sbtn plus', 'aria-label': `+1 ${nameOf(t, id)}`, onClick: () => { setv(get() + 1); paint(); } }, '+')));
  const paint = () => body.replaceChildren(side(m.a, () => sa, (v) => { sa = v; }), h('span', { class: 'rs-dvs' }, '–'), side(m.b, () => sb, (v) => { sb = v; }));
  paint();
  const finish = () => { TN.resolveFinals(t); persist(ctx, t); render(); if (t.matches.every((x) => x.done)) toast('Tournoi terminé.'); };
  const dlg = openDialog({ title: `${matchTitle(t, m)}${m.ref ? ` · arbitre : ${nameOf(t, m.ref)}` : ''}`, wide: true, body: [body,
    !m.done && m.phase === 'poule' ? h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '8px' } },
      btn('Échanger avec un autre match…', { cls: 'small', onClick: () => { dlg.close(); swapDialog(ctx, t, m); } }), btn('Changer l\'arbitre…', { cls: 'small', onClick: () => { dlg.close(); refDialog(ctx, t, m); } })) : null],
  actions: [{ label: 'Annuler' },
    m.done ? { label: 'Remettre à jouer', onClick: () => { m.done = false; m.sa = 0; m.sb = 0; delete m.doneAt; finish(); } } : null,
    { label: m.done ? 'Corriger' : 'Valider le résultat', primary: true, onClick: () => { m.sa = sa; m.sb = sb; m.log = []; if (!m.done) { m.done = true; m.doneAt = Date.now(); } finish(); } }].filter(Boolean) });
}

/** Deux tournois sur un seul terrain : une table de marque (le tournoi dont c'est le tour), les deux listes de matchs à côté. */
function sharedPanel(ctx, ts) {
  const turn = TN.sharedTurn(ts);
  const other = turn ? ts.find((x) => x !== turn) : null;
  const nextOther = other ? pending(other, 0)[0] : null;
  const allDone = ts.every((x) => x.matches.every((m) => m.done));
  return h('div', { class: 'tn-body tn-shared' },
    h('section', { class: 'tn-panel' },
      turn ? h('div', { class: `tn-turn side-${turn.side}` }, `En jeu : ${turn.label || turn.name}`) : null,
      h('div', { class: 'tn-stage n1' }, allDone ? h('div', { class: 'tn-twopod' }, ts.map((x) => podium(x))) : turn ? board(ctx, turn, 0, nextOther ? { t: other, m: nextOther } : null) : null),
      h('div', { class: 'tn-aside' }, ts.map((x) => h('div', { class: `tn-card tn-matches side-${x.side}` },
        h('div', { class: 'tn-cardhead' }, h('b', null, x.label || x.name.replace(/^.*·\s*/, '')), h('span', { class: 'muted small' }, `${x.matches.filter((m) => m.done).length}/${x.matches.length} joués · ${TN.matchMinutes(x)} min`)),
        matchList(ctx, x, [0]))))));
}

function tournamentPanel(ctx, t, split) {
  const courts = courtsOf(t);
  const done = t.matches.length > 0 && t.matches.every((m) => m.done);
  const nDone = t.matches.filter((m) => m.done).length;
  return h('section', { class: `tn-panel ${split ? 'is-split' : ''}`, 'data-tid': t.id },
    h('div', { class: `tn-stage n${done ? 1 : courts.length}` }, done ? podium(t) : courts.map((c) => board(ctx, t, c))),
    h('div', { class: 'tn-aside' },
      h('div', { class: 'tn-card tn-matches' },
        h('div', { class: 'tn-cardhead' }, h('b', null, split ? t.name : 'Matchs'), h('span', { class: 'muted small' }, `${nDone}/${t.matches.length} joués`)),
        matchList(ctx, t, courts)),
      split ? null : rankCard(t)));
}

function board(ctx, t, court, nextOverride = null) {
  const m = currentOf(t, court);
  if (!m) {
    return h('div', { class: 'tn-board idle' }, h('div', { class: 'tn-wait' }, icon('chrono', 30),
      h('div', null, t.matches.some((x) => !x.done) ? 'En attente : la suite se joue après les autres matchs.' : 'Plus de match sur ce terrain.')));
  }
  const key = `${t.id}:${court}`;
  const lv = t.live?.[court]?.matchId === m.id ? t.live[court] : null;
  const total = TN.matchMinutes(t) * 60000;
  const running = TN.liveRunning(lv);
  const elapsed = TN.liveElapsed(lv);
  const over = elapsed >= total;
  const ref = m.ref ? vest(t, m.ref) : null;
  const save = () => { render(); persist(ctx, t); };
  const team = (sd, id) => {
    const v = vest(t, id);
    return h('div', { class: `tn-team ${v.id === 'sans' ? 'novest' : ''}`, style: { '--v': v.hex, '--vi': v.ink } },
      h('div', { class: 'tn-tname' }, h('span', { class: 'vdot' }), h('span', null, nameOf(t, id))),
      h('div', { class: 'tn-score' }, sd === 'a' ? m.sa : m.sb));
  };
  const pts = (sd, id) => {
    const v = vest(t, id);
    const all = TN.scoreButtons(t);
    const b1 = (d, cls = '') => h('button', { type: 'button', class: `pbtn ${d < 0 ? 'minus' : ''} ${cls}`, 'aria-label': `${d > 0 ? '+' : '−'}${Math.abs(d)} ${nameOf(t, id)}`,
      onClick: () => { if (TN.addPoint(m, sd, d)) { buzz(d > 0 ? 'tap' : 'undo'); save(); } } }, `${d > 0 ? '+' : '−'}${Math.abs(d)}`);
    const minus = all.filter((d) => d < 0);
    if (minus.length < 2) return h('div', { class: 'tn-pts', style: { '--v': v.hex, '--vi': v.ink } }, all.map((d) => b1(d)));
    // plusieurs retraits (Basket 5e / 3e) : gros boutons +, petite ligne de retraits en dessous
    return h('div', { class: 'tn-pts stack', style: { '--v': v.hex, '--vi': v.ink } },
      h('div', { class: 'tn-prow' }, all.filter((d) => d > 0).map((d) => b1(d))),
      h('div', { class: 'tn-mrow' }, minus.map((d) => b1(d, 'mini'))));
  };
  const goBtn = h('button', { type: 'button', class: `tn-go ${running ? 'run' : ''}`, disabled: over,
    onClick: () => { t.live ||= {}; t.live[court] = running ? TN.livePause(lv) : TN.liveStart(lv, m.id); keepAwake(); save(); } },
  icon(running ? 'pause' : 'play', 24), h('span', null, over ? 'Temps écoulé' : running ? 'Pause' : elapsed > 0 ? 'Reprendre' : 'Démarrer'));
  const validate = h('button', { type: 'button', class: `tn-validate ${over ? 'hot' : ''}`, onClick: async () => {
    if (!over && !(await confirmDialog('Le temps n\'est pas écoulé. Valider quand même ce match ?', 'Valider', { danger: false }))) return;
    m.done = true; m.doneAt = Date.now(); if (t.live) delete t.live[court];
    TN.resolveFinals(t); save();
    if (t.matches.every((x) => x.done)) toast('Tournoi terminé.');
  } }, icon('check', 20), h('span', null, 'Valider le match'));
  const nx = nextOverride ? nextOverride.m : pending(t, court)[1];
  const nxT = nextOverride ? nextOverride.t : t;
  if (t.board === 'suivi') return simpleBoard(ctx, t, court, m, save, nx, nxT);
  return h('div', { class: 'tn-board', 'data-st': over ? 'over' : running ? 'run' : 'idle', style: { '--ref': ref ? ref.hex : '#3a3f55' } },
    h('div', { class: 'tn-top' },
      h('span', { class: 'tn-title' }, `${matchTitle(t, m)}${t.courts === 2 ? ` · Terrain ${court + 1}` : ''}`),
      m.ref ? h('span', { class: 'tn-ref' }, h('span', { class: 'vdot', style: { '--v': ref.hex } }), 'Arbitre : ', h('b', null, nameOf(t, m.ref))) : h('span', { class: 'tn-ref none' }, 'Sans arbitre')),
    h('div', { class: 'tn-mid' }, team('a', m.a),
      h('div', { class: 'tn-clock' },
        h('div', { class: 'clk', 'data-clk': key }, clockText(total - Math.min(elapsed, total), false)),
        h('div', { class: 'phase', 'data-phase': key }, phaseLabel(t, elapsed)),
        t.change?.on ? h('div', { class: 'chg', 'data-chg': key }) : null),
      team('b', m.b)),
    h('div', { class: 'tn-row' }, pts('a', m.a), goBtn, pts('b', m.b)),
    h('div', { class: 'tn-foot' },
      h('button', { type: 'button', class: 'tn-mini', 'aria-label': 'Annuler le dernier point', disabled: !(m.log || []).length, onClick: () => { if (TN.undoPoint(m)) save(); } }, icon('undo', 18), h('span', null, 'Annuler le dernier point')),
      h('button', { type: 'button', class: 'tn-mini', 'aria-label': 'Chrono à zéro', disabled: !elapsed, onClick: () => { if (t.live) delete t.live[court]; save(); } }, icon('reset', 18), h('span', null, 'Zéro')),
      h('span', { class: 'tn-next' }, nx ? ['Ensuite : ', nxT !== t ? `${nxT.name.replace(/^.*·\s*/, '')} · ` : '', dot(vest(nxT, nx.a).hex), nameOf(nxT, nx.a), ' – ', dot(vest(nxT, nx.b).hex), nameOf(nxT, nx.b)] : ''),
      validate));
}

/** Suivi simple (sans table de marque) : les deux équipes, le score réglé avec + et −, puis « Match suivant ». */
function simpleBoard(ctx, t, court, m, save, nx, nxT) {
  const side = (sd, id) => {
    const v = vest(t, id);
    return h('div', { class: 'tn-sside', style: { '--v': v.hex } },
      h('div', { class: 'tn-tname' }, h('span', { class: 'vdot' }), h('span', null, nameOf(t, id))),
      h('div', { class: 'tn-sscore' },
        h('button', { type: 'button', class: 'tn-sbtn', 'aria-label': `−1 ${nameOf(t, id)}`, onClick: () => { if (TN.addPoint(m, sd, -1)) { buzz('undo'); save(); } } }, '−'),
        h('b', null, sd === 'a' ? m.sa : m.sb),
        h('button', { type: 'button', class: 'tn-sbtn plus', 'aria-label': `+1 ${nameOf(t, id)}`, onClick: () => { if (TN.addPoint(m, sd, 1)) { buzz('tap'); save(); } } }, '+')));
  };
  return h('div', { class: 'tn-board tn-simple' },
    h('div', { class: 'tn-top' }, h('span', { class: 'tn-title' }, `${matchTitle(t, m)}${t.courts === 2 ? ` · Terrain ${court + 1}` : ''}`),
      m.ref ? h('span', { class: 'tn-ref' }, 'Arbitre : ', h('b', null, nameOf(t, m.ref))) : null),
    h('div', { class: 'tn-smid' }, side('a', m.a), h('span', { class: 'tn-svs' }, '–'), side('b', m.b)),
    h('div', { class: 'tn-foot' },
      h('span', { class: 'tn-next' }, nx ? ['Ensuite : ', dot(vest(nxT, nx.a).hex), nameOf(nxT, nx.a), ' – ', dot(vest(nxT, nx.b).hex), nameOf(nxT, nx.b)] : ''),
      h('button', { type: 'button', class: 'tn-validate hot', onClick: () => { m.done = true; m.doneAt = Date.now(); TN.resolveFinals(t); save(); if (t.matches.every((x) => x.done)) toast('Tournoi terminé.'); } }, icon('next', 20), h('span', null, 'Match suivant'))));
}

/** Fin du tournoi : podium à la place de la table de marque. */
function podium(t) {
  const rows = TN.finalStandings(t);
  return h('div', { class: `tn-board tn-podium ${rows.length > 6 ? 'many' : ''}` },
    h('div', { class: 'tn-ptitle' }, icon('trophy', 28), 'Tournoi terminé'),
    h('div', { class: 'tn-places' }, rows.map((x) => { const v = vest(t, x.id); return h('div', { class: `tn-place p${x.rank}`, style: { '--v': v.hex } }, h('span', { class: 'rk' }, ordinal(x.rank)), h('span', { class: 'nm' }, nameOf(t, x.id)), h('span', { class: 'pt' }, `${x.pts} pts`)); })),
    h('div', { class: 'tn-pbtns' }, btn('Classement complet', { icon: 'trophy', onClick: () => rankDialog(t) }), btn('Imprimer', { icon: 'print', onClick: () => printTournoi([t]) })));
}

function rankCard(t, title = 'Classement') {
  const rows = TN.finalStandings(t);
  return h('div', { class: 'tn-card tn-rank' },
    h('div', { class: 'tn-cardhead' }, h('b', null, title), h('button', { type: 'button', class: 'tn-link', onClick: () => rankDialog(t) }, 'Détail')),
    h('div', { class: 'scroll tn-rankwrap' }, h('table', { class: 'tn-ranktab' },
      h('thead', null, h('tr', null, h('th', null, '#'), h('th', { class: 'nm' }, 'Équipe'), h('th', null, 'J'), h('th', null, 'Diff'), h('th', null, 'Pts'))),
      h('tbody', null, rows.map((x) => h('tr', { class: x.played && x.rank === 1 ? 'top' : '' },
        h('td', { class: 'rk' }, x.rank), h('td', { class: 'nm' }, dot(vest(t, x.id).hex), nameOf(t, x.id)), h('td', null, x.played),
        h('td', null, x.diff > 0 ? `+${x.diff}` : x.diff), h('td', null, h('b', null, x.pts))))))));
}

function matchList(ctx, t, courts) {
  const cur = new Set(courts.map((c) => currentOf(t, c)?.id).filter(Boolean));
  const ordered = t.matches.slice().sort((a, b) => a.slot - b.slot || a.court - b.court);
  let n = 0;
  const label = (m) => (m.phase === 'finale' ? 'F' : m.phase === 'petite' ? 'PF' : String(++n));
  const rows = ordered.map((m) => {
    const lab = label(m);
    const known = m.a && m.b;
    const shown = m.done || cur.has(m.id) || m.sa || m.sb;
    const row = h('div', { class: `mrow ${m.done ? 'done' : ''} ${cur.has(m.id) ? 'cur' : ''}`, 'data-mid': m.id, role: 'button', tabindex: 0, onClick: () => matchMenu(ctx, t, m, row) },
      h('span', { class: 'mn', title: m.phase === 'finale' ? 'Finale' : m.phase === 'petite' ? 'Petite finale' : '' }, lab),
      t.courts === 2 && m.phase === 'poule' ? h('span', { class: 'mc' }, `T${m.court + 1}`) : null,
      known ? [h('span', { class: 'mt a', title: nameOf(t, m.a) }, h('span', null, tinyName(t, m.a)), dot(vest(t, m.a).hex)),
        h('span', { class: 'mv' }, shown ? `${m.sa}–${m.sb}` : '–'),
        h('span', { class: 'mt b', title: nameOf(t, m.b) }, dot(vest(t, m.b).hex), h('span', null, tinyName(t, m.b)))]
        : h('span', { class: 'mt muted' }, `${m.phase === 'finale' ? 'Finale : 1er contre 2e' : 'Petite finale : 3e contre 4e'}`),
      h('span', { class: 'mr', title: m.ref ? `Arbitre : ${nameOf(t, m.ref)}` : '' }, m.ref ? [h('span', { class: 'mrl' }, 'arb.'), dot(vest(t, m.ref).hex), h('span', { class: 'mrn' }, tinyName(t, m.ref))] : known ? '—' : ''));
    return row;
  });
  const list = h('div', { class: 'tn-list scroll', 'data-keep': `tlist-${t.id}` }, rows);
  // le match en cours remonte en haut de la liste quand il change (le précédent reste visible)
  const first = ordered.find((m) => cur.has(m.id));
  if (first && K.lastCur[t.id] !== first.id) {
    K.lastCur[t.id] = first.id;
    requestAnimationFrame(() => { const el = list.querySelector(`[data-mid="${first.id}"]`); if (el) list.scrollTop = Math.max(0, el.offsetTop - (el.previousElementSibling ? el.offsetHeight + 8 : 0)); });
  }
  return list;
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
    if (TN.liveRunning(lv) && el >= total) { t.live[court] = { matchId: m.id, base: total, since: null }; persist(K.ctx, t); buzz('end'); rerender = true; continue; }
    const txt = clockText(total - Math.min(el, total), false);
    if (clk.textContent !== txt) clk.textContent = txt;
    const board = clk.closest('.tn-board');
    const state = el >= total ? 'over' : TN.liveRunning(lv) ? 'run' : 'idle';
    if (board.dataset.st !== state) board.dataset.st = state;
    const ph = document.querySelector(`[data-phase="${key}"]`);
    if (ph) { const p = phaseLabel(t, el); if (ph.textContent !== p) ph.textContent = p; }
    const chg = document.querySelector(`[data-chg="${key}"]`);
    if (chg) {
      const cs = TN.changeState(t, el);
      const text = cs ? `Changement : ${clockText(total - cs.at, false)}` : '';
      if (chg.textContent !== text) chg.textContent = text;
      chg.classList.toggle('now', !!cs?.now);
      // signal une seule fois par changement, et seulement si le chrono tourne
      const sig = `${m.id}:${cs?.at}`;
      if (cs?.now && TN.liveRunning(lv) && K.chgSig[key] !== sig) { K.chgSig[key] = sig; buzz('change'); }
    }
  }
  if (rerender) render();
}

export { balanceNote };
