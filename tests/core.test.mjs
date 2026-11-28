// Tests du noyau : lancer avec `node --test tests/`
import test from 'node:test';
import assert from 'node:assert/strict';

import { newModel, newCompetence, newClass, newStudent, defaultLevels } from '../js/data/schema.js';
import {
  validateTable, validateModel, distributeByWeights, applyCoefficients, rescaleTo20,
  levelForScore, setCompetenceMax, sumMax,
} from '../js/logic/model.js';
import {
  setLevel, setScore, validateCell, clearCell, setStatus, studentTotals, classStats, cellState, getCell,
} from '../js/logic/scoring.js';
import {
  createEvaluation, duplicateEvaluation, addGroup, assignGroup, orderedStudents,
  addStudentToEvaluation, removeStudentFromEvaluation, studentHistory, removeGroup,
} from '../js/logic/evaluation.js';
import { EvalSession } from '../js/logic/history.js';
import { MemStore } from '../js/data/db.js';
import { Repo } from '../js/data/repo.js';
import { SyncEngine, RemoteChangedError, planSync, mergeEvaluations } from '../js/sync/engine.js';

// ---------- fabriques de test ----------
function makeModel(maxes = [5, 5, 4, 6], level = '6e') {
  const m = newModel();
  m.name = 'Badminton 6e';
  m.activity = 'Badminton';
  m.levels[level] = { competences: maxes.map((x, i) => Object.assign(newCompetence(x), { name: `Comp ${i + 1}` })) };
  return m;
}
function makeClass(names = ['Léa', 'Tom', 'Inès', 'Hugo']) {
  const c = newClass('6e A', '6e');
  c.students = names.map((n) => newStudent(n));
  return c;
}
function setup() {
  const model = makeModel();
  const cls = makeClass();
  const ev = createEvaluation({ cls, model, date: '2026-11-24' });
  return { model, cls, ev };
}
const comps = (ev) => ev.model.competences;

// ---------- 1. Calculs sur 20 ----------
test('exemple du cahier des charges : 4/5 + 3/5 + 3/4 + 5/6 = 15/20', () => {
  const { ev } = setup();
  const [a, b, c, d] = comps(ev);
  const sid = ev.students[0].id;
  setScore(ev, sid, a.id, 4);
  setScore(ev, sid, b.id, 3);
  setScore(ev, sid, c.id, 3);
  setScore(ev, sid, d.id, 5);
  const t = studentTotals(ev, sid);
  assert.equal(t.final, 15);
  assert.equal(t.complete, true);
  assert.equal(t.remaining, 0);
});

test("somme des barèmes libre depuis 1.10 : total ≠ 20 accepté, note ramenée sur 20 ; grille sans note", () => {
  const ok = validateTable(makeModel([5, 5, 4, 6]).levels['6e'].competences);
  assert.equal(ok.ok, true); assert.equal(ok.exact20, true);
  const low = validateTable(makeModel([5, 5, 4, 5]).levels['6e'].competences);
  assert.equal(low.ok, true); assert.equal(low.exact20, false); assert.equal(low.diff, 1);
  assert.equal(validateModel(makeModel([5, 5, 4, 5])).ok, true);
  const bad = makeModel([5, 0, 4, 5]);
  assert.equal(validateModel(bad).ok, false);
  bad.noScore = true;
  assert.equal(validateModel(bad).ok, true);
});

test('compétences non renseignées ≠ zéro : note finale absente, points partiels affichés', () => {
  const { ev } = setup();
  const sid = ev.students[0].id;
  const [a, b] = comps(ev);
  setScore(ev, sid, a.id, 4);
  setScore(ev, sid, b.id, 2);
  const t = studentTotals(ev, sid);
  assert.equal(t.final, null);
  assert.equal(t.points, 6);
  assert.equal(t.maxFilled, 10);
  assert.equal(t.remaining, 2);
  assert.equal(t.provisional, 12); // estimation explicite, jamais utilisée comme note finale
});

test('une vraie note de 0 est distincte du « non renseigné »', () => {
  const { ev } = setup();
  const sid = ev.students[0].id;
  const [a] = comps(ev);
  assert.equal(cellState(getCell(ev, sid, a.id)), 'empty');
  setScore(ev, sid, a.id, 0);
  assert.equal(cellState(getCell(ev, sid, a.id)), 'draft');
  assert.equal(studentTotals(ev, sid).filled, 1);
});

test('note finale : arrondie au pas, bornée au barème', () => {
  const { ev } = setup();
  const sid = ev.students[0].id;
  const [a] = comps(ev);
  setScore(ev, sid, a.id, 99);
  assert.equal(getCell(ev, sid, a.id).score, 5);
  setScore(ev, sid, a.id, 2.3);
  assert.equal(getCell(ev, sid, a.id).score, 2.5);
  setScore(ev, sid, a.id, -4);
  assert.equal(getCell(ev, sid, a.id).score, 0);
});

// ---------- 2. Niveaux et notes proposées ----------
test('niveaux par défaut : plages sans trou ni chevauchement, « Dépassé » = barème max', () => {
  for (const max of [2, 3, 4, 5, 6, 8, 10]) {
    const lv = defaultLevels(max);
    assert.equal(lv[3].value, max, `de.value pour ${max}`);
    assert.equal(lv[0].min, 0);
    for (const l of lv) {
      assert.ok(l.min <= l.value && l.value <= l.max, `valeur dans la plage (${l.key}, max ${max})`);
      assert.ok(l.max <= max);
    }
  }
});

