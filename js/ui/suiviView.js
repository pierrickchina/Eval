// Suivi des résultats d'une activité (onglet de l'outil Équipes) et onglet « Résultats » d'une classe.
import { app, render , back as navBack } from '../app.js';
import { h, btn, icon, iconBtn, openDialog, toast } from './dom.js';
import { fmtDate, todayISO, collator } from '../util.js';
import { vestOf } from '../logic/teams.js';
import { studentLabel } from '../data/schema.js';
import { activitiesOf } from '../logic/activities.js';
import * as R from '../logic/results.js';
import { ladderResults } from './ladderView.js';
import { kivaouResults } from './kivaouView.js';

const V = { setId: '', actId: '' };
const dot = (c) => h('i', { class: 'tdot', style: { background: vestOf(c).hex } });
const saveClass = (cls) => app.repo.save('classes', cls);

// ---------- Suivi des résultats (équipes et clubs) ----------

export function suiviPanel(cls, act) {
  const sets = act.equipes?.sets || [];
  if (V.setId && !sets.some((s) => s.id === V.setId)) V.setId = '';
  const sum = R.summarize(act, { setId: V.setId || null });
  const nDone = R.doneTournaments(act).length;
  const bonusBtn = (kind, e) => iconBtn('plus', `Bonus ou malus pour ${e.name}`, () => bonusDialog(cls, act, kind, e), 'sm');
  const num = (v) => (v > 0 ? `+${v}` : String(v));
  const head = h('tr', null, ['', 'Tournois', 'V', 'N', 'D', 'Points', 'Bonus / malus', 'Total', ''].map((x) => h('th', null, x)));
  const rowOf = (e, kind, sub = false) => h('tr', { class: sub ? 'subrow' : 'clubrow' },
    h('td', { class: 'nm' }, sub ? h('span', { class: 'indent' }) : null, dot(e.color), h('b', null, e.name)),
    [e.tournaments, e.w, e.d, e.l, e.pts].map((v) => h('td', null, v)),
    h('td', null, (e.bonus || 0) + (e.teamBonus || 0) ? num((e.bonus || 0) + (e.teamBonus || 0)) : '–'),
    h('td', null, h('b', null, e.total)), h('td', null, bonusBtn(kind, e)));
  const body = [];
  for (const c of sum.clubs) { body.push(rowOf(c, 'club')); for (const t of c.teams.sort((a, b) => collator.compare(a.name, b.name))) body.push(rowOf(t, 'team', true)); }
  for (const t of sum.teams) body.push(rowOf(t, 'team'));
  return h('div', { class: 'scroll grow listpad', 'data-keep': 'suivi' },
    h('div', { class: 'row wrap', style: { marginBottom: '10px' } },
      h('label', { class: 'row' }, 'Afficher', h('select', { 'aria-label': 'Période', onChange: (e) => { V.setId = e.target.value; render(); } },
        h('option', { value: '' }, 'Tout le cycle'), sets.map((s) => h('option', { value: s.id, selected: V.setId === s.id }, `Seulement : ${s.name}`)))),
      h('span', { class: 'muted small' }, `${nDone} tournoi${nDone > 1 ? 's' : ''} terminé${nDone > 1 ? 's' : ''}. Les tournois en cours comptent dès qu'ils sont terminés.`)),
    body.length ? h('div', { class: 'panel' }, h('table', { class: 'edit suivitab' }, h('thead', null, head), h('tbody', null, body)))
      : h('div', { class: 'empty' }, h('h2', null, 'Pas encore de résultats'), h('p', null, 'Terminez un tournoi de cette activité (outil Tournoi) : les victoires, égalités, défaites et points de chaque équipe et de chaque club apparaîtront ici. Vous pourrez aussi accorder un bonus ou un malus.')),
    sum.clubs.length ? h('p', { class: 'muted small' }, 'Le résultat d\'un club est la somme de ses équipes ; les équipes restent les mêmes d\'une leçon à l\'autre, même si des élèves changent.') : null);
}

