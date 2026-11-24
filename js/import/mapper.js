// Correspondance colonnes ↔ champs, construction des compétences, contrôles.
import { parseNum, r4 } from '../util.js';
import { newCompetence } from '../data/schema.js';
import { sumMax } from '../logic/model.js';
import { setCompetenceMax } from '../logic/model.js';

export const FIELDS = [
  { key: 'name', label: 'Compétence', required: true, hints: ['compétence', 'competence', 'champ', 'intitulé', 'intitule', 'nom'] },
  { key: 'afc', label: 'AFC (attendus de fin de cycle)', hints: ['afc', 'attendu', 'fin de cycle'] },
  { key: 'max', label: 'Barème (points)', required: true, hints: ['barème', 'bareme', 'points', 'pts', 'note', '/'] },
  { key: 'coef', label: 'Coefficient', hints: ['coef', 'pondération', 'ponderation'] },
  { key: 'na', label: 'Critères — Non acquis', hints: ['non acquis', 'insuffisant', 'très insuffisant', 'niveau 1', 'maîtrise insuffisante'] },
  { key: 'ec', label: "Critères — En cours d'acquisition", hints: ['en cours', 'fragile', 'partiel', 'niveau 2', 'maîtrise fragile'] },
  { key: 'ac', label: 'Critères — Acquis', hints: ['acquis', 'satisfaisant', 'niveau 3', 'maîtrise satisfaisante'] },
  { key: 'de', label: 'Critères — Dépassé', hints: ['dépassé', 'depasse', 'très bonne', 'excellent', 'niveau 4', 'expert'] },
];

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

/** Détecte la ligne d'en-tête : la première ligne avec au moins 2 cellules non vides. */
export function guessHeaderRow(rows) {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    if (rows[i].filter((c) => String(c).trim()).length >= 2) return i;
  }
  return 0;
}

/** Propose une correspondance champ → index de colonne d'après les intitulés. */
export function guessMapping(header) {
  const map = {};
  const used = new Set();
  const order = ['na', 'ec', 'de', 'ac', 'afc', 'coef', 'max', 'name']; // les plus spécifiques d'abord
  for (const key of order) {
    const f = FIELDS.find((x) => x.key === key);
    for (let i = 0; i < header.length; i++) {
      if (used.has(i)) continue;
      const h = norm(header[i]);
      if (!h) continue;
      if (f.hints.some((k) => h.includes(norm(k)))) {
        // « acquis » ne doit pas capter « non acquis » / « en cours d'acquisition »
        if (key === 'ac' && /non acquis|en cours/.test(h)) continue;
        map[key] = i;
        used.add(i);
        break;
      }
    }
  }
  return map;
}

/**
 * Construit les compétences à partir des lignes et de la correspondance.
 * @returns {{competences, issues:[{row,field,message,blocking}]}}
 */
export function buildCompetences(rows, mapping, { headerRow = 0, step = 0.5 } = {}) {
  const issues = [];
  const competences = [];
  const oneLine = (t) => t.replace(/\s*[\r\n]+\s*/g, ' ').replace(/ {2,}/g, ' ');
  const cell = (r, key) => {
    const t = mapping[key] == null ? '' : String(r[mapping[key]] ?? '').trim();
    return key === 'name' || key === 'afc' ? oneLine(t) : t; // critères : les retours à la ligne sont conservés
  };
  for (let i = headerRow + 1; i < rows.length; i++) {
    const r = rows[i] || [];
    if (r.every((c) => !String(c ?? '').trim())) continue;
    const name = cell(r, 'name');
    const rawMax = cell(r, 'max');
    if (!name && !rawMax) continue; // ligne décorative
    const rowNo = i + 1;
    const c = newCompetence(5, step);
    c.name = name;
    c.afc = cell(r, 'afc');
    c.srcRow = rowNo;
    if (!name) issues.push({ row: rowNo, field: 'name', message: 'Nom de compétence manquant.', blocking: true });
    const max = parseNum(rawMax.replace(/^\/\s*/, ''));
    if (rawMax === '') issues.push({ row: rowNo, field: 'max', message: 'Barème manquant.', blocking: true });
    else if (!(max > 0)) issues.push({ row: rowNo, field: 'max', message: `Barème « ${rawMax} » non numérique.`, blocking: true });
    setCompetenceMax(c, max > 0 ? max : 5, step);
    c.max = max > 0 ? r4(max) : 0;
    const coef = parseNum(cell(r, 'coef'));
    c.coef = coef > 0 ? coef : 1;
    if (mapping.coef != null && cell(r, 'coef') !== '' && !(coef > 0)) {
      issues.push({ row: rowNo, field: 'coef', message: 'Coefficient invalide (1 par défaut).', blocking: false });
    }
    for (const k of ['na', 'ec', 'ac', 'de']) {
      c.levels.find((l) => l.key === k).text = cell(r, k);
    }
    if (mapping.na != null || mapping.ec != null || mapping.ac != null || mapping.de != null) {
      const empty = ['na', 'ec', 'ac', 'de'].filter((k) => !cell(r, k));
      if (empty.length === 4) issues.push({ row: rowNo, field: 'levels', message: 'Aucun critère de réussite renseigné.', blocking: false });
    }
    competences.push(c);
  }
  if (!competences.length) issues.push({ row: 0, field: 'name', message: 'Aucune compétence trouvée avec cette correspondance.', blocking: true });
  return { competences, issues };
}

export const importSum = (comps) => sumMax(comps);
