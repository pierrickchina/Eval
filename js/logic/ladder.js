// Tables (tennis de table) et Rings (boxe, combat) : montante-descendante sur 8 tables / rings au plus.
// Données rangées dans l'activité : act.ladders[kind] = { duos: [{ id, a, b }], sessions: [séance] }.
// Séance : { id, date, unit: 'solo'|'duo', format: 'simple'|'duos'|'ronde', place: 'libre'|'niveau'|'resultats',
//            tables: [{ n, units: [uid] }], pool: [uid] (à placer), inapte: [sid], ranking: { [n]: [uid] }, createdAt }.
// Une « unité » est un élève (sid) ou un duo (« d:<id> »). Le classement d'une séance ne change rien à cette séance :
// il sert à créer la suivante (le 1er monte, le dernier descend, les autres restent).
import { uid, now } from '../util.js';

export const MAX_TABLES = 8;
export const KINDS = {
  tables: { label: 'Tables', one: 'Table', ones: 'tables', icon: 'racket', duos: true },
  rings: { label: 'Rings', one: 'Ring', ones: 'rings', icon: 'ring', duos: false },
};
export const FORMATS = {
  simple: { label: 'Simple', hint: '3 à 4 joueurs par table (5 à éviter)', unit: 'solo', min: 3, max: 4 },
  duos: { label: 'Duos', hint: '2 duos par table', unit: 'duo', min: 2, max: 2 },
  ronde: { label: 'Ronde à l\'italienne', hint: '3 à 4 équipes de 2 par table', unit: 'duo', min: 3, max: 4 },
};
export const PLACES = {
  libre: 'Tables libres (vous placez, par glisser-déposer)',
  niveau: 'Par niveau moyen (toutes les séances)',
  resultats: 'D\'après les résultats de la dernière séance',
};
export const DUO_MODES = {
  keep: 'Garder les duos actuels (modifiables)',
  libre: 'Duos libres (je les forme moi-même)',
  mixte: 'Duos mixtes (un plus fort + un moins fort), duos de même niveau entre eux',
  homogene: 'Duos homogènes (deux joueurs de même niveau)',
};

export const ladderOf = (act, kind) => {
  act.ladders ??= {};
  return (act.ladders[kind] ??= { duos: [], sessions: [] });
};
export const isDuo = (u) => typeof u === 'string' && u.startsWith('d:');
export const duoId = (u) => u.slice(2);
export const duoUnit = (d) => `d:${d.id}`;
export const membersOf = (L, u) => (isDuo(u) ? (() => { const d = L.duos.find((x) => x.id === duoId(u)); return d ? [d.a, d.b].filter(Boolean) : []; })() : [u]);
export const sortedSessions = (L) => [...L.sessions].sort((a, b) => String(a.date).localeCompare(String(b.date)) || a.createdAt - b.createdAt);
export const lastSession = (L, exceptId = null) => sortedSessions(L).filter((s) => s.id !== exceptId).at(-1) || null;

/** Tailles des tables : n unités sur k tables (k ≤ max), les plus grosses en haut. */
export function tableSizes(n, { min = 3, max = 4, maxTables = MAX_TABLES } = {}) {
  if (n <= 0) return [];
  let k = Math.min(maxTables, Math.max(1, Math.ceil(n / max)));
  while (k > 1 && n / k < Math.min(min, 2)) k--; // jamais un joueur seul à une table
  const base = Math.floor(n / k), extra = n % k;
  return Array.from({ length: k }, (_, i) => base + (i < extra ? 1 : 0));
}

/**
 * Niveau moyen de chaque élève sur les séances passées : 0 = toujours à la table du haut, 1 = toujours en bas.
 * Le rang dans la table affine un peu (le 1er d'une table est légèrement au-dessus du dernier).
 */