function bonusDialog(cls, act, kind, e) {
  const st = { sign: 1, pts: 1, reason: '' };
  const body = h('div', { class: 'dlg-body', style: { padding: 0 } });
  const paint = () => {
    const list = R.bonusesFor(act, kind, e.id);
    body.replaceChildren(...[
      h('div', { class: 'row wrap' },
        h('div', { class: 'seg' }, [[1, 'Bonus +'], [-1, 'Malus −']].map(([k, l]) => h('button', { type: 'button', class: st.sign === k ? 'on' : '', onClick: () => { st.sign = k; paint(); } }, l))),
        h('input', { type: 'number', inputmode: 'numeric', min: 1, max: 99, value: st.pts, style: { width: '80px' }, 'aria-label': 'Points', onChange: (ev) => { st.pts = Math.max(1, parseInt(ev.target.value, 10) || 1); } })),
      h('label', { class: 'field' }, 'Motif (court)', h('input', { type: 'text', placeholder: 'fair-play, retard…', value: st.reason, onInput: (ev) => { st.reason = ev.target.value; } })),
      list.length ? h('div', null, h('div', { class: 'muted small' }, 'Déjà accordés'), ...list.map((b) => h('div', { class: 'listrow' }, h('b', null, b.pts > 0 ? `+${b.pts}` : b.pts), h('span', { class: 'grow' }, b.reason || '—'), h('span', { class: 'muted small' }, b.date ? fmtDate(b.date) : ''),
        iconBtn('trash', 'Retirer', async () => { R.removeBonus(act, b.id); await saveClass(cls); paint(); render(); }, 'sm')))) : null,
    ].filter(Boolean));
  };
  paint();
  openDialog({ title: `Bonus / malus — ${e.name}`, body, actions: [{ label: 'Fermer' }, { label: 'Ajouter', primary: true, keepOpen: true, onClick: async () => {
    R.addBonus(act, { kind, ref: e.id, pts: st.sign * st.pts, reason: st.reason.trim(), label: e.name, setId: V.setId || null, date: todayISO() });
    st.reason = ''; await saveClass(cls); paint(); render(); toast('Ajouté.'); return false;
  } }] });
}

// ---------- Onglet « Résultats » d'une classe ----------

export function resultsTab(cls) {
  const hasLadder = (a) => Object.values(a.ladders || {}).some((L) => L.sessions?.length);
  const hasKv = (a) => a.kivaou?.sessions?.some((s) => s.groups.some((g) => g.end));
  const acts = activitiesOf(cls).filter((a) => R.doneTournaments(a).length || hasLadder(a) || hasKv(a));
  if (V.actId && !acts.some((a) => a.id === V.actId)) V.actId = '';
  if (!acts.length) {
    return h('div', { class: 'empty' }, h('h2', null, 'Pas encore de résultats'),
      h('p', null, 'Les résultats des élèves apparaîtront ici, activité par activité : tournois terminés (outil Tournoi) et tableau général des outils Tables et Rings.'));
  }
  const shown = V.actId ? acts.filter((a) => a.id === V.actId) : acts;
  const ladders = shown.flatMap((a) => [...ladderResults(cls, a), ...kivaouResults(cls, a)]);
  const tshown = shown.filter((a) => R.doneTournaments(a).length);
  const cols = tshown.flatMap((a) => R.doneTournaments(a).sort((x, y) => (x.date < y.date ? -1 : 1)).map((t) => ({ act: a, t })));
  const students = cls.students.filter((s) => s.active !== false).sort((a, b) => collator.compare(studentLabel(a), studentLabel(b)));
  const cache = new Map(tshown.map((a) => [a.id, new Map(students.map((s) => [s.id, R.palmares(a, s.id)]))]));
  return h('div', { class: 'resultsTab scroll grow', 'data-keep': 'results' },
    h('div', { class: 'row wrap', style: { padding: '8px 14px' } },
      h('label', { class: 'row' }, 'Activité', h('select', { 'aria-label': 'Activité', onChange: (e) => { V.actId = e.target.value; render(); } }, h('option', { value: '' }, 'Toutes'), acts.map((a) => h('option', { value: a.id, selected: V.actId === a.id }, a.name)))),
      h('span', { class: 'muted small' }, 'Rang final de l\'équipe de l\'élève dans chaque tournoi (absents : pas de résultat).')),
    cols.length ? h('div', { style: { padding: '0 14px 20px', overflowX: 'auto' } }, h('table', { class: 'edit restab' },
      h('thead', null, h('tr', null, h('th', null, 'Élève'), cols.map(({ act, t }) => h('th', { title: `${act.name} · ${t.name}` }, h('div', { class: 'rh' }, act.name), h('div', { class: 'rs' }, `${t.name}${t.date ? ' · ' + fmtDate(t.date) : ''}`))))),
      h('tbody', null, students.map((s) => h('tr', null, h('td', null, studentLabel(s)),
        cols.map(({ act, t }) => { const p = cache.get(act.id).get(s.id).find((x) => x.tid === t.id); return h('td', { class: p ? '' : 'none' }, p ? [h('b', null, `${R.ordinalFr(p.rank)}`), h('span', { class: 'muted small' }, ` / ${p.of}`), h('div', { class: 'muted small' }, dotName(p))] : '–'); })))))) : null,
    ladders.length ? h('div', { style: { padding: '0 14px 20px' } }, ladders) : null,
  );
}
const dotName = (p) => [dot(p.color), p.team];
