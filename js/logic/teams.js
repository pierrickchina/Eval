// Outil Équipes (et mode Clubs) : modèle de composition, déplacements, tirages automatiques, contraintes.
// Sans DOM : testé en Node. Une « composition » (set) = les équipes d'une leçon ; on la duplique pour la leçon suivante.
import { uid, now, clone } from '../util.js';
import { classNotes } from './classes.js';

/** Couleurs de chasuble (id stable, nom affiché, teinte, couleur du texte lisible dessus). */
export const VEST_COLORS = [
  { id: 'rouge', label: 'Rouge', hex: '#e5484d', ink: '#ffffff' },
  { id: 'bleu-fonce', label: 'Bleu foncé', hex: '#1f3a8a', ink: '#ffffff' },
  { id: 'bleu-clair', label: 'Bleu clair', hex: '#6cc3f5', ink: '#10243a' },
  { id: 'jaune', label: 'Jaune', hex: '#f5d90a', ink: '#2b2500' },
  { id: 'vert', label: 'Vert', hex: '#2e9e5b', ink: '#ffffff' },
  { id: 'orange', label: 'Orange', hex: '#f08a24', ink: '#2b1400' },
  { id: 'violet', label: 'Violet', hex: '#7b4fc9', ink: '#ffffff' },
  { id: 'noir', label: 'Noir', hex: '#1b1b1f', ink: '#ffffff' },
  { id: 'rose', label: 'Rose', hex: '#f48fb1', ink: '#3a0f20' },
  { id: 'sans', label: 'Sans maillot', hex: '#f4f4f7', ink: '#2b2d42' },
];
export const vestOf = (id) => VEST_COLORS.find((c) => c.id === id) || VEST_COLORS.at(-1);

/** Couleur d'un rôle (les rôles enregistrés avant la 1.6.1 n'ont pas de couleur : on retrouve celle du rôle d'origine). */
export const roleColor = (ro) => ro.color || DEFAULT_ROLES.find((d) => d.id === ro.id)?.color || '#6b7089';

/** Rôles proposés (modifiables dans les réglages de l'outil). short = abréviation affichée sur la tuile. */
export const DEFAULT_ROLES = [
  { id: 'capitaine', label: 'Capitaine', short: 'C', color: '#e03a3e' },
  { id: 'materiel', label: 'Responsable matériel', short: 'M', color: '#2f6fe0' },
  { id: 'officiel', label: 'Jeune officiel', short: 'O', color: '#e0a800' },
  { id: 'prepa', label: 'Préparateur / préparatrice physique', short: 'P', color: '#2e9b4f' },
  { id: 'manager', label: 'Manager / manageuse', short: 'Mg', color: '#ef7d1a' },
];

// ---------- Modèle ----------

export function newTeam({ name = '', color = 'rouge', kind = 'team', clubId = null, rank = 0 } = {}) {
  return { id: uid(), name, color, kind, clubId, rank, members: [] };
}

/** students : [{id, first, initial}] pour une composition « libre » (pour une classe, la liste vient de la classe). */
export function newSet({ name = '', date = '', mode = 'teams', students = null } = {}) {
  return { id: uid(), name, date, mode, students, teams: [], clubs: [], status: {}, roles: {}, locked: {}, constraints: [], createdAt: now(), parentId: null };
}

export const teamsOnly = (set) => set.teams.filter((t) => t.kind === 'team');
export const poolOf = (set, clubId) => set.teams.find((t) => t.kind === 'pool' && t.clubId === clubId);

/** Ajoute une équipe numérotée (couleur : la 1re non utilisée). */
export function addTeam(set) {
  const used = new Set(teamsOnly(set).map((t) => t.color));
  const color = (VEST_COLORS.find((c) => !used.has(c.id) && c.id !== 'sans') || VEST_COLORS[0]).id;
  const t = newTeam({ name: '', color });
  t.name = `Équipe ${teamsOnly(set).length + 1}`;
  set.teams.push(t);
  return t;
}

