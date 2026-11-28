import test from 'node:test';
import assert from 'node:assert/strict';
import * as KB from '../js/logic/kabaddi.js';
import * as MT from '../js/logic/montee.js';
import * as IC from '../js/logic/interclasses.js';
import * as TN from '../js/logic/tournament.js';
import * as KV from '../js/logic/kivaou.js';
import { newSet, addClub, setBasketClubs, NBA_TEAMS, teamsOnly, teamLabel } from '../js/logic/teams.js';

test('Kabaddi : +100 à la 1re élimination d\'un attaquant, puis +10 ; Ace +1000 ; faute −1 ; 6 attaques pour 3 équipes', () => {
  const st = KB.newKabaddi(3);
  assert.equal(st.attacks.length, 6);
  const a = st.attacks[0];
  assert.equal(KB.playerValue(a, 4), 100);
  KB.tapPlayer(a, 4); assert.equal(KB.playerValue(a, 4), 10); assert.equal(KB.playerValue(a, 5), 100);
  KB.tapPlayer(a, 4); KB.tapPlayer(a, 5); KB.addFaute(a); KB.addAce(a); KB.addAce(a);
  assert.equal(KB.scoreOf(a), 100 + 10 + 100 - 1 + 1000);
  assert.equal(KB.teamTotal(st, a.att), 1209);
  KB.undo(a); assert.equal(KB.scoreOf(a), 209);
  assert.equal(KB.ranking(st)[0].id, a.att);
  KB.setTeamCount(st, 4); assert.equal(st.attacks.length, 12);
  assert.ok(st.attacks.some((x) => x.id === a.id), 'attaques déjà jouées gardées');
});

test('Boxe FPS : chaque groupe avance d\'un atelier à chaque rotation', async () => {
  const { groupAt } = await import('../js/ui/boxeView.js').catch(() => ({ groupAt: (i, rot, n = 6) => ((i - rot) % n + n) % n }));
  assert.deepEqual([0, 1, 2, 3, 4, 5].map((i) => groupAt(i, 0)), [0, 1, 2, 3, 4, 5]);
  assert.deepEqual([0, 1, 2, 3, 4, 5].map((i) => groupAt(i, 1)), [5, 0, 1, 2, 3, 4]); // A passe à l'atelier 2
});

test('Montée de niveau : 3 fiches de 10 défis, niveaux vides réduits', () => {
  assert.equal(MT.MONTEE_SHEETS.length, 4);
  assert.ok(MT.MONTEE_SHEETS.every((s) => s.levels.length === 10));
  assert.equal(MT.MONTEE_SHEETS[0].levels[9], 'Match en 21 points');
  const act = {}; const M = MT.monteeOf(act);
  MT.setLevel(M, 'a', 3); MT.setLevel(M, 'b', 3); MT.setLevel(M, 'c', 12);
  assert.equal(MT.placeOf(M).c, 10);
  const w = MT.weights(M, ['a', 'b', 'c', 'd']);
  assert.ok(w[0] > 0, '1.12 : « d » part du niveau 1'); assert.ok(w[2] > w[9]); assert.equal(MT.levelOf(M, 'd'), 1);
  MT.setLevel(M, 'a', 0); assert.equal(MT.levelOf(M, 'a'), 0);
});

