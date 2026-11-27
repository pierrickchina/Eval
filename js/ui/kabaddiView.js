// Outil Kabaddi : attaques de 2 minutes, un bouton par attaquant (+100 puis +10), Ace +1000, faute −1, tableau Attaque × Défense.
import { app, registerView, go, render } from '../app.js';
import { h, btn, icon, iconBtn, openDialog, popMenu, toast } from './dom.js';
import { clone } from '../util.js';
import { vestOf, VEST_COLORS } from '../logic/teams.js';
import { clockText } from './chronoView.js';
import { buzz } from './foundations.js';
import { helpItem } from './help.js';
import { projectionShell, leaveFullscreen } from './projection.js';
import * as KB from '../logic/kabaddi.js';

const V = { ticker: null, proj: false };
const keyOf = (r) => `kab:${r.scope === 'act' ? r.actId : 'free'}`;
const stateOf = (r) => app.repo.getMeta(keyOf(r), null) || KB.newKabaddi();
const backTo = (r) => (r.from === 'classPage' && r.classId ? go('classPage', { id: r.classId }) : go('home'));

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
  if (V.proj) return projectionShell('Kabaddi', a ? `Attaque : ${team(a.att).name} → ${team(a.def).name}` : '', projContent(st, a, team), () => { V.proj = false; leaveFullscreen(); render(); });
  const left = a ? st.attackMin * 60000 - KB.elapsedMs(a) : 0;
  const running = !!a?.clock.startedAt;
  const m = iconBtn('more', 'Options', () => popMenu(m, [
    { label: 'Équipes et joueurs…', onClick: () => teamsDialog(st, () => { save(); render(); }) },
    { label: 'Projection', onClick: () => { V.proj = true; render(); } },
    '-',
    { label: 'Tout remettre à zéro', danger: true, onClick: () => { const snap = clone(st); apply(() => { st.attacks.forEach((x) => { x.events = []; x.done = false; x.clock = { base: 0, startedAt: null }; }); st.current = st.attacks[0]?.id; }, 'undo'); toast('Scores remis à zéro.', { action: 'Annuler', ms: 9000, onAction: () => { Object.assign(st, snap); save(); render(); } }); } },
    helpItem('kabaddi'),
  ]), 'boxed');
  const attackPanel = () => {
    if (!a) return h('div', { class: 'empty' }, h('h2', null, 'Toutes les attaques sont jouées'), btn('Projection', { icon: 'eye', cls: 'primary', onClick: () => { V.proj = true; render(); } }));
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
          h('span', { class: 'kbn' }, `${p.n}${p.n === 1 ? ' (cap.)' : ''}`), h('span', { class: 'kbname' }, p.name || `Joueur ${p.n}`), h('b', null, `+${val}`), n ? h('i', null, `${n} élim.`) : null);
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
      btn('Projection', { icon: 'eye', onClick: () => { V.proj = true; render(); } }), m),
    h('div', { class: 'kblayout' }, attackPanel(), matrix));
});

function projContent(st, a, team) {
  const rk = KB.ranking(st);
  return [
    a ? h('div', { class: 'pj-card kbpj' }, h('h2', null, 'Attaque en cours'), h('div', { class: 'kbpjrow' }, h('b', null, team(a.att).name), h('span', null, ' → '), h('b', null, team(a.def).name), h('span', { class: 'kbpjsc' }, `${KB.scoreOf(a)} pts`), h('span', { class: 'kbclock' }, h('b', null, clockText(Math.max(0, st.attackMin * 60000 - KB.elapsedMs(a)), false))))) : null,
    h('div', { class: 'pj-card' }, h('h2', null, 'Classement'), h('table', { class: 'pj-tab' }, h('tbody', null, rk.map((x) => h('tr', { class: x.rank === 1 && x.total ? 'first' : '' }, h('td', null, String(x.rank)), h('td', null, h('i', { class: 'pj-dot', style: { background: vestOf(team(x.id).color).hex } }), team(x.id).name), h('td', { class: 'n' }, `${x.total} pts`)))))),
    h('div', { class: 'pj-card' }, h('h2', null, 'Attaque \\ Défense'), h('table', { class: 'pj-tab' },
      h('thead', null, h('tr', null, h('th', null, ''), st.teams.map((t) => h('th', { class: 'n' }, t.name)))),
      h('tbody', null, st.teams.map((ta) => h('tr', null, h('td', null, ta.name), st.teams.map((td) => { const x = st.attacks.find((y) => y.att === ta.id && y.def === td.id); return h('td', { class: 'n' }, ta.id === td.id ? '—' : x && (x.done || x.events.length) ? String(KB.scoreOf(x)) : '·'); })))))),
  ].filter(Boolean);
}

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
