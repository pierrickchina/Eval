import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../js/logic/tournament.js';

const mk = (n, over = {}) => T.newTournament({ name: 'T', date: '2026-11-27', teams: Array.from({ length: n }, (_, i) => ({ id: 't' + i, name: 'E' + i, color: 'rouge' })), settings: over });

test('tous contre tous : le bon nombre de matchs, chacun contre chacun une seule fois', () => {
  for (const n of [2, 3, 4, 5, 6, 7, 8, 12]) {
    const t = mk(n);
    assert.equal(t.matches.length, n * (n - 1) / 2, `n=${n}`);
    const pairs = new Set(t.matches.map((m) => [m.a, m.b].sort().join('-')));
    assert.equal(pairs.size, t.matches.length);
  }
});
test('aller-retour : deux fois plus de matchs', () => {
  assert.equal(mk(5, { format: 'double' }).matches.length, 20);
});
test('équilibre : tous jouent autant ; arbitrages à 1 près ; impair = égalité parfaite', () => {
  for (const n of [3, 4, 5, 6, 7, 8, 9, 10, 12]) {
    const t = mk(n);
    const b = T.balance(t.teams.map((x) => x.id), t.matches);
    assert.equal(b.playSpread, 0, `jeu n=${n}`);
    assert.ok(b.refSpread <= 1, `arbitrage n=${n} écart ${b.refSpread}`);
    if (n % 2) assert.equal(b.refSpread, 0, `impair n=${n}`);
    assert.equal(b.refMissing, 0);
  }
});
test('un arbitre ne joue jamais le match qu\'il arbitre ; 2 équipes = pas d\'arbitre', () => {
  const t = mk(6);
  for (const m of t.matches) assert.ok(m.ref && m.ref !== m.a && m.ref !== m.b);
  assert.ok(mk(2).matches.every((m) => m.ref === null));
  assert.equal(mk(3).matches.every((m) => m.ref && m.ref !== m.a && m.ref !== m.b), true);
});
test('pas de longue série : jamais plus de 3 créneaux d\'activité de suite avec 6 équipes', () => {
  const t = mk(6);
  assert.ok(T.balance(t.teams.map((x) => x.id), t.matches).maxRun <= 3);
});
test('2 terrains : 2 matchs en même temps, équipes distinctes ; arbitres à partir de 6 équipes', () => {
  const t = mk(8, { courts: 2 });
  const bySlot = {};
  for (const m of t.matches) (bySlot[m.slot] ||= []).push(m);
  assert.ok(Object.values(bySlot).some((s) => s.length === 2));
  for (const s of Object.values(bySlot)) {
    const used = s.flatMap((m) => [m.a, m.b, m.ref].filter(Boolean));
    assert.equal(new Set(used).size, used.length, 'personne à deux endroits à la fois');
  }
  assert.equal(mk(8, { courts: 2 }).matches.every((m) => m.ref), true);
  assert.equal(mk(3, { courts: 2 }).courts, 1, 'moins de 4 équipes : un seul terrain');
  assert.ok(mk(4, { courts: 2 }).matches.some((m) => !m.ref), 'à 4 équipes sur 2 terrains, un match reste sans arbitre');
});
test('classement : points de tournoi, différence, points marqués', () => {
  const t = mk(3);
  const set = (a, b, sa, sb) => { const m = t.matches.find((x) => [x.a, x.b].includes(a) && [x.a, x.b].includes(b)); if (m.a === a) { m.sa = sa; m.sb = sb; } else { m.sa = sb; m.sb = sa; } m.done = true; };
  set('t0', 't1', 5, 2); set('t0', 't2', 3, 3); set('t1', 't2', 1, 4);
  const s = T.standings(t);
  assert.deepEqual(s.map((r) => r.id), ['t0', 't2', 't1']);
  assert.equal(s[0].pts, 3 + 2); assert.equal(s[1].pts, 2 + 3); // t0 : V+N ; t2 : N+V
  assert.equal(s[0].diff, 3); assert.equal(s[1].diff, 3); assert.equal(s[0].pf, 8); assert.equal(s[1].pf, 7);
  assert.deepEqual(s.map((r) => r.rank), [1, 2, 3]);
});
test('égalité parfaite : résultat entre les deux équipes ; sinon ex æquo', () => {
  const t = mk(3);
  const set = (a, b, sa, sb) => { const m = t.matches.find((x) => [x.a, x.b].includes(a) && [x.a, x.b].includes(b)); if (m.a === a) { m.sa = sa; m.sb = sb; } else { m.sa = sb; m.sb = sa; } m.done = true; };
  // cycle : t0 bat t1, t1 bat t2, t2 bat t0, même score → tout est égal → ex æquo
  set('t0', 't1', 2, 1); set('t1', 't2', 2, 1); set('t2', 't0', 2, 1);
  assert.deepEqual(T.standings(t).map((r) => r.rank), [1, 1, 1]);
  const u = mk(2);
  u.matches[0].sa = 1; u.matches[0].sb = 0; u.matches[0].done = true;
  assert.deepEqual(T.standings(u).map((r) => [r.id, r.rank]), [[u.matches[0].a, 1], [u.matches[0].b, 2]]);
});
test('finales : remplies après la poule, arbitres parmi les équipes libres', () => {
  const t = mk(6, { finals: 'both' });
  assert.equal(t.matches.filter((m) => m.phase !== 'poule').length, 2);
  assert.equal(T.resolveFinals(t), false, 'poule non terminée');
  t.matches.filter((m) => m.phase === 'poule').forEach((m, i) => { m.sa = i % 3; m.sb = 1; m.done = true; });
  assert.equal(T.resolveFinals(t), true);
  const pf = t.matches.find((m) => m.phase === 'petite'), f = t.matches.find((m) => m.phase === 'finale');
  assert.ok(pf.a && pf.b && f.a && f.b && pf.ref && f.ref);
  const rk = T.standings(t).map((r) => r.id);
  assert.deepEqual([f.a, f.b], [rk[0], rk[1]]); assert.deepEqual([pf.a, pf.b], [rk[2], rk[3]]);
  assert.ok(rk.slice(4).includes(pf.ref) && rk.slice(4).includes(f.ref));
  assert.equal(T.resolveFinals(t), false, 'idempotent');
});
test('finales à 4 équipes : arbitrage par l\'équipe qui attend', () => {
  const t = mk(4, { finals: 'both' });
  t.matches.filter((m) => m.phase === 'poule').forEach((m, i) => { m.sa = i; m.sb = 0; m.done = true; });
  T.resolveFinals(t);
  const pf = t.matches.find((m) => m.phase === 'petite'), f = t.matches.find((m) => m.phase === 'finale');
  const rk = T.standings(t).map((r) => r.id);
  assert.ok([rk[0], rk[1]].includes(pf.ref));
  assert.ok([rk[2], rk[3]].includes(f.ref));
});
test('classement final : les finales l\'emportent', () => {
  const t = mk(4, { finals: 'final' });
  t.matches.filter((m) => m.phase === 'poule').forEach((m, i) => { m.sa = 3; m.sb = i % 2; m.done = true; });
  T.resolveFinals(t);
  const f = t.matches.find((m) => m.phase === 'finale');
  f.sa = 0; f.sb = 1; f.done = true;
  assert.equal(T.finalStandings(t)[0].id, f.b);
});
test('points : ajout, retrait jamais sous zéro, annulation', () => {
  const m = { sa: 0, sb: 0, log: [] };
  T.addPoint(m, 'a', 2); T.addPoint(m, 'a', 1); assert.equal(m.sa, 3);
  assert.equal(T.addPoint(m, 'b', -1), 0); assert.equal(m.sb, 0);
  T.undoPoint(m); assert.equal(m.sa, 2); T.undoPoint(m); assert.equal(m.sa, 0); assert.equal(T.undoPoint(m), false);
});
test('« j\'ai X minutes » : toujours à la baisse, avec les temps de changement', () => {
  const p = T.planTime({ minutes: 40, n: 4, matchMin: 5, changeover: 2 });
  assert.ok(p.minutesUsed <= 40 - 2, `utilise ${p.minutesUsed} min`);
  assert.equal(p.perTeam, 2); // 5 créneaux = 5 matchs ; 5*2/4 = 2
  assert.equal(p.totalMatches, 4);
  assert.equal(T.planTime({ minutes: 200, n: 4, matchMin: 5, changeover: 2 }).full, true);
  assert.equal(T.planTime({ minutes: 5, n: 6, matchMin: 5, changeover: 2 }).possible, false);
  assert.equal(T.planTime({ minutes: 60, n: 5, matchMin: 5, changeover: 2 }).uneven, true);
});
test('nombre de matchs imposé : chaque équipe joue k matchs (nombre pair d\'équipes)', () => {
  const t = mk(6, { perTeam: 3 });
  const plays = T.balance(t.teams.map((x) => x.id), t.matches).plays;
  assert.ok(Object.values(plays).every((v) => v === 3));
  const u = mk(5, { perTeam: 3 });
  const pl = Object.values(T.balance(u.teams.map((x) => x.id), u.matches).plays);
  assert.ok(Math.max(...pl) - Math.min(...pl) <= 1);
});
test('chronomètre de match : phases, changement à la moitié, signal de 10 s', () => {
  const t = mk(4, { halves: 1, halfMin: 5, change: { on: true, mode: 'mid' } });
  assert.deepEqual(T.changeTimes(t), [150000]);
  assert.equal(T.changeState(t, 100000).now, false);
  assert.equal(T.changeState(t, 155000).now, true);
  assert.equal(T.changeState(t, 161000), null);
  assert.equal(T.phaseAt(t, 299999), 'h1'); assert.equal(T.phaseAt(t, 300000), 'fin');
  const u = mk(4, { halves: 2, halfMin: 5, pauseMin: 2, change: { on: true, mode: 'mid' } });
  assert.equal(T.matchMinutes(u), 12);
  assert.deepEqual(T.changeTimes(u), [150000, 300000 + 120000 + 150000]);
  assert.equal(T.phaseAt(u, 310000), 'pause'); assert.equal(T.phaseAt(u, 430000), 'h2');
  assert.deepEqual(T.changeTimes(mk(4, { change: { on: true, mode: 'custom', custom: '1:30, 3:00' } })), [90000, 180000]);
  assert.deepEqual(T.changeTimes(mk(4)), [150000]); // 1.9 : indicateur activé par défaut
  assert.deepEqual(T.changeTimes(mk(4, { change: { on: false } })), []);
});
test('chrono en direct : démarrer, pause, reprise', () => {
  let lv = T.liveStart(null, 'm1', 1000);
  assert.equal(T.liveElapsed(lv, 4000), 3000);
  lv = T.livePause(lv, 4000); assert.equal(T.liveElapsed(lv, 9000), 3000);
  lv = T.liveStart(lv, 'm1', 10000); assert.equal(T.liveElapsed(lv, 12000), 5000);
  assert.equal(T.liveElapsed(T.liveStart(lv, 'm2', 10000), 11000), 1000, 'autre match : repart de zéro');
});
test('sport selon l\'activité', () => {
  assert.equal(T.sportFromActivity('Basket-ball'), 'basket'); assert.equal(T.sportFromActivity('Handball (démo)'), 'handball');
  assert.equal(T.sportFromActivity('Badminton'), 'autre');
  assert.deepEqual(T.scoreButtons({ sport: 'basket' }), [1, 2, 3, -1]); assert.deepEqual(T.scoreButtons({ sport: 'futsal' }), [1, -1]);
});

