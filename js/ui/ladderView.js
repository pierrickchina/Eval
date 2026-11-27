// Outils Tables (tennis de table) et Rings (boxe, combat) : séances, répartition, inaptes, classement final, tableau général.
// Pas de feuilles de poule ni de points sur la tablette : seul le classement final de chaque table est rangé.
import { app, registerView, go, render } from '../app.js';
import { h, btn, icon, iconBtn, openDialog, popMenu, toast } from './dom.js';
import { fmtDate, todayISO, collator, uid } from '../util.js';
import { studentLabel } from '../data/schema.js';
import { activitiesOf, touchTool } from '../logic/activities.js';
import * as LD from '../logic/ladder.js';
import { helpItem } from './help.js';

const saveClass = (cls) => app.repo.save('classes', cls);
const V = { rank: false, tab: 'sessions' };

function ctxFor(r, kind) {
  const cls = app.repo.get('classes', r.classId);
  const act = cls && !cls.deleted ? activitiesOf(cls).find((a) => a.id === r.actId) : null;
  if (!act) return null;
  const L = LD.ladderOf(act, kind);
  const students = cls.students.filter((s) => s.active !== false).sort((a, b) => collator.compare(studentLabel(a), studentLabel(b)));
  const byId = new Map(cls.students.map((s) => [s.id, s]));
  const forb = act.forbidden ||= {};
  return {
    cls, act, L, kind, K: LD.KINDS[kind], students, byId,
    name: (sid) => (byId.get(sid) ? studentLabel(byId.get(sid)) : '?'),
    forbidden: (sid) => !!forb[sid],
    toggleForbidden: (sid) => { if (forb[sid]) delete forb[sid]; else forb[sid] = Date.now(); },
    save: () => { touchTool(act, kind); return saveClass(cls); },
  };
}
const backTo = (r) => (r.from === 'classPage' && r.classId ? go('classPage', { id: r.classId }) : go('home'));

for (const kind of Object.keys(LD.KINDS)) registerView(kind, (r) => view(r, kind));

function view(r, kind) {
  const c = ctxFor(r, kind);
  if (!c) { queueMicrotask(() => go('home')); return h('div'); }
  if (r.sid) { const s = c.L.sessions.find((x) => x.id === r.sid); if (s) return sessionView(r, c, s); }
  return listView(r, c);
}

// ---------- Liste des séances ----------

function listView(r, c) {
  const sessions = LD.sortedSessions(c.L).reverse();
  const newBtn = () => btn('Nouvelle séance', { icon: 'plus', cls: 'primary', onClick: () => setupDialog(r, c) });
  const m = iconBtn('more', 'Options', () => popMenu(m, [
    c.K.duos ? { label: 'Duos…', onClick: () => duosDialog(c) } : null,
    helpItem(c.kind),
  ].filter(Boolean)), 'boxed');
  const row = (s) => {
    const ranked = s.tables.filter((t) => t.units.length > 1 && (s.ranking[t.n] || []).length === t.units.length).length, k = s.tables.filter((t) => t.units.length).length;
    const more = iconBtn('more', 'Actions', (e) => { e.stopPropagation(); popMenu(more, [{ label: 'Supprimer la séance', danger: true, onClick: () => deleteSession(c, s) }]); }, 'sm');
    const open = () => go(c.kind, { ...r, sid: s.id });
    return h('div', { class: 'evrow', role: 'button', tabindex: 0, onClick: open, onKeydown: (e) => { if (e.key === 'Enter') open(); } },
      h('div', { class: 'grow' }, h('div', { class: 't' }, `Séance du ${fmtDate(s.date)}`),
        h('div', { class: 'muted small' }, [LD.FORMATS[s.format]?.label, `${k} ${c.K.ones}`, LD.PLACES[s.place]?.split(' (')[0], ranked ? `classement : ${ranked}/${k}` : 'classement à ranger', s.inapte.length ? `${s.inapte.length} inapte(s)` : ''].filter(Boolean).join(' · '))),
      more);
  };
  const tabs = h('div', { class: 'seg' }, [['sessions', 'Séances'], ['overview', 'Tableau général']].map(([k, l]) => h('button', { type: 'button', class: V.tab === k ? 'on' : '', onClick: () => { V.tab = k; render(); } }, l)));
  return h('div', { class: 'main' },
    h('div', { class: 'topbar' }, iconBtn('back', 'Retour', () => backTo(r), '', { 'data-back': '1' }),
      h('div', { class: 'grow evtitle' }, h('h1', null, c.K.label), h('div', { class: 'sub' }, `${c.act.name} · ${c.cls.name}`)), sessions.length ? newBtn() : null, m),
    sessions.length ? h('div', { class: 'toolbar' }, tabs) : null,
    !sessions.length ? h('div', { class: 'empty' }, h('h2', null, 'Aucune séance'),
      h('p', null, `Répartissez les élèves sur ${c.kind === 'rings' ? 'les rings' : 'les tables'} (8 au plus). Pendant la séance, rangez le classement final de chaque ${c.K.one.toLowerCase()} : à la séance suivante, le 1er monte et le dernier descend.`), newBtn())
      : V.tab === 'overview' ? h('div', { class: 'scroll grow listpad', 'data-keep': 'ld-over' }, overviewNode(c))
        : h('div', { class: 'scroll grow listpad', 'data-keep': 'ld-list' }, sessions.map(row)));
}

