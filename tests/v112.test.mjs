import test from 'node:test';
import assert from 'node:assert/strict';
import { Repo } from '../js/data/repo.js';
import { MemStore } from '../js/data/db.js';
import * as AR from '../js/logic/arbitre.js';
import * as VM from '../js/logic/vma.js';

test('1.12 : réglages partagés (préréglages, circuits…) dans la sauvegarde ; réglages de l\'appareil exclus', async () => {
  const r = await new Repo(new MemStore()).init();
  await r.setMeta('toolPresets', { circuit: { work: 30 } });
  await r.setMeta('lastSync', 123);
  await r.flush();
  const out = r.exportAll();
  const meta = out.freetools.filter((x) => x.type === 'meta');
  assert.deepEqual(meta.map((x) => x.key).sort(), ['toolPresets']);
  assert.equal(meta[0].value.circuit.work, 30);
  // restauration sur une autre tablette : le réglage revient dans les réglages
  const r2 = await new Repo(new MemStore()).init();
  await r2.importAll(out);
  assert.equal(r2.getMeta('toolPresets').circuit.work, 30);
  assert.equal(r2.getMeta('lastSync'), null);
});

test('1.12 : les écritures démarrent immédiatement (rien en file d\'attente à la fermeture)', async () => {
  const store = new MemStore();
  const r = await new Repo(store).init();
  r.save('classes', { id: 'c1', name: '6e A' });
  assert.ok(store.d.classes.has('c1'), 'écrit sans attendre');
});

test('1.12 : réglages supprimés et migration des anciens réglages', async () => {
  const store = new MemStore();
  await store.put('meta', { id: 'ctCircuits', value: [{ id: 'x' }] });
  const r = await new Repo(store).init();
  assert.ok(r.get('freetools', 'meta:ctCircuits'), 'réglage existant recopié au démarrage');
  await r.removeMeta('ctCircuits');
  assert.equal(r.getMeta('ctCircuits'), null);
  assert.ok(r.get('freetools', 'meta:ctCircuits').deleted);
});

test('1.13 : Certificat de rôle par activité (arbitre, juge-spectateur, coach), niveau = validation de l\'enseignant', () => {
  const hb = { name: 'Handball' };
  const A = AR.arbitreOf(hb);
  assert.deepEqual(A.roles[0].levels, ['Je découvre', 'Arbitre de table', 'Arbitre de champ', 'Arbitre référent']);
  assert.deepEqual(AR.defaultRoles('Tennis de table')[0].levels.slice(1), ['Arbitre compteur', 'Arbitre polyvalent', 'Arbitre organisateur']);
  assert.equal(AR.defaultRoles('Acrosport')[0].kind, 'juge');
  assert.deepEqual(AR.defaultRoles('Boxe française').map((r) => r.kind), ['arbitre', 'coach']);
  assert.equal(AR.defaultRoles('Duathlon')[0].kind, 'coach');
  assert.equal(AR.defaultRoles('Ultimate').length, 1, 'pas de coach de club en Ultimate');
  AR.setSelfLevel(A, 's1', 'r1', 2);
  assert.ok(AR.selfDone(A, 's1', 'r1'));
  assert.equal(AR.levelOf(A, 's1', 'r1'), null, 'l\'appli ne propose jamais de niveau');
  AR.setTeacherLevel(A, 's1', 'r1', 3);
  assert.equal(AR.badgesOf(A, 's1')[0].metal.name, 'or');
  A.modes.teacher = false;
  assert.equal(AR.levelOf(A, 's1', 'r1'), 2);
  assert.deepEqual(AR.badgesOf(A, 'inconnu'), []);
  // reprise d'un certificat 1.12
  const old = { name: 'Basket', arbitre: { levels: ['a', 'b', 'c', 'd'], criteria: [], students: { x: { level: 2, self: {}, peers: [] } } } };
  const B = AR.arbitreOf(old);
  assert.equal(B.roles[0].levels[2], 'c'); assert.equal(AR.levelOf(B, 'x', 'r1'), 2);
});

test('Test VMA Léger navette 20 m : paliers, allers, VMA et allures', () => {
  const p = VM.stagePlan();
  assert.equal(p[0].kmh, 8.5); assert.equal(p[1].kmh, 9);
  assert.equal(p[0].n, 7); // 7 allers de 20 m ≈ 1 min à 8,5 km/h
  assert.ok(Math.abs(p[0].end - 59.3) < 0.1);
  const s = VM.stateAt(70);
  assert.equal(s.stage, 2); assert.equal(s.totalLegs, 8);
  assert.equal(VM.vmaOf(s.stage), 9);
  assert.equal(VM.allure(12, 100, 60), 200);
  assert.equal(VM.allure(12, 80, 60), 160);
  assert.ok(VM.stateAt(99999).done);
});
