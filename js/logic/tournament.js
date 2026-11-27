// Tournois : calendrier équilibré (matchs, arbitres, repos), classement, estimation du temps, chronomètre de match.
// Logique pure (aucun accès à l'écran) : testée par tests/v17.test.mjs.
import { uid, now } from '../util.js';
import { rngFrom, shuffle } from './teams.js';

// ---------- Sports et réglages par défaut ----------

export const SPORTS = {
  handball: { label: 'Handball', buttons: [1, -1] },
  futsal: { label: 'Futsal', buttons: [1, -1] },
  ultimate: { label: 'Ultimate', buttons: [1, -1] },
  basket: { label: 'Basket', buttons: [1, 2, 3, -1] },
  basket5: { label: 'Basket 5e', buttons: [1, 10, 100, -1, -10, -100] }, // réglages tout prêts (Projet EPS) : +1 / +10 / +100, retraits discrets
  basket3: { label: 'Basket 3e', buttons: [1, 10, 100, -1, -10, -100] },
  autre: { label: 'Autre', buttons: [1, 2, 3, -1] },
};
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
/** Sport présélectionné d'après le nom d'une activité (« Basket 3e B » → basket) ; « autre » si rien de reconnu. */
export function sportFromActivity(name, level = '') {
  const n = norm(name);
  if (/basket/.test(n) && /5/.test(level)) return 'basket5';
  if (/basket/.test(n) && /3/.test(level)) return 'basket3';
  if (/hand/.test(n)) return 'handball';
  if (/futsal|foot/.test(n)) return 'futsal';
  if (/basket/.test(n)) return 'basket';
  if (/ultimate/.test(n)) return 'ultimate';
  return 'autre';
}

export const DEFAULT_SETTINGS = {
  sport: 'handball', halves: 1, halfMin: 5, pauseMin: 2, pts: { w: 3, d: 2, l: 1 }, courts: 1,
  format: 'single', finals: 'none', perTeam: null, changeover: 2,
  change: { on: true, mode: 'mid', custom: '' }, customButtons: '1,2,3',
};

/** Nom proposé : « Tournoi » + date. */
export const defaultName = (dateISO) => `Tournoi ${dateISO ? dateISO.split('-').reverse().join('/') : ''}`.trim();

export function newTournament({ name, date, teams, settings = {}, scope = 'free', pairId = null, side = null, ctx = {} }) {
  const s = { ...DEFAULT_SETTINGS, ...settings, pts: { ...DEFAULT_SETTINGS.pts, ...(settings.pts || {}) }, change: { ...DEFAULT_SETTINGS.change, ...(settings.change || {}) } };
  const t = { id: uid(), name, date, scope, pairId, side, ...ctx, ...s, teams, matches: [], status: 'setup', live: {}, createdAt: now() };
  if (teams.length < 4) t.courts = 1; // deux terrains : au moins 4 équipes
  t.matches = generateSchedule(teams.map((x) => x.id), t);
  return t;
}

/** Réglages à reprendre du dernier tournoi (pour pré-remplir le suivant). */
export const SETTING_KEYS = ['sport', 'halves', 'halfMin', 'pauseMin', 'pts', 'courts', 'format', 'finals', 'perTeam', 'changeover', 'change', 'customButtons'];
export const settingsOf = (t) => JSON.parse(JSON.stringify(Object.fromEntries(SETTING_KEYS.filter((k) => k in t).map((k) => [k, t[k]]))));
/** Composition la plus récente : date de la leçon, puis dernière modification. */
export const latestSet = (sets) => [...(sets || [])].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0))[0] || null;

export const matchMinutes = (t) => (t.halves === 2 ? 2 * t.halfMin + t.pauseMin : t.halfMin);
export const scoreButtons = (t) => (t.sport === 'autre'
  ? [...new Set(String(t.customButtons || '1,2,3').split(/[,\s;]+/).map((x) => parseInt(x, 10)).filter((x) => x && Math.abs(x) <= 99))].concat([-1]).filter((v, i, a) => a.indexOf(v) === i)
  : SPORTS[t.sport]?.buttons || [1, -1]);

// ---------- Appariements ----------