function deleteSession(c, s) {
  const i = c.L.sessions.indexOf(s);
  c.L.sessions.splice(i, 1); render(); c.save();
  toast('Séance supprimée.', { action: 'Annuler', ms: 9000, onAction: () => { c.L.sessions.splice(i, 0, s); render(); c.save(); } });
}

// ---------- Création d'une séance ----------

function setupDialog(r, c) {
  const last = LD.lastSession(c.L);
  const st = {
    date: todayISO(), format: last?.format && (c.K.duos || last.format === 'simple') ? last.format : 'simple',
    place: last ? 'resultats' : 'niveau', duoMode: c.L.duos.length ? 'keep' : 'mixte',
    count: last ? last.tables.filter((t) => t.units.length).length : 0, absent: new Set(),
  };
  const body = h('div', { class: 'dlg-body ld-setup' });
  const seg = (k, opts, dis = () => false) => h('div', { class: 'seg wrap' }, opts.map(([v, l]) => h('button', { type: 'button', class: st[k] === v ? 'on' : '', disabled: dis(v), onClick: () => { st[k] = v; paint(); } }, l)));
  const paint = () => {
    const f = LD.FORMATS[st.format];
    const comparable = last && last.unit === f.unit;
    if (st.place === 'resultats' && !comparable) st.place = 'niveau';
    const present = c.students.filter((s) => !st.absent.has(s.id));
    const units = f.unit === 'duo' ? Math.ceil(present.length / 2) : present.length;
    const auto = LD.tableSizes(units, { min: f.min, max: f.max }).length;
    const k = st.count || auto;
    body.replaceChildren(
      h('label', { class: 'field' }, 'Date', h('input', { type: 'date', value: st.date, onChange: (e) => { st.date = e.target.value || todayISO(); } })),
      c.K.duos ? h('div', { class: 'field' }, 'Forme', seg('format', Object.entries(LD.FORMATS).map(([k2, x]) => [k2, x.label])), h('span', { class: 'muted small' }, f.hint)) : null,
      f.unit === 'duo' ? h('div', { class: 'field' }, 'Duos', h('div', { class: 'radios' }, Object.entries(LD.DUO_MODES).map(([k2, l]) => h('label', { class: 'radio' },
        h('input', { type: 'radio', name: 'duomode', checked: st.duoMode === k2, disabled: k2 === 'keep' && !c.L.duos.length, onChange: () => { st.duoMode = k2; paint(); } }), ' ', l)))) : null,
      h('div', { class: 'field' }, 'Placement', h('div', { class: 'radios' }, Object.entries(LD.PLACES).map(([k2, l]) => h('label', { class: 'radio' },
        h('input', { type: 'radio', name: 'place', checked: st.place === k2, disabled: k2 === 'resultats' && !comparable, onChange: () => { st.place = k2; paint(); } }), ' ', l,
        k2 === 'resultats' && !comparable ? h('span', { class: 'muted small' }, last ? ' — pas de séance précédente de cette forme' : ' — pas encore de séance') : null)))),
      h('div', { class: 'field' }, `Nombre de ${c.K.ones}`, h('div', { class: 'row' },
        h('div', { class: 'stepper' },
          h('button', { type: 'button', 'aria-label': 'Moins', disabled: k <= 1, onClick: () => { st.count = Math.max(1, k - 1); paint(); } }, icon('minus', 18)),
          h('output', null, String(k)),
          h('button', { type: 'button', 'aria-label': 'Plus', disabled: k >= LD.MAX_TABLES, onClick: () => { st.count = Math.min(LD.MAX_TABLES, k + 1); paint(); } }, icon('plus', 18))),
        st.count ? btn('Auto', { cls: 'small soft', onClick: () => { st.count = 0; paint(); } }) : h('span', { class: 'muted small' }, `proposé : ${auto}`),
        h('span', { class: 'muted small' }, `${present.length} élèves présents · ${units ? Math.round(units / k * 10) / 10 : 0} ${f.unit === 'duo' ? 'duos' : 'joueurs'} par ${c.K.one.toLowerCase()}`))),
      h('details', { class: 'ld-abs' }, h('summary', null, `Absents à cette séance (${st.absent.size})`),
        h('div', { class: 'chips' }, c.students.map((s) => h('button', { type: 'button', class: `chipbtn ${st.absent.has(s.id) ? 'on' : ''}`, onClick: () => { st.absent.has(s.id) ? st.absent.delete(s.id) : st.absent.add(s.id); paint(); } }, studentLabel(s))))),
    );
    if (st._open) body.querySelector('details').open = true;
    body.querySelector('details').addEventListener('toggle', (e) => { st._open = e.target.open; });
  };
  paint();
  openDialog({ title: `Nouvelle séance · ${c.K.label}`, body, actions: [{ label: 'Annuler' }, { label: 'Créer la séance', primary: true, onClick: () => {
    const f = LD.FORMATS[st.format];
    const present = c.students.filter((s) => !st.absent.has(s.id)).map((s) => s.id);
    const s = LD.newSession(c.L, { date: st.date, format: st.format, place: st.place, count: st.count || 0, duoMode: f.unit === 'duo' ? st.duoMode : null, students: present });
    s.inapte = [...st.absent];
    c.save(); V.rank = false;
    go(c.kind, { ...r, sid: s.id });
  } }] });
}

