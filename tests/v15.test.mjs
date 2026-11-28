// Tests v1.5 : activités, migration, outils visibles, impact des suppressions.
import test from 'node:test';
import assert from 'node:assert/strict';
import { newModel, newCompetence, newClass, newStudent } from '../js/data/schema.js';
import { createEvaluation, duplicateEvaluation } from '../js/logic/evaluation.js';
import { setScore } from '../js/logic/scoring.js';
import {
  ensureActivities, newActivity, visibleTools, deleteImpact, activityEvals, hasTool, activitiesOf,
} from '../js/logic/activities.js';

const DAY = 86400000;
function setup() {
  const cls = newClass('3e B', '3e');
  cls.students = [newStudent('Tom', 'B'), newStudent('Léa', 'C')];
  cls.infos = { x: { text: 'ancien', u: 1 } };
  const mk = (act) => { const m = newModel(); m.name = act; m.activity = act; m.levels['3e'] = { competences: [10, 10].map((x, i) => Object.assign(newCompetence(x), { name: 'C' + i })) }; return m; };
  return { cls, hand: mk('Handball'), bad: mk('Badminton') };
}

test('migration : chaque évaluation est rangée dans l\'activité de même nom, infos supprimées, idempotent', () => {
  const { cls, hand, bad } = setup();
  const e1 = createEvaluation({ cls, model: hand, date: '2026-10-01', step: 0.5 });
  const e2 = createEvaluation({ cls, model: hand, date: '2026-11-01', step: 0.5 });
  const e3 = createEvaluation({ cls, model: bad, date: '2026-11-15', step: 0.5 });
  const r = ensureActivities([cls], [e1, e2, e3]);
  assert.equal(cls.activities.length, 2);
  assert.equal(e1.activityId, e2.activityId);
  assert.notEqual(e1.activityId, e3.activityId);
  assert.ok(cls.activities.every((a) => hasTool(a, 'evaluation')));
  assert.equal('infos' in cls, false);
  assert.ok(cls.activities.every((a) => /^#/.test(a.color)) && cls.activities[0].color !== cls.activities[1].color, 'chaque activité reçoit une couleur pastel');
  assert.equal(r.evals.length, 3);
  const again = ensureActivities([cls], [e1, e2, e3]);
  assert.equal(again.evals.length, 0);
  assert.equal(again.classes.length, 0);
  assert.equal(cls.activities.length, 2);
});

test('migration : nom d\'activité comparé sans tenir compte de la casse, activité existante réutilisée', () => {
  const { cls, hand } = setup();
  cls.activities = [newActivity('handball', [])];
  const e = createEvaluation({ cls, model: hand, date: '2026-10-01', step: 0.5 });
  ensureActivities([cls], [e]);
  assert.equal(cls.activities.length, 1);
  assert.equal(e.activityId, cls.activities[0].id);
  assert.ok(hasTool(cls.activities[0], 'evaluation'));
});

test('une évaluation dupliquée reste dans la même activité', () => {
  const { cls, hand } = setup();
  const e = createEvaluation({ cls, model: hand, date: '2026-10-01', step: 0.5 });
  ensureActivities([cls], [e]);
  const copy = duplicateEvaluation(e, { date: '2026-12-01' });
  assert.equal(copy.activityId, e.activityId);
  assert.equal(activityEvals([e, copy], cls, cls.activities[0]).length, 2);
  assert.equal(activityEvals([e, copy], cls, cls.activities[0])[0].date, '2026-12-01');
});

test('outils visibles : récents d\'abord, anciens derrière le « + », jamais un cadre vide', () => {
  const t = 1e12;
  const tools = [
    { type: 'evaluation', lastUsed: t - 5 * DAY }, { type: 'tournoi', lastUsed: t - 90 * DAY }, { type: 'tables', lastUsed: t - 10 * DAY },
  ];
  const v = visibleTools(tools, t);
  assert.deepEqual(v.shown.map((x) => x.type), ['evaluation', 'tables']);
  assert.deepEqual(v.hidden.map((x) => x.type), ['tournoi']);
  const old = visibleTools([{ type: 'evaluation', lastUsed: t - 400 * DAY }], t);
  assert.equal(old.shown.length, 1);
  assert.equal(old.hidden.length, 0);
  const many = visibleTools(Array.from({ length: 9 }, (_, i) => ({ type: 'o' + i, lastUsed: t - i })), t, { max: 6 });
  assert.equal(many.shown.length, 6);
  assert.equal(many.hidden.length, 3);
});

test('impact d\'une suppression : liste précise des évaluations, résultats, remarques', () => {
  const { cls, hand } = setup();
  const e = createEvaluation({ cls, model: hand, date: '2026-10-01', step: 0.5 });
  ensureActivities([cls], [e]);
  const act = activitiesOf(cls)[0];
  const sid = cls.students[0].id, cid = e.model.competences[0].id;
  setScore(e, sid, cid, 6);
  e.notes = { [sid]: { text: 'Bien', u: 1 } };
  const imp = deleteImpact([e], cls, act, null);
  assert.equal(imp.empty, false);
  assert.equal(imp.evals.length, 1);
  assert.equal(imp.evals[0].marks, 1);
  assert.equal(imp.evals[0].notes, 1);
  assert.equal(imp.evals[0].students, 2);
  assert.equal(deleteImpact([e], cls, act, 'tournoi').empty, true);
  assert.equal(deleteImpact([e], cls, newActivity('Autre'), null).empty, true);
});