export function levelMap(L, { before = null } = {}) {
  const acc = new Map();
  for (const s of sortedSessions(L)) {
    if (before && s.id === before) break;
    const T = s.tables.filter((t) => t.units.length).length;
    s.tables.filter((t) => t.units.length).forEach((t, i) => {
      const r = s.ranking?.[t.n] || [];
      for (const u of t.units) {
        const ri = r.indexOf(u);
        const within = ri >= 0 && t.units.length > 1 ? ri / (t.units.length - 1) : 0.5;
        const pos = T > 1 ? (i + within * 0.9) / (T - 0.1) : within;
        for (const sid of membersOf(L, u)) { const a = acc.get(sid) || [0, 0]; a[0] += Math.min(1, pos); a[1]++; acc.set(sid, a); }
      }
    });
  }
  return new Map([...acc].map(([k, [s, n]]) => [k, s / n]));
}
const lv = (map, sid) => (map.has(sid) ? map.get(sid) : 0.5);
const unitLevel = (L, map, u) => { const ms = membersOf(L, u); return ms.length ? ms.reduce((a, sid) => a + lv(map, sid), 0) / ms.length : 0.5; };

/** Mélange déterministe si une graine est donnée (tests), sinon aléatoire. */
function shuffle(a, rnd = Math.random) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }

/** Forme les duos : mixtes (fort + faible) ou homogènes (voisins de niveau). Un nombre impair laisse un élève seul (duo incomplet). */
export function makeDuos(sids, map, mode = 'mixte', rnd = Math.random) {
  const sorted = shuffle(sids, rnd).sort((a, b) => lv(map, a) - lv(map, b));
  const out = [];
  if (mode === 'homogene') for (let i = 0; i < sorted.length; i += 2) out.push({ id: uid(), a: sorted[i], b: sorted[i + 1] || null });
  else { const n = sorted.length; for (let i = 0; i < Math.ceil(n / 2); i++) { const j = n - 1 - i; out.push({ id: uid(), a: sorted[i], b: j > i ? sorted[j] : null }); } }
  return out;
}

/** Répartit des unités triées (meilleures d'abord) sur des tables numérotées 1…k. */
function fill(units, sizes) {
  const tables = []; let k = 0;
  sizes.forEach((sz, i) => { tables.push({ n: i + 1, units: units.slice(k, k + sz) }); k += sz; });
  return tables;
}

/** Qui monte / qui descend d'une table : le 1er dès qu'il est rangé ; le dernier seulement si le classement est complet. */
export function movers(s, t) {
  const r = (s.ranking?.[t.n] || []).filter((u) => t.units.includes(u));
  if (t.units.length < 2) return { first: null, last: null };
  return { first: r[0] || null, last: r.length === t.units.length ? r.at(-1) : null };
}

/**
 * Montée-descente : à partir de la séance précédente et de son classement. Le 1er de chaque table monte d'une table,
 * le dernier descend, les autres restent. Les unités absentes de `present` sont retirées ; les nouvelles sont ajoutées
 * à la table dont le niveau est le plus proche, puis les tables vides disparaissent.
 */
export function promote(prev, present, { L, map } = {}) {
  const tabs = prev.tables.filter((t) => t.units.length).map((t) => ({ n: t.n, units: t.units.slice() }));
  const k = tabs.length;
  const next = tabs.map(() => []);
  tabs.forEach((t, i) => {
    const { first, last } = movers(prev, t);
    for (const u of t.units) {
      if (u === first && i > 0) next[i - 1].push(u);
      else if (u === last && i < k - 1) next[i + 1].push(u);
      else next[i].push(u);
    }
  });
  const keep = new Set(present);
  let tables = next.map((us) => us.filter((u) => keep.has(u)));
  const placed = new Set(tables.flat());
  const fresh = present.filter((u) => !placed.has(u));
  for (const u of fresh) {
    const want = Math.min(tables.length - 1, Math.max(0, Math.round(unitLevel(L, map, u) * (tables.length - 1))));
    (tables[want] ||= []).push(u);
  }
  tables = tables.filter((us) => us && us.length);
  return tables.map((units, i) => ({ n: i + 1, units }));
}

/**
 * Crée une séance. opts : { kind, date, format, place, count (tables souhaitées, facultatif), duoMode, students: [sid présents] }.
 * Pour les duos, L.duos est mis à jour (formés ou complétés).
 */
