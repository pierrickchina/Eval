// Tests v1.6 : logique des équipes (tailles, tirages, niveaux, tutorat, contraintes, clubs, évaluation).
import test from 'node:test';
import assert from 'node:assert/strict';
import { newModel, newCompetence, newClass, newStudent } from '../js/data/schema.js';
import { createEvaluation } from '../js/logic/evaluation.js';
import { setScore } from '../js/logic/scoring.js';
import {
  newSet, addTeam, addClub, teamsOnly, teamSizes, countForSize, moveStudent, setStatus, toggleRole, visibleRole, toggleLock,
  duplicateSet, unplaced, teamOfStudent, syncStudents, generate, duos, levelScores, rngFrom, copyIntoEvaluation, assign,
} from '../js/logic/teams.js';

const mkStudents = (n) => Array.from({ length: n }, (_, i) => ({ id: 's' + i, first: 'E' + i, initial: '' }));
const sizes = (set) => teamsOnly(set).map((t) => t.members.length);
const allPlaced = (set) => teamsOnly(set).flatMap((t) => t.members);

test('tailles : nombre d\'équipes, taille, ou les deux — toujours une solution', () => {
  assert.deepEqual(teamSizes(28, { teams: 5 }), [6, 6, 6, 5, 5]);
  assert.deepEqual(teamSizes(28, { size: 5 }), [5, 5, 5, 5, 4, 4]);
  assert.deepEqual(teamSizes(28, { teams: 5, size: 5 }), [6, 6, 6, 5, 5], 'le nombre d\'équipes prime, tailles au plus proche');
  assert.deepEqual(teamSizes(3, { teams: 8 }), [1, 1, 1], 'jamais d\'équipe vide');
  assert.deepEqual(teamSizes(0, { teams: 3 }), []);
  assert.equal(countForSize(28, 5), 6);
  assert.equal(countForSize(10, 5), 2);
});

test('déplacements, absents, dispensés, rôles, verrous', () => {
  const set = newSet({ name: 'L1' });
  const A = addTeam(set), B = addTeam(set);
  assert.equal(A.name, 'Équipe 1');
  assert.notEqual(A.color, B.color);
  moveStudent(set, 's1', A.id); moveStudent(set, 's1', B.id);
  assert.deepEqual([A.members, B.members], [[], ['s1']]);
  setStatus(set, 's1', 'dispense');
  assert.deepEqual(B.members, ['s1'], 'un dispensé reste dans son équipe');
  toggleRole(set, 's1', 'officiel'); toggleRole(set, 's1', 'capitaine');
  assert.equal(visibleRole(set, 's1').id, 'officiel', 'plusieurs rôles, le premier est visible');
  toggleRole(set, 's1', 'officiel');
  assert.equal(visibleRole(set, 's1').id, 'capitaine');
  setStatus(set, 's1', 'absent');
  assert.deepEqual(B.members, [], 'un absent quitte son équipe');
  moveStudent(set, 's1', A.id);
  assert.equal(set.status.s1, undefined, 'placer un absent le rend présent');
  toggleLock(set, 's1'); assert.equal(set.locked.s1, true);
  assert.equal(unplaced(set, mkStudents(3)).length, 2);
});

test('arrivée / départ d\'élèves : non placé / retiré', () => {
  const set = newSet(); const A = addTeam(set);
  moveStudent(set, 's0', A.id); moveStudent(set, 's1', A.id); set.roles.s1 = ['capitaine'];
  syncStudents(set, ['s0', 's2']);
  assert.deepEqual(A.members, ['s0']);
  assert.equal(set.roles.s1, undefined);
  assert.deepEqual(unplaced(set, mkStudents(3).filter((s) => s.id !== 's1')).map((s) => s.id), ['s2']);
});

test('duplication : mêmes équipes (mêmes identifiants), absences effacées, parenté gardée', () => {
  const set = newSet({ name: 'Leçon 1' }); const A = addTeam(set);
  moveStudent(set, 's0', A.id); set.status.s9 = 'absent';
  const c = duplicateSet(set, { name: 'Leçon 2', date: '2026-12-01' });
  assert.notEqual(c.id, set.id); assert.equal(c.parentId, set.id);
  assert.equal(c.teams[0].id, A.id, 'l\'équipe reste la même entité');
  assert.deepEqual(c.status, {});
  c.teams[0].members.push('s5');
  assert.deepEqual(A.members, ['s0'], 'copie indépendante');
});