/** Ajoute un club (couleur propre) et ses 3 zones : « à répartir » dans le club, équipe 1, équipe 2. */
/** Option « Club Basket » (fiche « Équipes NBA ») : clubs aux noms des franchises NBA, équipe 1 = championnat FIBA, équipe 2 = championnat NBA. */
export const NBA_TEAMS = ['Atlanta Hawks', 'Boston Celtics', 'Brooklyn Nets', 'Charlotte Hornets', 'Chicago Bulls', 'Cleveland Cavaliers', 'Dallas Mavericks', 'Denver Nuggets', 'Detroit Pistons', 'Golden State Warriors', 'Houston Rockets', 'Indiana Pacers', 'LA Clippers', 'Los Angeles Lakers', 'Memphis Grizzlies', 'Miami Heat', 'Milwaukee Bucks', 'Minnesota Timberwolves', 'New Orleans Pelicans', 'New York Knicks', 'Oklahoma City Thunder', 'Orlando Magic', 'Philadelphia 76ers', 'Phoenix Suns', 'Portland Trail Blazers', 'Sacramento Kings', 'San Antonio Spurs', 'Toronto Raptors', 'Utah Jazz', 'Washington Wizards'];
export const BASKET_ROLES = [
  { id: 'capitaine', label: 'Capitaine', short: 'C', color: '#e03a3e' },
  { id: 'prepa', label: 'Préparateur·trice physique', short: 'P', color: '#2e9b4f' },
  { id: 'manager', label: 'Manager', short: 'Mg', color: '#ef7d1a' },
  { id: 'materiel', label: 'Responsable matériel', short: 'M', color: '#2f6fe0' },
];
/** Applique (ou retire) l'option Club Basket. Les noms déjà NBA sont gardés ; les autres sont tirés au hasard sans doublon. */
export function setBasketClubs(set, on = true, rnd = Math.random) {
  if (!on) { delete set.flavor; set.clubs.forEach((c, i) => { if (NBA_TEAMS.includes(c.name)) c.name = `Club ${i + 1}`; }); for (const t of teamsOnly(set)) if (t.kind === 'team') t.name = `Équipe ${t.rank}`; return; }
  set.flavor = 'nba';
  const used = new Set(set.clubs.map((c) => c.name).filter((n) => NBA_TEAMS.includes(n)));
  for (const c of set.clubs) if (!NBA_TEAMS.includes(c.name)) { const free = NBA_TEAMS.filter((n) => !used.has(n)); const n = free[Math.floor(rnd() * free.length)] || c.name; used.add(n); c.name = n; }
  for (const t of set.teams) if (t.kind === 'team') t.name = t.rank === 1 ? 'FIBA' : 'NBA';
}

export function addClub(set) {
  const used = new Set(set.clubs.map((c) => c.color));
  const color = (VEST_COLORS.find((c) => !used.has(c.id) && c.id !== 'sans') || VEST_COLORS[0]).id;
  const club = { id: uid(), name: `Club ${set.clubs.length + 1}`, color };
  set.clubs.push(club);
  set.teams.push(newTeam({ name: 'Club', color, kind: 'pool', clubId: club.id, rank: 0 }));
  set.teams.push(newTeam({ name: 'Équipe 1', color, kind: 'team', clubId: club.id, rank: 1 }));
  set.teams.push(newTeam({ name: 'Équipe 2', color, kind: 'team', clubId: club.id, rank: 2 }));
  if (set.flavor === 'nba') setBasketClubs(set, true);
  return club;
}

export function removeClub(set, clubId) {
  set.clubs = set.clubs.filter((c) => c.id !== clubId);
  set.teams = set.teams.filter((t) => t.clubId !== clubId);
}
export function removeTeam(set, teamId) { set.teams = set.teams.filter((t) => t.id !== teamId); }

/** Couleur effective d'une équipe : la sienne, sinon celle de son club. */
export function teamColorId(set, t) {
  if (t.clubId && !t.colorOwn) return set.clubs.find((c) => c.id === t.clubId)?.color || t.color;
  return t.color;
}
/** Nom complet d'une équipe (avec son club). */
export function teamLabel(set, t) {
  const club = t.clubId ? set.clubs.find((c) => c.id === t.clubId) : null;
  return club && t.kind === 'team' ? `${club.name} · ${t.name}` : t.name;
}