export function newSession(L, opts, rnd = Math.random) {
  const f = FORMATS[opts.format] || FORMATS.simple;
  const present = opts.students.slice();
  const map = levelMap(L);
  const prev = lastSession(L);
  let units;
  if (f.unit === 'duo') {
    const set = new Set(present);
    if (opts.duoMode && opts.duoMode !== 'keep' && opts.duoMode !== 'libre') L.duos = makeDuos(present, map, opts.duoMode, rnd);
    else {
      // garder les duos : retirer les élèves partis, former des duos avec ceux qui n'en ont pas
      L.duos = L.duos.map((d) => ({ ...d, a: set.has(d.a) ? d.a : null, b: set.has(d.b) ? d.b : null })).map((d) => (d.a ? d : { ...d, a: d.b, b: null })).filter((d) => d.a);
      const inDuo = new Set(L.duos.flatMap((d) => [d.a, d.b]));
      const loose = present.filter((s) => !inDuo.has(s));
      const singles = L.duos.filter((d) => !d.b);
      for (const s of loose) { const d = singles.shift(); if (d) d.b = s; else { const nd = { id: uid(), a: s, b: null }; L.duos.push(nd); singles.push(nd); } }
    }
    units = L.duos.map(duoUnit);
  } else units = present;
  const maxTables = Math.min(MAX_TABLES, opts.count || MAX_TABLES);
  let tables, pool = [];
  const comparable = prev && prev.unit === f.unit;
  if (opts.place === 'resultats' && comparable) {
    tables = promote(prev, units, { L, map });
    // trop de tables (réglage plus petit) : on fusionne par le bas
    while (tables.length > maxTables) { const extra = tables.pop(); tables.at(-1).units.push(...extra.units); }
  } else if (opts.place === 'libre') {
    const k = Math.max(1, Math.min(maxTables, opts.count || tableSizes(units.length, { ...f, maxTables }).length));
    tables = Array.from({ length: k }, (_, i) => ({ n: i + 1, units: [] }));
    pool = units.slice();
  } else {
    const sorted = shuffle(units, rnd).sort((a, b) => unitLevel(L, map, a) - unitLevel(L, map, b));
    tables = fill(sorted, tableSizes(sorted.length, { min: f.min, max: f.max, maxTables }));
  }
  const s = { id: uid(), date: opts.date, unit: f.unit, format: opts.format, place: opts.place === 'resultats' && !comparable ? 'niveau' : opts.place, tables, pool, inapte: [], ranking: {}, createdAt: now() };
  L.sessions.push(s);
  return s;
}

/** Déplace une unité vers une table (n), vers « à placer » (n = 'pool'). */
export function moveUnit(s, u, n) {
  for (const t of s.tables) t.units = t.units.filter((x) => x !== u);
  s.pool = (s.pool || []).filter((x) => x !== u);
  for (const k of Object.keys(s.ranking)) s.ranking[k] = s.ranking[k].filter((x) => x !== u);
  if (n === 'pool') s.pool.push(u);
  else { let t = s.tables.find((x) => x.n === n); if (!t) { t = { n, units: [] }; s.tables.push(t); s.tables.sort((a, b) => a.n - b.n); } t.units.push(u); }
}

/**
 * Élève inapte / absent : il quitte sa table (ou son duo reste avec le partenaire) et va dans la case « Inapte ».
 * Une table qui n'a plus qu'un joueur (ou un duo) est regroupée avec la table voisine.
 */
export function setInapte(L, s, sid, on = true) {
  s.inapte = (s.inapte || []).filter((x) => x !== sid);
  if (!on) {
    // retour : dans sa table (duo) ou à la table la moins remplie
    const d = s.unit === 'duo' ? L.duos.find((x) => x.a === sid || x.b === sid) : null;
    const u = d ? duoUnit(d) : sid;
    if (s.tables.some((t) => t.units.includes(u)) || (s.pool || []).includes(u)) return;
    const t = [...s.tables].sort((a, b) => a.units.length - b.units.length || a.n - b.n)[0];
    if (t) t.units.push(u); else s.tables.push({ n: 1, units: [u] });
    return;
  }
  s.inapte.push(sid);
  if (s.unit === 'duo') {
    const d = L.duos.find((x) => x.a === sid || x.b === sid);
    if (!d) return;
    const other = d.a === sid ? d.b : d.a;
    if (other && !s.inapte.includes(other)) return; // le partenaire joue seul pour le duo
    moveUnit(s, duoUnit(d), 'pool'); s.pool = s.pool.filter((x) => x !== duoUnit(d));
  } else { moveUnit(s, sid, 'pool'); s.pool = s.pool.filter((x) => x !== sid); }
  readapt(s);
}
/** Unité (élève ou duo) d'un élève dans une séance, qu'elle soit placée ou non. */
export function unitOfStudent(L, s, sid) {
  if (s.unit !== 'duo') return sid;
  const d = L.duos.find((x) => x.a === sid || x.b === sid);
  return d ? duoUnit(d) : null;
}