test('choisir un niveau propose une note ; note modifiable ; le niveau suit la note', () => {
  const { ev } = setup();
  const sid = ev.students[0].id;
  const c = comps(ev)[0]; // /5
  setLevel(ev, sid, c.id, 'ac');
  assert.equal(getCell(ev, sid, c.id).score, 4);
  assert.equal(getCell(ev, sid, c.id).validated, false);
  setScore(ev, sid, c.id, 1);
  assert.equal(getCell(ev, sid, c.id).level, 'na');
  setScore(ev, sid, c.id, 5);
  assert.equal(getCell(ev, sid, c.id).level, 'de');
  setLevel(ev, sid, c.id, 'de');
  assert.equal(getCell(ev, sid, c.id).score, c.max);
  assert.equal(levelForScore(c, 2), 'ec');
  assert.equal(levelForScore(c, 3), 'ac');
});

test('correspondances niveau → note modifiables par compétence, indépendamment', () => {
  const { ev } = setup();
  const [a, b] = comps(ev);
  a.levels.find((l) => l.key === 'ac').value = 3.5;
  setLevel(ev, ev.students[0].id, a.id, 'ac');
  setLevel(ev, ev.students[0].id, b.id, 'ac');
  assert.equal(getCell(ev, ev.students[0].id, a.id).score, 3.5);
  assert.equal(getCell(ev, ev.students[0].id, b.id).score, 4);
});

test('validation : modifiable à tout moment ; modifier une note validée la repasse en « non validée »', () => {
  const { ev } = setup();
  const sid = ev.students[0].id;
  const c = comps(ev)[0];
  setLevel(ev, sid, c.id, 'ac');
  assert.equal(validateCell(ev, sid, c.id), true);
  assert.equal(cellState(getCell(ev, sid, c.id)), 'validated');
  setScore(ev, sid, c.id, 3.5);
  assert.equal(cellState(getCell(ev, sid, c.id)), 'draft');
  validateCell(ev, sid, c.id);
  setLevel(ev, sid, c.id, 'ec'); // changer le niveau aussi
  assert.equal(cellState(getCell(ev, sid, c.id)), 'draft');
  clearCell(ev, sid, c.id);
  assert.equal(validateCell(ev, sid, c.id), false); // rien à valider
});

test('allValidated : vrai seulement si les 4 compétences sont validées', () => {
  const { ev } = setup();
  const sid = ev.students[0].id;
  for (const c of comps(ev)) setLevel(ev, sid, c.id, 'ac');
  assert.equal(studentTotals(ev, sid).allValidated, false);
  for (const c of comps(ev)) validateCell(ev, sid, c.id);
  assert.equal(studentTotals(ev, sid).allValidated, true);
});

// ---------- 3. Absents / dispensés / moyennes ----------
test('absents, dispensés, non évalués : jamais 0, exclus des moyennes avec n correct', () => {
  const { ev } = setup();
  const [s1, s2, s3, s4] = ev.students;
  for (const s of [s1, s2, s3, s4]) for (const c of comps(ev)) setScore(ev, s.id, c.id, c.max); // tous 20/20
  setStatus(ev, s2.id, 'absent');
  setStatus(ev, s3.id, 'dispense');
  setStatus(ev, s4.id, 'nonEvalue');
  // même s'ils ont des données résiduelles, ils ne comptent pas
  let st = classStats(ev);
  assert.equal(st.overall.n, 1);
  assert.equal(st.overall.mean, 20);
  assert.equal(st.perComp[comps(ev)[0].id].n, 1);
  assert.equal(studentTotals(ev, s2.id).usable, false);
  assert.equal(studentTotals(ev, s2.id).status, 'absent');
  // un élève présent mais sans aucune donnée n'est pas un zéro
  setStatus(ev, s2.id, 'present');
  clearAll(ev, s2.id);
  st = classStats(ev);
  assert.equal(st.overall.n, 1);
  assert.equal(st.perComp[comps(ev)[0].id].n, 2 - 1); // s1 seulement (s2 vide)
});
function clearAll(ev, sid) { for (const c of comps(ev)) clearCell(ev, sid, c.id); }

test('moyenne de classe : valeurs et nombre d\'élèves pris en compte', () => {
  const { ev } = setup();
  const [s1, s2, s3] = ev.students;
  const c0 = comps(ev)[0];
  setScore(ev, s1.id, c0.id, 4);
  setScore(ev, s2.id, c0.id, 3);
  setScore(ev, s3.id, c0.id, 2);
  const st = classStats(ev);
  assert.equal(st.perComp[c0.id].mean, 3);
  assert.equal(st.perComp[c0.id].n, 3);
  assert.equal(st.overall.mean, null); // aucune note finale complète encore
  for (const c of comps(ev)) { setScore(ev, s1.id, c.id, c.max); setScore(ev, s2.id, c.id, c.max / 2); }
  assert.equal(classStats(ev).overall.n, 2);
  assert.equal(classStats(ev).overall.mean, 15);
});

