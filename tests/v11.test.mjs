// Tests de la version 1.1 : règle des niveaux, observations brouillon, remarques, fusion, résumé annuel.
import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultLevels, newModel, newCompetence, newClass, newStudent } from '../js/data/schema.js';
import { setCompetenceMax, applyLevelRule, levelForScore, proposedScore } from '../js/logic/model.js';
import { createEvaluation, duplicateEvaluation, removeStudentFromEvaluation } from '../js/logic/evaluation.js';
import {
  addObs, removeObs, obsCounts, toPlaceCount, setNote, getNote, setLevel, setScore, getCell, cellState, studentTotals, clearCell,
} from '../js/logic/scoring.js';
import { EvalSession } from '../js/logic/history.js';
import { mergeEvaluations } from '../js/sync/engine.js';
import { buildSummary, summaryText } from '../js/ui/summaryView.js';

function setup(maxes = [8, 5, 4, 3]) {
  const model = newModel();
  model.name = 'M'; model.activity = 'Handball';
  model.levels['6e'] = { competences: maxes.map((m, i) => Object.assign(newCompetence(m), { name: 'C' + (i + 1) })) };
  const cls = newClass('6e A', '6e');
  ['Léa', 'Tom', 'Inès'].forEach((f) => cls.students.push(newStudent(f)));
  const ev = createEvaluation({ cls, model, date: '2026-11-20' });
  return { ev, cls, model };
}

test('règle des niveaux : « en cours » = exactement la moitié du barème, plages 30/50, 55/90, 90/100', () => {
  for (const max of [2, 3, 4, 5, 6, 7, 8, 10]) {
    const [na, ec, ac, de] = defaultLevels(max);
    assert.equal(na.value, 0, 'NA proposé 0');
    assert.equal(ec.value, max / 2, `EC proposé = moitié (max ${max})`);
    assert.equal(ec.max, max / 2, `EC max = moitié (max ${max})`);
    assert.equal(de.value, max);
    assert.equal(de.max, max);
    assert.ok(na.max < ec.min && ec.max < ac.min && ac.max < de.min, `plages ordonnées sans chevauchement (max ${max})`);
    for (const l of [na, ec, ac, de]) assert.ok(l.min <= l.value && l.value <= l.max);
  }
  const l8 = defaultLevels(8);
  assert.equal(l8[1].value, 4, '8 → 4');
  assert.equal(proposedScore({ max: 8, levels: l8 }, 'ec'), 4);
});

test('acquis proposé ≈ 80 % ; dépassé ≥ 90 %', () => {
  const l = defaultLevels(10);
  assert.equal(l[2].value, 8);
  assert.equal(l[2].min, 5.5);
  assert.equal(l[3].min, 9);
  assert.equal(levelForScore({ levels: l }, 9.5), 'de');
  assert.equal(levelForScore({ levels: l }, 4), 'ec');
  assert.equal(levelForScore({ levels: l }, 1), 'na');
});

test('changer le barème garde les textes et recale « en cours » sur la moitié', () => {
  const c = newCompetence(8);
  c.levels[1].text = 'Texte long en cours';
  c.levels[3].text = 'Texte dépassé';
  setCompetenceMax(c, 6);
  assert.equal(c.levels[1].value, 3);
  assert.equal(c.levels[1].text, 'Texte long en cours');
  assert.equal(c.levels[3].text, 'Texte dépassé');
});

test('migration : un ancien modèle (EC à 55 %) passe à la nouvelle règle sans perdre les textes', () => {
  const c = newCompetence(8);
  c.levels = [
    { key: 'na', text: 'a', min: 0, max: 3, value: 1.5 }, { key: 'ec', text: 'b', min: 3.5, max: 5, value: 4.5 },
    { key: 'ac', text: 'c', min: 5.5, max: 7, value: 6.5 }, { key: 'de', text: 'd', min: 8, max: 8, value: 8 },
  ];
  applyLevelRule(c);
  assert.deepEqual(c.levels.map((l) => l.text), ['a', 'b', 'c', 'd']);
  assert.equal(c.levels[1].value, 4);
});

test('les évaluations déjà créées gardent leur copie figée du modèle', () => {
  const { ev, model } = setup();
  const before = JSON.stringify(ev.model);
  for (const c of model.levels['6e'].competences) setCompetenceMax(c, c.max);
  model.levels['6e'].competences[0].levels[1].value = 99;
  assert.equal(JSON.stringify(ev.model), before);
});

test('observations brouillon : ajout, comptage, retrait, sans effet sur la note ni l\'état', () => {
  const { ev } = setup();
  const sid = ev.students[0].id, c = ev.model.competences[0];
  addObs(ev, sid, c.id, 'de'); addObs(ev, sid, c.id, 'ac'); addObs(ev, sid, c.id, 'ac');
  const cell = getCell(ev, sid, c.id);
  assert.deepEqual(cell.obs, ['de', 'ac', 'ac']);
  assert.deepEqual(obsCounts(cell.obs), { na: 0, ec: 0, ac: 2, de: 1 });
  assert.equal(cellState(cell), 'empty', 'toujours « vide » : pas de degré');
  assert.equal(studentTotals(ev, sid).filled, 0);
  assert.equal(studentTotals(ev, sid).final, null);
  assert.equal(toPlaceCount(ev, sid), 1);
  assert.equal(removeObs(ev, sid, c.id, 0), true);
  assert.deepEqual(getCell(ev, sid, c.id).obs, ['ac', 'ac']);
  assert.equal(removeObs(ev, sid, c.id, 9), false);
  removeObs(ev, sid, c.id, 0); removeObs(ev, sid, c.id, 0);
  assert.equal(getCell(ev, sid, c.id).obs, undefined);
  assert.equal(toPlaceCount(ev, sid), 0);
});

