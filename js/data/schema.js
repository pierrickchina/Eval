// Constantes et fabriques du modèle de données.
import { uid, now, roundTo, schoolYear } from '../util.js';

export const SCHEMA_VERSION = 1;
export const SCHOOL_LEVELS = ['6e', '5e', '4e', '3e', 'Autres'];
export const TOTAL_POINTS = 20;
export const DEFAULT_STEP = 0.5;

export const LEVELS = [
  { key: 'na', label: 'Non acquis', short: 'NA', symbol: '✕' },
  { key: 'ec', label: "En cours d'acquisition", short: 'EC', symbol: '≈' },
  { key: 'ac', label: 'Acquis', short: 'A', symbol: '✓' },
  { key: 'de', label: 'Dépassé', short: 'D', symbol: '★' },
];
export const LEVEL_KEYS = LEVELS.map((l) => l.key);
export const levelInfo = (k) => LEVELS.find((l) => l.key === k);

export const STATUSES = [
  { key: 'present', label: 'Présent', short: '' },
  { key: 'absent', label: 'Absent', short: 'ABS' },
  { key: 'dispense', label: 'Dispensé', short: 'DISP' },
  { key: 'nonEvalue', label: 'Non évalué', short: 'N.É.' },
];

export const CLASS_COLORS = [
  '#f4a6b7', '#f7c59f', '#f6e38f', '#b7e3a7', '#9fdcd0',
  '#a5d0f2', '#b9b7f2', '#d9b4ee', '#f2b5dc', '#c9c9d3',
];

/**
 * Niveaux de réussite par défaut pour un barème donné (en points, sur la grille du pas).
 * Plages sans chevauchement ; « Dépassé » = barème maximal.
 */
export function defaultLevels(max, step = DEFAULT_STEP) {
  const r = (f) => roundTo(Math.min(max, Math.max(0, f * max)), step);
  const naMax = Math.max(0, r(0.4) - step);
  const ecMin = Math.min(r(0.4), max);
  const ecMax = Math.max(ecMin, r(0.7) - step);
  const acMin = Math.min(Math.max(r(0.7), ecMax), max);
  const acMax = Math.max(acMin, Math.min(r(0.9), max));
  return [
    { key: 'na', text: '', min: 0, max: naMax, value: Math.min(r(0.2), naMax) },
    { key: 'ec', text: '', min: ecMin, max: ecMax, value: Math.min(Math.max(r(0.55), ecMin), ecMax) },
    { key: 'ac', text: '', min: acMin, max: acMax, value: Math.min(Math.max(r(0.8), acMin), acMax) },
    { key: 'de', text: '', min: max, max: max, value: max },
  ];
}

export function newCompetence(max = 5, step = DEFAULT_STEP) {
  return { id: uid(), name: '', afc: '', max, coef: 1, levels: defaultLevels(max, step) };
}

export function newModel() {
  return { id: uid(), name: '', activity: '', levels: {}, createdAt: now() };
}

export function newClass(name = '', level = '6e', color = CLASS_COLORS[0]) {
  return { id: uid(), name, level, color, year: schoolYear(), students: [], createdAt: now() };
}

export function newStudent(first = '', initial = '') {
  return { id: uid(), first, initial, active: true, joinedAt: now() };
}

export const studentLabel = (s) => (s.initial ? `${s.first} ${s.initial.toUpperCase()}.` : s.first);
