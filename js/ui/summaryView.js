// Résumé d'un élève sur l'année scolaire : moyenne, évolution par activité, niveaux, remarques.
// Pratique pour rédiger les appréciations (bouton « Copier »).
import { app , back as navBack } from '../app.js';
import { h, openDialog, toast } from './dom.js';
import { fmt, fmtDate, collator, schoolYear } from '../util.js';
import { studentLabel, levelInfo } from '../data/schema.js';
import { studentHistory, currentStudent } from '../logic/evaluation.js';
import { getNote } from '../logic/scoring.js';
import { printNode } from './printView.js';

const yearOf = (iso) => schoolYear(new Date(`${iso}T12:00:00`));

/** Calcule le résumé (sans DOM : testable). */
export function buildSummary(evals, sid, year) {
  const rows = studentHistory(evals, sid).filter((r) => yearOf(r.date) === year).map((r) => ({ ...r, sid }));
  const present = rows.filter((r) => r.totals.status === 'present');
  const finals = present.filter((r) => r.totals.final != null);
  const mean = finals.length ? finals.reduce((a, r) => a + r.totals.final, 0) / finals.length : null;
  const byAct = {};
  for (const r of rows) (byAct[r.activity] ??= []).push(r);
  const activities = Object.entries(byAct).map(([activity, rs]) => {
    const f = rs.filter((r) => r.totals.status === 'present' && r.totals.final != null);
    return {
      activity, rows: rs, count: rs.length,
      mean: f.length ? f.reduce((a, r) => a + r.totals.final, 0) / f.length : null,
      first: f[0]?.totals.final ?? null, last: f.at(-1)?.totals.final ?? null, graded: f.length,
    };
  }).sort((a, b) => collator.compare(a.activity, b.activity));
  const absences = rows.filter((r) => r.totals.status === 'absent').length;
  const dispenses = rows.filter((r) => r.totals.status === 'dispense').length;
  return { rows, mean, activities, absences, dispenses, count: rows.length, graded: finals.length };
}

const levelsText = (r) => r.comps.map(({ comp, cell }) => `${comp.name} ${cell?.level ? levelInfo(cell.level).symbol : '–'}`).join(', ');

