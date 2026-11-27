// Outil Interclasses (outil libre) : création de l'événement, pilotage (saisie des scores par le Tournoi), sponsors, titres,
// et projection pour les élèves : match en cours, à suivre, derniers résultats, classements secs ou par titres.
import { app, registerView, go, render } from '../app.js';
import { h, btn, icon, iconBtn, openDialog, popMenu, toast } from './dom.js';
import { fmtDate, todayISO, uid, collator } from '../util.js';
import { vestOf } from '../logic/teams.js';
import * as TN from '../logic/tournament.js';
import * as IC from '../logic/interclasses.js';
import { helpItem } from './help.js';
import { projectionShell, leaveFullscreen } from './projection.js';

const V = { proj: false, ticker: null };
const recs = () => app.repo.list('freetools').filter((x) => x.type === 'interclasses').sort((a, b) => (b.ic.createdAt || 0) - (a.ic.createdAt || 0));
const backHome = () => go('home');
const save = (rec) => app.repo.save('freetools', rec);

registerView('interclasses', (r) => {
  const rec = r.icId ? app.repo.get('freetools', r.icId) : null;
  if (rec && !rec.deleted) return eventView(r, rec);
  return listView();
});

function listView() {
  const list = recs();
  const newBtn = () => btn('Nouvel interclasse', { icon: 'plus', cls: 'primary', onClick: setupDialog });
  return h('div', { class: 'main' },
    h('div', { class: 'topbar' }, iconBtn('back', 'Retour', backHome, '', { 'data-back': '1' }),
      h('div', { class: 'grow evtitle' }, h('h1', null, 'Interclasses'), h('div', { class: 'sub' }, 'Tournois entre classes, projetés pour les élèves')), list.length ? newBtn() : null,
      (() => { const m = iconBtn('more', 'Options', () => popMenu(m, [helpItem('interclasses')]), 'boxed'); return m; })()),
    list.length ? h('div', { class: 'scroll grow listpad', 'data-keep': 'ics' }, list.map((x) => {
      const more = iconBtn('more', 'Actions', (e) => { e.stopPropagation(); popMenu(more, [{ label: 'Supprimer', danger: true, onClick: async () => { await app.repo.remove('freetools', x.id); render(); toast(`« ${x.ic.name} » supprimé.`, { action: 'Annuler', ms: 9000, onAction: async () => { await app.repo.restore('freetools', x.id); render(); } }); } }]); }, 'sm');
      const played = x.ts.reduce((a, t) => a + t.matches.filter((m) => m.done).length, 0), all = x.ts.reduce((a, t) => a + t.matches.length, 0);
      return h('div', { class: 'evrow', role: 'button', tabindex: 0, onClick: () => go('interclasses', { icId: x.id }) },
        h('div', { class: 'grow' }, h('div', { class: 't' }, x.ic.name), h('div', { class: 'muted small' }, `${fmtDate(x.ic.date)} · ${IC.IC_SPORTS[x.ic.sport].label} ${x.ic.level} · ${x.ic.classes.length} classes · ${played}/${all} matchs`)), more);
    }))
      : h('div', { class: 'empty' }, h('h2', null, 'Aucun interclasse'), h('p', null, 'Ultimate pour les 6e et les 4e, basket pour les 5e et les 3e : chaque classe est un club à deux équipes. Les scores se saisissent comme dans le Tournoi ; la projection montre aux élèves où en est l\'événement.'), newBtn()));
}