// ---------- Séance ----------

const unitName = (c, u) => (LD.isDuo(u) ? LD.membersOf(c.L, u).map(c.name).join(' + ') || 'Duo' : c.name(u));

function sessionView(r, c, s) {
  const apply = (fn) => { fn(); render(); c.save(); };
  const prevMove = new Map(); // ↑ ↓ annoncés pour la séance suivante
  const full = s.tables.filter((x) => x.units.length);
  for (const t of full) { const { first, last } = LD.movers(s, t); if (first && t !== full[0]) prevMove.set(first, 'up'); if (last && t !== full.at(-1)) prevMove.set(last, 'down'); }
  const chip = (u, t) => {
    const ms = LD.membersOf(c.L, u);
    const r2 = t ? (s.ranking[t.n] || []) : [];
    const rank = t ? r2.indexOf(u) + 1 : 0;
    const label = ms.length ? ms.map((sid) => h('span', { class: `ldn ${s.inapte.includes(sid) ? 'out' : ''}` }, c.name(sid), c.forbidden(sid) ? h('i', { class: 'nomat', title: 'Matériel interdit' }) : null)) : 'Duo vide';
    const kids = [];
    ms.forEach((x, i) => { if (i) kids.push(h('span', { class: 'plus' }, '+')); kids.push(label[i]); });
    const el = h('button', { type: 'button', class: `ldchip ${rank ? 'ranked' : ''} ${V.rank && t ? 'rankable' : ''}`, 'data-u': u,
      onClick: () => (V.rank && t ? apply(() => LD.rankTap(s, t.n, u)) : unitMenu(el, c, s, u, apply)) },
      rank ? h('b', { class: 'rk' }, String(rank)) : null, ...(ms.length ? kids : [label]),
      rank && prevMove.get(u) ? h('span', { class: `mv ${prevMove.get(u)}`, title: prevMove.get(u) === 'up' ? 'Montera à la séance suivante' : 'Descendra à la séance suivante' }, prevMove.get(u) === 'up' ? '↑' : '↓') : null);
    return el;
  };
  const card = (t) => h('section', { class: `ldcard ${V.rank ? 'ranking' : ''}` },
    h('header', null, h('b', null, `${c.K.one} ${t.n}`), h('span', { class: 'muted small' }, t.units.length > (LD.FORMATS[s.format].max) ? `${t.units.length} · beaucoup` : String(t.units.length)),
      V.rank && (s.ranking[t.n] || []).length ? btn('Effacer', { cls: 'small soft', onClick: () => apply(() => { delete s.ranking[t.n]; }) }) : null),
    h('div', { class: 'ldunits' }, t.units.length ? t.units.slice().sort((a, b) => { const rk = s.ranking[t.n] || []; const ia = rk.indexOf(a), ib = rk.indexOf(b); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); }).map((u) => chip(u, t)) : h('span', { class: 'muted small' }, V.rank ? '' : 'Vide · touchez un élève pour le placer ici')));
  const tables = s.tables;
  const pool = s.pool || [];
  const side = h('aside', { class: 'ldside' },
    pool.length || s.place === 'libre' ? h('div', { class: 'ldbox pool' }, h('b', null, `À placer (${pool.length})`), h('div', { class: 'ldunits' }, pool.map((u) => chip(u, null)))) : null,
    h('div', { class: 'ldbox inapte' }, h('b', null, `Inapte / absent (${s.inapte.length})`),
      h('div', { class: 'ldunits' }, s.inapte.length ? s.inapte.map((sid) => h('button', { type: 'button', class: 'ldchip out', onClick: (e) => popMenu(e.currentTarget, [{ label: `${c.name(sid)} : de retour`, onClick: () => apply(() => LD.setInapte(c.L, s, sid, false)) }]) }, c.name(sid), c.forbidden(sid) ? h('i', { class: 'nomat', title: 'Matériel interdit' }) : null)) : h('span', { class: 'muted small' }, 'Personne'))));
  const m = iconBtn('more', 'Options', () => popMenu(m, [
    c.K.duos && s.unit === 'duo' ? { label: 'Duos…', onClick: () => duosDialog(c) } : null,
    { label: `Ajouter ${c.kind === 'rings' ? 'un ring' : 'une table'}`, disabled: tables.length >= LD.MAX_TABLES, onClick: () => apply(() => { s.tables.push({ n: (Math.max(0, ...s.tables.map((t) => t.n)) + 1), units: [] }); }) },
    { label: 'Retirer les tables vides', onClick: () => apply(() => { s.tables = s.tables.filter((t) => t.units.length); s.tables.forEach((t, i) => { if (t.n !== i + 1) { if (s.ranking[t.n]) { s.ranking[i + 1] = s.ranking[t.n]; delete s.ranking[t.n]; } t.n = i + 1; } }); }) },
    { label: 'Date de la séance…', onClick: () => dateDialog(s, apply) },
    helpItem(c.kind),
    '-',
    { label: 'Supprimer la séance', danger: true, onClick: () => { deleteSession(c, s); go(c.kind, { ...r, sid: undefined }); } },
  ].filter(Boolean)), 'boxed');
  return h('div', { class: 'main ladder' },
    h('div', { class: 'topbar' }, iconBtn('back', 'Retour', () => go(c.kind, { ...r, sid: undefined }), '', { 'data-back': '1' }),
      h('div', { class: 'grow evtitle' }, h('h1', null, `${c.K.label} · ${fmtDate(s.date)}`), h('div', { class: 'sub' }, `${c.act.name} · ${c.cls.name} · ${LD.FORMATS[s.format].label}`)),
      btn(V.rank ? 'Terminé' : 'Classement final', { icon: V.rank ? 'check' : 'trophy', cls: V.rank ? 'primary' : '', onClick: () => { V.rank = !V.rank; render(); } }),
      m),
    V.rank ? h('div', { class: 'ldhint' }, `Touchez les joueurs de chaque ${c.K.one.toLowerCase()} dans l'ordre du classement final (1er, 2e…) ; le dernier se range tout seul. Rien ne bouge aujourd'hui : à la séance suivante, ↑ le 1er monte, ↓ le dernier descend.`) : null,
    h('div', { class: 'ldlayout' }, h('div', { class: 'ldgrid scroll', 'data-keep': 'ldgrid' }, tables.map(card)), side));
}