/** Méthode du cercle : rondes de matchs (un nombre impair d'équipes laisse une équipe au repos par ronde). */
export function circleRounds(ids) {
  const a = ids.slice();
  if (a.length % 2) a.push(null);
  const n = a.length, rounds = [];
  for (let r = 0; r < n - 1; r++) {
    const round = [];
    for (let i = 0; i < n / 2; i++) { const x = a[i], y = a[n - 1 - i]; if (x != null && y != null) round.push(r % 2 ? [y, x] : [x, y]); }
    rounds.push(round);
    a.splice(1, 0, a.pop());
  }
  return rounds;
}

/** Liste des matchs à jouer : tous contre tous (1 ou 2 fois), ou seulement k rondes si un nombre de matchs par équipe est imposé. */
export function pairingPool(ids, { format = 'single', perTeam = null } = {}) {
  const n = ids.length;
  const rounds = circleRounds(ids);
  const legs = format === 'double' ? 2 : 1;
  const full = (n - 1) * legs;
  if (!perTeam || perTeam >= full) {
    const out = [];
    for (let l = 0; l < legs; l++) for (const r of rounds) for (const [a, b] of r) out.push(l % 2 ? { a: b, b: a } : { a, b });
    return out;
  }
  const out = [];
  for (let k = 0; k < perTeam; k++) { const r = rounds[k % rounds.length]; for (const [a, b] of r) out.push(k >= rounds.length ? { a: b, b: a } : { a, b }); }
  return out;
}

// ---------- Mise en ordre, arbitres, évaluation ----------

/** Place les matchs dans des créneaux (1 ou 2 terrains en même temps) en évitant les enchaînements : glouton avec tirage aléatoire. */
function orderPool(ids, pool, courts, rng) {
  const left = shuffle(pool.slice(), rng);
  const last = Object.fromEntries(ids.map((i) => [i, -99])), played = Object.fromEntries(ids.map((i) => [i, 0]));
  const slots = [];
  while (left.length) {
    const slot = [], busy = new Set();
    const s = slots.length;
    for (let c = 0; c < courts && left.length; c++) {
      let best = -1, bestScore = Infinity;
      for (let i = 0; i < left.length; i++) {
        const m = left[i];
        if (busy.has(m.a) || busy.has(m.b)) continue;
        let sc = 0;
        for (const t of [m.a, m.b]) {
          const gap = s - last[t];
          sc += gap === 1 ? 8 : gap === 2 ? 2 : 0;
          sc += played[t] * 0.6 - Math.min(gap, 6) * 0.3;
        }
        sc += rng() * 0.5;
        if (sc < bestScore) { bestScore = sc; best = i; }
      }
      if (best < 0) break;
      const [m] = left.splice(best, 1);
      slot.push(m); busy.add(m.a); busy.add(m.b);
    }
    if (!slot.length) { slots.push([left.shift()]); continue; } // sécurité (ne devrait pas arriver)
    for (const m of slot) { last[m.a] = last[m.b] = s; played[m.a]++; played[m.b]++; }
    slots.push(slot);
  }
  return slots;
}

/** Un arbitre (équipe entière) par match, parmi les équipes qui ne jouent pas à ce créneau : le moins sollicité, sans enchaîner jeu et arbitrage. */
function assignReferees(ids, slots, rng) {
  const refs = Object.fromEntries(ids.map((i) => [i, 0]));
  const playing = slots.map((sl) => new Set(sl.flatMap((m) => [m.a, m.b])));
  const active = slots.map((sl) => new Set(playing[slots.indexOf(sl)]));
  slots.forEach((sl, s) => {
    const taken = new Set();
    for (const m of sl) {
      let best = null, bestScore = Infinity;
      for (const t of ids) {
        if (playing[s].has(t) || taken.has(t)) continue;
        let sc = refs[t] * 100;
        if (s > 0 && active[s - 1].has(t)) sc += 4;
        if (s + 1 < slots.length && playing[s + 1].has(t)) sc += 3;
        sc += rng();
        if (sc < bestScore) { bestScore = sc; best = t; }
      }
      m.ref = best;
      if (best) { refs[best]++; taken.add(best); active[s].add(best); }
    }
  });
  return slots;
}