function setupDialog() {
  const st = { sport: 'ultimate', level: '4e', classes: [], shared: true, equalize: true, halfMin: 6, board: 'suivi', w: 3, d: 2, l: 1, sponsor: 1, date: todayISO() };
  const fromApp = () => [...new Set(app.repo.list('classes').filter((c) => c.level === st.level).map((c) => c.name))].sort(collator.compare);
  const letters = () => 'ABCDEFGH'.split('').map((x) => `${st.level.replace('e', '')}${x}`);
  st.classes = fromApp().length ? fromApp() : letters().slice(0, 5);
  const body = h('div', { class: 'dlg-body kvdlg' });
  const seg = (k, items, after) => h('div', { class: 'seg wrap' }, items.map(([v, l]) => h('button', { type: 'button', class: st[k] === v ? 'on' : '', onClick: () => { st[k] = v; after?.(); paint(); } }, l)));
  const step = (k, lab, min, max, unit = '') => h('div', { class: 'ctrow' }, h('span', { class: 'ctl' }, lab), h('div', { class: 'stepper' },
    h('button', { type: 'button', 'aria-label': `${lab} : moins`, disabled: st[k] <= min, onClick: () => { st[k]--; paint(); } }, icon('minus', 18)), h('output', null, `${st[k]}${unit}`),
    h('button', { type: 'button', 'aria-label': `${lab} : plus`, disabled: st[k] >= max, onClick: () => { st[k]++; paint(); } }, icon('plus', 18))), h('span'));
  const paint = () => {
    const S = IC.IC_SPORTS[st.sport];
    const pool = [...new Set([...fromApp(), ...letters()])];
    body.replaceChildren(
      h('div', { class: 'field' }, 'Sport', seg('sport', Object.entries(IC.IC_SPORTS).map(([k, x]) => [k, x.label]), () => { st.level = IC.IC_SPORTS[st.sport].levels[0]; st.classes = fromApp().length ? fromApp() : letters().slice(0, 5); })),
      h('div', { class: 'field' }, 'Niveau', seg('level', S.levels.map((l) => [l, l]), () => { st.classes = fromApp().length ? fromApp() : letters().slice(0, 5); })),
      h('div', { class: 'field' }, `Classes (${st.classes.length}) : chacune a une équipe ${S.tourneys[0].toLowerCase()} et une équipe ${S.tourneys[1].toLowerCase()}`,
        h('div', { class: 'kvpick' }, pool.map((c) => h('button', { type: 'button', class: `kvchip ${st.classes.includes(c) ? 'on' : ''}`, onClick: () => { st.classes = st.classes.includes(c) ? st.classes.filter((x) => x !== c) : [...st.classes, c].sort(collator.compare); paint(); } }, c)))),
      h('div', { class: 'field' }, 'Terrain', seg('shared', [[true, '1 seul terrain : les tournois alternent'], [false, '1 terrain par tournoi']])),
      st.shared ? h('label', { class: 'row' }, h('input', { type: 'checkbox', checked: st.equalize, style: { width: '22px', height: '22px' }, onChange: (e) => { st.equalize = e.target.checked; } }), h('span', null, 'Égaliser le temps entre les deux tournois')) : '',
      h('div', { class: 'field' }, 'Saisie des scores', seg('board', [['suivi', 'Suivi simple (il y a déjà une table de marque)'], ['table', 'Table de marque sur la tablette']])),
      step('halfMin', 'Durée d\'un match', 2, 30, ' min'),
      step('w', 'Points : victoire', 0, 10), step('d', 'Points : nul', 0, 10), step('l', 'Points : défaite', 0, 10), step('sponsor', 'Bonus sponsor', 0, 10, ' pt'),
      h('label', { class: 'field' }, 'Date', h('input', { type: 'date', value: st.date, onChange: (e) => { st.date = e.target.value || todayISO(); } })));
  };
  paint();
  openDialog({ title: 'Nouvel interclasse', body, wide: true, actions: [{ label: 'Annuler' }, { label: 'Créer', primary: true, onClick: async () => {
    if (st.classes.length < 2) return toast('Choisissez au moins deux classes.');
    const name = `Interclasse ${IC.IC_SPORTS[st.sport].label} ${st.level}`;
    const made = IC.newInterclasses({ name, date: st.date, sport: st.sport, level: st.level, classes: st.classes, shared: st.shared, sponsorPts: st.sponsor,
      settings: { halfMin: st.halfMin, board: st.board, pts: { w: st.w, d: st.d, l: st.l }, equalize: st.equalize, halves: 1, finals: 'none', change: { on: false, mode: 'mid', custom: '' } } });
    const rec = { id: uid(), type: 'interclasses', ...made };
    await app.repo.save('freetools', rec);
    go('interclasses', { icId: rec.id });
  } }] });
}

// ---------- Événement : pilotage ----------