test('statut repassé en « présent » : résultats conservés', () => {
  const { ev } = setup();
  const s = ev.students[0];
  setScore(ev, s.id, comps(ev)[0].id, 4);
  setStatus(ev, s.id, 'absent');
  setStatus(ev, s.id, 'present');
  assert.equal(getCell(ev, s.id, comps(ev)[0].id).score, 4);
});

// ---------- 4. Historique, indépendance modèle / classe / évaluation ----------
test('modifier le modèle ne change JAMAIS une évaluation déjà créée', () => {
  const { model, cls, ev } = setup();
  const before = JSON.stringify(ev.model);
  model.levels['6e'].competences[0].max = 9;
  model.levels['6e'].competences[0].name = 'Renommée';
  model.name = 'Autre nom';
  model.activity = 'Volley';
  assert.equal(JSON.stringify(ev.model), before);
  // une nouvelle évaluation prend, elle, la nouvelle version
  const ev2 = createEvaluation({ cls, model, date: '2026-12-01' });
  assert.equal(ev2.model.competences[0].name, 'Renommée');
});

test('modifier la classe (nom, niveau, couleur, élèves) ne change pas les anciennes évaluations', () => {
  const { cls, ev } = setup();
  const snapshot = JSON.stringify({ s: ev.students, c: ev.classInfo });
  cls.name = '5e B';
  cls.level = '5e';
  cls.color = '#000000';
  cls.students[0].first = 'Léna';
  cls.students.pop();
  assert.equal(JSON.stringify({ s: ev.students, c: ev.classInfo }), snapshot);
});

test("élève arrivé en cours d'année : dans les nouvelles évaluations, pas rétroactivement", () => {
  const { model, cls, ev: old } = setup();
  const arrivant = newStudent('Zoé', 'M');
  cls.students.push(arrivant);
  const neu = createEvaluation({ cls, model, date: '2027-01-10' });
  assert.ok(neu.students.some((s) => s.id === arrivant.id));
  assert.ok(!old.students.some((s) => s.id === arrivant.id));
  assert.equal(studentHistory([old, neu], arrivant.id).length, 1);
});

test("départ d'un élève : il disparaît des nouvelles évaluations mais garde son historique", () => {
  const { model, cls, ev } = setup();
  const partant = cls.students[1];
  setScore(ev, partant.id, comps(ev)[0].id, 4);
  partant.active = false;
  const neu = createEvaluation({ cls, model, date: '2027-01-10' });
  assert.ok(!neu.students.some((s) => s.id === partant.id));
  const h = studentHistory([ev, neu], partant.id);
  assert.equal(h.length, 1);
  assert.equal(h[0].comps[0].cell.score, 4);
});

test("historique individuel : suit l'élève même si prénom et classe changent", () => {
  const { model, cls, ev: ev1 } = setup();
  const sid = cls.students[0].id;
  setScore(ev1, sid, comps(ev1)[0].id, 3);
  cls.students[0].first = 'Léa-Rose';
  const cls2 = newClass('5e C', '5e'); // l'élève change de classe (même id)
  cls2.students = [{ ...cls.students[0] }];
  const model5 = makeModel([5, 5, 4, 6], '5e');
  const ev2 = createEvaluation({ cls: cls2, model: model5, date: '2027-09-20' });
  setScore(ev2, sid, comps(ev2)[0].id, 5);
  const h = studentHistory([ev2, ev1], sid);
  assert.equal(h.length, 2);
  assert.deepEqual(h.map((x) => x.date), ['2026-11-24', '2027-09-20']);
  assert.deepEqual(h.map((x) => x.className), ['6e A', '5e C']);
});

test('historique : une évaluation supprimée n\'apparaît plus', () => {
  const { cls, ev } = setup();
  ev.deleted = true;
  assert.equal(studentHistory([ev], cls.students[0].id).length, 0);
});

test('niveau sans tableau pour la classe : erreur claire', () => {
  const model = makeModel([5, 5, 4, 6], '5e');
  assert.throws(() => createEvaluation({ cls: makeClass(), model, date: '2026-11-24' }), /pas de tableau/);
});

// ---------- 5. Équipes, tri, filtres ----------
test('équipes / groupes de niveau : tri, filtre, déplacement sans toucher la classe', () => {
  const { cls, ev } = setup();
  const t1 = addGroup(ev, 'team', 'Équipe 1');
  const t2 = addGroup(ev, 'team', 'Équipe 2');
  const g1 = addGroup(ev, 'level', 'Niveau A');
  const [s1, s2, s3, s4] = ev.students;
  assignGroup(ev, s1.id, 'team', t2.id);
  assignGroup(ev, s2.id, 'team', t1.id);
  assignGroup(ev, s3.id, 'team', t1.id);
  assignGroup(ev, s1.id, 'level', g1.id);
  const byTeam = orderedStudents(ev, { sort: 'teams' }).map((s) => s.first);
  assert.deepEqual(byTeam, ['Inès', 'Tom', 'Léa', 'Hugo']); // éq.1 (alpha), éq.2, sans équipe
  assert.deepEqual(orderedStudents(ev, { filter: { type: 'team', id: t1.id } }).map((s) => s.first), ['Tom', 'Inès']);
  assert.deepEqual(orderedStudents(ev, { filter: { type: 'level', id: g1.id } }).map((s) => s.first), ['Léa']);
  assignGroup(ev, s1.id, 'team', t1.id); // déplacement
  assert.equal(ev.membership[s1.id].team, t1.id);
  assert.equal(cls.students.length, 4); // classe intacte
  removeGroup(ev, t1.id);
  assert.equal(ev.membership[s1.id].team, undefined);
  assert.deepEqual(orderedStudents(ev, { sort: 'alpha' }).map((s) => s.first), ['Hugo', 'Inès', 'Léa', 'Tom']);
});