function unitMenu(anchor, c, s, u, apply) {
  const ms = LD.membersOf(c.L, u);
  const here = s.tables.find((t) => t.units.includes(u))?.n;
  popMenu(anchor, [
    ...s.tables.filter((t) => t.n !== here).map((t) => ({ label: `→ ${c.K.one} ${t.n} (${t.units.length})`, onClick: () => apply(() => LD.moveUnit(s, u, t.n)) })),
    s.place === 'libre' && here ? { label: '→ À placer', onClick: () => apply(() => LD.moveUnit(s, u, 'pool')) } : null,
    '-',
    ...ms.map((sid) => ({ label: `${c.name(sid)} : inapte / absent`, onClick: () => apply(() => LD.setInapte(c.L, s, sid, true)) })),
    ...ms.map((sid) => ({ label: `${c.name(sid)} : ${c.forbidden(sid) ? 'matériel autorisé de nouveau' : 'matériel interdit (jusqu\'à la fin de la séquence)'}`, onClick: () => apply(() => c.toggleForbidden(sid)) })),
  ].filter(Boolean));
}

function dateDialog(s, apply) {
  let d = s.date;
  openDialog({ title: 'Date de la séance', body: h('label', { class: 'field' }, 'Date', h('input', { type: 'date', value: d, onChange: (e) => { d = e.target.value || d; } })),
    actions: [{ label: 'Annuler' }, { label: 'Enregistrer', primary: true, onClick: () => apply(() => { s.date = d; }) }] });
}