test('Interclasses : deux tournois, alternance sur un terrain, sponsor, coach', () => {
  const { ic, ts } = IC.newInterclasses({ name: 'IC', date: '2026-12-08', sport: 'ultimate', level: '4e', classes: ['4A', '4B', '4C', '4D', '4E'], shared: true });
  const rec = { ic, ts };
  assert.deepEqual(ts.map((t) => t.label), ['Frisbee', 'Disque']);
  assert.equal(ts[0].matches.length, 10); assert.ok(ts.every((t) => t.shared && t.board === 'suivi'));
  const up = IC.upcoming(rec, 4);
  assert.deepEqual(up.map((x) => x.t.label), ['Frisbee', 'Disque', 'Frisbee', 'Disque']);
  IC.setSponsor(rec, ts[0], ts[0].teams[2].id, true);
  assert.equal(TN.standings(ts[0]).find((x) => x.id === ts[0].teams[2].id).pts, 1);
  // la classe 4A gagne tous ses matchs dans les deux tournois
  for (const t of ts) for (const m of t.matches) { const a = t.teams.find((x) => x.id === m.a); m.sa = a.name === '4A' ? 3 : 1; m.sb = a.name === '4A' ? 0 : 1; const b = t.teams.find((x) => x.id === m.b); if (b.name === '4A') { m.sa = 0; m.sb = 3; } m.done = true; }
  assert.equal(IC.coachClass(rec).name, '4A');
  assert.equal(IC.classRanking(rec)[0].name, '4A');
  const b = IC.newInterclasses({ name: 'IC', date: '2026-02-10', sport: 'basket', level: '5e', classes: ['5A', '5B'] });
  assert.deepEqual(b.ts.map((t) => t.label), ['Filles', 'Garçons']);
});

test('Tournoi : deux tournois sur un terrain (à qui le tour), égaliser le temps', () => {
  const mk = (n, side) => { const t = TN.newTournament({ name: side, date: '2026-11-27', teams: Array.from({ length: n }, (_, i) => ({ id: side + i, name: side + i, color: 'rouge' })), side }); t.shared = true; return t; };
  const a = mk(3, 'A'), b = mk(4, 'B');
  assert.equal(TN.sharedTurn([a, b]), a);
  a.matches[0].done = true;
  assert.equal(TN.sharedTurn([a, b]), b);
  b.matches[0].sa = 1; a.matches[0].done = true;
  assert.equal(TN.sharedTurn([a, b]), b, 'un match commencé reste prioritaire');
  assert.equal(TN.equalizedMinutes(6, 3, 6), 3);
  assert.equal(TN.equalizedMinutes(6, 6, 6), 6);
});

test('Club Basket : noms NBA, équipe 1 = FIBA, équipe 2 = NBA', () => {
  const set = newSet({ name: 'L', date: '2026-11-27', mode: 'clubs', students: [] });
  addClub(set); addClub(set);
  setBasketClubs(set, true, () => 0);
  assert.ok(set.clubs.every((c) => NBA_TEAMS.includes(c.name)));
  assert.notEqual(set.clubs[0].name, set.clubs[1].name);
  const labels = teamsOnly(set).filter((t) => t.kind === 'team').map((t) => teamLabel(set, t));
  assert.ok(labels.some((l) => l.endsWith('FIBA')) && labels.some((l) => l.endsWith('NBA')));
  addClub(set); assert.ok(NBA_TEAMS.includes(set.clubs[2].name));
  setBasketClubs(set, false); assert.equal(set.clubs[0].name, 'Club 1');
});

test('Kivaou : bilan depuis le début, par élève', () => {
  const K = { settings: { ...KV.KV_DEFAULT }, sessions: [] };
  const s1 = KV.todaySession(K, '2026-11-20');
  const g = KV.addGroup(K, s1, ['a', 'b'], 'A'); g.start = 1; g.end = 1 + 10 * 60000; g.found = 5;
  const s2 = { id: 's2', date: '2026-11-27', groups: [] }; K.sessions.push(s2);
  const g2 = KV.addGroup(K, s2, ['a'], 'defi'); g2.start = 1; g2.end = 1 + 25 * 60000; g2.found = 10;
  const o = KV.overall(K, ['a', 'b']);
  assert.equal(o[0].runs, 2); assert.equal(o[0].found, 15); assert.equal(o[0].sought, 16); assert.equal(o[0].late, 1); assert.equal(o[0].best, 10 * 60000);
  assert.equal(o[1].runs, 1);
});
