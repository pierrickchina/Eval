import test from 'node:test';
import assert from 'node:assert/strict';
import { libraryModels, installLibrary, originalOf, LIBRARY_SUMMARY } from '../js/data/library.js';
import { defaultLevels } from '../js/data/schema.js';
import { validateModel, levelForScore } from '../js/logic/model.js';
import { parseTime, timeLevel, zoneLevel, gapLevel, perfResult } from '../js/logic/perf.js';
import * as LD from '../js/logic/ladder.js';
import { intervalAt } from '../js/logic/intervals.js';
import * as MK from '../js/logic/mariokart.js';
import { newSet, addTeam, rotateRoles } from '../js/logic/teams.js';
import * as T from '../js/logic/tournament.js';

let k = 0; const uid = () => 'u' + (k++);
const lib = () => libraryModels({ uid, defaultLevels });

test('bibliothèque : chaque grille totalise 20 et suit les points du projet', () => {
  for (const m of lib()) assert.ok(validateModel(m).ok, m.activity);
  assert.equal(LIBRARY_SUMMARY.length, 19);
  assert.ok(LIBRARY_SUMMARY.every((x) => x.total === 20));
  const ct = lib().find((m) => m.activity === 'Circuit training').levels['3e'].competences[0];
  assert.deepEqual(ct.levels.map((l) => l.value), [0, 2, 3, 5]);
  for (const l of ct.levels) assert.equal(levelForScore(ct, l.value), l.key, `${l.key} cohérent`);
  const mk = lib().find((m) => m.activity === 'Mario Kart');
  assert.deepEqual(Object.keys(mk.levels), ['5e']);
  assert.equal(mk.levels['5e'].competences.length, 5);
  assert.deepEqual(Object.keys(lib().find((m) => m.activity === 'Boxe française').levels), ['3e']);
  assert.deepEqual(Object.keys(lib().find((m) => m.activity === 'Vélo').levels), ['5e']);
  assert.ok(!lib().some((m) => /th[eè]que/i.test(m.activity)));
  const tt3 = lib().find((m) => m.activity === 'Tennis de table').levels['3e'].competences.find((c) => c.name === 'Joueur fair-play');
  const tt4 = lib().find((m) => m.activity === 'Tennis de table').levels['4e'].competences.find((c) => c.name === 'Joueur fair-play');
  assert.deepEqual(tt3.levels.map((l) => l.text), tt4.levels.map((l) => l.text));
});

test('bibliothèque v2 : Duathlon remplacé s\'il n\'a pas été modifié, 6e sans note', async () => {
  const { upgradeLibrary } = await import('../js/data/library.js');
  const store = new Map(); const meta = new Map([['libraryVersion', 1]]);
  const repo = { list: () => [...store.values()], save: async (_s, m) => store.set(m.id, m), getMeta: (key, d) => (meta.has(key) ? meta.get(key) : d), setMeta: async (key, v) => meta.set(key, v) };
  const old = { id: 'lib-duathlon', activity: 'Duathlon', library: 'projet-eps-jjr', levels: { '4e': { competences: [{ name: 'Athlète compétent (course)', max: 8 }, { name: 'Athlète compétent (lancer)', max: 4 }, { name: 'Élève investi', max: 4 }, { name: 'Élève observateur', max: 4 }] } } };
  const gym = { id: 'lib-gymnastique', activity: 'Gymnastique', library: 'projet-eps-jjr', levels: { '6e': { competences: [{ name: 'x', max: 20 }] } } };
  store.set(old.id, old); store.set(gym.id, gym);
  const r = await upgradeLibrary(repo, { uid, defaultLevels });
  assert.deepEqual(r.pending, []);
  assert.equal(store.get('lib-duathlon').levels['4e'].competences[0].name, 'Course');
  assert.equal(store.get('lib-gymnastique').levels['6e'].noScore, true);
  // grille corrigée par l'enseignant : en attente
  meta.set('libraryVersion', 1); const mod = { ...old, id: 'm2', levels: { '4e': { competences: [{ name: 'Ma course', max: 10 }] } } }; store.clear(); store.set('m2', mod);
  assert.equal((await upgradeLibrary(repo, { uid, defaultLevels })).pending.length, 1);
});

