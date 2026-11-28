// Outil Kabaddi : attaques de 2 minutes, un bouton par attaquant (+100 puis +10), Ace +1000, faute −1, tableau Attaque × Défense.
import { app, registerView, go, render , back as navBack } from '../app.js';
import { h, btn, icon, iconBtn, openDialog, popMenu, toast } from './dom.js';
import { clone, uid } from '../util.js';
import { vestOf, VEST_COLORS, teamsOnly, teamLabel, teamColorId } from '../logic/teams.js';
import { studentLabel } from '../data/schema.js';
import { activitiesOf } from '../logic/activities.js';
import { practices } from '../logic/today.js';
import { clockText } from './chronoView.js';
import { buzz } from './foundations.js';
import { helpItem } from './help.js';
import * as KB from '../logic/kabaddi.js';
import { presetFor, savePreset } from './presets.js';

const V = { ticker: null };
const keyOf = (r) => `kab:${r.scope === 'act' ? r.actId : 'free'}`;
const stateOf = (r) => app.repo.getMeta(keyOf(r), null) || fromTeams(r) || fresh();
/** 1.13 : dans une activité, les équipes du Kabaddi = la dernière composition d'Équipes (prénoms sur les boutons). */
function seqTeams(r) {
  if (r.scope !== 'act') return null;
  const cls = app.repo.get('classes', r.classId);
  const act = cls ? activitiesOf(cls).find((a) => a.id === r.actId) : null;
  const set = (act?.equipes?.sets || []).slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).find((x) => teamsOnly(x).filter((t) => t.members.length).length >= 2);
  return set ? { cls, act, set } : null;
}
function fromTeams(r) {
  const q = seqTeams(r);
  if (!q) return null;
  const st = fresh();
  st.teams = teamsOnly(q.set).filter((t) => t.members.length).slice(0, 6).map((t) => ({ id: uid(), name: teamLabel(q.set, t), color: teamColorId(q.set, t),
    players: t.members.filter((sid) => practices(q.cls, sid)).map((sid, i) => { const s = q.cls.students.find((x) => x.id === sid); return { n: i + 1, name: s ? studentLabel(s) : '', sid }; }) }));
  st.fromSet = q.set.id;
  st.attacks = []; st.current = null; KB.buildAttacks(st);
  return st;
}
/** Nouvelle partie : préréglage de l'équipe EPS (nombre d'équipes, durée d'une attaque). */
export function fresh() { const p = presetFor(null, 'kabaddi') || {}; const st = KB.newKabaddi(p.teams || 3); if (p.attackMin) st.attackMin = p.attackMin; return st; }
const backTo = (r) => navBack(() => (r.from === 'classPage' && r.classId ? go('classPage', { id: r.classId }) : go('home')));

function tick() {
  if (app.route.name !== 'kabaddi') { clearInterval(V.ticker); V.ticker = null; return; }
  const st = stateOf(app.route);
  const a = st.attacks.find((x) => x.id === st.current); if (!a) return;
  const left = st.attackMin * 60000 - KB.elapsedMs(a);
  if (left <= 0 && a.clock.startedAt) { a.clock.base = st.attackMin * 60000; a.clock.startedAt = null; app.repo.setMeta(keyOf(app.route), st); buzz('end'); render(); return; }
  for (const el of document.querySelectorAll('.kbclock b')) { const txt = clockText(Math.max(0, left), false); if (el.textContent !== txt) el.textContent = txt; }
}