function eventView(r, rec) {
  const titles = IC.titlesFor(rec.ic.sport, rec.ic.level);
  const S = IC.IC_SPORTS[rec.ic.sport];
  if (V.proj) return projection(r, rec);
  const apply = (fn) => { fn(); render(); save(rec); };
  const tCard = (t, k) => {
    const rows = TN.finalStandings(t);
    return h('div', { class: 'panel ictour', style: { '--tc': S.colors[k] } },
      h('div', { class: 'panelhead' }, h('h3', null, t.label), h('span', { class: 'muted small' }, `${t.matches.filter((m) => m.done).length}/${t.matches.length} matchs · ${TN.matchMinutes(t)} min`)),
      h('table', { class: 'edit ictab' }, h('thead', null, h('tr', null, ['#', 'Classe', 'Pts', 'Sponsor'].map((x) => h('th', null, x)))),
        h('tbody', null, rows.map((x) => { const tm = t.teams.find((y) => y.id === x.id); return h('tr', null, h('td', null, String(x.rank)), h('td', null, h('i', { class: 'tdot', style: { background: vestOf(tm.color).hex } }), tm.name), h('td', null, h('b', null, String(x.pts))),
          h('td', null, h('label', { class: 'row' }, h('input', { type: 'checkbox', checked: !!t.bonus?.[tm.id], style: { width: '22px', height: '22px' }, onChange: (e) => apply(() => IC.setSponsor(rec, t, tm.id, e.target.checked)) }), h('span', { class: 'muted small' }, `+${rec.ic.sponsorPts}`)))); }))));
  };
  const coach = IC.coachClass(rec);
  return h('div', { class: 'main interclasses' },
    h('div', { class: 'topbar' }, iconBtn('back', 'Retour', () => go('interclasses', {}), '', { 'data-back': '1' }),
      h('div', { class: 'grow evtitle' }, h('h1', null, rec.ic.name), h('div', { class: 'sub' }, `${fmtDate(rec.ic.date)} · ${rec.ic.classes.length} classes · ${rec.ts[0].shared ? '1 terrain, tournois en alternance' : '1 terrain par tournoi'}`)),
      btn('Matchs et scores', { icon: 'trophy', cls: 'primary', onClick: () => go('tournoi', { scope: 'ic', icId: rec.id, tid: rec.ts[0].id }) }),
      btn('Projection', { icon: 'eye', onClick: () => { V.proj = true; render(); } }),
      (() => { const m = iconBtn('more', 'Options', () => popMenu(m, [helpItem('interclasses')]), 'boxed'); return m; })()),
    h('div', { class: 'scroll grow listpad icgrid', 'data-keep': 'ic' },
      rec.ts.map((t, k) => tCard(t, k)),
      h('div', { class: 'panel' }, h('h3', null, 'Titres'),
        h('div', { class: 'listrow' }, h('b', { class: 'grow' }, titles.best), h('span', null, rec.ts.map((t) => { const w = IC.winnerOf(t); return `${t.label} : ${w ? w.name : '…'}`; }).join(' · '))),
        h('div', { class: 'listrow' }, h('b', { class: 'grow' }, titles.coach), h('span', null, coach ? `${coach.name} (gagne les deux tournois)` : 'si une classe gagne les deux tournois')),
        h('div', { class: 'listrow' }, h('b', { class: 'grow' }, titles.fair), h('select', { onChange: (e) => apply(() => { rec.ic.titles.fair = e.target.value || null; }) }, h('option', { value: '' }, 'À désigner'), rec.ic.classes.map((c) => h('option', { value: c.id, selected: rec.ic.titles.fair === c.id }, c.name)))),
        h('div', { class: 'listrow' }, h('b', { class: 'grow' }, `${titles.mvp} (joueuse)`), h('input', { type: 'text', value: rec.ic.titles.mvpF, placeholder: 'Prénom + initiale', onChange: (e) => apply(() => { rec.ic.titles.mvpF = e.target.value.trim(); }) })),
        h('div', { class: 'listrow' }, h('b', { class: 'grow' }, `${titles.mvp} (joueur)`), h('input', { type: 'text', value: rec.ic.titles.mvpG, placeholder: 'Prénom + initiale', onChange: (e) => apply(() => { rec.ic.titles.mvpG = e.target.value.trim(); }) }))),
      h('div', { class: 'panel' }, h('h3', null, 'Classement des classes'), h('p', { class: 'muted small' }, 'Points des deux équipes de la classe, bonus sponsor compris.'),
        h('table', { class: 'edit ictab' }, h('tbody', null, IC.classRanking(rec).map((c) => h('tr', null, h('td', null, String(c.rank)), h('td', null, h('i', { class: 'tdot', style: { background: vestOf(c.color).hex } }), c.name), h('td', null, h('b', null, `${c.pts} pts`)))))))));
}

// ---------- Projection ----------