test('tirage aléatoire : tout le monde placé une fois, tailles équilibrées, reproductible', () => {
  const st = mkStudents(28);
  const a = newSet(); generate(a, st, { mode: 'random', teams: 5, seed: 7 });
  assert.deepEqual(sizes(a).sort(), [5, 5, 6, 6, 6]);
  assert.equal(new Set(allPlaced(a)).size, 28);
  const b = newSet(); generate(b, st, { mode: 'random', teams: 5, seed: 7 });
  assert.deepEqual(teamsOnly(a).map((t) => t.members), teamsOnly(b).map((t) => t.members));
});

test('absents jamais placés, dispensés laissés non placés', () => {
  const st = mkStudents(10); const set = newSet();
  setStatus(set, 's0', 'absent'); setStatus(set, 's1', 'dispense');
  generate(set, st, { mode: 'random', teams: 2, seed: 1 });
  const placed = allPlaced(set);
  assert.equal(placed.length, 8);
  assert.ok(!placed.includes('s0') && !placed.includes('s1'));
});

test('niveaux : équipes équilibrées (moyennes proches) et groupes de niveau (homogènes)', () => {
  const st = mkStudents(12);
  const scores = new Map(st.map((s, i) => [s.id, (i + 1) / 12]));
  const bal = newSet(); generate(bal, st, { mode: 'balanced', teams: 3, scores, seed: 3 });
  const means = teamsOnly(bal).map((t) => t.members.reduce((a, s) => a + scores.get(s), 0) / t.members.length);
  assert.ok(Math.max(...means) - Math.min(...means) < 0.1, 'moyennes proches : ' + means);
  const lev = newSet(); generate(lev, st, { mode: 'levels', teams: 3, scores, seed: 3 });
  const [g1, g2, g3] = teamsOnly(lev).map((t) => t.members.map((s) => scores.get(s)));
  assert.ok(Math.min(...g1) > Math.max(...g2) && Math.min(...g2) > Math.max(...g3), 'groupes ordonnés par niveau');
});

test('élèves sans résultat : placés au milieu, aucun blocage', () => {
  const st = mkStudents(6);
  const scores = new Map([['s0', 0.9], ['s1', 0.2]]);
  const set = newSet(); generate(set, st, { mode: 'balanced', teams: 2, scores, seed: 2 });
  assert.equal(allPlaced(set).length, 6);
});

test('duos de tutorat : fort ↔ milieu, trio si impair', () => {
  const ids = mkStudents(6).map((s) => s.id);
  const scores = new Map(ids.map((s, i) => [s, 1 - i / 10]));
  const g = duos(ids, scores, rngFrom(1));
  assert.deepEqual(g.map((x) => x.length), [2, 2, 2]);
  assert.deepEqual(g[0], ['s0', 's3']);
  const g5 = duos(ids.slice(0, 5), scores, rngFrom(1));
  assert.deepEqual(g5.map((x) => x.length).sort(), [2, 3]);
  const set = newSet(); generate(set, mkStudents(7), { mode: 'tutor', seed: 1 });
  assert.equal(teamsOnly(set).length, 3);
  assert.equal(allPlaced(set).length, 7);
});

test('verrous : les élèves verrouillés gardent leur équipe au « mélanger de nouveau »', () => {
  const st = mkStudents(12); const set = newSet();
  generate(set, st, { mode: 'random', teams: 3, seed: 1 });
  const t0 = teamsOnly(set)[0];
  const keep = t0.members.slice(0, 2); keep.forEach((s) => toggleLock(set, s));
  for (const seed of [2, 3, 4]) {
    generate(set, st, { mode: 'random', teams: 3, seed });
    assert.ok(keep.every((s) => teamOfStudent(set, s).id === t0.id), 'toujours dans la même équipe');
    assert.equal(new Set(allPlaced(set)).size, 12);
    assert.deepEqual(sizes(set).sort(), [4, 4, 4]);
  }
});

