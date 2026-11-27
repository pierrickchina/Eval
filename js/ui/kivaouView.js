// Outil Kivaou (course d'orientation) : qui va où, minuteurs par groupe, retours, résultats et bilan.
// Écran de sécurité : en un coup d'œil, qui n'est pas rentré. Aucune saisie au clavier pendant la séance.
import { app, registerView, go, render } from '../app.js';
import { h, btn, icon, iconBtn, openDialog, popMenu, toast, confirmDialog } from './dom.js';
import { fmtDate, todayISO, collator, uid } from '../util.js';
import { studentLabel } from '../data/schema.js';
import { activitiesOf, touchTool } from '../logic/activities.js';
import { buzz } from './foundations.js';
import { helpItem } from './help.js';
import { presetFor, savePreset } from './presets.js';
import * as KV from '../logic/kivaou.js';

const V = { tab: 'course', showBack: false, sessionId: null, sortBy: 'rank', ticker: null, alarmed: new Set() };
const saveClass = (cls) => app.repo.save('classes', cls);
const pad = (n) => String(n).padStart(2, '0');
const mmss = (ms) => { const s = Math.round(Math.abs(ms) / 1000); return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`; };
export const clock = (t) => { const d = new Date(t); return `${pad(d.getHours())}h${pad(d.getMinutes())}`; };
const LEFT_TXT = (K, g, t) => { const l = KV.leftMs(K, g, t); return l < 0 ? `+${mmss(l)}` : mmss(l); };

function ctxFor(r) {
  const cls = app.repo.get('classes', r.classId);
  const act = cls && !cls.deleted ? activitiesOf(cls).find((a) => a.id === r.actId) : null;
  if (!act) return null;
  const K = KV.kivaouOf(act, presetFor(act.name, 'kivaou') || KV.KV_DEFAULT);
  const students = cls.students.filter((s) => s.active !== false).sort((a, b) => collator.compare(studentLabel(a), studentLabel(b)));
  const byId = new Map(cls.students.map((s) => [s.id, s]));
  return { cls, act, K, students, name: (sid) => (byId.get(sid) ? studentLabel(byId.get(sid)) : '?'), save: () => { touchTool(act, 'kivaou'); return saveClass(cls); } };
}

// ---------- Battement : chiffres, couleurs, alarme de dépassement ----------

function tick() {
  if (app.route.name !== 'kivaou') { clearInterval(V.ticker); V.ticker = null; return; }
  const c = ctxFor(app.route); if (!c) return;
  const s = c.K.sessions.find((x) => x.id === V.sessionId); if (!s) return;
  const t = Date.now();
  let changed = false;
  for (const g of s.groups) {
    const el = document.querySelector(`[data-gid="${g.id}"]`);
    const st = KV.stateOf(c.K, g, t);
    if (st === 'over' && !V.alarmed.has(g.id)) { V.alarmed.add(g.id); buzz('end'); changed = true; }
    if (!el) continue;
    if (el.dataset.st !== st) changed = true;
    const d = el.querySelector('.kvdigits'); if (d) { const txt = LEFT_TXT(c.K, g, t); if (d.textContent !== txt) d.textContent = txt; }
  }
  if (changed) render();
}

// ---------- Écran ----------

registerView('kivaou', (r) => {
  const c = ctxFor(r);
  if (!c) { queueMicrotask(() => go('home')); return h('div'); }
  const today = todayISO();
  // séance en cours (« ⋮ › Nouvelle séance » en ouvre une autre, la précédente reste dans le bilan)
  let s = c.K.sessions.find((x) => x.id === c.K.currentId);
  if (!s || s.date !== today) { s = KV.todaySession(c.K, today); c.K.currentId = s.id; }
  if (V.tab === 'course' || !c.K.sessions.some((x) => x.id === V.sessionId)) V.sessionId = s.id;
  const shown = c.K.sessions.find((x) => x.id === V.sessionId) || s;
  if (!V.ticker) V.ticker = setInterval(tick, 500);
  const apply = (fn) => { fn(); render(); c.save(); };
  const t = Date.now();
  const out = KV.outGroups(s);
  const back = async () => {
    if (out.length && !(await confirmDialog(`${out.length} groupe${out.length > 1 ? 's ne sont pas rentrés' : ' n\'est pas rentré'}. Tout le monde est rentré ?`, 'Quitter quand même', { danger: true }))) return;
    clearInterval(V.ticker); V.ticker = null;
    if (r.from === 'classPage' && r.classId) go('classPage', { id: r.classId }); else go('home');
  };
  const ready = s.groups.filter((g) => !g.start);
  const m = iconBtn('more', 'Options', () => popMenu(m, [
    { label: 'Réglages (temps, malus, parcours)…', onClick: () => settingsDialog(c) },
    { label: c.K.settings.grouped ? 'Départ groupé : activé' : 'Départ groupé : désactivé', active: c.K.settings.grouped, onClick: () => apply(() => { c.K.settings.grouped = !c.K.settings.grouped; }) },
    { label: 'Nouvelle séance (tout repart à zéro)', disabled: !s.groups.length, onClick: async () => {
      if (out.length && !(await confirmDialog(`${out.length} groupe(s) ne sont pas rentrés. Ouvrir quand même une nouvelle séance ?`, 'Nouvelle séance', { danger: true }))) return;
      const prevId = c.K.currentId;
      const ns = { id: uid(), date: today, groups: [], createdAt: Date.now() };
      apply(() => { c.K.sessions.push(ns); c.K.currentId = ns.id; V.sessionId = ns.id; });
      toast('Nouvelle séance : la précédente est gardée dans le bilan.', { action: 'Annuler', ms: 9000, onAction: () => apply(() => { c.K.sessions = c.K.sessions.filter((x) => x !== ns || x.groups.length); c.K.currentId = prevId; V.sessionId = prevId; }) });
    } },
    helpItem('kivaou'),
  ]), 'boxed');
  const tabs = h('div', { class: 'seg' }, [['course', 'Course'], ['bilan', 'Bilan']].map(([k, l]) => h('button', { type: 'button', class: V.tab === k ? 'on' : '', onClick: () => { V.tab = k; render(); } }, l)));
  const top = h('div', { class: 'topbar' }, iconBtn('back', 'Retour', back, '', { 'data-back': '1' }),
    h('div', { class: 'grow evtitle' }, h('h1', null, 'Kivaou'), h('div', { class: 'sub' }, `${c.act.name} · ${c.cls.name} · ${fmtDate(s.date)} · ${c.K.settings.maxMin} min max`)),
    tabs,
    V.tab === 'course' && c.K.settings.grouped && ready.length ? btn(`GO pour tous (${ready.length})`, { icon: 'play', cls: 'primary kvgoall', onClick: () => apply(() => { const t0 = Date.now(); for (const g of ready) KV.go(g, t0); buzz('change'); }) }) : null,
    V.tab === 'course' ? btn('Nouveau groupe', { icon: 'plus', cls: c.K.settings.grouped && ready.length ? '' : 'primary', onClick: () => groupDialog(c, s, apply) }) : null,
    m);
  if (V.tab === 'bilan') return h('div', { class: 'main kivaou' }, top, h('div', { class: 'scroll grow listpad', 'data-keep': 'kv-bilan' }, bilanNode(c, shown, true)));

  // bandeau de sécurité, toujours en haut
  const late = out.filter((g) => KV.stateOf(c.K, g, t) === 'over');
  const banner = s.groups.some((g) => g.start)
    ? h('div', { class: `kvbanner ${late.length ? 'late' : out.length ? 'out' : 'ok'}` },
      out.length ? [h('b', null, `${out.length} groupe${out.length > 1 ? 's' : ''} pas rentré${out.length > 1 ? 's' : ''}`), late.length ? h('span', null, ` · en retard : ${late.map((g) => g.sids.map(c.name).join(', ')).join(' / ')}`) : null]
        : h('b', null, 'Tout le monde est rentré'))
    : null;
  const order = { over: 0, warn1: 1, warn2: 2, run: 3, ready: 4 };
  const active = s.groups.filter((g) => !g.end).sort((a, b) => (order[KV.stateOf(c.K, a, t)] - order[KV.stateOf(c.K, b, t)]) || (a.start && b.start ? KV.leftMs(c.K, a, t) - KV.leftMs(c.K, b, t) : a.n - b.n));
  const backs = s.groups.filter((g) => g.end).sort((a, b) => b.end - a.end);
  const card = (g) => {
    const st = KV.stateOf(c.K, g, t);
    const crs = KV.courseOf(c.K, g.course);
    return h('section', { class: `kvcard ${st}`, 'data-gid': g.id, 'data-st': st },
      h('header', null, h('b', { class: 'kvcourse' }, crs.name), h('span', { class: 'kvn' }, `Groupe ${g.n}`),
        iconBtn('more', `Groupe ${g.n}`, (e) => popMenu(e.currentTarget, [
          { label: 'Modifier les élèves / le parcours…', onClick: () => groupDialog(c, s, apply, g) },
          g.start ? { label: 'Annuler le départ', onClick: () => apply(() => { g.start = null; V.alarmed.delete(g.id); }) } : null,
          { label: 'Supprimer le groupe', danger: true, onClick: () => { const i = s.groups.indexOf(g); apply(() => { s.groups.splice(i, 1); }); toast('Groupe supprimé.', { action: 'Annuler', ms: 8000, onAction: () => apply(() => { s.groups.splice(i, 0, g); }) }); } },
        ].filter(Boolean)), 'sm')),
      h('div', { class: 'kvnames' }, g.sids.map(c.name).join(' · ')),
      g.start ? [
        h('div', { class: 'kvdigits' }, LEFT_TXT(c.K, g, t)),
        h('div', { class: 'kvmeta' }, `Parti à ${clock(g.start)}${st === 'over' ? ' · temps dépassé' : ''}`),
        h('button', { type: 'button', class: 'kvbtn arrive', onClick: () => apply(() => { KV.arrive(g); buzz('tap'); }) }, icon('check', 26), 'Arrivé'),
      ] : [
        h('div', { class: 'kvmeta' }, c.K.settings.grouped ? 'En attente du départ groupé' : 'Prêt à partir'),
        c.K.settings.grouped ? null : h('button', { type: 'button', class: 'kvbtn go', onClick: () => apply(() => { KV.go(g); buzz('tap'); }) }, icon('play', 26), 'GO'),
      ]);
  };
  const small = (g) => {
    const res = KV.resultOf(c.K, g);
    return h('button', { type: 'button', class: `kvsmall ${res.late ? 'late' : ''}`, onClick: () => resultDialog(c, g, apply) },
      h('b', null, g.sids.map(c.name).join(' · ')), h('span', null, KV.courseOf(c.K, g.course).name),
      h('span', null, `${mmss(res.time)}${res.late ? ' (hors temps)' : ''}`),
      h('span', { class: g.found == null ? 'todo' : '' }, g.found == null ? 'balises à saisir' : `${g.found}/${g.sought} balises`));
  };
  return h('div', { class: 'main kivaou' }, top, banner,
    h('div', { class: 'scroll grow kvbody', 'data-keep': 'kv' },
      // beaucoup de groupes : cartes resserrées pour tout voir sur un écran
      active.length ? h('div', { class: `kvgrid ${active.length > 9 ? 'd3' : active.length > 6 ? 'd2' : ''}` }, active.map(card))
        : h('div', { class: 'empty' }, h('h2', null, s.groups.length ? 'Aucun groupe dehors' : 'Aucun groupe'), h('p', null, 'Touchez « Nouveau groupe » : les élèves, le parcours, « Prêt », puis GO sur la carte.'), btn('Nouveau groupe', { icon: 'plus', cls: 'primary', onClick: () => groupDialog(c, s, apply) })),
      backs.length ? h('div', { class: 'kvbacks' },
        h('button', { type: 'button', class: 'kvbackhead', onClick: () => { V.showBack = !V.showBack; render(); } }, icon(V.showBack ? 'up' : 'plus', 18), `Rentrés (${backs.length})`, backs.some((g) => g.found == null) ? h('span', { class: 'muted small' }, ' · touchez un groupe pour saisir ses balises') : null),
        V.showBack ? h('div', { class: 'kvsmalls' }, backs.map(small)) : null) : null));
});

// ---------- Fenêtres (sans clavier) ----------

function groupDialog(c, s, apply, g = null) {
  const busy = KV.busyStudents(s);
  const st = { sids: new Set(g ? g.sids : []), course: g ? g.course : (c.K.settings.lastCourse || c.K.settings.courses[0]?.id) };
  const body = h('div', { class: 'dlg-body kvdlg' });
  const paint = () => body.replaceChildren(
    h('div', { class: 'field' }, `Élèves (${st.sids.size})`, h('div', { class: 'kvpick' }, c.students.filter((x) => !busy.has(x.id) || st.sids.has(x.id)).map((x) =>
      h('button', { type: 'button', class: `kvchip ${st.sids.has(x.id) ? 'on' : ''}`, onClick: () => { st.sids.has(x.id) ? st.sids.delete(x.id) : st.sids.add(x.id); paint(); } }, studentLabel(x))))),
    h('div', { class: 'field' }, 'Parcours', h('div', { class: 'kvpick' }, c.K.settings.courses.map((x) =>
      h('button', { type: 'button', class: `kvchip course ${st.course === x.id ? 'on' : ''}`, onClick: () => { st.course = x.id; paint(); } }, x.name, h('small', null, ` ${x.balises} balises`))))));
  paint();
  const save = (start) => () => {
    if (!st.sids.size) { toast('Choisissez au moins un élève.'); return false; }
    apply(() => {
      c.K.settings.lastCourse = st.course;
      if (g) { g.sids = [...st.sids]; if (g.course !== st.course) { g.course = st.course; g.sought = KV.courseOf(c.K, st.course).balises || g.sought; } }
      else { const ng = KV.addGroup(c.K, s, [...st.sids], st.course); if (start) { KV.go(ng); buzz('tap'); } }
    });
  };
  openDialog({ title: g ? `Groupe ${g.n}` : 'Nouveau groupe', body, wide: true, actions: g ? [{ label: 'Annuler' }, { label: 'Enregistrer', primary: true, onClick: save(false) }]
    : [{ label: 'Annuler' }, { label: 'Prêt', primary: true, onClick: save(false) }] }); // le départ se fait par le GO de la carte
}

const stepper = (val, set, { min = 0, max = 99, unit = '' } = {}) => h('div', { class: 'stepper big' },
  h('button', { type: 'button', 'aria-label': 'Moins', disabled: val <= min, onClick: () => set(Math.max(min, val - 1)) }, icon('minus', 20)),
  h('output', null, `${val}${unit}`),
  h('button', { type: 'button', 'aria-label': 'Plus', disabled: val >= max, onClick: () => set(Math.min(max, val + 1)) }, icon('plus', 20)));

function resultDialog(c, g, apply) {
  const st = { found: g.found ?? g.sought ?? 0, sought: g.sought ?? KV.courseOf(c.K, g.course).balises ?? 0 };
  const body = h('div', { class: 'dlg-body kvdlg' });
  const paint = () => body.replaceChildren(
    h('p', { class: 'kvnames' }, g.sids.map(c.name).join(' · ')),
    h('div', { class: 'field' }, 'Balises validées', stepper(st.found, (v) => { st.found = v; paint(); }, { max: st.sought })),
    h('div', { class: 'field' }, 'Balises cherchées', stepper(st.sought, (v) => { st.sought = v; st.found = Math.min(st.found, v); paint(); }, { min: 1 })),
    h('p', { class: 'muted small' }, `Malus : ${c.K.settings.malusMin} min par balise manquée.`));
  paint();
  openDialog({ title: `Groupe ${g.n} · ${KV.courseOf(c.K, g.course).name}`, body, actions: [
    { label: 'Pas encore rentré', onClick: () => apply(() => KV.undoArrive(g)) },
    { label: 'Enregistrer', primary: true, onClick: () => apply(() => { g.found = st.found; g.sought = st.sought; }) }] });
}

function settingsDialog(c) {
  kivaouSettingsDialog(c.K.settings, (S) => { c.K.settings = S; render(); c.save(); }, c.act.name);
}
/** Réglages Kivaou (utilisés aussi par Réglages › Préréglages de l'équipe EPS). */
export function kivaouSettingsDialog(initial, onSave, activityName = null, { presetOnly = false } = {}) {
  const S = JSON.parse(JSON.stringify(initial));
  let asPreset = presetOnly;
  const body = h('div', { class: 'dlg-body kvdlg' });
  const paint = () => body.replaceChildren(
    h('div', { class: 'field' }, 'Temps maximum', stepper(S.maxMin, (v) => { S.maxMin = v; paint(); }, { min: 1, max: 120, unit: ' min' })),
    h('div', { class: 'field' }, 'Malus par balise manquée', stepper(S.malusMin, (v) => { S.malusMin = v; paint(); }, { min: 0, max: 30, unit: ' min' })),
    h('label', { class: 'row' }, h('input', { type: 'checkbox', checked: S.grouped, style: { width: '22px', height: '22px' }, onChange: (e) => { S.grouped = e.target.checked; } }), h('span', null, 'Départ groupé : un seul GO lance le chrono de toute la classe')),
    h('div', { class: 'field' }, 'Parcours et nombre de balises',
      ...S.courses.map((x, i) => h('div', { class: 'listrow' },
        h('input', { type: 'text', value: x.name, 'aria-label': 'Nom du parcours', style: { flex: 1 }, onChange: (e) => { x.name = e.target.value.trim() || x.name; } }),
        stepper(x.balises, (v) => { x.balises = v; paint(); }, { min: 1, max: 40, unit: ' bal.' }),
        iconBtn('trash', 'Retirer', () => { S.courses.splice(i, 1); paint(); }, 'sm', { disabled: S.courses.length <= 1 }))),
      btn('Ajouter un parcours', { icon: 'plus', cls: 'small soft', onClick: () => { S.courses.push({ id: uid(), name: `Boucle ${String.fromCharCode(65 + S.courses.length - 1)}`, balises: 6 }); paint(); } })),
    activityName && !presetOnly ? h('label', { class: 'row presetcheck' }, h('input', { type: 'checkbox', checked: asPreset, style: { width: '22px', height: '22px' }, onChange: (e) => { asPreset = e.target.checked; } }),
      h('span', null, `Enregistrer aussi comme préréglage de l'équipe EPS pour « ${activityName} »`)) : '');
  paint();
  openDialog({ title: presetOnly ? `Préréglage Kivaou · ${activityName}` : 'Réglages Kivaou', body, wide: true, actions: [{ label: 'Annuler' }, { label: 'Enregistrer', primary: true, onClick: async () => {
    if (asPreset && activityName) { const P = JSON.parse(JSON.stringify(S)); delete P.lastCourse; await savePreset(activityName, 'kivaou', P); }
    onSave(S);
  } }] });
}

