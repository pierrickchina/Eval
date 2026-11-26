// Calculs d'une évaluation : cellules, totaux sur 20, moyennes, statuts.
import { now, r4, roundTo } from '../util.js';
import { levelForScore, proposedScore } from './model.js';

export const getCell = (ev, sid, cid) => ev.results?.[sid]?.[cid] || null;
export const getStatus = (ev, sid) => ev.status?.[sid] || 'present';

/** 'empty' (rien) | 'draft' (renseignée, non validée) | 'validated' */
export function cellState(cell) {
  if (!cell || cell.score == null) return 'empty';
  return cell.validated ? 'validated' : 'draft';
}

function ensureCell(ev, sid, cid) {
  ev.results ??= {};
  ev.results[sid] ??= {};
  return (ev.results[sid][cid] ??= { level: null, score: null, validated: false, u: 0 });
}

const compOf = (ev, cid) => ev.model.competences.find((c) => c.id === cid);

/** Choisir un niveau propose automatiquement une note ; la cellule repasse « non validée ». */
export function setLevel(ev, sid, cid, key, stamp = now()) {
  const comp = compOf(ev, cid);
  const cell = ensureCell(ev, sid, cid);
  cell.level = key;
  cell.score = proposedScore(comp, key);
  cell.validated = false;
  cell.u = stamp;
}

/** Note saisie à la main : bornée au barème, arrondie au pas, niveau recalculé, non validée. */
export function setScore(ev, sid, cid, score, stamp = now()) {
  const comp = compOf(ev, cid);
  if (score == null || Number.isNaN(score)) return clearCell(ev, sid, cid, stamp);
  const s = roundTo(Math.min(comp.max, Math.max(0, score)), ev.step || 0.5);
  const cell = ensureCell(ev, sid, cid);
  cell.score = s;
  cell.level = levelForScore(comp, s);
  cell.validated = false;
  cell.u = stamp;
}

export function validateCell(ev, sid, cid, value = true, stamp = now()) {
  const cell = getCell(ev, sid, cid);
  if (!cell || cell.score == null) return false;
  cell.validated = !!value;
  cell.u = stamp;
  return true;
}

export function clearCell(ev, sid, cid, stamp = now()) {
  const cell = ensureCell(ev, sid, cid);
  cell.level = null;
  cell.score = null;
  cell.validated = false;
  cell.u = stamp;
}

// ---- Observations « brouillon » : symboles notés en cours de séance, sans fixer le degré ----
// Stockées dans la cellule (cell.obs = ['de','ac','ac']), sans effet sur la note ni sur l'état de la cellule.

export const getObs = (ev, sid, cid) => getCell(ev, sid, cid)?.obs || [];

/** Compte les observations par niveau : { na, ec, ac, de }. */
export function obsCounts(obs) {
  const c = { na: 0, ec: 0, ac: 0, de: 0 };
  for (const k of obs || []) if (k in c) c[k]++;
  return c;
}

export function addObs(ev, sid, cid, key, stamp = now()) {
  const cell = ensureCell(ev, sid, cid);
  cell.obs = [...(cell.obs || []), key];
  cell.u = stamp;
}

/** Retire l'observation d'indice `index` (touche sur le symbole). */
export function removeObs(ev, sid, cid, index, stamp = now()) {
  const cell = getCell(ev, sid, cid);
  if (!cell?.obs || index < 0 || index >= cell.obs.length) return false;
  cell.obs = cell.obs.filter((_, i) => i !== index);
  if (!cell.obs.length) delete cell.obs;
  cell.u = stamp;
  return true;
}

/** Élève « à placer » : au moins une compétence avec des observations brouillon mais encore sans degré. */
export function toPlaceCount(ev, sid) {
  if (getStatus(ev, sid) !== 'present') return 0;
  let n = 0;
  for (const c of ev.model.competences) {
    const cell = getCell(ev, sid, c.id);
    if (cell?.obs?.length && cellState(cell) === 'empty') n++;
  }
  return n;
}

// ---- Remarque libre par élève (écriture au stylet ou clavier) ----

export const getNote = (ev, sid) => ev.notes?.[sid]?.text || '';

export function setNote(ev, sid, text, stamp = now()) {
  ev.notes ??= {};
  const t = String(text || '').trim() ? String(text) : '';
  if ((ev.notes[sid]?.text || '') === t) return; // identique : rien à enregistrer (pas de faux « modifié »)
  if (!t) { ev.notes[sid] = { text: '', u: stamp }; return; }
  ev.notes[sid] = { text: t, u: stamp };
}

export function setStatus(ev, sid, status, stamp = now()) {
  ev.status ??= {};
  ev.statusU ??= {};
  if (status === 'present') delete ev.status[sid];
  else ev.status[sid] = status;
  ev.statusU[sid] = stamp;
}

/** Totaux d'un élève. La note finale n'existe que si TOUTES les compétences sont renseignées. */
export function studentTotals(ev, sid) {
  const status = getStatus(ev, sid);
  const comps = ev.model.competences;
  let points = 0, maxFilled = 0, filled = 0, validated = 0;
  for (const c of comps) {
    const cell = getCell(ev, sid, c.id);
    if (cellState(cell) === 'empty') continue;
    points += cell.score;
    maxFilled += c.max;
    filled++;
    if (cell.validated) validated++;
  }
  const remaining = comps.length - filled;
  const complete = comps.length > 0 && remaining === 0;
  return {
    status,
    usable: status === 'present',
    points: r4(points),
    maxFilled: r4(maxFilled),
    filled,
    remaining,
    complete,
    allValidated: complete && validated === comps.length,
    final: complete ? r4(points) : null,
    provisional: filled > 0 && !complete ? r4((points / maxFilled) * 20) : null,
  };
}

/** Moyennes de classe : seuls les élèves « présents » avec des données exploitables comptent. */
export function classStats(ev) {
  const perComp = {};
  for (const c of ev.model.competences) {
    let sum = 0, n = 0;
    for (const s of ev.students) {
      if (getStatus(ev, s.id) !== 'present') continue;
      const cell = getCell(ev, s.id, c.id);
      if (cellState(cell) === 'empty') continue;
      sum += cell.score;
      n++;
    }
    perComp[c.id] = { mean: n ? r4(sum / n) : null, n, max: c.max };
  }
  let sum = 0, n = 0;
  for (const s of ev.students) {
    const t = studentTotals(ev, s.id);
    if (t.usable && t.final != null) {
      sum += t.final;
      n++;
    }
  }
  return { perComp, overall: { mean: n ? r4(sum / n) : null, n }, studentsCount: ev.students.length };
}
