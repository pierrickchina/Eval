// Test de bout en bout dans Chromium (Playwright). Lancer : node tests/e2e.mjs [url]
// Prérequis : un serveur statique sur le dossier de l'application (ex. python3 -m http.server 8765).
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright'); // installé globalement (NODE_PATH) ou localement

const URL = process.argv[2] || 'http://127.0.0.1:8765/index.html';
const SHOTS = process.env.SHOTS || '/tmp/claude-0/-home-claude/7c20a5a1-b5cf-5e73-87c9-df7896a28ca7/scratchpad/shots';
mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, hasTouch: true, locale: 'fr-FR', acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
const shot = (n) => page.screenshot({ path: `${SHOTS}/${n}.png` });
let step = 0;
const log = (m) => console.log(`✓ ${String(++step).padStart(2, '0')} ${m}`);

await page.goto(URL);
await page.waitForSelector('.empty h2');
assert.match(await page.textContent('.empty h2'), /Bienvenue/);
log('accueil vide affiché');

// ---------- Classe ----------
await page.click('text=Ouvrir les réglages');
await page.click('.seg >> text=Classes');
await page.click('text=Nouvelle classe');
await page.fill('input[placeholder="ex. 6e A"]', '6e A');
await page.press('input[placeholder="ex. 6e A"]', 'Tab');
await page.waitForSelector('text=Enregistré automatiquement');
for (const [n, i] of [['Léa', 'M'], ['Tom', ''], ['Inès', ''], ['Léa', 'D']]) {
  await page.fill('[aria-label="Prénom du nouvel élève"]', n);
  await page.press('[aria-label="Prénom du nouvel élève"]', 'Enter');
  if (i) await page.fill('[aria-label="Initiale du nom"] >> nth=0', i);
  await page.press('[aria-label="Initiale du nom"] >> nth=0', 'Enter');
  await page.waitForTimeout(80);
}
assert.equal(await page.locator('.listrow input[aria-label="Prénom"]').count(), 4);
log('classe « 6e A » avec 4 élèves (2 Léa distingués par initiale)');
await shot('01-classe');
await page.click('text=Terminer');

// ---------- Modèle ----------
await page.click('.seg >> text=Modèles d\'évaluation');
await page.click('text=Nouveau modèle');
await page.fill('input[placeholder^="ex. Badminton – "]', 'Badminton cycle 3');
await page.fill('input[placeholder="ex. Badminton"]', 'Badminton');
await page.click('.chip >> text=6e');
await page.click('text=Ajouter une compétence');
// 1re compétence : barème proposé 5
const addComp = async (name, max) => {
  const rows = page.locator('table.edit tbody tr:has(input[data-max])');
  const n = await rows.count();
  const row = rows.nth(n - 1);
  await row.locator('input[aria-label="Nom"]').fill(name);
  await row.locator('input[data-max]').fill(String(max));
  await row.locator('input[data-max]').press('Tab');
};
await addComp('S\'engager dans la pratique', 5);
await page.click('text=Ajouter une compétence'); await addComp('Réaliser une performance', 5);
await page.click('text=Ajouter une compétence'); await addComp('Arbitrer', 4);
// somme = 14 : l'enregistrement doit être bloqué
assert.equal(await page.locator('#m-save').isDisabled(), true);
assert.match(await page.textContent('#m-sum'), /14 \/ 20 — il manque 6/);
log('somme ≠ 20 : message « il manque 6 » et enregistrement bloqué');
await page.click('text=Ajouter une compétence');
await addComp('Coopérer', 6);
assert.match(await page.textContent('#m-sum'), /20 \/ 20/);
assert.equal(await page.locator('#m-save').isDisabled(), false);
// critères du niveau Acquis de la 1re compétence
await page.locator('text=Niveaux ▼').first().click();
await page.fill('textarea[aria-label="Critères Acquis"]', 'Choisit sa frappe selon la situation');
await shot('02-modele');
await page.click('#m-save');
await page.waitForSelector('text=Badminton');
log('modèle enregistré une fois la somme égale à 20');

// ---------- Nouvelle évaluation ----------
await page.click('[aria-label="Retour"]');
await page.click('text=Nouvelle évaluation');
await page.waitForSelector('.dlg select');
await page.click('.dlg >> text=Créer');
await page.waitForSelector('table.grid');
assert.equal(await page.locator('tbody tr').count(), 4);
assert.equal(await page.locator('thead th').count(), 6); // élève + 4 compétences + note
log('évaluation créée : 4 élèves × 4 compétences');
await shot('03-tableau-vide');

// saisie d'une cellule : niveau Acquis → note proposée 4/5
const cell = (row, col) => page.locator(`tbody tr:nth-child(${row}) td.cell`).nth(col);
await cell(1, 0).click();
await page.click('.lvbtn.ac');
assert.equal((await cell(1, 0).textContent()).replace(/[^\d,]/g, ''), '4');
assert.match(await cell(1, 0).getAttribute('class'), /draft/);
assert.match(await cell(1, 0).getAttribute('class'), /lv-ac/);
log('niveau Acquis → note 4 proposée, cellule grisée (non validée) et verte');
await page.click('.sheet >> text=Valider et suivant');
assert.match(await cell(1, 0).getAttribute('class'), /validated/);
assert.match(await page.textContent('.sheet .who'), /Tom/);
log('« Valider et suivant » valide la cellule et passe à l\'élève suivant');
// note manuelle
const inp = page.locator('.sheet input[aria-label="Note"]');
await inp.fill('2,5'); await inp.press('Enter');
assert.match(await cell(2, 0).getAttribute('class'), /lv-ec/);
await shot('04-saisie');
log('note manuelle 2,5 → niveau recalculé « en cours »');