test('bibliothèque : installée une fois, modèles corrigés jamais écrasés, origine récupérable', async () => {
  const store = new Map(); const meta = new Map();
  const repo = { list: () => [...store.values()].filter((m) => !m.deleted), save: async (_s, m) => store.set(m.id, m), getMeta: (key, d) => (meta.has(key) ? meta.get(key) : d), setMeta: async (key, v) => meta.set(key, v) };
  assert.equal(await installLibrary(repo, { uid, defaultLevels }), 12);
  assert.equal(await installLibrary(repo, { uid, defaultLevels }), 0);
  const velo = repo.list().find((m) => m.activity === 'Vélo');
  velo.levels['5e'].competences[0].max = 12; velo.deleted = true;
  assert.equal(await installLibrary(repo, { uid, defaultLevels, force: true }), 1); // le Vélo supprimé revient
  const o = originalOf(velo, { uid, defaultLevels });
  assert.equal(o.id, velo.id); assert.equal(o.levels['5e'].competences[0].max, 10);
});

test('Duathlon : temps, zone, écart au projet → niveau', () => {
  assert.equal(parseTime("7'45"), 465); assert.equal(parseTime('8'), 480); assert.equal(parseTime('7:05'), 425); assert.equal(parseTime(''), null);
  assert.equal(timeLevel(11 * 60 + 1, 'G'), 0); assert.equal(timeLevel(11 * 60, 'G'), 1); assert.equal(timeLevel(8 * 60, 'G'), 2); assert.equal(timeLevel(359, 'G'), 3);
  assert.equal(timeLevel(8 * 60, 'F'), 2); assert.equal(timeLevel(8.5 * 60 + 1, 'F'), 1); assert.equal(timeLevel(389, 'F'), 3);
  assert.deepEqual([0, 1, 2, 3, 4, 5].map((z) => zoneLevel(z, 'G')), [0, 0, 1, 2, 2, 3]);
  assert.deepEqual([0, 1, 2, 3, 4, 5].map((z) => zoneLevel(z, 'F')), [0, 1, 2, 2, 3, 3]);
  assert.equal(gapLevel(5, 2), 3); assert.equal(gapLevel(25, 2), 2); assert.equal(gapLevel(5, 1), 1); assert.equal(gapLevel(70, 2), 0);
  // 1.10 : grilles des fiches élèves (3e : Course /6, Lancer /2, Projet /4, Observation /4, Coach /4)
  const d = lib().find((m) => m.activity === 'Duathlon');
  assert.deepEqual(d.levels['3e'].competences.map((x) => [x.name, x.max]), [['Course', 6], ['Lancer', 2], ['Projet', 4], ['Observation', 4], ['Coach', 4]]);
  assert.deepEqual(d.levels['4e'].competences.map((x) => [x.name, x.max]), [['Course', 8], ['Lancer', 4], ['Investissement', 4], ['Coach', 4]]);
  const lancer = d.levels['4e'].competences[1];
  assert.deepEqual([1, 2, 3, 4, 5].map((z) => perfResult(lancer, { sex: 'F', zone: z }).level), ['na', 'ec', 'ac', 'ac', 'de']); // une seule échelle
  assert.deepEqual(perfResult(d.levels['3e'].competences[0], { sex: 'F', time: "8'00" }), { level: 'ac' });
  const tz = { levels: defaultLevels(8), perf: { type: 'timezone' } };
  assert.deepEqual(perfResult(tz, { sex: 'G', time: "7'00", zone: 3 }), { level: 'ac' });
  assert.equal(perfResult(tz, { sex: 'G', time: "5'30" }), null);
});