/** Les tables trop petites (1 unité) rejoignent la table voisine ; numérotation conservée du haut vers le bas. */
export function readapt(s) {
  const tabs = s.tables.filter((t) => t.units.length);
  for (let i = 0; i < tabs.length; i++) {
    if (tabs.length > 1 && tabs[i].units.length === 1) {
      const j = i < tabs.length - 1 ? i + 1 : i - 1;
      tabs[j].units.push(...tabs[i].units); tabs[i].units = [];
      for (const k of Object.keys(s.ranking)) if (Number(k) === tabs[i].n) delete s.ranking[k];
    }
  }
  s.tables = s.tables.filter((t) => t.units.length || s.place === 'libre');
}

/** Classement final d'une table : ordre de passage (1er, 2e…). Le dernier se complète tout seul. */
export function rankTap(s, n, u) {
  const t = s.tables.find((x) => x.n === n); if (!t) return;
  const r = (s.ranking[n] ||= []);
  if (r.includes(u)) { s.ranking[n] = r.slice(0, r.indexOf(u)); return; } // retoucher = revenir à ce rang
  r.push(u);
  const left = t.units.filter((x) => !r.includes(x));
  if (left.length === 1) r.push(left[0]);
}

/** Tableau général : pour chaque élève, la table de chaque séance et son niveau moyen. */
export function overview(L, sids) {
  const sessions = sortedSessions(L);
  const map = levelMap(L);
  const rows = sids.map((sid) => ({
    sid,
    cells: sessions.map((s) => {
      if ((s.inapte || []).includes(sid)) return { inapte: true };
      const t = s.tables.find((x) => x.units.some((u) => membersOf(L, u).includes(sid)));
      if (!t) return null;
      const u = t.units.find((x) => membersOf(L, x).includes(sid));
      const r = s.ranking?.[t.n] || [];
      return { n: t.n, rank: r.includes(u) ? r.indexOf(u) + 1 : null, of: t.units.length };
    }),
    level: map.has(sid) ? map.get(sid) : null,
  }));
  return { sessions, rows };
}

/** Palier atteint sur la séquence, pour l'évaluation : derniers / intermédiaires / hauts. */
export function tierOf(level) {
  if (level == null) return null;
  return level <= 0.34 ? 'haut' : level < 0.67 ? 'milieu' : 'bas';
}
const TIER_LEVEL = { haut: 'ac', milieu: 'ec', bas: 'na' };
const TIER_TEXT = { tables: { haut: 'tables hautes', milieu: 'tables intermédiaires', bas: 'tables basses' }, rings: { haut: 'rings hauts', milieu: 'rings intermédiaires', bas: 'rings bas' } };

/** Suggestion pour la compétence « Performance » d'une évaluation (activité de l'évaluation, Rings puis Tables). */
export function ladderSuggestion(repo, ev, sid) {
  const cls = repo.get('classes', ev.classId);
  const act = cls?.activities?.find((a) => a.id === ev.activityId);
  if (!act?.ladders) return null;
  for (const kind of ['rings', 'tables']) {
    const L = act.ladders[kind];
    if (!L?.sessions?.length) continue;
    const m = levelMap(L);
    if (!m.has(sid)) continue;
    const tier = tierOf(m.get(sid));
    const n = L.sessions.filter((s) => s.tables.some((t) => t.units.some((u) => membersOf(L, u).includes(sid)))).length;
    return { level: TIER_LEVEL[tier], tier, why: `${TIER_TEXT[kind][tier]} sur ${n} séance${n > 1 ? 's' : ''} (${KINDS[kind].label}).` };
  }
  return null;
}
