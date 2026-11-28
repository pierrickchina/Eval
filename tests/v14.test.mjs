// Tests v1.4 : page classe (notes, oublis, trimestres).
import test from 'node:test';
import assert from 'node:assert/strict';
import { newModel, newCompetence, newClass, newStudent } from '../js/data/schema.js';
import { createEvaluation } from '../js/logic/evaluation.js';
import { setScore } from '../js/logic/scoring.js';
import { MemStore } from '../js/data/db.js';
import { Repo } from '../js/data/repo.js';
import {
  addForget, removeForget, forgetCount, forgetColor, forgetsOf, defaultTrimesters, getTrimesters, classNotes,
} from '../js/logic/classes.js';

function setup() {
  const mk = (activity) => { const m = newModel(); m.name = activity; m.activity = activity; m.levels['6e'] = { competences: [10, 10].map((x, i) => Object.assign(newCompetence(x), { name: 'C' + i })) }; return m; };
  const cls = newClass('6e A', '6e');
  ['Léa', 'Tom', 'Inès'].forEach((f) => cls.students.push(newStudent(f)));
  return { cls, mk };
}
const fill = (ev, sid, a, b) => { const [c1, c2] = ev.model.competences; setScore(ev, sid, c1.id, a); setScore(ev, sid, c2.id, b); };

test('oublis : + / −, dates, comptage à l\'année', () => {
  const { cls } = setup();
  const sid = cls.students[0].id;
  assert.equal(forgetCount(cls, sid), 0);
  assert.equal(removeForget(cls, sid), false);
  addForget(cls, sid, '2026-09-10'); addForget(cls, sid, '2026-10-02'); addForget(cls, sid, '2026-11-20');
  assert.equal(forgetCount(cls, sid), 3);
  assert.deepEqual(forgetsOf(cls, sid), ['2026-09-10', '2026-10-02', '2026-11-20']);
  removeForget(cls, sid);
  assert.deepEqual(forgetsOf(cls, sid), ['2026-09-10', '2026-10-02'], '« − » retire la dernière');
  removeForget(cls, sid); removeForget(cls, sid);
  assert.equal(cls.forgets[sid], undefined);
});

test('couleurs des croix : 1-2 jaunes, 3 orange, 4+ rouges', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 9].map(forgetColor), ['y', 'y', 'o', 'r', 'r', 'r']);
});

test('trimestres : propositions par défaut, valeurs enregistrées prioritaires', () => {
  const d = defaultTrimesters('2026-2027');
  assert.equal(d[0].start, '2026-09-01');
  assert.equal(d[2].end, '2027-07-05');
  assert.deepEqual(getTrimesters({}, '2026-2027'), d);
  const custom = [{ start: 'a', end: 'b' }, { start: 'c', end: 'd' }, { start: 'e', end: 'f' }];
  assert.deepEqual(getTrimesters({ trimesters: { '2026-2027': custom } }, '2026-2027'), custom);
});

test('notes de la classe : une colonne par évaluation (nombre libre), notes finales, moyennes', () => {
  const { cls, mk } = setup();
  const [a, b, c] = cls.students.map((s) => s.id);
  const hand = createEvaluation({ cls, model: mk('Handball'), date: '2026-10-05' });
  const bad = createEvaluation({ cls, model: mk('Badminton'), date: '2026-11-10' });
  const acro = createEvaluation({ cls, model: mk('Acrosport'), date: '2026-12-15' });
  fill(hand, a, 8, 6); fill(hand, b, 10, 10);                // Léa 14, Tom 20, Inès vide
  fill(bad, a, 5, 5); fill(bad, c, 4, 4); bad.status[b] = 'absent'; // Léa 10, Inès 8, Tom absent
  fill(acro, a, 10, 8);
  const other = createEvaluation({ cls: newClass('5e B', '6e'), model: mk('Autre'), date: '2026-10-05' });
  const evals = [acro, hand, bad, other];
  const all = classNotes(evals, cls);
  assert.deepEqual(all.evals.map((e) => e.model.activity), ['Handball', 'Badminton', 'Acrosport'], 'triées par date, autre classe exclue');
  const lea = all.rows.find((r) => r.student.id === a);
  assert.deepEqual(lea.cells.map((x) => x.final), [14, 10, 18]);
  assert.equal(lea.mean, 14);
  const tom = all.rows.find((r) => r.student.id === b);
  assert.equal(tom.cells[1].status, 'absent');
  assert.equal(tom.mean, 20, 'l\'absence ne compte pas comme zéro');
  assert.equal(all.colMeans[0], 17);
  assert.equal(all.overall, mean3([14, 20, 8]));
  // filtre trimestre : T1 s'arrête fin novembre → Acrosport (décembre) exclu ; une activité de plus = une colonne de plus
  const t1 = classNotes(evals, cls, { trim: { start: '2026-09-01', end: '2026-11-30' } });
  assert.equal(t1.evals.length, 2);
  assert.equal(t1.rows.find((r) => r.student.id === a).mean, 12);
  const plus = classNotes([...evals, createEvaluation({ cls, model: mk('Tennis de table'), date: '2026-11-25' })], cls, { trim: { start: '2026-09-01', end: '2026-11-30' } });
  assert.equal(plus.evals.length, 3);
});
const mean3 = (xs) => Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10000) / 10000;

test('élève parti avec des résultats : reste visible (grisé), sans résultats : disparaît', () => {
  const { cls, mk } = setup();
  const [a, b] = cls.students.map((s) => s.id);
  const ev = createEvaluation({ cls, model: mk('Hand'), date: '2026-10-05' });
  fill(ev, a, 5, 5); fill(ev, b, 6, 6);
  cls.students[0].active = false; cls.students[2].active = false;
  const r = classNotes([ev], cls);
  assert.deepEqual(r.rows.map((x) => [x.student.first, x.former]), [['Tom', false], ['Léa', true]]);
});

test('les oublis sont dans la classe : inclus dans la sauvegarde JSON et la restauration', async () => {
  const { cls } = setup();
  addForget(cls, cls.students[0].id, '2026-10-01'); addForget(cls, cls.students[0].id, '2026-10-08');
  const r = new Repo(new MemStore()); await r.init();
  await r.save('classes', cls);
  const dump = JSON.parse(JSON.stringify(r.exportAll()));
  const r2 = new Repo(new MemStore()); await r2.init();
  await r2.importAll(dump, { mode: 'replace' });
  const back = r2.get('classes', cls.id);
  assert.equal(forgetCount(back, cls.students[0].id), 2);
});