registerView('kabaddi', (r) => {
  const st = stateOf(r);
  if (!V.ticker) V.ticker = setInterval(tick, 250);
  const save = () => { st.updatedAt = Date.now(); return app.repo.setMeta(keyOf(r), st); };
  const apply = (fn, kind = 'tap') => { fn(); buzz(kind); save(); render(); };
  const team = (id) => st.teams.find((t) => t.id === id);
  const a = st.attacks.find((x) => x.id === st.current) || null;
  const left = a ? st.attackMin * 60000 - KB.elapsedMs(a) : 0;
  const running = !!a?.clock.startedAt;
  const m = iconBtn('more', 'Options', () => popMenu(m, [
    { label: 'Équipes et joueurs…', onClick: () => teamsDialog(st, () => { save(); render(); }) },
    r.scope === 'act' ? { label: 'Reprendre les équipes de la séquence', disabled: !seqTeams(r), onClick: () => { const snap = clone(st); const nx = fromTeams(r); Object.keys(st).forEach((k) => delete st[k]); Object.assign(st, nx); save(); render(); toast('Équipes reprises de l\'outil Équipes (scores remis à zéro).', { action: 'Annuler', ms: 8000, onAction: () => { Object.keys(st).forEach((k) => delete st[k]); Object.assign(st, snap); save(); render(); } }); } } : null,
    r.scope === 'act' ? { label: 'Changer les équipes (glisser-déposer)…', onClick: () => go('equipes', { from: 'classPage', classId: r.classId, scope: 'act', actId: r.actId, latest: 1 }) } : null,
    { label: 'Enregistrer comme préréglage de l\'équipe EPS', onClick: async () => { await savePreset(null, 'kabaddi', { teams: st.teams.length, attackMin: st.attackMin }); toast('Préréglage Kabaddi enregistré.'); } },
    '-',
    { label: 'Tout remettre à zéro', danger: true, onClick: () => { const snap = clone(st); apply(() => { st.attacks.forEach((x) => { x.events = []; x.done = false; x.clock = { base: 0, startedAt: null }; }); st.current = st.attacks[0]?.id; }, 'undo'); toast('Scores remis à zéro.', { action: 'Annuler', ms: 9000, onAction: () => { Object.assign(st, snap); save(); render(); } }); } },
    helpItem('kabaddi'),
  ].filter(Boolean)), 'boxed');
  const attackPanel = () => {
    if (!a) { const rk = KB.ranking(st); return h('div', { class: 'empty' }, h('h2', null, 'Toutes les attaques sont jouées'), h('p', { class: 'kbwin' }, rk[0] ? `1re place : ${team(rk[0].id).name} (${rk[0].total} pts)` : '')); }
    const att = team(a.att), def = team(a.def), v = vestOf(att.color);
    return h('section', { class: 'kbattack', style: { '--v': v.hex } },
      h('header', null,
        h('div', { class: 'kbvs' }, h('b', null, att.name), h('span', null, ' attaque '), h('b', null, def.name)),
        h('div', { class: `kbclock ${left <= 20000 ? 'warn' : ''}` }, h('b', null, clockText(Math.max(0, left), false)),
          btn(running ? 'Pause' : left <= 0 ? 'Fini' : KB.elapsedMs(a) ? 'Reprendre' : 'Départ', { icon: running ? 'pause' : 'play', cls: `kbgo ${running ? '' : 'primary'}`, disabled: left <= 0,
            onClick: () => apply(() => { if (running) { a.clock.base = KB.elapsedMs(a); a.clock.startedAt = null; } else a.clock.startedAt = Date.now(); }, 'change') })),
        h('div', { class: 'kbscore' }, String(KB.scoreOf(a)), h('small', null, 'pts'))),
      h('div', { class: 'kbplayers' }, att.players.map((p) => {
        const val = KB.playerValue(a, p.n);
        const n = a.events.filter((e) => e.player === p.n).length;
        return h('button', { type: 'button', class: `kbp ${val === 10 ? 'ten' : ''}`, onClick: () => apply(() => KB.tapPlayer(a, p.n)) },
          h('span', { class: 'kbhand' }, icon('hand', 20)), h('span', { class: 'kbn' }, `${p.n}${p.n === 1 ? ' (cap.)' : ''}`), h('span', { class: 'kbname' }, p.name || `Joueur ${p.n}`), h('b', null, `+${val}`), n ? h('i', null, `${n} élim.`) : null);
      })),
      h('div', { class: 'kbteam' },
        btn('Ace +1000', { icon: 'star', cls: 'kbace', disabled: KB.countOf(a, 'ace') > 0, onClick: () => apply(() => KB.addAce(a), 'change') }),
        btn(`Faute −1${KB.countOf(a, 'faute') ? ` (${KB.countOf(a, 'faute')})` : ''}`, { cls: 'kbfaute', onClick: () => apply(() => KB.addFaute(a), 'undo') }),
        btn('Annuler le dernier', { icon: 'undo', disabled: !a.events.length, onClick: () => apply(() => KB.undo(a), 'undo') }),
        btn('Attaque suivante', { icon: 'next', cls: 'primary', onClick: () => apply(() => { a.done = true; a.clock.startedAt = null; const nx = st.attacks.find((x) => !x.done); st.current = nx?.id || null; }, 'change') })));
  };
  const matrix = h('div', { class: 'kbmatrix panel' },
    h('table', { class: 'kbtab' },
      h('thead', null, h('tr', null, h('th', null, 'Att. \\ Déf.'), st.teams.map((t) => h('th', null, h('i', { class: 'tdot', style: { background: vestOf(t.color).hex } }), t.name)), h('th', null, 'Total'))),
      h('tbody', null, st.teams.map((ta) => h('tr', null, h('th', null, h('i', { class: 'tdot', style: { background: vestOf(ta.color).hex } }), ta.name),
        st.teams.map((td) => { if (ta.id === td.id) return h('td', { class: 'x' }); const x = st.attacks.find((y) => y.att === ta.id && y.def === td.id);
          return h('td', { class: `${x?.id === st.current ? 'cur' : ''} ${x?.done ? 'done' : ''}`, role: 'button', onClick: () => apply(() => { st.current = x.id; }) }, x && (x.done || x.events.length) ? String(KB.scoreOf(x)) : '·'); }),
        h('td', null, h('b', null, String(KB.teamTotal(st, ta.id))))))))
    , h('p', { class: 'muted small' }, 'Touchez une case pour (re)jouer cette attaque.'));
  return h('div', { class: 'main kabaddi' },
    h('div', { class: 'topbar' }, iconBtn('back', 'Retour', () => backTo(r), '', { 'data-back': '1' }),
      h('div', { class: 'grow evtitle' }, h('h1', null, 'Kabaddi'), h('div', { class: 'sub' }, `${st.teams.length} équipes · ${st.attacks.filter((x) => x.done).length}/${st.attacks.length} attaques jouées`)),
      m),
    h('div', { class: 'kblayout' }, attackPanel(), matrix));
});