import * as R from '../js/logic/results.js';
const finished = (teams, setId, scores) => {
  const t = T.newTournament({ name: 'T', date: '2026-11-27', teams, scope: 'act', ctx: { setId } });
  t.matches.forEach((m, i) => { const sc = scores(m, i); m.sa = sc[0]; m.sb = sc[1]; m.done = true; });
  return t;
};
test('résultats : club = somme de ses équipes + bonus ; équipes durables ; filtre par composition', () => {
  const tm = (id, teamId, clubId, color) => ({ id, teamId, clubId, name: teamId, color, members: [id + 's'] });
  const A = [tm('a1', 'tA1', 'c1', 'rouge'), tm('a2', 'tB1', 'c2', 'vert'), tm('a3', 'tC1', 'c3', 'jaune')];
  const B = [tm('b1', 'tA2', 'c1', 'rouge'), tm('b2', 'tB2', 'c2', 'vert')];
  const t1 = finished(A, 's1', (m) => (m.a === 'a1' || m.b === 'a1' ? (m.a === 'a1' ? [3, 0] : [0, 3]) : [1, 1]));
  const t2 = finished(B, 's2', () => [2, 1]);
  const act = { tournois: [t1, t2], equipes: { sets: [{ clubs: [{ id: 'c1', name: 'Club 1', color: 'rouge' }, { id: 'c2', name: 'Club 2', color: 'vert' }, { id: 'c3', name: 'Club 3', color: 'jaune' }] }], bonus: [] } };
  const s = R.summarize(act);
  const c1 = s.clubs.find((c) => c.id === 'c1');
  assert.equal(c1.teams.length, 2);
  assert.equal(c1.pts, c1.teams.reduce((a, x) => a + x.pts, 0));
  R.addBonus(act, { kind: 'club', ref: 'c1', pts: 2, reason: 'fair-play' });
  R.addBonus(act, { kind: 'team', ref: 'tA1', pts: -1, reason: 'retard' });
  const s2 = R.summarize(act);
  const c1b = s2.clubs.find((c) => c.id === 'c1');
  assert.equal(c1b.total, c1.pts + 2 - 1);
  assert.equal(s2.all.find((e) => e.id === 'tA1').total, c1.teams.find((x) => x.id === 'tA1').pts - 1);
  const only1 = R.summarize(act, { setId: 's1' });
  assert.equal(only1.all.find((e) => e.id === 'tA2'), undefined);
  assert.equal(R.summarize({ tournois: [], equipes: { sets: [] } }).all.length, 0);
});
test('tournois en cours ignorés ; palmarès : rang sur nombre d\'équipes, absents exclus', () => {
  const teams = [1, 2, 3, 4].map((i) => ({ id: 'x' + i, name: 'E' + i, color: 'rouge', members: i === 1 ? ['eleve1'] : [] }));
  const t = finished(teams, 's', (m) => (m.a === 'x1' ? [5, 0] : m.b === 'x1' ? [0, 5] : [1, 0]));
  const open = T.newTournament({ name: 'Ouvert', date: '2026-12-01', teams, scope: 'act' });
  const act = { tournois: [t, open], equipes: { sets: [] } };
  assert.equal(R.doneTournaments(act).length, 1);
  const p = R.palmares(act, 'eleve1');
  assert.equal(p.length, 1); assert.equal(p[0].rank, 1); assert.equal(p[0].of, 4);
  assert.deepEqual(R.palmares(act, 'absent'), []);
  assert.equal(R.ordinalFr(1), '1er'); assert.equal(R.ordinalFr(3), '3e');
});
