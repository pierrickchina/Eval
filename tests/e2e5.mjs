// Test v1.4 dans Chromium : menu Classes, notes (colonnes libres, trimestres), oublis (croix colorées), infos, sauvegarde.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const URL = process.argv[2] || 'http://127.0.0.1:8765/index.html';
const SHOTS = process.env.SHOTS || '/tmp/claude-0/-home-claude/7c20a5a1-b5cf-5e73-87c9-df7896a28ca7/scratchpad/shots';
mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, hasTouch: true, locale: 'fr-FR' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
let n = 0; const log = (m) => console.log(`✓ ${String(++n).padStart(2, '0')} ${m}`);
const route = () => page.evaluate(() => window.__app.route.name);

await page.addInitScript(() => { try { localStorage.setItem('eps-skip-tour', '1'); } catch {} });
await page.goto(URL);
await page.waitForSelector('.empty h2');
await page.evaluate(async () => {
  const S = await import('./js/data/schema.js');
  const E = await import('./js/logic/evaluation.js');
  const C = await import('./js/logic/scoring.js');
  const app = window.__app;
  const cls = S.newClass('6e A', '6e');
  cls.year = '2026-2027';
  ['Léa', 'Tom', 'Inès'].forEach((f) => cls.students.push(S.newStudent(f)));
  await app.repo.save('classes', cls);
  const mk = (act) => { const m = S.newModel(); m.name = act; m.activity = act; m.levels['6e'] = { competences: [10, 10].map((x, i) => Object.assign(S.newCompetence(x), { name: 'C' + i })) }; return m; };
  const add = async (act, date, fills) => {
    const ev = E.createEvaluation({ cls, model: mk(act), date });
    fills.forEach((v, i) => { if (v != null) ev.model.competences.forEach((c) => C.setScore(ev, cls.students[i].id, c.id, v)); });
    await app.repo.save('evaluations', ev);
  };
  await add('Handball', '2026-10-05', [7, 10, null]);       // Léa 14, Tom 20
  await add('Badminton', '2026-11-10', [5, 4, 6]);          // 10, 8, 12
  await add('Acrosport', '2026-12-15', [9, null, 8]);       // 18, —, 16
});
await page.reload();
await page.waitForSelector('.card');

assert.match(await page.textContent('.card'), /3 élèves/);
assert.ok(await page.locator('.card .lasttask').count(), 'raccourci vers la dernière tâche');
await page.click('.card');
await page.waitForSelector('.hub');
assert.equal(await route(), 'classPage');
assert.deepEqual(await page.locator('.seg >> nth=0').locator('button').allTextContents(), ['Carnet de bord', 'Séance du jour', 'Oublis', 'Notes', 'Résultats']);
assert.equal(await page.locator('.actframe').count(), 3, 'migration : une activité par évaluation existante');
await page.click('.seg >> text=Notes');
await page.waitForSelector('table.notes');
log('accueil → tuile de classe → carnet de bord (3 onglets, 3 activités) → onglet Notes');

// colonnes
assert.equal(await page.locator('table.notes thead th').count(), 1 + 3 + 1);
assert.deepEqual(await page.locator('table.notes thead th .cn').allTextContents(), ['Handball', 'Badminton', 'Acrosport', 'Moyenne']);
const row = (name) => page.locator('table.notes tbody tr', { hasText: name });
assert.deepEqual(await row('Léa').locator('td').allTextContents(), ['14', '10', '18', '14']);
assert.equal((await row('Tom').locator('td').first().textContent()).trim(), '20');
log('une colonne par évaluation, notes finales et moyenne par élève');
await page.screenshot({ path: `${SHOTS}/v14-notes.png` });

// trimestre
await page.selectOption('select[aria-label="Période"]', '0');
assert.equal(await page.locator('table.notes thead th').count(), 1 + 2 + 1);
assert.deepEqual(await row('Léa').locator('td').allTextContents(), ['14', '10', '12']);
log('filtre « Trimestre 1 » : seules les évaluations de la période');
await page.selectOption('select[aria-label="Période"]', 'all');

// ajout d'une évaluation → nouvelle colonne
await page.evaluate(async () => {
  const S = await import('./js/data/schema.js'); const E = await import('./js/logic/evaluation.js');
  const app = window.__app; const cls = app.repo.list('classes')[0];
  const m = S.newModel(); m.name = 'TT'; m.activity = 'Tennis de table'; m.levels['6e'] = { competences: [Object.assign(S.newCompetence(20), { name: 'X' })] };
  await app.repo.save('evaluations', E.createEvaluation({ cls, model: m, date: '2026-11-20' }));
});
await page.click('.seg >> text=Oublis'); await page.click('.seg >> text=Notes');
assert.equal(await page.locator('table.notes thead th').count(), 1 + 4 + 1);
log('une activité de plus = une colonne de plus');