// ---------- Bilan ----------

export function bilanNode(c, s, interactive = false) {
  const mode = interactive ? V.sortBy : 'rank';
  const seg = interactive ? h('div', { class: 'seg' }, [['rank', 'Classement'], ['group', 'Par groupe'], ['course', 'Par parcours'], ['all', 'Depuis le début']].map(([k, l]) => h('button', { type: 'button', class: mode === k ? 'on' : '', onClick: () => { V.sortBy = k; render(); } }, l))) : null;
  const sessions = [...c.K.sessions].filter((x) => x.groups.length).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.createdAt || 0) - (a.createdAt || 0)));
  const label = (x) => { const same = sessions.filter((y) => y.date === x.date); return `Séance du ${fmtDate(x.date)}${same.length > 1 ? ` (${same.length - same.indexOf(x)})` : ''}`; };
  if (mode === 'all') {
    const rows = KV.overall(c.K, c.students.map((x) => x.id));
    return h('div', null, h('div', { class: 'row wrap', style: { marginBottom: '10px' } }, seg, h('span', { class: 'muted small' }, `${sessions.length} séance(s) · une ligne par élève`)),
      h('div', { style: { overflowX: 'auto' } }, h('table', { class: 'edit restab kvtab' },
        h('thead', null, h('tr', null, ['Élève', 'Sorties', 'Parcours faits', 'Balises', 'Meilleur temps', 'Hors temps'].map((x) => h('th', null, x)))),
        h('tbody', null, rows.map((x) => h('tr', null, h('td', null, c.name(x.sid)), h('td', null, String(x.runs || '–')), h('td', null, x.courses || '–'),
          h('td', null, x.sought ? `${x.found}/${x.sought}` : '–'), h('td', null, x.best != null ? mmss(x.best) : '–'), h('td', null, x.late ? String(x.late) : '–')))))));
  }
  const rows = KV.bilan(c.K, s);
  if (!rows.length) return h('div', null, interactive ? h('div', { class: 'row wrap', style: { marginBottom: '10px' } }, seg) : null, h('p', { class: 'muted' }, 'Pas encore de groupe pour cette séance.'));
  if (mode === 'group') rows.sort((a, b) => a.group - b.group || collator.compare(c.name(a.sid), c.name(b.sid)));
  if (mode === 'course') rows.sort((a, b) => collator.compare(a.course, b.course) || (a.done - b.done) * -1 || (a.late - b.late) || (a.total - b.total));
  // par parcours : rang recalculé dans chaque parcours
  if (mode === 'course') { const by = {}; for (const x of rows) { if (!x.done) continue; by[x.course] ??= []; by[x.course].push(x); } for (const list of Object.values(by)) list.forEach((x, i) => { x.crank = i > 0 && list[i - 1].total === x.total && list[i - 1].late === x.late ? list[i - 1].crank : i + 1; }); }
  const names = (gid) => s.groups.find((g) => g.id === gid)?.sids.map(c.name).join(', ');
  return h('div', null,
    interactive ? h('div', { class: 'row wrap', style: { marginBottom: '10px' } },
      sessions.length > 1 ? h('select', { 'aria-label': 'Séance', onChange: (e) => { V.sessionId = e.target.value; render(); } }, sessions.map((x) => h('option', { value: x.id, selected: x.id === s.id }, label(x)))) : null,
      seg, h('span', { class: 'muted small' }, `Total = temps + ${c.K.settings.malusMin} min par balise manquée · hors temps : toujours derniers`)) : null,
    h('div', { style: { overflowX: 'auto' } }, h('table', { class: 'edit restab kvtab' },
      h('thead', null, h('tr', null, ['Rang', 'Élève', 'Avec', 'Parcours', 'Temps', 'Balises', 'Total'].map((x) => h('th', null, x)))),
      h('tbody', null, rows.map((x, i) => h('tr', { class: `${x.late ? 'late' : ''} ${(mode === 'group' && i && rows[i - 1].group !== x.group) || (mode === 'course' && i && rows[i - 1].course !== x.course) ? 'sep' : ''}` },
        h('td', null, x.done ? (x.late ? 'H.T.' : String(mode === 'course' ? x.crank : x.rank)) : '–'), h('td', null, h('b', null, c.name(x.sid))),
        h('td', { class: 'muted' }, (names(x.gid) || '').split(', ').filter((n) => n !== c.name(x.sid)).join(', ') || '–'), h('td', null, x.course),
        h('td', null, x.done ? mmss(x.time) : 'dehors'), h('td', null, x.found != null ? `${x.found}/${x.sought}` : '–'),
        h('td', null, x.done ? h('b', null, mmss(x.total)) : '–')))))));
}

/** Onglet « Résultats » de la classe : un tableau par séance Kivaou de l'activité. */
export function kivaouResults(cls, act) {
  if (!act.kivaou?.sessions?.some((s) => s.groups.some((g) => g.end))) return [];
  const c = ctxFor({ classId: cls.id, actId: act.id });
  return [...act.kivaou.sessions].filter((s) => s.groups.some((g) => g.end)).sort((a, b) => (a.date < b.date ? 1 : -1))
    .map((s) => h('div', { class: 'ldres' }, h('h3', null, `${act.name} · Kivaou · ${fmtDate(s.date)}`), bilanNode(c, s, false)));
}
