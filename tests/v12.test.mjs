// Tests v1.2 : auto-évaluation (logique), fusion, duplication.
import test from 'node:test';
import assert from 'node:assert/strict';
import { newModel, newCompetence, newClass, newStudent } from '../js/data/schema.js';
import { createEvaluation, duplicateEvaluation, removeStudentFromEvaluation } from '../js/logic/evaluation.js';
import { setSelfLevel, selfTotals, validateSelf, reopenSelf, selfCell, selfDone } from '../js/logic/selfeval.js';
import { studentTotals } from '../js/logic/scoring.js';
import { mergeEvaluations } from '../js/sync/engine.js';

function setup() {
  const model = newModel(); model.name = 'M'; model.activity = 'Hand';
  model.levels['6e'] = { competences: [8, 5, 4, 3].map((m, i) => Object.assign(newCompetence(m), { name: 'C' + i })) };
  const cls = newClass('6e A', '6e'); ['Léa', 'Tom'].forEach((f) => cls.students.push(newStudent(f)));
  return { ev: createEvaluation({ cls, model, date: '2026-11-26' }), cls };
}

test('auto-évaluation : note = degrés choisis, validation seulement quand tout est renseigné', () => {
  const { ev } = setup();
  const sid = ev.students[0].id, cs = ev.model.competences;
  assert.equal(validateSelf(ev, sid), false);
  setSelfLevel(ev, sid, cs[0].id, 'ec');   // 4/8
  setSelfLevel(ev, sid, cs[1].id, 'ac');   // 4/5
  assert.equal(selfTotals(ev, sid).complete, false);
  assert.equal(selfTotals(ev, sid).final, null);
  assert.equal(validateSelf(ev, sid), false);
  setSelfLevel(ev, sid, cs[2].id, 'de');   // 4/4
  setSelfLevel(ev, sid, cs[3].id, 'na');   // 0/3
  assert.equal(selfTotals(ev, sid).final, 12);
  assert.equal(validateSelf(ev, sid), true);
  assert.equal(selfDone(ev, sid), true);
});

test('auto-évaluation validée : verrouillée ; l\'enseignant peut la rouvrir', () => {
  const { ev } = setup();
  const sid = ev.students[0].id;
  for (const c of ev.model.competences) setSelfLevel(ev, sid, c.id, 'ac');
  validateSelf(ev, sid);
  assert.equal(setSelfLevel(ev, sid, ev.model.competences[0].id, 'de'), false);
  assert.equal(selfCell(ev, sid, ev.model.competences[0].id).level, 'ac');
  reopenSelf(ev, sid);
  assert.equal(setSelfLevel(ev, sid, ev.model.competences[0].id, 'de'), true);
});

test('l\'auto-évaluation n\'influence jamais la note de l\'enseignant', () => {
  const { ev } = setup();
  const sid = ev.students[0].id;
  for (const c of ev.model.competences) setSelfLevel(ev, sid, c.id, 'de');
  const t = studentTotals(ev, sid);
  assert.equal(t.filled, 0);
  assert.equal(t.final, null);
});

test('auto-évaluation : fusion de synchro, duplication, retrait de l\'élève', () => {
  const { ev, cls } = setup();
  const [a, b] = ev.students.map((s) => s.id);
  const A = structuredClone(ev), B = structuredClone(ev);
  setSelfLevel(A, a, ev.model.competences[0].id, 'ac', 100);
  setSelfLevel(B, b, ev.model.competences[0].id, 'de', 200);
  A.updatedAt = 10; B.updatedAt = 9;
  const m = mergeEvaluations(A, B, 'x');
  assert.equal(selfCell(m, a, ev.model.competences[0].id).level, 'ac');
  assert.equal(selfCell(m, b, ev.model.competences[0].id).level, 'de');
  assert.deepEqual(duplicateEvaluation(A, { date: '2026-12-01', cls }).selfEval, {});
  assert.ok(duplicateEvaluation(A, { date: '2026-12-01', cls, keepResults: true }).selfEval[a]);
  removeStudentFromEvaluation(A, a);
  assert.equal(A.selfEval[a], undefined);
});
