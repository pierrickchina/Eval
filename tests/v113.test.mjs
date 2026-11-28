import test from 'node:test';
import assert from 'node:assert/strict';
import * as TD from '../js/logic/today.js';
import * as T from '../js/logic/teams.js';
import * as IV from '../js/logic/intervals.js';
import { toolFits, toolsForActivity } from '../js/logic/activities.js';
import { todayISO } from '../js/util.js';

test('Séance du jour : statuts du jour, nouveau jour = tous présents, tirage parmi ceux qui pratiquent', () => {
  const cls = { students: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] };
  TD.setToday(cls, 'a', 'absent'); TD.setToday(cls, 'b', 'inapte');
  assert.equal(TD.statusToday(cls, 'a'), 'absent'); assert.ok(!TD.practices(cls, 'b')); assert.ok(TD.practices(cls, 'c'));
  assert.deepEqual(TD.countsToday(cls, cls.students), { present: 1, absent: 1, dispense: 0, inapte: 1 });
  for (let i = 0; i < 10; i++) assert.equal(TD.draw(cls, cls.students).id, 'c');
  assert.equal(TD.nextStatus('present'), 'absent'); assert.equal(TD.nextStatus('inapte'), 'present');
  cls.today.date = '2000-01-01';
  assert.ok(TD.practices(cls, 'a'), 'un autre jour : présent');
  assert.equal(TD.todayOf(cls).date, todayISO());
});

test('Équipes : 1 équipe = 1 club, 1 club = 1 équipe (joueurs conservés)', () => {
  const set = T.newSet({ name: 'L1' }); const a = T.addTeam(set), b = T.addTeam(set);
  a.members = ['s1', 's2']; b.members = ['s3'];
  T.teamsToClubs(set);
  assert.equal(set.mode, 'clubs'); assert.equal(set.clubs.length, 2);
  assert.equal(set.clubs[0].name, 'Équipe 1'); assert.deepEqual(T.poolOf(set, set.clubs[0].id).members, ['s1', 's2']);
  T.clubsToTeams(set);
  assert.equal(set.mode, 'teams'); assert.deepEqual(T.teamsOnly(set).map((t) => t.members), [['s1', 's2'], ['s3']]);
});

test('Circuit training : défi de classe = relais de 5 × 30 s, 4 exercices, 2 blocs, 2 min 30 entre les blocs', () => {
  const c = { ...IV.CT_PRESETS.find((p) => p.id === 'defi').cfg, prep: 0 };
  assert.equal(IV.totalOf(c), 25 * 60 + 30);
  const s = IV.intervalAt(c, 95000); // 3e élève du 1er exercice ? 95 s = 3 × 30 + 5 → élève 4
  assert.equal(s.phase, 'work'); assert.equal(s.slot, 4); assert.equal(s.station, 1);
  assert.equal(IV.intervalAt(c, 155000).phase, 'rest'); // transition après 5 × 30 s
});

test('Outils selon l\'activité : un outil peut servir à plusieurs activités', () => {
  assert.ok(toolFits('mariokart', 'Jeux athlétiques') && toolFits('mariokart', 'Duathlon'));
  assert.ok(toolFits('vma', 'Duathlon') && !toolFits('vma', 'Course d\'orientation'));
  assert.ok(toolFits('circuit', 'Boxe française') && toolFits('kabaddi', 'Lutte') && !toolFits('tables', 'Boxe'));
  assert.ok(toolFits('rotation', 'Gymnastique') && toolFits('arbitre', 'Acrosport'));
  assert.deepEqual(toolsForActivity('Jeux athlétiques'), ['evaluation', 'mariokart', 'vma', 'chrono']);
});