/** Élèves de la composition (liste libre, ou élèves actifs de la classe). */
export function studentsOf(set, cls = null) {
  if (cls) return cls.students.filter((s) => s.active !== false).map((s) => ({ id: s.id, first: s.first, initial: s.initial || '' }));
  return set.students || [];
}

/** Retire des équipes les élèves qui ne sont plus dans la liste (partis) et nettoie statuts, rôles, verrous. */
export function syncStudents(set, studentIds) {
  const ids = new Set(studentIds);
  for (const t of set.teams) t.members = t.members.filter((s) => ids.has(s));
  for (const k of ['status', 'roles', 'locked']) for (const s of Object.keys(set[k])) if (!ids.has(s)) delete set[k][s];
  set.constraints = set.constraints.filter((c) => ids.has(c.a) && ids.has(c.b));
}

export const teamOfStudent = (set, sid) => set.teams.find((t) => t.members.includes(sid)) || null;
export const statusOf = (set, sid) => set.status[sid] || 'present';

/** Élèves « non placés » : présents ou dispensés, dans aucune équipe. Les absents ont leur propre zone. */
export function unplaced(set, students) {
  return students.filter((s) => statusOf(set, s.id) !== 'absent' && !teamOfStudent(set, s.id));
}

/** Déplace un élève vers une équipe (teamId) ou le retire (null). Un élève absent qui est placé redevient présent. */
export function moveStudent(set, sid, teamId) {
  for (const t of set.teams) t.members = t.members.filter((s) => s !== sid);
  if (!teamId) return;
  const t = set.teams.find((x) => x.id === teamId);
  if (!t) return;
  t.members.push(sid);
  if (set.status[sid] === 'absent') delete set.status[sid];
}

/** 'present' | 'absent' | 'dispense'. Un absent quitte son équipe ; un dispensé peut y rester (avec un rôle). */
export function setStatus(set, sid, st) {
  if (st === 'present') delete set.status[sid]; else set.status[sid] = st;
  if (st === 'absent') { for (const t of set.teams) t.members = t.members.filter((s) => s !== sid); delete set.locked[sid]; }
}

export function toggleRole(set, sid, roleId) {
  const r = set.roles[sid] || [];
  set.roles[sid] = r.includes(roleId) ? r.filter((x) => x !== roleId) : [...r, roleId]; // le 1er rôle est celui qui s'affiche
  if (!set.roles[sid].length) delete set.roles[sid];
}
export const visibleRole = (set, sid, roles = DEFAULT_ROLES) => {
  const id = (set.roles[sid] || [])[0];
  return id ? roles.find((r) => r.id === id) || null : null;
};

/**
 * Fait tourner les rôles dans chaque équipe : chaque élève reçoit un rôle différent de celui de la leçon précédente
 * (`prev` : { sid: [roleIds] }), et, autant que possible, deux élèves d'une même équipe n'ont pas le même rôle.
 * Les absents n'ont pas de rôle. Renvoie le nombre d'élèves qui gardent leur rôle (0 si tout a tourné).
 */
export function rotateRoles(set, roleIds, prev = set.roles) {
  if (!roleIds.length) return 0;
  const before = Object.fromEntries(Object.entries(prev || {}).map(([k, v]) => [k, (v || [])[0]]));
  const next = {};
  let kept = 0;
  for (const t of teamsOnly(set)) {
    const ms = t.members.filter((sid) => set.status[sid] !== 'absent');
    if (!ms.length) continue;
    // ordre stable : celui des rôles précédents, pour que la rotation « avance » d'un cran
    const order = ms.slice().sort((a, b) => (roleIds.indexOf(before[a]) + 1 || 99) - (roleIds.indexOf(before[b]) + 1 || 99));
    let best = null;
    for (let k = 0; k < roleIds.length; k++) {
      const pick = order.map((sid, i) => roleIds[(i + k) % roleIds.length]);
      const same = order.filter((sid, i) => before[sid] && before[sid] === pick[i]).length;
      if (!best || same < best.same) best = { pick, same, k };
      if (same === 0 && k > 0) break; // k = 0 donnerait souvent les mêmes rôles : on avance d'au moins un cran
    }
    order.forEach((sid, i) => { next[sid] = [best.pick[i]]; });
    kept += best.same;
  }
  set.roles = next;
  return kept;
}

