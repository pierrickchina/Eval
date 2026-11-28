import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseCSV, detectDelimiter, decodeText } from '../js/import/csv.js';
import { readXlsx } from '../js/import/xlsx.js';
import { guessHeaderRow, guessMapping, buildCompetences } from '../js/import/mapper.js';
import { validateTable, rescaleTo20, sumMax } from '../js/logic/model.js';

const fx = (n) => readFileSync(new URL(`./fixtures/${n}`, import.meta.url));

test('CSV : séparateur, guillemets, ; dans une cellule, lignes vides', () => {
  const text = decodeText(fx('competences.csv'));
  assert.equal(detectDelimiter(text), ';');
  const rows = parseCSV(text);
  assert.equal(rows[0][0], 'Compétence');
  assert.equal(rows[1][0], "Se préparer; s'échauffer");
  assert.equal(rows[2][2], '15');
  assert.equal(parseCSV('a,"b ""c""",d\n1,2,3').at(0)[1], 'b "c"');
  assert.deepEqual(parseCSV('a;b\r\n1;2\r\n'), [['a', 'b'], ['1', '2']]);
});

test('CSV Windows-1252 : accents décodés', () => {
  const bytes = Uint8Array.from([0x43, 0x6f, 0x6f, 0x70, 0xe9, 0x72, 0x65, 0x72]); // « Coopérer » en latin-1
  assert.equal(decodeText(bytes.buffer), 'Coopérer');
});

test('XLSX : feuilles, chaînes partagées, nombres, accents, retours à la ligne, lignes vides', async () => {
  const buf = fx('competences.xlsx');
  const sheets = await readXlsx(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  assert.deepEqual(sheets.map((s) => s.name), ['Badminton 6e', 'Autre']);
  const rows = sheets[0].rows;
  assert.equal(rows[0][0], 'Tableau de compétences – Badminton (6e)');
  assert.deepEqual(rows[1], []);
  assert.equal(rows[2][4], 'Non acquis');
  assert.equal(rows[3][2], '5');
  assert.equal(rows[3][7], 'Varie & surprend "l\'adversaire"');
  assert.equal(rows[5][0], 'Arbitrer\net observer');
  assert.equal(sheets[1].rows[1][1], '20');
});

test('XLSX : fichier invalide → erreur claire', async () => {
  await assert.rejects(() => readXlsx(new TextEncoder().encode('pas un zip').buffer), /xlsx valide/);
});

test('correspondance automatique des colonnes + construction des compétences', async () => {
  const buf = fx('competences.xlsx');
  const [sheet] = await readXlsx(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const h = guessHeaderRow(sheet.rows);
  assert.equal(h, 2); // saute le titre et la ligne vide
  const mapping = guessMapping(sheet.rows[h]);
  assert.deepEqual(mapping, { na: 4, ec: 5, ac: 6, de: 7, afc: 1, coef: 3, max: 2, name: 0 });
  const { competences, issues } = buildCompetences(sheet.rows, mapping, { headerRow: h });
  assert.equal(competences.length, 4);
  assert.deepEqual(competences.map((c) => c.max), [5, 5, 4, 6]); // « 6,0 » avec virgule accepté
  assert.equal(competences[0].afc, 'AFC 1.2');
  assert.equal(competences[2].name, 'Arbitrer et observer'); // retour à la ligne de la cellule → espace
  assert.equal(competences[0].levels.find((l) => l.key === 'ec').text, 'Joue en fond de court');
  assert.equal(competences[3].coef, 2);
  assert.equal(sumMax(competences), 20);
  assert.equal(validateTable(competences).ok, true);
  // la dernière compétence n'a aucun critère : signalée mais non bloquante
  const warn = issues.filter((i) => i.field === 'levels');
  assert.equal(warn.length, 1);
  assert.equal(warn[0].blocking, false);
  assert.equal(warn[0].row, 7);
});

test('import CSV : données manquantes/incompatibles signalées, somme ≠ 20 détectée puis corrigée', () => {
  const rows = parseCSV(decodeText(fx('competences.csv')));
  const mapping = guessMapping(rows[0]);
  assert.equal(mapping.name, 0);
  assert.equal(mapping.max, 2);
  const { competences, issues } = buildCompetences(rows, mapping);
  assert.equal(competences.length, 3); // la ligne vide est ignorée, « Sans barème » est gardée pour correction
  const blocking = issues.filter((i) => i.blocking);
  assert.equal(blocking.length, 1);
  assert.equal(blocking[0].field, 'max');
  assert.match(blocking[0].message, /manquant/);
  // correction : on donne un barème au dernier, puis somme = 5+15+? → rescale
  competences[2].max = 5;
  assert.equal(sumMax(competences), 25);
  assert.equal(validateTable(competences).exact20, false); // 1.10 : accepté (note ramenée sur 20)
  rescaleTo20(competences);
  assert.equal(sumMax(competences), 20);
  assert.equal(validateTable(competences).ok, true);
});

test('barème non numérique et nom manquant signalés', () => {
  const rows = [['Compétence', 'Barème'], ['A', 'beaucoup'], ['', '5'], ['C', '/4']];
  const { competences, issues } = buildCompetences(rows, { name: 0, max: 1 });
  assert.equal(competences.length, 3);
  assert.deepEqual(issues.map((i) => `${i.row}:${i.field}`).sort(), ['2:max', '3:name']);
  assert.equal(competences[2].max, 4); // « /4 » accepté
});