/** Bilan d'équilibre d'un calendrier : matchs joués, arbitrages, plus longue série d'activité, écart de repos. */
export function balance(ids, matches) {
  const poule = matches.filter((m) => m.phase === 'poule' && m.a && m.b);
  const nSlots = poule.reduce((mx, m) => Math.max(mx, m.slot + 1), 0);
  const plays = {}, refs = {}, act = {};
  for (const i of ids) { plays[i] = 0; refs[i] = 0; act[i] = Array(nSlots).fill(0); }
  for (const m of poule) {
    plays[m.a]++; plays[m.b]++; act[m.a][m.slot] = 1; act[m.b][m.slot] = 1;
    if (m.ref) { refs[m.ref]++; act[m.ref][m.slot] = 1; }
  }
  let maxRun = 0, sumRunSq = 0, idleVar = 0;
  for (const i of ids) {
    let run = 0, runs = [], gaps = [], gap = 0, seen = false;
    for (const v of act[i]) {
      if (v) { run++; if (seen && gap) gaps.push(gap); gap = 0; seen = true; } else { if (run) runs.push(run); run = 0; gap++; }
    }
    if (run) runs.push(run);
    const mr = runs.length ? Math.max(...runs) : 0;
    maxRun = Math.max(maxRun, mr); sumRunSq += mr * mr;
    if (gaps.length) { const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length; idleVar += gaps.reduce((a, g) => a + (g - mean) ** 2, 0) / gaps.length; }
  }
  const spread = (o) => { const v = Object.values(o); return v.length ? Math.max(...v) - Math.min(...v) : 0; };
  const refMissing = poule.filter((m) => !m.ref).length;
  const cost = spread(plays) * 60 + spread(refs) * 50 + refMissing * 5 + sumRunSq * 2 + idleVar;
  return { plays, refs, playSpread: spread(plays), refSpread: spread(refs), maxRun, refMissing, cost };
}

/**
 * Calendrier complet d'un tournoi. Plusieurs essais aléatoires reproductibles ; on garde le plus équilibré.
 * Finales : « final » (1er contre 2e) ou « both » (petite finale 3e contre 4e, puis finale), créées vides et remplies par resolveFinals().
 */
export function generateSchedule(ids, { format = 'single', courts = 1, perTeam = null, finals = 'none', seed = Date.now() } = {}) {
  const n = ids.length;
  if (n < 2) return [];
  const c = n < 4 ? 1 : courts;
  const pool = pairingPool(ids, { format, perTeam });
  let best = null;
  const tries = n <= 6 ? 60 : 40;
  for (let k = 0; k < tries; k++) {
    const rng = rngFrom(seed + k * 7919);
    const slots = assignReferees(ids, orderPool(ids, pool, c, rng), rng);
    const matches = [];
    slots.forEach((sl, s) => sl.forEach((m, court) => matches.push({ id: uid(), slot: s, court, a: m.a, b: m.b, ref: m.ref || null, phase: 'poule', sa: 0, sb: 0, log: [], done: false })));
    const b = balance(ids, matches);
    if (!best || b.cost < best.cost) best = { matches, cost: b.cost };
    if (b.cost === 0) break;
  }
  const out = best.matches;
  let s = out.reduce((mx, m) => Math.max(mx, m.slot), -1) + 1;
  const wantFinals = n >= 3 && finals !== 'none';
  if (wantFinals && finals === 'both' && n >= 4) out.push({ id: uid(), slot: s++, court: 0, a: null, b: null, ref: null, phase: 'petite', from: { a: 3, b: 4 }, sa: 0, sb: 0, log: [], done: false });
  if (wantFinals) out.push({ id: uid(), slot: s, court: 0, a: null, b: null, ref: null, phase: 'finale', from: { a: 1, b: 2 }, sa: 0, sb: 0, log: [], done: false });
  return out;
}

// ---------- Saisie des scores ----------

/** Ajoute (ou retire, v < 0) des points à un côté ; jamais sous zéro. Retourne le changement réellement appliqué (0 si rien). */
export function addPoint(m, side, v) {
  const key = side === 'a' ? 'sa' : 'sb';
  const before = m[key];
  m[key] = Math.max(0, before + v);
  const d = m[key] - before;
  if (d) (m.log ||= []).push({ s: side, d });
  return d;
}
export function undoPoint(m) {
  const last = (m.log || []).pop();
  if (!last) return false;
  const key = last.s === 'a' ? 'sa' : 'sb';
  m[key] = Math.max(0, m[key] - last.d);
  return true;
}