// ---------- Duos (gardés d'une séance à l'autre, modifiables) ----------

function duosDialog(c) {
  const dlg = openDialog({ title: 'Duos', body: h('div'), actions: [{ label: 'Terminé', primary: true, onClick: () => { render(); } }] });
  const save = () => { c.save(); paint(); };
  const sel = (d, k) => h('select', { 'aria-label': k === 'a' ? 'Joueur 1' : 'Joueur 2', onChange: (e) => {
    const sid = e.target.value || null;
    const other = c.L.duos.find((x) => x !== d && (x.a === sid || x.b === sid));
    if (other) { const kk = other.a === sid ? 'a' : 'b'; other[kk] = d[k]; if (!other.a) { other.a = other.b; other.b = null; } }
    d[k] = sid; if (!d.a) { d.a = d.b; d.b = null; }
    c.L.duos = c.L.duos.filter((x) => x.a);
    save();
  } }, h('option', { value: '' }, '—'), c.students.map((s) => h('option', { value: s.id, selected: d[k] === s.id }, studentLabel(s))));
  const paint = () => {
    const inDuo = new Set(c.L.duos.flatMap((d) => [d.a, d.b]));
    const loose = c.students.filter((s) => !inDuo.has(s.id));
    dlg.content.replaceChildren(
      h('p', { class: 'muted small', style: { margin: 0 } }, 'Les duos sont gardés d\'une séance à l\'autre. Choisir un élève déjà en duo échange les deux élèves.'),
      ...c.L.duos.map((d, i) => h('div', { class: 'listrow' }, h('b', { style: { width: '2.2em' } }, `${i + 1}.`), sel(d, 'a'), h('span', null, '+'), sel(d, 'b'),
        iconBtn('trash', 'Séparer ce duo', () => { c.L.duos = c.L.duos.filter((x) => x !== d); save(); }, 'sm'))),
      loose.length ? h('p', { class: 'small' }, h('b', null, 'Sans duo : '), loose.map((s) => studentLabel(s)).join(', ')) : null,
      btn('Nouveau duo', { icon: 'plus', cls: 'small soft', disabled: !loose.length, onClick: () => { c.L.duos.push({ id: uid(), a: loose[0].id, b: loose[1]?.id || null }); save(); } }));
  };
  paint();
}

// ---------- Tableau général ----------

export function overviewNode(c) {
  const { sessions, rows } = LD.overview(c.L, c.students.map((s) => s.id));
  if (!sessions.length) return h('p', { class: 'muted' }, 'Pas encore de séance.');
  const tierLabel = { haut: 'hauts', milieu: 'intermédiaires', bas: 'derniers' };
  return h('div', { style: { overflowX: 'auto' } }, h('table', { class: 'edit restab ldover' },
    h('thead', null, h('tr', null, h('th', null, 'Élève'), sessions.map((s) => h('th', null, h('div', { class: 'rh' }, fmtDate(s.date)), h('div', { class: 'rs' }, LD.FORMATS[s.format]?.label))), h('th', null, 'Niveau moyen'))),
    h('tbody', null, rows.sort((a, b) => (a.level ?? 2) - (b.level ?? 2)).map((r) => h('tr', null, h('td', null, c.name(r.sid), c.forbidden(r.sid) ? h('i', { class: 'nomat', title: 'Matériel interdit' }) : null),
      r.cells.map((x) => h('td', { class: x ? '' : 'none' }, !x ? '–' : x.inapte ? h('span', { class: 'muted small' }, 'inapte') : [h('b', null, `${c.K.one} ${x.n}`), x.rank ? h('span', { class: 'muted small' }, ` · ${x.rank}/${x.of}`) : null])),
      h('td', null, r.level == null ? '–' : `${c.K.ones} ${tierLabel[LD.tierOf(r.level)]}`))))));
}

/** Pour l'onglet « Résultats » de la classe : un tableau par outil utilisé dans l'activité. */
export function ladderResults(cls, act) {
  return Object.keys(LD.KINDS).filter((k) => act.ladders?.[k]?.sessions?.length).map((k) => {
    const c = ctxFor({ classId: cls.id, actId: act.id }, k);
    return h('div', { class: 'ldres' }, h('h3', null, `${act.name} · ${c.K.label}`), overviewNode(c));
  });
}