test('tri par résultats : note globale ou compétence, sans résultat en fin de liste', () => {
  const { ev } = setup();
  const [s1, s2, s3, s4] = ev.students;
  const c0 = comps(ev)[0], c1 = comps(ev)[1];
  setScore(ev, s1.id, c0.id, 2);
  setScore(ev, s2.id, c0.id, 5);
  setScore(ev, s3.id, c1.id, 4);
  setStatus(ev, s4.id, 'absent');
  setScore(ev, s4.id, c0.id, 5); // absent : ne compte pas dans le tri
  assert.deepEqual(orderedStudents(ev, { sort: 'results', dir: 'desc', key: 'total' }).map((s) => s.first),
    ['Tom', 'Inès', 'Léa', 'Hugo']);
  assert.deepEqual(orderedStudents(ev, { sort: 'results', dir: 'asc', key: c0.id }).map((s) => s.first),
    ['Léa', 'Tom', 'Hugo', 'Inès']);
});

test("ajout / retrait d'un élève dans l'évaluation sans modifier la classe", () => {
  const { cls, ev } = setup();
  const invité = newStudent('Noa');
  assert.equal(addStudentToEvaluation(ev, invité), true);
  assert.equal(addStudentToEvaluation(ev, invité), false);
  assert.equal(ev.students.length, 5);
  assert.equal(cls.students.length, 4);
  setScore(ev, invité.id, comps(ev)[0].id, 3);
  removeStudentFromEvaluation(ev, invité.id);
  assert.equal(ev.students.length, 4);
  assert.equal(ev.results[invité.id], undefined);
});

// ---------- 6. Annuler / rétablir ----------
test('annuler / rétablir : note, niveau, validation, statut, équipes, ajout/suppression d\'élève', () => {
  const { ev } = setup();
  const sess = new EvalSession(ev);
  const s = ev.students[0];
  const c = comps(ev)[0];

  assert.equal(sess.do('Niveau', (e) => setLevel(e, s.id, c.id, 'ac')), true);
  assert.equal(getCell(ev, s.id, c.id).score, 4);
  sess.do('Note', (e) => setScore(e, s.id, c.id, 2));
  sess.do('Validation', (e) => validateCell(e, s.id, c.id));
  sess.do('Statut', (e) => setStatus(e, ev.students[1].id, 'absent'));
  let g;
  sess.do('Équipe', (e) => { g = addGroup(e, 'team', 'Rouge'); assignGroup(e, s.id, 'team', g.id); });
  sess.do('Retrait élève', (e) => removeStudentFromEvaluation(e, ev.students[3].id));
  sess.do('Ajout élève', (e) => addStudentToEvaluation(e, newStudent('Noa')));

  assert.equal(ev.students.length, 4);
  assert.equal(sess.undoLabel, 'Ajout élève');
  sess.undo(); assert.equal(ev.students.length, 3);
  sess.undo(); assert.equal(ev.students.length, 4);
  sess.undo(); assert.equal(ev.groups.length, 0);
  sess.undo(); assert.equal(ev.status[ev.students[1].id], undefined);
  sess.undo(); assert.equal(cellState(getCell(ev, s.id, c.id)), 'draft');
  sess.undo(); assert.equal(getCell(ev, s.id, c.id).score, 4); // note annulée → note proposée par le niveau
  sess.undo(); assert.equal(cellState(getCell(ev, s.id, c.id)), 'empty'); // niveau annulé
  assert.equal(sess.canUndo, false);
  // rétablir
  sess.redo(); assert.equal(getCell(ev, s.id, c.id).score, 4);
  sess.redo(); sess.redo();
  assert.equal(cellState(getCell(ev, s.id, c.id)), 'validated');
  // une nouvelle action vide la pile « rétablir »
  sess.undo();
  sess.do('Autre', (e) => setScore(e, s.id, c.id, 1));
  assert.equal(sess.canRedo, false);
});

test('annulation : pas d\'entrée si rien n\'a changé ; limite de 50 actions ; sauvegarde déclenchée', () => {
  const { ev } = setup();
  let saved = 0;
  const sess = new EvalSession(ev, { onChange: () => saved++ });
  const s = ev.students[0], c = comps(ev)[0];
  assert.equal(sess.do('rien', () => {}), false);
  assert.equal(saved, 0);
  for (let i = 0; i < 60; i++) sess.do('n', (e) => setScore(e, s.id, c.id, (i % 10) / 2));
  assert.ok(sess.undoStack.length <= 50);
  sess.undo();
  assert.ok(saved > 0);
});