// ---------- Classement ----------

const outcome = (m, team) => {
  const mine = m.a === team ? m.sa : m.sb, theirs = m.a === team ? m.sb : m.sa;
  return { pf: mine, pa: theirs, r: mine > theirs ? 'w' : mine < theirs ? 'l' : 'd' };
};

/** Tableau de poule : joués, V/N/D, points marqués/encaissés, différence, points de tournoi. Rangs « à la française » (ex æquo : 1, 2, 2, 4). */
export function standings(t, { includeFinals = false } = {}) {
  const ids = t.teams.map((x) => x.id);
  const done = t.matches.filter((m) => m.done && m.a && m.b && (includeFinals || m.phase === 'poule'));
  const row = (list) => {
    const r = Object.fromEntries(ids.map((i) => [i, { id: i, played: 0, w: 0, d: 0, l: 0, pf: 0, pa: 0, diff: 0, pts: 0 }]));
    for (const m of list) for (const team of [m.a, m.b]) {
      if (!r[team]) continue;
      const o = outcome(m, team), x = r[team];
      x.played++; x[o.r]++; x.pf += o.pf; x.pa += o.pa; x.diff += o.pf - o.pa; x.pts += t.pts[o.r];
    }
    return r;
  };
  const table = row(done);
  const rows = Object.values(table);
  rows.sort((x, y) => y.pts - x.pts || y.diff - x.diff || y.pf - x.pf);
  const key = (x) => `${x.pts}|${x.diff}|${x.pf}`;
  const out = [];
  for (let i = 0; i < rows.length;) {
    let j = i;
    while (j < rows.length && key(rows[j]) === key(rows[i])) j++;
    let group = rows.slice(i, j);
    if (group.length > 1) { // égalité parfaite : résultats entre les équipes concernées (mini-classement)
      const gid = new Set(group.map((g) => g.id));
      const mini = row(done.filter((m) => gid.has(m.a) && gid.has(m.b)));
      group.sort((x, y) => mini[y.id].pts - mini[x.id].pts || mini[y.id].diff - mini[x.id].diff);
      let k = 0;
      while (k < group.length) {
        let l = k;
        while (l < group.length && mini[group[l].id].pts === mini[group[k].id].pts && mini[group[l].id].diff === mini[group[k].id].diff) l++;
        for (let q = k; q < l; q++) group[q].rank = i + k + 1;
        k = l;
      }
    } else group[0].rank = i + 1;
    out.push(...group);
    i = j;
  }
  return out;
}

/** Classement final : celui de la poule, corrigé par les finales jouées (1er/2e, 3e/4e). */
export function finalStandings(t) {
  const rows = standings(t).map((r) => ({ ...r }));
  const byId = new Map(rows.map((r) => [r.id, r]));
  const apply = (m, first) => {
    if (!m?.done || !m.a || m.sa === m.sb) return;
    const [w, l] = m.sa > m.sb ? [m.a, m.b] : [m.b, m.a];
    byId.get(w).rank = first; byId.get(l).rank = first + 1;
  };
  apply(t.matches.find((m) => m.phase === 'petite'), 3);
  apply(t.matches.find((m) => m.phase === 'finale'), 1);
  return rows.sort((a, b) => a.rank - b.rank);
}

export const pouleDone = (t) => t.matches.filter((m) => m.phase === 'poule').every((m) => m.done);

/** Quand la poule est terminée : remplit la (petite) finale avec les équipes classées et leurs arbitres. Retourne true si modifié. */
export function resolveFinals(t) {
  const fin = t.matches.filter((m) => m.phase !== 'poule' && !m.a);
  if (!fin.length || !pouleDone(t)) return false;
  const rk = standings(t).map((r) => r.id);
  const refCount = Object.fromEntries(rk.map((i) => [i, 0]));
  for (const m of t.matches) if (m.ref) refCount[m.ref]++;
  const petite = fin.find((m) => m.phase === 'petite'), finale = fin.find((m) => m.phase === 'finale');
  const pick = (cands) => cands.sort((a, b) => refCount[a] - refCount[b])[0] || null;
  if (petite) {
    petite.a = rk[2]; petite.b = rk[3];
    const others = rk.slice(4);
    petite.ref = pick(others.slice()) || pick([rk[0], rk[1]]); // priorité aux équipes libres ; sinon une équipe de la finale qui attend
    if (petite.ref) refCount[petite.ref]++;
  }
  if (finale) {
    finale.a = rk[0]; finale.b = rk[1];
    const others = rk.slice(petite ? 4 : 2);
    finale.ref = pick(others.slice()) || (petite ? pick([rk[2], rk[3]]) : null);
  }
  return true;
}