function projection(r, rec) {
  if (!V.ticker) V.ticker = setInterval(() => { if (app.route.name !== 'interclasses' || !V.proj) { clearInterval(V.ticker); V.ticker = null; return; } render(); }, 3000);
  const S = IC.IC_SPORTS[rec.ic.sport];
  const titles = IC.titlesFor(rec.ic.sport, rec.ic.level);
  const nm = (t, id) => t.teams.find((x) => x.id === id)?.name || '?';
  const col = (t, id) => vestOf(t.teams.find((x) => x.id === id)?.color).hex;
  const tag = (t) => h('span', { class: 'pj-tag', style: { background: S.colors[rec.ts.indexOf(t)] } }, t.label);
  const up = IC.upcoming(rec, 4);
  const now = up[0];
  const matchLine = ({ t, m }, big = false) => h('div', { class: `pj-match ${big ? 'big' : ''}` }, tag(t),
    h('span', null, h('i', { class: 'pj-dot', style: { background: col(t, m.a) } }), nm(t, m.a)),
    h('b', { class: 'pj-sc' }, m.done || m.sa || m.sb ? `${m.sa} – ${m.sb}` : 'contre'),
    h('span', null, h('i', { class: 'pj-dot', style: { background: col(t, m.b) } }), nm(t, m.b)),
    m.ref ? h('small', null, `arbitre : ${nm(t, m.ref)}`) : null);
  const standing = (t) => h('div', { class: 'pj-card', style: { borderTop: `6px solid ${S.colors[rec.ts.indexOf(t)]}` } }, h('h2', null, `Classement ${t.label}`),
    h('table', { class: 'pj-tab' }, h('tbody', null, TN.finalStandings(t).map((x) => h('tr', { class: x.rank === 1 && x.played ? 'first' : '' }, h('td', null, String(x.rank)), h('td', null, h('i', { class: 'pj-dot', style: { background: col(t, x.id) } }), nm(t, x.id)),
      h('td', { class: 'n' }, `${x.played} m.`), h('td', { class: 'n' }, `${x.pts} pts`), x.bonus ? h('td', { class: 'n' }, '★ sponsor') : h('td'))))));
  const titlesView = () => {
    const coach = IC.coachClass(rec);
    const fair = rec.ic.classes.find((c) => c.id === rec.ic.titles.fair);
    const line = (t, v) => h('div', { class: 'pj-title' }, h('span', null, t), h('b', null, v || '…'));
    return h('div', { class: 'pj-card pj-titles' }, h('h2', null, 'Titres à gagner'),
      ...rec.ts.map((t) => { const w = IC.winnerOf(t); const lead = TN.finalStandings(t)[0]; return line(`${titles.best} · ${t.label}`, w ? w.name : lead?.played ? `en tête : ${nm(t, lead.id)}` : ''); }),
      line(titles.coach, coach ? coach.name : 'une classe qui gagne les deux tournois'),
      line(titles.fair, fair?.name), line(`${titles.mvp}`, [rec.ic.titles.mvpF, rec.ic.titles.mvpG].filter(Boolean).join(' · ')),
      h('div', { class: 'pj-title' }, h('span', null, 'Classement des classes'), h('b', null, IC.classRanking(rec).slice(0, 3).map((c) => `${c.rank}. ${c.name} (${c.pts})`).join('   '))));
  };
  const content = [
    h('div', { class: 'pj-row' },
      h('div', { class: 'pj-card grow' }, h('h2', null, now ? 'Sur le terrain' : 'Événement terminé'), now ? matchLine(now, true) : h('div', { class: 'pj-big' }, 'Bravo à toutes les classes !'),
        up.length > 1 ? [h('h2', { style: { marginTop: '14px' } }, 'À suivre'), ...up.slice(1, rec.ic.proj === 'titres' ? 2 : 4).map((x) => matchLine(x))] : null),
      h('div', { class: 'pj-card' }, h('h2', null, 'Derniers résultats'), IC.lastResults(rec, 4).map((x) => matchLine(x)))),
    rec.ic.proj === 'titres' ? titlesView() : h('div', { class: 'pj-row' }, rec.ts.map(standing)),
  ];
  const shell = projectionShell(rec.ic.name, `${fmtDate(rec.ic.date)} · ${rec.ts.map((t) => t.label).join(' / ')}`, content, () => { V.proj = false; leaveFullscreen(); render(); });
  // choix de ce qui est projeté (classements secs / par titres) : petit bouton discret en haut à droite
  shell.prepend(h('div', { class: 'pj-switch' }, [['sec', 'Classements'], ['titres', 'Titres']].map(([k, l]) => h('button', { type: 'button', class: rec.ic.proj === k ? 'on' : '', onPointerdown: (e) => e.stopPropagation(), onClick: (e) => { e.stopPropagation(); rec.ic.proj = k; save(rec); render(); } }, l))));
  return shell;
}