// ---------- 7. Duplication ----------
test('duplication : modèle, classe, équipes repris ; résultats non copiés par défaut ; entité indépendante', () => {
  const { cls, ev } = setup();
  const t = addGroup(ev, 'team', 'Bleus');
  assignGroup(ev, ev.students[0].id, 'team', t.id);
  setScore(ev, ev.students[0].id, comps(ev)[0].id, 4);
  setStatus(ev, ev.students[1].id, 'absent');

  const copy = duplicateEvaluation(ev, { date: '2026-12-15', cls });
  assert.notEqual(copy.id, ev.id);
  assert.equal(copy.date, '2026-12-15');
  assert.equal(copy.classId, ev.classId);
  assert.deepEqual(copy.model, ev.model);
  assert.equal(copy.groups.length, 1);
  assert.equal(copy.membership[ev.students[0].id].team, copy.groups[0].id);
  assert.deepEqual(copy.results, {});
  assert.deepEqual(copy.status, {});

  // indépendance
  setScore(copy, copy.students[0].id, comps(copy)[0].id, 1);
  assert.equal(getCell(ev, ev.students[0].id, comps(ev)[0].id).score, 4);
  copy.model.competences[0].name = 'X';
  assert.notEqual(ev.model.competences[0].name, 'X');
});

test('duplication : options résultats copiés / équipes non reprises / élèves resynchronisés', () => {
  const { cls, ev } = setup();
  const t = addGroup(ev, 'team', 'Bleus');
  assignGroup(ev, ev.students[0].id, 'team', t.id);
  setScore(ev, ev.students[0].id, comps(ev)[0].id, 4);
  const withRes = duplicateEvaluation(ev, { date: '2026-12-15', keepResults: true, keepGroups: false, cls });
  assert.equal(getCell(withRes, ev.students[0].id, comps(ev)[0].id).score, 4);
  assert.equal(withRes.groups.length, 0);
  // un élève arrivé depuis : présent dans la copie
  cls.students.push(newStudent('Zoé'));
  const copy2 = duplicateEvaluation(ev, { date: '2026-12-15', cls });
  assert.equal(copy2.students.length, 5);
  // sans resynchronisation : liste d'origine
  const copy3 = duplicateEvaluation(ev, { date: '2026-12-15', cls, syncStudents: false });
  assert.equal(copy3.students.length, 4);
});

// ---------- 8. Répartition des barèmes ----------
test('répartition par coefficients : toujours exactement 20, multiples du pas', () => {
  for (const w of [[1, 1, 1, 1], [2, 1, 1], [3, 3, 1, 1, 2], [1], [0, 0], [1, 2, 3, 4, 5, 6, 7]]) {
    const parts = distributeByWeights(w);
    assert.equal(parts.reduce((a, b) => a + b, 0), 20, `somme pour ${w}`);
    parts.forEach((p) => assert.equal(p % 0.5, 0));
  }
  assert.deepEqual(distributeByWeights([2, 1, 1]), [10, 5, 5]);
  const m = makeModel([5, 5, 5, 5]);
  const cs = m.levels['6e'].competences;
  cs[0].coef = 2;
  applyCoefficients(cs);
  assert.equal(sumMax(cs), 20);
  assert.ok(cs[0].max > cs[1].max);
  // les niveaux sont recalés sur le nouveau barème
  assert.equal(cs[0].levels[3].value, cs[0].max);
});

test('import : mise à l\'échelle de barèmes quelconques vers 20', () => {
  const cs = [10, 10, 5, 5].map((x) => Object.assign(newCompetence(5), { max: x, name: 'x' }));
  cs.forEach((c) => (c.levels = defaultLevels(c.max)));
  rescaleTo20(cs);
  assert.equal(sumMax(cs), 20);
  assert.deepEqual(cs.map((c) => c.max), [6.5, 6.5, 3.5, 3.5]);
});

test('changer le barème d\'une compétence remet ses niveaux à l\'échelle', () => {
  const c = newCompetence(5);
  setCompetenceMax(c, 10);
  assert.equal(c.levels[3].value, 10);
  assert.equal(c.levels[1].value, 5); // « en cours » = exactement la moitié du barème
  assert.ok(c.levels.every((l) => l.min <= l.value && l.value <= l.max));
});

// ---------- 9. Dépôt, sauvegarde JSON ----------
async function newRepo() {
  const r = new Repo(new MemStore());
  await r.init();
  return r;
}

test('dépôt : sauvegarde automatique et rechargement après « redémarrage »', async () => {
  const store = new MemStore();
  let r = new Repo(store);
  await r.init();
  const { model, cls, ev } = setup();
  await r.save('models', model);
  await r.save('classes', cls);
  await r.save('evaluations', ev);
  setScore(ev, ev.students[0].id, comps(ev)[0].id, 4);
  await r.save('evaluations', ev);
  // redémarrage : nouveau dépôt sur le même stockage
  r = new Repo(store);
  await r.init();
  assert.equal(r.list('evaluations').length, 1);
  assert.equal(getCell(r.list('evaluations')[0], ev.students[0].id, comps(ev)[0].id).score, 4);
  assert.ok(r.deviceId);
});