test('contraintes : ensemble / séparés respectées ; contradiction = maximum possible, sans blocage', () => {
  const st = mkStudents(12);
  for (let seed = 1; seed <= 6; seed++) {
    const set = newSet();
    set.constraints = [{ a: 's0', b: 's1', type: 'together' }, { a: 's2', b: 's3', type: 'apart' }, { a: 's4', b: 's5', type: 'apart' }];
    const r = generate(set, st, { mode: 'random', teams: 3, seed });
    assert.equal(r.violated.length, 0, 'seed ' + seed);
    assert.equal(teamOfStudent(set, 's0').id, teamOfStudent(set, 's1').id);
    assert.notEqual(teamOfStudent(set, 's2').id, teamOfStudent(set, 's3').id);
  }
  const bad = newSet();
  bad.constraints = [{ a: 's0', b: 's1', type: 'together' }, { a: 's0', b: 's1', type: 'apart' }];
  const r = generate(bad, st, { mode: 'random', teams: 3, seed: 1 });
  assert.equal(r.violated.length, 1, 'une des deux contraintes contradictoires reste non respectée');
  assert.equal(allPlaced(bad).length, 12);
});

test('clubs : 3 zones par club, génération dans « à répartir », séparation à la main', () => {
  const st = mkStudents(16); const set = newSet({ mode: 'clubs' });
  generate(set, st, { mode: 'random', teams: 4, seed: 1 });
  assert.equal(set.clubs.length, 4);
  const pools = set.teams.filter((t) => t.kind === 'pool');
  assert.deepEqual(pools.map((p) => p.members.length), [4, 4, 4, 4]);
  const club = set.clubs[0], p = pools[0];
  const t1 = set.teams.find((t) => t.clubId === club.id && t.rank === 1), t2 = set.teams.find((t) => t.clubId === club.id && t.rank === 2);
  moveStudent(set, p.members[0], t1.id); moveStudent(set, p.members[0], t2.id);
  assert.equal(t1.name, 'Équipe 1'); assert.equal(t2.name, 'Équipe 2');
  assert.equal(teamsOnly(set).length, 8);
});

test('niveau d\'après les évaluations : moyenne ou évaluation précise', () => {
  const cls = newClass('6e A', '6e');
  ['Léa', 'Tom', 'Inès'].forEach((f) => cls.students.push(newStudent(f)));
  const m = newModel(); m.name = 'G'; m.activity = 'Hand';
  m.levels['6e'] = { competences: [10, 10].map((x, i) => Object.assign(newCompetence(x), { name: 'C' + i })) };
  const ev = createEvaluation({ cls, model: m, date: '2026-10-01' });
  ev.model.competences.forEach((c) => { setScore(ev, cls.students[0].id, c.id, c.max); setScore(ev, cls.students[1].id, c.id, c.max / 2); });
  const s = levelScores(cls, [ev], 'mean');
  assert.equal(s.get(cls.students[0].id), 1);
  assert.equal(s.get(cls.students[1].id), 0.5);
  assert.equal(s.has(cls.students[2].id), false, 'sans résultat : absent de la liste');
  assert.equal(levelScores(cls, [ev], ev.id).get(cls.students[0].id), 1);
});

test('reprise dans une évaluation : groupes d\'équipe figés, statuts à confirmer', () => {
  const cls = newClass('6e A', '6e');
  ['Léa', 'Tom', 'Inès'].forEach((f) => cls.students.push(newStudent(f)));
  const m = newModel(); m.name = 'G'; m.activity = 'Hand';
  m.levels['6e'] = { competences: [Object.assign(newCompetence(20), { name: 'C' })] };
  const ev = createEvaluation({ cls, model: m, date: '2026-10-01' });
  const set = newSet({ name: 'L1' }); const A = addTeam(set); A.color = 'vert';
  moveStudent(set, cls.students[0].id, A.id); setStatus(set, cls.students[2].id, 'absent');
  const r = copyIntoEvaluation(ev, set);
  const g = ev.groups.find((x) => x.type === 'team');
  assert.equal(g.id, A.id); assert.equal(g.name, 'Équipe 1');
  assert.equal(ev.membership[cls.students[0].id].team, A.id);
  assert.deepEqual(r.statuses, { [cls.students[2].id]: 'absent' });
  copyIntoEvaluation(ev, set);
  assert.equal(ev.groups.filter((x) => x.type === 'team').length, 1, 'mise à jour : pas de doublon');
});

test('assign : places insuffisantes → on élargit, personne n\'est oublié', () => {
  const out = assign({ players: ['a', 'b', 'c', 'd', 'e'], containers: [{ id: 1, fixed: [] }, { id: 2, fixed: [] }], sizes: [2, 2], mode: 'random', rng: rngFrom(1) });
  assert.equal(out.size, 5);
});