test('observations conservées comme trace une fois l\'élève placé ; « à placer » seulement sans degré', () => {
  const { ev } = setup();
  const sid = ev.students[1].id, c = ev.model.competences[1];
  addObs(ev, sid, c.id, 'de'); addObs(ev, sid, c.id, 'ac');
  assert.equal(toPlaceCount(ev, sid), 1);
  setLevel(ev, sid, c.id, 'ac');
  assert.deepEqual(getCell(ev, sid, c.id).obs, ['de', 'ac'], 'trace conservée');
  assert.equal(toPlaceCount(ev, sid), 0, 'plus à placer');
  clearCell(ev, sid, c.id);
  assert.deepEqual(getCell(ev, sid, c.id).obs, ['de', 'ac'], 'effacer la note ne supprime pas les observations');
  assert.equal(toPlaceCount(ev, sid), 1);
  setScore(ev, sid, c.id, 3);
  assert.equal(toPlaceCount(ev, sid), 0);
});

test('un élève absent n\'est jamais « à placer »', () => {
  const { ev } = setup();
  const sid = ev.students[0].id;
  addObs(ev, sid, ev.model.competences[0].id, 'ec');
  ev.status[sid] = 'absent';
  assert.equal(toPlaceCount(ev, sid), 0);
});

test('annuler / rétablir couvre les observations et les remarques', () => {
  const { ev } = setup();
  const sess = new EvalSession(ev);
  const sid = ev.students[0].id, c = ev.model.competences[0];
  sess.do('Observation', (e) => addObs(e, sid, c.id, 'de'));
  sess.do('Remarque', (e) => setNote(e, sid, 'a aidé un camarade'));
  assert.equal(getNote(ev, sid), 'a aidé un camarade');
  sess.undo();
  assert.equal(getNote(ev, sid), '');
  sess.undo();
  assert.equal(getCell(ev, sid, c.id)?.obs, undefined);
  sess.redo();
  assert.deepEqual(getCell(ev, sid, c.id).obs, ['de']);
});

test('remarques : modification identique sans effet, retrait de l\'élève, duplication', () => {
  const { ev, cls } = setup();
  const [a, b] = ev.students.map((s) => s.id);
  const sess = new EvalSession(ev);
  assert.equal(sess.do('Remarque', (e) => setNote(e, a, 'Très motivé')), true);
  assert.equal(sess.do('Remarque', (e) => setNote(e, a, 'Très motivé')), false);
  setNote(ev, b, 'À revoir');
  const sans = duplicateEvaluation(ev, { date: '2026-12-01', cls });
  assert.deepEqual(sans.notes, {}, 'sans résultats : pas de remarques');
  const avec = duplicateEvaluation(ev, { date: '2026-12-01', cls, keepResults: true });
  assert.equal(getNote(avec, a), 'Très motivé');
  removeStudentFromEvaluation(ev, b);
  assert.equal(getNote(ev, b), '');
});

test('fusion de synchro : observations (cellule la plus récente) et remarques (la plus récente gagne)', () => {
  const { ev } = setup();
  const sid = ev.students[0].id, c = ev.model.competences[0], c2 = ev.model.competences[1];
  const A = structuredClone(ev), B = structuredClone(ev);
  addObs(A, sid, c.id, 'de', 100);
  addObs(B, sid, c2.id, 'ac', 200);
  setNote(A, sid, 'version A', 300);
  setNote(B, sid, 'version B', 250);
  A.updatedAt = 1000; B.updatedAt = 900;
  const m = mergeEvaluations(A, B, 'dev');
  assert.deepEqual(getCell(m, sid, c.id).obs, ['de']);
  assert.deepEqual(getCell(m, sid, c2.id).obs, ['ac']);
  assert.equal(getNote(m, sid), 'version A');
});

test('anciennes évaluations (sans obs ni notes) : tout fonctionne', () => {
  const { ev } = setup();
  delete ev.notes;
  const sid = ev.students[0].id;
  assert.equal(getNote(ev, sid), '');
  assert.equal(toPlaceCount(ev, sid), 0);
  setNote(ev, sid, 'ok');
  assert.equal(getNote(ev, sid), 'ok');
});

test('résumé de l\'année : moyenne, activités, absences, texte', () => {
  const { ev, cls, model } = setup();
  const sid = ev.students[0].id;
  const fill = (e, pts) => e.model.competences.forEach((c) => setScore(e, sid, c.id, c.max * pts));
  fill(ev, 0.5);                                   // 10/20
  const ev2 = createEvaluation({ cls, model, date: '2026-12-10' }); fill(ev2, 1);    // 20/20
  const ev3 = createEvaluation({ cls, model, date: '2026-12-15' }); ev3.status[sid] = 'absent';
  const old = createEvaluation({ cls, model, date: '2025-10-01' }); fill(old, 1);      // autre année
  setNote(ev2, sid, 'progrès net');
  const sum = buildSummary([ev, ev2, ev3, old], sid, '2026-2027');
  assert.equal(sum.count, 3);
  assert.equal(sum.graded, 2);
  assert.equal(sum.mean, 15);
  assert.equal(sum.absences, 1);
  assert.equal(sum.activities.length, 1);
  assert.equal(sum.activities[0].first, 10);
  assert.equal(sum.activities[0].last, 20);
  const txt = summaryText('Léa', '2026-2027', sum);
  assert.match(txt, /Moyenne : 15\/20/);
  assert.match(txt, /progrès net/);
  assert.match(txt, /absent/);
});