// clic colonne → évaluation, retour
await page.click('.colbtn >> nth=0');
await page.waitForSelector('table.grid:not(.notes)');
assert.equal(await route(), 'eval');
await page.goBack();
await page.waitForSelector('table.notes');
assert.equal(await route(), 'classPage');
log('toucher une colonne ouvre l\'évaluation ; Précédent revient à la classe');

// ---------- Oublis ----------
await page.click('.seg >> text=Oublis');
await page.waitForSelector('.forgetrow');
const lea = page.locator('.forgetrow', { hasText: 'Léa' });
for (let i = 0; i < 5; i++) await lea.locator('[aria-label^="Ajouter un oubli"]').click();
const colors = await lea.locator('.xmark').evaluateAll((els) => els.map((e) => getComputedStyle(e).color));
assert.equal(colors.length, 5);
assert.equal(colors[0], colors[1], '1 et 2 : même couleur');
assert.notEqual(colors[1], colors[2], '3 : autre couleur (orange)');
assert.notEqual(colors[2], colors[3], '4 : autre couleur (rouge)');
assert.equal(colors[3], colors[4], '4 et 5 : rouges');
assert.match(colors[0], /rgb\(230, 184, 0\)/); assert.match(colors[2], /rgb\(240, 127, 26\)/); assert.match(colors[3], /rgb\(224, 52, 63\)/);
assert.equal((await lea.locator('.fcount').textContent()).trim(), '5');
await page.screenshot({ path: `${SHOTS}/v14-oublis.png` });
log('5 oublis : 2 croix jaunes, 1 orange, 2 rouges');
await lea.locator('[aria-label^="Retirer un oubli"]').click();
assert.equal(await lea.locator('.xmark').count(), 4);
log('« − » retire la dernière croix');
assert.equal(await page.locator('.forgetrow', { hasText: 'Tom' }).locator('[aria-label^="Retirer un oubli"]').isDisabled(), true);
await page.click('.toplace');
assert.equal(await page.locator('.forgetrow').count(), 1);
await page.click('.toplace');
log('filtre « 3 croix et + »');
// persistance
await page.reload(); // 1.13 : l'actualisation reste sur la page de la classe
await page.waitForSelector('.topbar'); await page.waitForFunction(() => window.__app?.repo);
await page.evaluate(async () => (await import('./js/app.js')).go('home'));
await page.waitForSelector('.card');
await page.click('.card'); await page.click('.seg >> text=Oublis');
assert.equal(await page.locator('.forgetrow', { hasText: 'Léa' }).locator('.xmark').count(), 4);
log('oublis conservés après rechargement');

// ---------- Infos élèves supprimées ----------
assert.equal(await page.locator('.seg >> text=Infos').count(), 0);
log('onglet « Infos élèves » supprimé');

// ---------- Sauvegarde ----------
const dump = await page.evaluate(() => JSON.stringify(window.__app.repo.exportAll()));
const obj = JSON.parse(dump);
const c = obj.classes[0];
assert.equal(Object.values(c.forgets).flat().length, 4);
assert.equal('infos' in c, false);
assert.ok(Array.isArray(c.activities) && c.activities.length >= 3);
log('oublis et activités présents dans la sauvegarde JSON (donc dans le fichier envoyé sur Drive)');

// ---------- Trimestres dans les réglages ----------
await page.goBack(); await page.waitForSelector('.home-grid .card');
await page.click('text=Réglages'); await page.click('.seg >> text=Général');
await page.waitForSelector('text=Trimestres');
const t1end = page.locator('.panel', { hasText: 'Trimestres' }).locator('input[type=date]').nth(1);
await t1end.fill('2026-12-20');
await t1end.press('Tab');
await page.waitForTimeout(100);
await page.goBack(); await page.waitForSelector('.card');
await page.click('.card'); await page.click('.seg >> text=Notes');
await page.selectOption('select[aria-label="Période"]', '0');
assert.equal(await page.locator('table.notes thead th').count(), 1 + 4 + 1 - 0, 'avec T1 prolongé jusqu\'au 20 déc : Handball, Badminton, TT, Acrosport');
log('dates de trimestre modifiables dans les réglages');

// impression
await page.evaluate(() => { window.print = () => { window.__printed = document.getElementById('print-root').innerText; }; });
await page.click('.toolbar >> text=PDF');
await page.waitForFunction(() => window.__printed);
assert.match(await page.evaluate(() => window.__printed), /Léa/);
log('impression / PDF du tableau des notes');

assert.equal(errors.length, 0, errors.join('\n'));
console.log('\nAucune erreur JavaScript.');
await browser.close();