test('Tables & Rings : tailles, niveau, montée-descente, inapte', () => {
  assert.deepEqual(LD.tableSizes(9), [3, 3, 3]); assert.deepEqual(LD.tableSizes(10), [4, 3, 3]); assert.deepEqual(LD.tableSizes(30), [4, 4, 4, 4, 4, 4, 3, 3]);
  assert.deepEqual(LD.tableSizes(36), [5, 5, 5, 5, 4, 4, 4, 4]); assert.deepEqual(LD.tableSizes(5, { min: 2, max: 2 }), [3, 2]);
  const L = { duos: [], sessions: [] };
  const sids = 'abcdefghi'.split('');
  const s1 = LD.newSession(L, { date: '2026-11-01', format: 'simple', place: 'niveau', students: sids }, () => 0.3);
  assert.equal(s1.tables.length, 3);
  for (const t of s1.tables) s1.ranking[t.n] = t.units.slice();
  const top = s1.tables.map((t) => t.units);
  const s2 = LD.newSession(L, { date: '2026-11-08', format: 'simple', place: 'resultats', students: sids });
  const where = (s, u) => s.tables.find((t) => t.units.includes(u)).n;
  assert.equal(where(s2, top[0][0]), 1); // 1er de la table du haut : reste
  assert.equal(where(s2, top[0][2]), 2); // dernier de la table 1 : descend
  assert.equal(where(s2, top[1][0]), 1); // 1er de la table 2 : monte
  assert.equal(where(s2, top[1][1]), 2); // milieu : reste
  assert.equal(where(s2, top[2][2]), 3); // dernier de la table du bas : reste
  // le classement d'une séance ne change pas cette séance
  assert.deepEqual(s1.tables.map((t) => t.units), top);
  // niveau moyen : le 1er de la table du haut est le meilleur
  const m = LD.levelMap(L);
  assert.ok(m.get(top[0][0]) < m.get(top[2][2]));
  // inapte : table de 2 conservée ; table réduite à 1 regroupée
  LD.setInapte(L, s2, s2.tables[2].units[0]);
  assert.equal(s2.tables.at(-1).units.length, 2);
  LD.setInapte(L, s2, s2.tables[2].units[0]);
  assert.equal(s2.tables.length, 2); assert.equal(s2.inapte.length, 2);
  LD.setInapte(L, s2, s2.inapte[0], false);
  assert.equal(s2.inapte.length, 1);
  // classement par touches
  const s3 = { tables: [{ n: 1, units: ['x', 'y', 'z'] }], ranking: {} };
  LD.rankTap(s3, 1, 'y'); LD.rankTap(s3, 1, 'x');
  assert.deepEqual(s3.ranking[1], ['y', 'x', 'z']);
  LD.rankTap(s3, 1, 'x'); assert.deepEqual(s3.ranking[1], ['y']);
});

test('Tables en duos : mixtes, homogènes, gardés d\'une séance à l\'autre', () => {
  const map = new Map([['a', 0], ['b', 0.2], ['c', 0.4], ['d', 0.6], ['e', 0.8], ['f', 1]]);
  const mixte = LD.makeDuos([...map.keys()], map, 'mixte', () => 0.5);
  assert.deepEqual(mixte.map((d) => [d.a, d.b].sort().join('')).sort(), ['af', 'be', 'cd']);
  const homo = LD.makeDuos([...map.keys()], map, 'homogene', () => 0.5);
  assert.deepEqual(homo.map((d) => [d.a, d.b].sort().join('')).sort(), ['ab', 'cd', 'ef']);
  const L = { duos: [], sessions: [] };
  const s = LD.newSession(L, { date: '2026-11-01', format: 'duos', place: 'niveau', duoMode: 'mixte', students: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] });
  assert.equal(L.duos.length, 4); assert.ok(s.tables.every((t) => t.units.length >= 2));
  const before = JSON.stringify(L.duos.map((d) => [d.a, d.b]));
  LD.newSession(L, { date: '2026-11-08', format: 'duos', place: 'resultats', duoMode: 'keep', students: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] });
  assert.equal(JSON.stringify(L.duos.map((d) => [d.a, d.b])), before);
  const r = LD.newSession(L, { date: '2026-11-15', format: 'ronde', place: 'niveau', duoMode: 'keep', students: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] });
  assert.equal(r.tables.length, 1); // 4 duos : une ronde à l'italienne
  assert.equal(LD.tierOf(0.1), 'haut'); assert.equal(LD.tierOf(0.5), 'milieu'); assert.equal(LD.tierOf(0.9), 'bas');
});

test('rôles : rotation, chacun change, pas de doublon dans l\'équipe', () => {
  const set = newSet({ name: 'L', date: '2026-11-01', mode: 'teams', students: ['a', 'b', 'c', 'd', 'e'] });
  addTeam(set); set.teams[0].members = ['a', 'b', 'c', 'd', 'e'];
  const roles = ['capitaine', 'materiel', 'officiel', 'prepa', 'manager'];
  rotateRoles(set, roles, {});
  const r1 = { ...set.roles };
  assert.equal(new Set(Object.values(r1).map((x) => x[0])).size, 5);
  for (let i = 0; i < 4; i++) {
    const prev = { ...set.roles };
    assert.equal(rotateRoles(set, roles, prev), 0);
    for (const s of Object.keys(prev)) assert.notEqual(set.roles[s][0], prev[s][0]);
  }
  set.status.e = 'absent';
  rotateRoles(set, roles); assert.equal(set.roles.e, undefined);
});