export function toggleLock(set, sid) { if (set.locked[sid]) delete set.locked[sid]; else set.locked[sid] = true; }

/** Duplication pour la leçon suivante : mêmes équipes (mêmes identifiants : l'équipe reste la même entité), absences effacées. */
/** 1.13 : chaque équipe devient un club (même nom, même couleur) ; ses joueurs vont dans « à répartir » du club. */
export function teamsToClubs(set) {
  const teams = teamsOnly(set).filter((t) => !t.clubId);
  set.clubs = []; set.teams = set.teams.filter((t) => t.clubId);
  for (const t of teams) {
    const club = { id: uid(), name: t.name || `Club ${set.clubs.length + 1}`, color: t.color };
    set.clubs.push(club);
    const pool = newTeam({ name: 'Club', color: t.color, kind: 'pool', clubId: club.id, rank: 0 }); pool.members = t.members.slice();
    set.teams.push(pool, newTeam({ name: 'Équipe 1', color: t.color, kind: 'team', clubId: club.id, rank: 1 }), newTeam({ name: 'Équipe 2', color: t.color, kind: 'team', clubId: club.id, rank: 2 }));
  }
  set.mode = 'clubs';
  if (set.flavor === 'nba') setBasketClubs(set, true);
}
/** 1.13 : chaque club devient une équipe (nom et couleur du club), avec tous ses joueurs. */
export function clubsToTeams(set) {
  const out = set.clubs.map((c) => { const t = newTeam({ name: c.name, color: c.color }); t.members = set.teams.filter((x) => x.clubId === c.id).flatMap((x) => x.members); return t; });
  set.teams = out; set.clubs = []; set.mode = 'teams'; delete set.flavor;
}

export function duplicateSet(set, { name, date } = {}) {
  const c = clone(set);
  c.id = uid();
  c.parentId = set.id;
  c.name = name || `${set.name} (copie)`;
  c.date = date ?? set.date;
  c.status = {};
  c.createdAt = now();
  return c;
}

// ---------- Tailles ----------

/** Nombre d'équipes pour une taille visée : celui dont la taille moyenne est la plus proche. */
export function countForSize(n, size) {
  const lo = Math.max(1, Math.floor(n / size)), hi = Math.max(1, Math.ceil(n / size));
  return Math.abs(n / lo - size) < Math.abs(n / hi - size) ? lo : hi;
}

/**
 * Répartition des n joueurs : nombre d'équipes et/ou taille. Rien n'est jamais « impossible » :
 * avec les deux, le nombre d'équipes prime et les tailles s'équilibrent au plus près.
 * Retourne les tailles (ex. 28 joueurs, 5 équipes → [6,6,6,5,5]).
 */
export function teamSizes(n, { teams = 0, size = 0 } = {}) {
  if (n <= 0) return [];
  let k = teams > 0 ? teams : size > 0 ? countForSize(n, size) : 2;
  k = Math.max(1, Math.min(k, n));
  const base = Math.floor(n / k), extra = n % k;
  return Array.from({ length: k }, (_, i) => base + (i < extra ? 1 : 0));
}

// ---------- Hasard et niveaux ----------

