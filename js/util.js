// Utilitaires sans dépendance au DOM (utilisables dans les tests Node).

export const uid = () =>
  globalThis.crypto?.randomUUID
    ? crypto.randomUUID()
    : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);

export const now = () => Date.now();
export const clone = (o) => structuredClone(o);
export const r4 = (n) => Math.round(n * 10000) / 10000;
export const roundTo = (v, step) => r4(Math.round(v / step) * step);

export const fmt = (n, max = 2) =>
  n == null || Number.isNaN(n)
    ? '–'
    : Number(n).toLocaleString('fr-FR', { maximumFractionDigits: max });

/** Lit un nombre saisi (virgule ou point). Renvoie NaN si invalide. */
export function parseNum(s) {
  if (typeof s === 'number') return s;
  if (s == null) return NaN;
  const t = String(s).trim().replace(/\s/g, '').replace(',', '.');
  if (t === '') return NaN;
  return Number(t);
}

export const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true });

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function debounce(fn, ms) {
  let t;
  const wrapped = (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
  wrapped.cancel = () => clearTimeout(t);
  return wrapped;
}

/** Année scolaire courante, ex. "2026-2027" (bascule en août). */
export function schoolYear(date = new Date()) {
  const y = date.getFullYear();
  const start = date.getMonth() >= 7 ? y : y - 1;
  return `${start}-${start + 1}`;
}

export function nextSchoolYear(label) {
  const m = /^(\d{4})-(\d{4})$/.exec(label || '');
  if (!m) return schoolYear(new Date(new Date().getFullYear() + 1, 8, 1));
  return `${+m[1] + 1}-${+m[2] + 1}`;
}