test('suppression douce : retrouvable (annuler la suppression) et masquée dans les listes', async () => {
  const r = await newRepo();
  const { ev } = setup();
  await r.save('evaluations', ev);
  await r.remove('evaluations', ev.id);
  assert.equal(r.list('evaluations').length, 0);
  assert.equal(r.all('evaluations').length, 1);
  await r.restore('evaluations', ev.id);
  assert.equal(r.list('evaluations').length, 1);
});

test('export / import JSON : restauration complète (fusion et remplacement)', async () => {
  const a = await newRepo();
  const { model, cls, ev } = setup();
  setScore(ev, ev.students[0].id, comps(ev)[0].id, 4);
  await a.save('models', model);
  await a.save('classes', cls);
  await a.save('evaluations', ev);
  const json = JSON.parse(JSON.stringify(a.exportAll()));

  const b = await newRepo();
  const rep = await b.importAll(json);
  assert.equal(rep.added, 3);
  assert.deepEqual(b.list('evaluations')[0], a.list('evaluations')[0]);
  assert.equal(b.list('classes')[0].students.length, 4);
  assert.equal(b.list('models')[0].levels['6e'].competences.length, 4);

  // import en mode fusion : ne remplace JAMAIS une donnée locale plus récente
  await new Promise((r) => setTimeout(r, 5)); // (évite l'égalité d'horodatage à la milliseconde près)
  const local = b.get('evaluations', ev.id);
  setScore(local, ev.students[0].id, comps(ev)[0].id, 1);
  await b.save('evaluations', local);
  const rep2 = await b.importAll(json);
  assert.equal(rep2.keptLocal, 1);
  assert.equal(getCell(b.get('evaluations', ev.id), ev.students[0].id, comps(ev)[0].id).score, 1);

  // remplacement explicite
  await b.importAll(json, { mode: 'replace' });
  assert.equal(getCell(b.get('evaluations', ev.id), ev.students[0].id, comps(ev)[0].id).score, 4);

  assert.rejects(() => b.importAll({ app: 'autre' }), /pas une sauvegarde/);
  assert.rejects(() => b.importAll({ app: 'eps-eval', schema: 99 }), /plus récente/);
});

test("une évaluation de l'ancienne année reste intacte après modification complète des réglages", async () => {
  const r = await newRepo();
  const { model, cls, ev } = setup();
  setScore(ev, ev.students[0].id, comps(ev)[0].id, 4);
  await r.save('models', model);
  await r.save('classes', cls);
  await r.save('evaluations', ev);
  const frozen = JSON.stringify(r.get('evaluations', ev.id));
  // on modifie modèle ET classe, on les sauvegarde
  model.levels['6e'].competences.splice(0, 1);
  cls.students = [];
  await r.save('models', model);
  await r.save('classes', cls);
  assert.equal(JSON.stringify(r.get('evaluations', ev.id)), frozen);
});

test('pendingCount : modifications en attente de synchro', async () => {
  const r = await newRepo();
  const { ev } = setup();
  assert.equal(r.pendingCount(), 0);
  await r.save('evaluations', ev);
  assert.equal(r.pendingCount(), 1);
});

// ---------- 10. Synchronisation (moteur testé avec un Drive simulé) ----------
class FakeDrive {
  constructor() { this.data = null; this.version = 0; this.onGet = null; this.puts = 0; this.offline = false; }
  async getRemote() {
    if (this.offline) throw new Error('hors ligne');
    if (this.onGet) { const f = this.onGet; this.onGet = null; f(); }
    return { version: this.version, data: this.data ? structuredClone(this.data) : null };
  }
  async putRemote(data, expected) {
    if (this.offline) throw new Error('hors ligne');
    if (expected !== this.version) throw new RemoteChangedError();
    this.data = structuredClone(data);
    this.puts++;
    return ++this.version;
  }
}
const tick = () => new Promise((r) => setTimeout(r, 3)); // garantit des updatedAt différents

async function device(drive) {
  const repo = await newRepo();
  return { repo, engine: new SyncEngine({ repo, api: drive }) };
}

test('synchro : première sauvegarde puis restauration sur un autre appareil', async () => {
  const drive = new FakeDrive();
  const A = await device(drive);
  const { model, cls, ev } = setup();
  setScore(ev, ev.students[0].id, comps(ev)[0].id, 4);
  for (const [n, rec] of [['models', model], ['classes', cls], ['evaluations', ev]]) await A.repo.save(n, rec);
  assert.equal(A.repo.pendingCount(), 3);
  const res = await A.engine.run();
  assert.equal(res.status, 'ok');
  assert.equal(res.pushed, 3);
  assert.equal(A.repo.pendingCount(), 0);

  const B = await device(drive);
  const res2 = await B.engine.run();
  assert.equal(res2.pulled, 3);
  assert.deepEqual(B.repo.get('evaluations', ev.id), A.repo.get('evaluations', ev.id));
  assert.equal(B.repo.pendingCount(), 0);
});