function teamsDialog(st, done) {
  const S = clone({ teams: st.teams, attackMin: st.attackMin });
  const body = h('div', { class: 'dlg-body kvdlg' });
  const paint = () => body.replaceChildren(
    h('div', { class: 'field' }, 'Nombre d\'équipes', h('div', { class: 'stepper' },
      h('button', { type: 'button', 'aria-label': 'Moins', disabled: S.teams.length <= 2, onClick: () => { S.teams.pop(); paint(); } }, icon('minus', 18)), h('output', null, String(S.teams.length)),
      h('button', { type: 'button', 'aria-label': 'Plus', disabled: S.teams.length >= 6, onClick: () => { const tmp = { teams: S.teams.slice(), attacks: [] }; KB.setTeamCount(tmp, S.teams.length + 1); S.teams = tmp.teams; paint(); } }, icon('plus', 18)))),
    h('div', { class: 'field' }, 'Durée d\'une attaque', h('div', { class: 'stepper' },
      h('button', { type: 'button', 'aria-label': 'Moins', disabled: S.attackMin <= 1, onClick: () => { S.attackMin--; paint(); } }, icon('minus', 18)), h('output', null, `${S.attackMin} min`),
      h('button', { type: 'button', 'aria-label': 'Plus', onClick: () => { S.attackMin++; paint(); } }, icon('plus', 18)))),
    ...S.teams.map((t) => h('div', { class: 'panel kbteamedit' },
      h('div', { class: 'row' }, h('input', { type: 'text', value: t.name, 'aria-label': 'Nom de l\'équipe', style: { flex: 1 }, onChange: (e) => { t.name = e.target.value.trim() || t.name; } }),
        h('select', { 'aria-label': 'Couleur', onChange: (e) => { t.color = e.target.value; } }, VEST_COLORS.map((c) => h('option', { value: c.id, selected: c.id === t.color }, c.label)))),
      h('div', { class: 'kbnames' }, t.players.map((p) => h('input', { type: 'text', value: p.name, placeholder: `${p.n}${p.n === 1 ? ' (cap.)' : ''}`, 'aria-label': `Joueur ${p.n}`, onChange: (e) => { p.name = e.target.value.trim(); } }))))));
  paint();
  openDialog({ title: 'Équipes et joueurs', body, wide: true, actions: [{ label: 'Annuler' }, { label: 'Enregistrer', primary: true, onClick: () => { st.teams = S.teams; st.attackMin = S.attackMin; KB.buildAttacks(st); done(); } }] });
}