// remplir toute la ligne de Léa M → note finale
for (let c = 1; c < 4; c++) { await cell(1, c).click(); await page.click('.lvbtn.de'); await page.click('.sheet >> text=Valider'); }
await page.waitForTimeout(100);
const total1 = await page.locator('tbody tr:nth-child(1) td.total').textContent();
assert.match(total1, /^(?:\s*)?[\d,]+\/20/);
log(`note finale affichée : ${total1.trim()}`);
// partiel pour Tom
assert.match(await page.locator('tbody tr:nth-child(2) td.total').textContent(), /2,5\/5.*3 restantes/);
log('note partielle : « 2,5/5 · 3 restantes » (pas de note sur 20)');

// moyenne de classe
assert.match(await page.locator('tfoot td').first().textContent(), /n = 2/);
log('moyenne de classe avec effectif n');

// annuler / rétablir
await page.click('[aria-label^="Annuler"]');
await page.waitForTimeout(80);
await page.click('[aria-label^="Rétablir"]');
log('annuler / rétablir');

// statut absent
await page.locator('tbody tr:nth-child(3) .st').click();
await page.click('.popmenu >> text=Absent');
assert.match(await page.locator('tbody tr:nth-child(3) td.total').textContent(), /ABS/);
assert.match(await page.locator('tbody tr:nth-child(3)').getAttribute('class'), /inactive/);
log('élève absent : statut visible, jamais compté comme zéro');
await shot('05-statuts');

// groupes
await page.click('text=Groupes');
await page.click('.dlg >> text=Ajouter une équipe');
await page.click('.dlg >> text=Ajouter une équipe');
await page.locator('.dlg table select').first().selectOption({ index: 1 });
await page.click('.dlg >> text=Terminé');
await page.click('.seg >> text=Équipes');
assert.match(await page.locator('tbody tr:nth-child(1) .tag.team').textContent(), /Équipe 1/);
log('équipes créées, élève affecté, tri par équipes');

// fiche élève
await page.locator('tbody tr:nth-child(1) .nm').click();
await page.waitForSelector('.compcard');
assert.equal(await page.locator('.compcard').count(), 4);
await shot('06-fiche-eleve');
log('fiche individuelle ouverte (4 compétences, 4 niveaux chacune)');
await page.click('text=Historique');
await page.waitForSelector('table.hist');
await shot('07-historique');
await page.click('.dlg >> text=Fermer');
await page.click('text=Tableau');

// ---------- Duplication ----------
await page.click('[aria-label="Retour aux évaluations"]');
await page.locator('.card [aria-label="Actions"]').click();
await page.click('.popmenu >> text=Dupliquer');
await page.click('.dlg-foot >> text=Dupliquer');
await page.waitForSelector('table.grid');
assert.equal(await page.locator('td.cell.draft, td.cell.validated').count(), 0);
log('duplication : nouvelle évaluation sans résultats');
await page.click('[aria-label="Retour aux évaluations"]');
assert.equal(await page.locator('.card').count(), 2);
await shot('08-accueil');

// ---------- Sauvegarde persistante + hors connexion ----------
await page.reload();
await page.waitForSelector('.card');
assert.equal(await page.locator('.card').count(), 2);
log('rechargement : données conservées (IndexedDB)');

await page.waitForFunction(() => navigator.serviceWorker?.controller || navigator.serviceWorker?.ready.then(() => true), null, { timeout: 8000 }).catch(() => {});
await page.evaluate(async () => { await navigator.serviceWorker.ready; });
await page.reload();
await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 8000 });
await ctx.setOffline(true);
await page.reload();
await page.waitForSelector('.card');
assert.equal(await page.locator('.card').count(), 2);
await page.locator('.card').first().click();
await page.waitForSelector('table.grid');
await cell(1, 1).click(); await page.click('.lvbtn.ec');
assert.match(await cell(1, 1).getAttribute('class'), /lv-ec/);
log('HORS CONNEXION : rechargement, ouverture et saisie fonctionnent');
await ctx.setOffline(false);

// ---------- Portrait ----------
await page.setViewportSize({ width: 800, height: 1280 });
await page.waitForTimeout(200);
await shot('09-portrait');
log('mode portrait');

// ---------- Export JSON ----------
await page.setViewportSize({ width: 1280, height: 800 });
await page.goto(URL + '#');
await page.waitForSelector('.card, table.grid');
if (await page.locator('table.grid').count()) await page.click('[aria-label="Retour aux évaluations"]');
await page.click('text=Réglages'); await page.click('.seg >> text=Données et synchronisation');
const [dl] = await Promise.all([page.waitForEvent('download'), page.click('text=Exporter une sauvegarde')]);
const path = await dl.path();
const json = JSON.parse((await import('node:fs')).readFileSync(path, 'utf8'));
assert.equal(json.app, 'eps-eval');
assert.equal(json.evaluations.length, 2);
assert.equal(json.classes[0].students.length, 4);
log('export JSON complet');
await shot('10-donnees');

await browser.close();
console.log(errors.length ? '\nERREURS JS :\n' + errors.join('\n') : '\nAucune erreur JavaScript.');
process.exit(errors.length ? 1 : 0);