// ---------- Temps ----------

/** « J'ai X minutes » : nombre de matchs par équipe proposé, toujours à la baisse (le dernier changement n'est pas compté, marge de sécurité de 1 créneau si possible). */
export function planTime({ minutes, n, courts = 1, matchMin, changeover = 2, format = 'single' }) {
  const c = n < 4 ? 1 : courts;
  const slotLen = matchMin + changeover;
  let slots = Math.floor((minutes - changeover) / slotLen);
  if (slots > 3) slots -= 0; // pas de marge supplémentaire : le changement final est déjà retiré
  const full = (n - 1) * (format === 'double' ? 2 : 1);
  const matches = Math.max(0, slots) * c;
  let k = Math.min(full, Math.floor((matches * 2) / n));
  const total = k >= full ? (n * full) / 2 : (k * Math.floor(n / 2));
  const usedSlots = Math.ceil(total / c);
  const uneven = k < full && n % 2 === 1;
  return { perTeam: k, full: k >= full, slots: usedSlots, totalMatches: total, minutesUsed: usedSlots ? usedSlots * slotLen - changeover : 0, uneven, possible: k > 0 };
}

export const estimateMinutes = (t) => {
  const slots = t.matches.reduce((mx, m) => Math.max(mx, m.slot + 1), 0);
  return slots ? slots * (matchMinutes(t) + t.changeover) - t.changeover : 0;
};

// ---------- Chronomètre d'un terrain ----------

export const liveElapsed = (lv, at = Date.now()) => (lv ? lv.base + (lv.since ? at - lv.since : 0) : 0);
export const liveRunning = (lv) => !!lv?.since;
export function liveStart(lv, matchId, at = Date.now()) { return { matchId, base: lv?.matchId === matchId ? lv.base : 0, since: at }; }
export function livePause(lv, at = Date.now()) { return lv ? { matchId: lv.matchId, base: liveElapsed(lv, at), since: null } : lv; }

/** Phase du match d'après le temps écoulé (ms) : 'h1', 'pause', 'h2', 'fin'. Une seule mi-temps : 'h1' puis 'fin'. */
export function phaseAt(t, elapsed) {
  const h = t.halfMin * 60000, p = t.pauseMin * 60000;
  if (t.halves === 2) return elapsed < h ? 'h1' : elapsed < h + p ? 'pause' : elapsed < 2 * h + p ? 'h2' : 'fin';
  return elapsed < h ? 'h1' : 'fin';
}

/** Instants de changement de joueurs (ms écoulées depuis le début du match). */
export function changeTimes(t) {
  if (!t.change?.on) return [];
  const h = t.halfMin * 60000, p = t.pauseMin * 60000;
  const spans = t.halves === 2 ? [[0, h], [h + p, 2 * h + p]] : [[0, h]];
  if (t.change.mode === 'custom') {
    return String(t.change.custom || '').split(/[;,\s]+/).map((x) => { const m = x.match(/^(\d+)(?::(\d{1,2}))?$/); return m ? (parseInt(m[1], 10) * 60 + (parseInt(m[2] || '0', 10))) * 1000 : null; }).filter((x) => x != null && x > 0 && x < matchMinutes(t) * 60000).sort((a, b) => a - b);
  }
  const fr = t.change.mode === 'thirds' ? [1 / 3, 2 / 3] : [1 / 2];
  return spans.flatMap(([a, b]) => fr.map((f) => Math.round(a + (b - a) * f)));
}
/** Prochain changement (ms écoulées) et s'il est « à signaler » (dans les 10 s qui suivent). */
export function changeState(t, elapsed) {
  const times = changeTimes(t);
  const next = times.find((x) => x + 10000 > elapsed);
  if (next == null) return null;
  return { at: next, now: elapsed >= next && elapsed < next + 10000 };
}