test('tournoi 1.9 : composition la plus récente, réglages repris, Basket 5e / 3e', () => {
  assert.equal(T.latestSet([{ id: 1, date: '2026-11-01', createdAt: 5 }, { id: 2, date: '2026-11-20', createdAt: 1 }, { id: 3, date: '2026-11-20', createdAt: 1, updatedAt: 9 }]).id, 3);
  assert.equal(T.sportFromActivity('Basket', '5e'), 'basket5'); assert.equal(T.sportFromActivity('Basket', '3e'), 'basket3'); assert.equal(T.sportFromActivity('Basket', '4e'), 'basket');
  const t = T.newTournament({ name: 'T', date: '2026-11-27', teams: [{ id: 'a' }, { id: 'b' }], settings: { sport: 'basket5' } });
  assert.deepEqual(T.scoreButtons(t), [1, 10, 100, -1, -10, -100]);
  assert.equal(t.change.on, true);
  assert.deepEqual(T.settingsOf(t).sport, 'basket5');
});

test('Circuit training et Mario Kart', async () => {
  const { totalOf: ctTotal, setParam, toggleLock, CT_PRESETS } = await import('../js/logic/intervals.js');
  const wo8 = { ...CT_PRESETS[1].cfg, prep: 0, locks: {} };
  assert.equal(ctTotal(wo8), 12 * 30 + 11 * 10); // 7 min 50 (pas de repos après le dernier)
  const wo5 = { ...CT_PRESETS[0].cfg, prep: 5, locks: {} };
  assert.equal(ctTotal(wo5), 340); // 3 circuits de 3 exercices, 20 s / 20 s
  assert.equal(intervalAt(wo5, 0).phase, 'prep');
  assert.deepEqual([intervalAt(wo5, 5000).phase, intervalAt(wo5, 5000).station, intervalAt(wo5, 5000).round], ['work', 1, 1]);
  assert.equal(intervalAt(wo5, 26000).phase, 'rest');
  assert.equal(intervalAt(wo5, 5000 + 100000).phase, 'roundRest'); // après 3 exercices (20 + 20 + 20 + 20 + 20 = 100 s)
  assert.equal(intervalAt(wo5, 5000 + 120000).round, 2);
  assert.equal(intervalAt(wo5, 5000 + 340000).phase, 'done');
  // cadenas : durée totale verrouillée à 8 min, on passe à 10 exercices → la récupération s'ajuste
  let c = toggleLock({ ...wo8, prep: 0 }, 'total');
  c = setParam(c, 'total', 480);
  c = setParam(c, 'stations', 10);
  assert.ok(Math.abs(ctTotal(c) - 480) <= 20, `total ${ctTotal(c)}`);
  assert.equal(c.stations, 10); assert.notEqual(c.rest, 10);
  // travail verrouillé aussi : il ne bouge pas
  c = toggleLock(c, 'rest'); c = setParam(c, 'stations', 8);
  assert.equal(c.work, 30); assert.equal(c.stations, 8);
  const st = MK.newMK();
  assert.equal(st.groups.length, 4); assert.deepEqual(st.bonus, MK.MK_BONUS);
  MK.addLap(st.groups[0]); MK.addLap(st.groups[0], -5); assert.equal(st.groups[0].laps, 0);
  MK.addBonus(st.groups[0], 'Banane'); MK.addBonus(st.groups[0], 'Banane', -1); assert.deepEqual(st.groups[0].bonus, {});
  MK.setGroupCount(st, 6); assert.equal(st.groups.length, 6);
  assert.deepEqual([5, 6, 8, 10].map(MK.lapsLevel), ['na', 'ec', 'ac', 'de']);
  const g = st.groups[0]; g.laps = 8; g.malus = 2;
  assert.equal(MK.totalOf(st, g), 14);
  g.objective = '100'; assert.equal(MK.totalOf(st, g), 14); // case vide : à valider à la main
  g.objOk = true; assert.equal(MK.totalOf(st, g), 17);
  st.objectives['100'][4] = 9; assert.equal(MK.totalOf(st, g), 14); // 8 tours sur 9 demandés
  g.laps = 9; assert.equal(MK.totalOf(st, g), 19);
  assert.equal(MK.addCoins(g, 7), 0); assert.equal(MK.addCoins(g, 4), 1); assert.equal(g.coins, 11);
  assert.ok(MK.MK_BONUS.includes(MK.drawGift(st, () => 0.5)));
});

test('1.10 : barème libre ramené sur 20, grille sans note', async () => {
  const { studentTotals, setLevel } = await import('../js/logic/scoring.js');
  const ev = { model: { competences: [{ id: 'a', max: 4, levels: defaultLevels(4) }, { id: 'b', max: 4, levels: defaultLevels(4) }] }, results: {}, status: {} };
  setLevel(ev, 's', 'a', 'de'); setLevel(ev, 's', 'b', 'ec');
  assert.equal(studentTotals(ev, 's').final, 15); // 6 / 8 → 15 / 20
  ev.model.noScore = true;
  assert.equal(studentTotals(ev, 's').final, null);
});