test('synchro : modifications hors connexion conservées puis envoyées au retour du réseau', async () => {
  const drive = new FakeDrive();
  const A = await device(drive);
  const { ev } = setup();
  await A.repo.save('evaluations', ev);
  drive.offline = true;
  await assert.rejects(() => A.engine.run(), /hors ligne/);
  assert.equal(A.repo.pendingCount(), 1); // rien n'est perdu, tout reste en attente
  setScore(ev, ev.students[0].id, comps(ev)[0].id, 3);
  await A.repo.save('evaluations', ev);
  drive.offline = false;
  const res = await A.engine.run();
  assert.equal(res.status, 'ok');
  assert.equal(A.repo.pendingCount(), 0);
  assert.equal(getCell(drive.data.records.evaluations[0], ev.students[0].id, comps(ev)[0].id).score, 3);
});

test('synchro : modification d\'un seul côté → appliquée sans conflit', async () => {
  const drive = new FakeDrive();
  const A = await device(drive), B = await device(drive);
  const { ev } = setup();
  await A.repo.save('evaluations', ev);
  await A.engine.run(); await B.engine.run();
  await tick();
  const evB = B.repo.get('evaluations', ev.id);
  setScore(evB, ev.students[0].id, comps(ev)[0].id, 5);
  await B.repo.save('evaluations', evB);
  await B.engine.run();
  const res = await A.engine.run();
  assert.equal(res.status, 'ok');
  assert.equal(getCell(A.repo.get('evaluations', ev.id), ev.students[0].id, comps(ev)[0].id).score, 5);
});

test('synchro : modifications différentes sur 2 appareils → conflit signalé, jamais écrasé en silence', async () => {
  const drive = new FakeDrive();
  const A = await device(drive), B = await device(drive);
  const { ev } = setup();
  await A.repo.save('evaluations', ev);
  await A.engine.run(); await B.engine.run();
  await tick();
  const s0 = ev.students[0].id, s1 = ev.students[1].id, c0 = comps(ev)[0].id;
  const evA = A.repo.get('evaluations', ev.id);
  setScore(evA, s0, c0, 2);
  await A.repo.save('evaluations', evA);
  await tick();
  const evB = B.repo.get('evaluations', ev.id);
  setScore(evB, s1, c0, 4);
  await B.repo.save('evaluations', evB);
  await B.engine.run(); // B envoie en premier

  const res = await A.engine.run();
  assert.equal(res.status, 'conflicts');
  assert.equal(res.conflicts.length, 1);
  // rien n'a été modifié localement ni à distance
  assert.equal(getCell(A.repo.get('evaluations', ev.id), s0, c0).score, 2);
  assert.equal(getCell(drive.data.records.evaluations[0], s1, c0).score, 4);
  assert.equal(getCell(drive.data.records.evaluations[0], s0, c0), null);

  // choix « fusionner » : les deux modifications sont gardées
  const key = res.conflicts[0].key;
  const res2 = await A.engine.run({ resolutions: { [key]: 'merge' } });
  assert.equal(res2.status, 'ok');
  const merged = A.repo.get('evaluations', ev.id);
  assert.equal(getCell(merged, s0, c0).score, 2);
  assert.equal(getCell(merged, s1, c0).score, 4);
  assert.equal(getCell(drive.data.records.evaluations[0], s1, c0).score, 4);
  assert.equal(getCell(drive.data.records.evaluations[0], s0, c0).score, 2);
  assert.equal(A.repo.pendingCount(), 0);
  // B récupère la fusion
  await B.engine.run();
  assert.equal(getCell(B.repo.get('evaluations', ev.id), s0, c0).score, 2);
});

test('synchro : conflit résolu en gardant « local » ou « distant »', async () => {
  for (const choice of ['local', 'remote']) {
    const drive = new FakeDrive();
    const A = await device(drive), B = await device(drive);
    const { cls } = setup();
    await A.repo.save('classes', cls);
    await A.engine.run(); await B.engine.run();
    await tick();
    const cA = A.repo.get('classes', cls.id); cA.name = 'Nom A'; await A.repo.save('classes', cA);
    await tick();
    const cB = B.repo.get('classes', cls.id); cB.name = 'Nom B'; await B.repo.save('classes', cB);
    await B.engine.run();
    const r1 = await A.engine.run();
    assert.equal(r1.status, 'conflicts');
    await A.engine.run({ resolutions: { [r1.conflicts[0].key]: choice } });
    const expected = choice === 'local' ? 'Nom A' : 'Nom B';
    assert.equal(A.repo.get('classes', cls.id).name, expected);
    assert.equal(drive.data.records.classes[0].name, expected);
    await B.engine.run();
    assert.equal(B.repo.get('classes', cls.id).name, expected);
    assert.equal(A.repo.pendingCount(), 0);
    assert.equal(B.repo.pendingCount(), 0);
  }
});

test('synchro : appareil neuf avec données locales différentes → conflit, pas d\'écrasement par une vieille sauvegarde', async () => {
  const drive = new FakeDrive();
  const A = await device(drive);
  const { cls } = setup();
  await A.repo.save('classes', cls);
  await A.engine.run();
  // un autre appareil a la même classe (même id) mais modifiée, jamais synchronisée
  const B = await device(drive);
  const copy = structuredClone(cls); copy.name = 'Modifiée hors ligne';
  await tick();
  await B.repo.save('classes', copy);
  const res = await B.engine.run();
  assert.equal(res.status, 'conflicts');
  assert.equal(B.repo.get('classes', cls.id).name, 'Modifiée hors ligne');
});