/** Texte brut du résumé, à coller dans un appréciation ou un mail. */
export function summaryText(name, year, sum) {
  const out = [`${name} — année ${year}`];
  out.push(sum.mean != null ? `Moyenne : ${fmt(sum.mean, 1)}/20 sur ${sum.graded} évaluation(s) notée(s)` : 'Pas encore de note finale complète.');
  if (sum.absences || sum.dispenses) out.push(`Absences : ${sum.absences} · Dispenses : ${sum.dispenses}`);
  for (const a of sum.activities) {
    out.push('', `${a.activity}${a.mean != null ? ` — moyenne ${fmt(a.mean, 1)}/20` : ''}`);
    for (const r of a.rows) {
      const t = r.totals;
      const note = t.status !== 'present' ? { absent: 'absent(e)', dispense: 'dispensé(e)', nonEvalue: 'non évalué(e)' }[t.status] : t.final != null ? `${fmt(t.final)}/20` : 'incomplète';
      const remark = getNote(r.ev, r.sid);
      out.push(`- ${fmtDate(r.date)} : ${note} (${levelsText(r)})${remark ? ` — ${remark}` : ''}`);
    }
  }
  return out.join('\n');
}
export function studentSummaryDialog(sid, fromEv) {
  const repo = app.repo;
  const evals = repo.list('evaluations');
  const all = studentHistory(evals, sid);
  const cur = currentStudent(repo.list('classes'), fromEv || all.at(-1)?.ev || { students: [] }, sid);
  const name = cur ? studentLabel(cur) : 'Élève';
  const years = [...new Set(all.map((r) => yearOf(r.date)))].sort().reverse();
  const st = { year: (fromEv && years.includes(yearOf(fromEv.date)) ? yearOf(fromEv.date) : years[0]) || schoolYear() };
  const body = h('div', { class: 'dlg-body', style: { padding: 0 } });

  const paint = () => {
    const sum = buildSummary(evals, sid, st.year);
    body.replaceChildren(
      h('div', { class: 'row wrap' },
        h('label', { class: 'field', style: { minWidth: '200px' } }, 'Année scolaire',
          h('select', { value: st.year, onChange: (e) => { st.year = e.target.value; paint(); } }, (years.length ? years : [st.year]).map((y) => h('option', { value: y }, y)))),
        h('div', { class: 'grow' }),
        h('button', { type: 'button', class: 'btn', onClick: async () => {
          try { await navigator.clipboard.writeText(summaryText(name, st.year, sum)); toast('Résumé copié : collez-le où vous voulez.'); }
          catch { toast('Copie impossible sur cet appareil.'); }
        } }, 'Copier le résumé'),
        h('button', { type: 'button', class: 'btn', onClick: () => printNode(printable(name, st.year, sum)) }, 'Imprimer / PDF')),
      h('div', { class: 'sumstats' },
        h('div', { class: 'sumstat' }, h('b', null, sum.mean != null ? `${fmt(sum.mean, 1)}/20` : '–'), h('span', null, 'Moyenne de l\'année')),
        h('div', { class: 'sumstat' }, h('b', null, `${sum.graded} / ${sum.count}`), h('span', null, 'Évaluations notées')),
        h('div', { class: 'sumstat' }, h('b', null, sum.absences), h('span', null, 'Absences')),
        sum.dispenses ? h('div', { class: 'sumstat' }, h('b', null, sum.dispenses), h('span', null, 'Dispenses')) : null),
      sum.count ? sum.activities.map((a) => h('div', { class: 'panel', style: { boxShadow: 'none', border: '1px solid var(--line)', marginBottom: '10px' } },
        h('div', { class: 'row wrap' }, h('h3', { class: 'grow' }, a.activity),
          a.mean != null ? h('span', { class: 'tag' }, `moyenne ${fmt(a.mean, 1)}/20`) : null,
          a.graded >= 2 ? h('span', { class: 'tag' }, `${fmt(a.first)} → ${fmt(a.last)}`) : null),
        a.rows.map((r) => {
          const t = r.totals, remark = getNote(r.ev, sid);
          return h('div', { class: 'listrow', style: { alignItems: 'flex-start' } },
            h('span', { class: 'muted small', style: { width: '92px', flex: 'none' } }, fmtDate(r.date)),
            h('div', { class: 'grow' },
              h('div', { class: 'row wrap', style: { gap: '6px' } }, r.comps.map(({ comp, cell }) => {
                const lv = cell?.level ? levelInfo(cell.level) : null;
                return h('span', { class: `lvchip ${cell?.score != null ? cell.level || 'none' : 'none'}`, title: comp.name }, `${comp.name} ${lv ? lv.symbol : '–'}`);
              })),
              remark ? h('div', { class: 'small', style: { marginTop: '4px', whiteSpace: 'pre-wrap' } }, `✎ ${remark}`) : null),
            h('b', null, t.status !== 'present' ? { absent: 'Abs.', dispense: 'Disp.', nonEvalue: 'N.É.' }[t.status] : t.final != null ? `${fmt(t.final)}/20` : '–'));
        }))) : h('p', { class: 'muted' }, 'Aucune évaluation pour cet élève cette année.'));
  };
  openDialog({ title: `Résumé — ${name}`, body, wide: true, actions: [{ label: 'Fermer', primary: true }] });
  paint();
}

function printable(name, year, sum) {
  const noteOf = (t) => (t.status !== 'present' ? { absent: 'Abs.', dispense: 'Disp.', nonEvalue: 'N.É.' }[t.status] : t.final != null ? `${fmt(t.final)}/20` : '–');
  const block = (a) => h('div', null,
    h('h3', { style: { margin: '4mm 0 1mm' } }, `${a.activity}${a.mean != null ? ` — moyenne ${fmt(a.mean, 1)}/20` : ''}`),
    h('table', null, h('tbody', null, a.rows.map((r) => h('tr', null,
      h('td', { class: 'l' }, fmtDate(r.date)),
      h('td', { class: 'l' }, levelsText(r)),
      h('td', null, noteOf(r.totals)),
      h('td', { class: 'l' }, getNote(r.ev, r.sid)))))));
  return h('div', null,
    h('h1', null, `${name} — année ${year}`),
    h('div', { class: 'sub' }, sum.mean != null ? `Moyenne : ${fmt(sum.mean, 1)}/20 · ${sum.graded} évaluation(s) notée(s)` : 'Pas encore de note finale complète'),
    sum.activities.map(block));
}