export function rngFrom(seed) {
  if (seed == null) return Math.random;
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function shuffle(list, rng = Math.random) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/**
 * Niveau de chaque élève (0 à 1) à partir des évaluations de la classe : source 'mean' = moyenne des notes finales,
 * sinon identifiant d'une évaluation. Sans note finale, on utilise les points déjà saisis (niveaux des cases).
 * Retourne Map(id → score) ; les élèves sans aucun résultat sont absents de la Map.
 */
export function levelScores(cls, evals, source = 'mean') {
  const data = classNotes(evals, cls, {});
  const out = new Map();
  const cellScore = (c) => (!c || c.status !== 'present' ? null : c.final != null ? c.final / 20 : c.maxFilled ? c.points / c.maxFilled : null);
  for (const r of data.rows) {
    let v = null;
    if (source === 'mean') {
      const xs = r.cells.map(cellScore).filter((x) => x != null);
      v = xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
    } else {
      const j = data.evals.findIndex((e) => e.id === source);
      v = j >= 0 ? cellScore(r.cells[j]) : null;
    }
    if (v != null) out.set(r.student.id, v);
  }
  return out;
}

/** Élèves sans résultat : placés au milieu du classement (valeur médiane des autres, ou 0,5 s'il n'y en a aucun). */
export function fillScores(ids, scores) {
  const known = ids.map((i) => scores.get(i)).filter((x) => x != null).sort((a, b) => a - b);
  const med = known.length ? known[Math.floor(known.length / 2)] : 0.5;
  return new Map(ids.map((i) => [i, scores.get(i) ?? med]));
}

// ---------- Tirages ----------

/**
 * Répartit `players` dans des conteneurs. containers : [{ id, fixed: [ids déjà placés et verrouillés] }], sizes[i] = effectif visé.
 * mode : 'random' · 'balanced' (équipes comparables, hétérogènes à l'intérieur) · 'levels' (groupes de niveau, homogènes à l'intérieur).
 * Retourne Map(id élève → id conteneur). Jamais d'échec : si les places manquent, on en ajoute là où c'est le moins chargé.
 */
export function assign({ players, containers, sizes, mode = 'random', scores = new Map(), rng = Math.random }) {
  const caps = containers.map((c, i) => Math.max(0, (sizes[i] ?? 0) - c.fixed.length));
  let free = players.length - caps.reduce((a, b) => a + b, 0);
  while (free > 0) { const i = caps.indexOf(Math.min(...caps)); caps[i]++; free--; } // places insuffisantes : on arrondit vers le haut
  const out = new Map();
  const sc = fillScores(players, scores);
  const order = shuffle(players, rng); // le hasard départage les égalités
  if (mode === 'random') {
    let i = 0;
    for (const p of order) { while (caps[i % caps.length] <= 0) i++; const k = i % caps.length; out.set(p, containers[k].id); caps[k]--; i++; }
    return out;
  }
  const sorted = [...order].sort((a, b) => sc.get(b) - sc.get(a));
  if (mode === 'levels') { // les plus forts dans la 1re équipe, etc.
    let k = 0;
    for (const p of sorted) { while (caps[k] <= 0) k++; out.set(p, containers[k].id); caps[k]--; }
    return out;
  }
  // balanced : chacun va dans l'équipe la moins forte (somme des niveaux) qui a encore de la place
  const sums = containers.map((c) => c.fixed.reduce((a, s) => a + (scores.get(s) ?? 0.5), 0));
  const counts = containers.map((c) => c.fixed.length);
  for (const p of sorted) {
    let best = -1;
    for (let k = 0; k < containers.length; k++) {
      if (caps[k] <= 0) continue;
      if (best < 0 || sums[k] < sums[best] - 1e-9 || (Math.abs(sums[k] - sums[best]) <= 1e-9 && counts[k] < counts[best])) best = k;
    }
    out.set(p, containers[best].id); caps[best]--; sums[best] += sc.get(p); counts[best]++;
  }
  return out;
}

/**
 * Duos de tutorat : le 1er du classement est associé à l'élève du milieu, etc. (fort ↔ plus fragile).
 * Nombre impair : le dernier élève rejoint un duo, qui devient un trio. Retourne des tableaux d'identifiants.
 */
export function duos(players, scores = new Map(), rng = Math.random) {
  const sc = fillScores(players, scores);
  const sorted = shuffle(players, rng).sort((a, b) => sc.get(b) - sc.get(a));
  const n = sorted.length;
  if (n === 0) return [];
  if (n === 1) return [[sorted[0]]];
  const m = Math.floor(n / 2);
  const groups = Array.from({ length: m }, (_, i) => [sorted[i], sorted[m + i]]);
  if (n % 2) groups[m - 1].push(sorted[n - 1]);
  return groups;
}

/** Nombre de contraintes non respectées. */
export function violations(groupOf, constraints) {
  return constraints.filter((c) => {
    const ga = groupOf.get(c.a), gb = groupOf.get(c.b);
    if (ga == null || gb == null) return false;
    return c.type === 'together' ? ga !== gb : ga === gb;
  });
}

/**
 * Améliore une répartition (Map élève → conteneur) pour respecter les contraintes « ensemble / séparés » en échangeant des
 * élèves entre équipes sans changer les effectifs, sans toucher aux élèves verrouillés. Respecte le maximum possible.
 */
export function applyConstraints(assignment, constraints, { fixed = new Set(), scores = new Map(), mode = 'random', rng = Math.random, tries = 4000 } = {}) {
  const map = new Map(assignment);
  const rel = constraints.filter((c) => map.has(c.a) || map.has(c.b));
  if (!rel.length) return { assignment: map, violated: [] };
  const movable = [...map.keys()].filter((s) => !fixed.has(s));
  const cost = () => {
    let v = violations(map, rel).length * 1000;
    if (mode !== 'random') { // ne pas casser l'équilibre des niveaux pour rien
      const groups = new Map();
      for (const [s, g] of map) { if (!groups.has(g)) groups.set(g, []); groups.get(g).push(scores.get(s) ?? 0.5); }
      const means = [...groups.values()].map((xs) => xs.reduce((a, b) => a + b, 0) / xs.length);
      const gm = means.reduce((a, b) => a + b, 0) / (means.length || 1);
      if (mode === 'balanced') v += means.reduce((a, m) => a + (m - gm) ** 2, 0);
      else for (const xs of groups.values()) { const m = xs.reduce((a, b) => a + b, 0) / xs.length; v += xs.reduce((a, x) => a + (x - m) ** 2, 0); }
    }
    return v;
  };
  let cur = cost();
  for (let i = 0; i < tries && violations(map, rel).length; i++) {
    const a = movable[Math.floor(rng() * movable.length)], b = movable[Math.floor(rng() * movable.length)];
    if (a == null || b == null || map.get(a) === map.get(b)) continue;
    const ga = map.get(a), gb = map.get(b);
    map.set(a, gb); map.set(b, ga);
    const c = cost();
    if (c < cur) cur = c; else { map.set(a, ga); map.set(b, gb); }
  }
  return { assignment: map, violated: violations(map, rel) };
}

/**
 * Génère (ou « mélange de nouveau ») les équipes d'une composition.
 * opts : { mode: 'random'|'balanced'|'levels'|'tutor', teams, size, scores, seed, students, keepLocked }
 *  - composition « équipes » : remplit les équipes (en crée ou supprime les équipes vides en trop selon le nombre voulu) ;
 *  - composition « clubs »   : répartit les élèves dans les clubs (zone « à répartir » de chaque club) ; vous séparez ensuite à la main.
 *  - 'tutor' : crée des duos (équipes de 2, trio si impair) ; en mode clubs, ignoré (on crée des clubs normalement).
 * Les absents ne sont jamais placés, les dispensés non plus (ils restent « non placés » pour que vous choisissiez leur rôle),
 * les élèves verrouillés gardent leur place. Retourne { violated, note }.
 */
export function generate(set, students, opts = {}) {
  const { mode = 'random', teams = 0, size = 0, scores = new Map(), seed = null } = opts;
  const rng = rngFrom(seed);
  const lockedIds = new Set(Object.keys(set.locked).filter((s) => set.locked[s]));
  const present = students.filter((s) => statusOf(set, s.id) === 'present').map((s) => s.id);
  const dispensed = students.filter((s) => statusOf(set, s.id) === 'dispense').map((s) => s.id);
  const clubs = set.mode === 'clubs';
  const targetKind = clubs ? 'pool' : 'team';

  // 1. on vide les zones concernées sauf les verrouillés
  const zones = () => set.teams.filter((t) => (clubs ? t.kind === 'pool' : t.kind === 'team'));
  if (clubs) for (const t of set.teams) t.members = t.members.filter((s) => lockedIds.has(s));
  else for (const t of set.teams) t.members = t.members.filter((s) => lockedIds.has(s));
  const pool = present.filter((s) => !lockedIds.has(s) || !teamOfStudent(set, s));
  const lockedPlaced = present.filter((s) => lockedIds.has(s) && teamOfStudent(set, s));
  const total = pool.length + lockedPlaced.length;

  // 2. duos (équipes ordinaires uniquement)
  if (mode === 'tutor' && !clubs) {
    set.teams = set.teams.filter((t) => t.kind !== 'team' || t.members.length);
    const groups = duos(pool, scores, rng);
    groups.forEach((g, i) => { const t = addTeam(set); t.name = `Duo ${i + 1}`; t.members = g; });
    return { violated: [], note: `${groups.length} duo${groups.length > 1 ? 's' : ''}${groups.some((g) => g.length === 3) ? ' (dont un trio)' : ''}` };
  }

  // 3. nombre d'équipes visé : on ajoute des zones au besoin ; on supprime les zones vides en trop (équipes ordinaires)
  const sizes = teamSizes(total, { teams, size });
  const k = sizes.length;
  if (!clubs) {
    let ts = zones();
    while (ts.length < k) { addTeam(set); ts = zones(); }
    while (ts.length > k) { const empty = [...ts].reverse().find((t) => !t.members.length); if (!empty) break; removeTeam(set, empty.id); ts = zones(); }
  } else {
    while (set.clubs.length < k) addClub(set);
  }
  const zs = zones().slice(0, Math.max(k, 1));
  const containers = zs.map((z) => ({ id: z.id, fixed: z.members.filter((s) => lockedIds.has(s)) }));
  const sz = zs.map((_, i) => sizes[i] ?? 0);
  let asg = assign({ players: pool, containers, sizes: sz, mode, scores, rng });
  const fullMap = new Map(asg);
  for (const z of zs) for (const s of z.members) fullMap.set(s, z.id); // verrouillés, pour les contraintes
  const res = applyConstraints(fullMap, set.constraints, { fixed: lockedIds, scores, mode: mode === 'random' ? 'random' : mode, rng });
  asg = res.assignment;
  for (const [s, zid] of asg) { if (lockedIds.has(s)) continue; const z = set.teams.find((t) => t.id === zid); if (z && !z.members.includes(s)) z.members.push(s); }
  void dispensed; void targetKind;
  const sizesNow = zs.map((z) => z.members.length);
  const min = Math.min(...sizesNow), max = Math.max(...sizesNow);
  const note = size && !teams && min !== max ? `Équipes de ${min} à ${max} élèves (taille visée : ${size}).`
    : size && teams ? `Équipes de ${min} à ${max} élèves (${teams} équipes demandées, taille visée : ${size}).` : '';
  return { violated: res.violated, note };
}

/** Liste lisible d'une contrainte non respectée. */
export const constraintText = (c, nameOf) => `${nameOf(c.a)} et ${nameOf(c.b)} ${c.type === 'together' ? 'ensemble' : 'séparés'}`;

// ---------- Lien avec une évaluation ----------

/**
 * Reprend la composition dans une évaluation (copie figée) : équipes → groupes « team » (même identifiant, nom, teinte).
 * Retourne { statuses } : élèves absents/dispensés de la composition, à proposer pour la fiche (avec confirmation).
 */
export function copyIntoEvaluation(ev, set) {
  const evIds = new Set(ev.students.map((s) => s.id));
  ev.groups = ev.groups.filter((g) => g.type !== 'team');
  for (const m of Object.values(ev.membership)) delete m.team;
  for (const t of teamsOnly(set)) {
    ev.groups.push({ id: t.id, type: 'team', name: teamLabel(set, t), color: vestOf(teamColorId(set, t)).hex });
    for (const sid of t.members) if (evIds.has(sid)) { ev.membership[sid] ??= {}; ev.membership[sid].team = t.id; }
  }
  ev.teamSet = { setId: set.id, name: set.name, at: now() };
  const statuses = {};
  for (const [sid, st] of Object.entries(set.status)) if (evIds.has(sid)) statuses[sid] = st;
  return { statuses };
}