test('synchro : suppression douce propagée ; suppression vs modification = conflit', async () => {
  const drive = new FakeDrive();
  const A = await device(drive), B = await device(drive);
  const { ev } = setup();
  await A.repo.save('evaluations', ev);
  await A.engine.run(); await B.engine.run();
  await tick();
  await A.repo.remove('evaluations', ev.id);
  await A.engine.run();
  await B.engine.run();
  assert.equal(B.repo.list('evaluations').length, 0);
  // restaurer côté B et modifier côté A en même temps
  await tick();
  await B.repo.restore('evaluations', ev.id);
  await tick();
  const evA = A.repo.get('evaluations', ev.id);
  evA.date = '2030-01-01';
  await A.repo.save('evaluations', evA);
  await B.engine.run();
  const res = await A.engine.run();
  assert.equal(res.status, 'conflicts');
});

test('synchro : le fichier distant a changé pendant la synchro → nouvel essai automatique', async () => {
  const drive = new FakeDrive();
  const A = await device(drive), B = await device(drive);
  const { ev, cls } = setup();
  await A.repo.save('classes', cls);
  await A.engine.run();
  await B.engine.run();
  await A.repo.save('evaluations', ev);
  // pendant la lecture par A, B publie d'autres données
  const other = newClass('3e Z', '3e');
  drive.onGet = () => {
    drive.data.records.classes.push(structuredClone(other));
    drive.version++;
  };
  const res = await A.engine.run();
  assert.equal(res.status, 'ok');
  assert.ok(A.repo.get('classes', other.id), 'les données de l\'autre appareil sont récupérées');
  assert.equal(drive.data.records.evaluations.length, 1);
});

test('planSync : cas de base', () => {
  const mk = (id, u, extra = {}) => ({ store: 'classes', rec: { id, updatedAt: u, name: 'n' + u, ...extra } });
  const key = (id) => `classes:${id}`;
  const local = new Map([[key('a'), mk('a', 5)], [key('b'), mk('b', 7)], [key('d'), mk('d', 1)]]);
  const remote = new Map([[key('a'), mk('a', 5)], [key('b'), mk('b', 6)], [key('c'), mk('c', 2)], [key('d'), mk('d', 2)]]);
  const plan = planSync(local, remote, { [key('b')]: 6, [key('d')]: 0 });
  assert.equal(plan.same.length, 1);
  assert.deepEqual(plan.toRemote.map((x) => x.rec.id), ['b']);
  assert.deepEqual(plan.toLocal.map((x) => x.rec.id), ['c']);
  assert.deepEqual(plan.conflicts.map((c) => c.key), [key('d')]);
});

test('mergeEvaluations : la cellule la plus récente gagne, les statuts aussi, élèves réunis', () => {
  const { ev } = setup();
  const a = structuredClone(ev), b = structuredClone(ev);
  const [s0, s1] = ev.students; const c = comps(ev)[0].id;
  setScore(a, s0.id, c, 2, 100);
  setScore(b, s0.id, c, 4, 200);          // plus récent → gagne
  setScore(a, s1.id, c, 3, 300);          // seulement en A
  setStatus(a, ev.students[2].id, 'absent', 50);
  setStatus(b, ev.students[2].id, 'dispense', 60);
  b.students.push({ id: 'zz', first: 'Zoé', initial: '' });
  a.updatedAt = 10; b.updatedAt = 20;
  const m = mergeEvaluations(a, b, 'dev');
  assert.equal(getCell(m, s0.id, c).score, 4);
  assert.equal(getCell(m, s1.id, c).score, 3);
  assert.equal(m.status[ev.students[2].id], 'dispense');
  assert.ok(m.students.some((s) => s.id === 'zz'));
  assert.equal(m.students.length, 5);
});

test('planSync : même horodatage mais appareils et contenus différents ≠ identiques (régression)', () => {
  const mk = (dev, name) => ({ store: 'classes', rec: { id: 'a', updatedAt: 1000, deviceId: dev, name } });
  const key = 'classes:a';
  // l'appareil local n'a pas bougé depuis la dernière synchro (base = 1000) : il doit recevoir la version distante
  const plan = planSync(new Map([[key, mk('A', 'avant')]]), new Map([[key, mk('B', 'après')]]), { [key]: 1000 });
  assert.equal(plan.same.length, 0);
  assert.deepEqual(plan.toLocal.map((x) => x.rec.name), ['après']);
  // sans base commune : conflit signalé
  const plan2 = planSync(new Map([[key, mk('A', 'x')]]), new Map([[key, mk('B', 'y')]]), {});
  assert.equal(plan2.conflicts.length, 1);
  // même appareil, même horodatage : identique
  assert.equal(planSync(new Map([[key, mk('A', 'x')]]), new Map([[key, mk('A', 'x')]]), {}).same.length, 1);
});

test('mergeEvaluations : horodatage strictement plus récent que les deux versions', () => {
  const { ev } = setup();
  const a = structuredClone(ev), b = structuredClone(ev);
  a.updatedAt = Date.now() + 5000; b.updatedAt = Date.now() + 9000; // dans le futur : now() seul ne suffirait pas
  assert.ok(mergeEvaluations(a, b, 'x').updatedAt > b.updatedAt);
});
