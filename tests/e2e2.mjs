// 2e test navigateur : import CSV/XLSX, élèves arrivés/partis, conflits Drive (interface), restauration JSON.
// Lancer : node tests/e2e2.mjs [url]
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');

const URL = process.argv[2] || 'http://127.0.0.1:8765/index.html';
const FIX = new globalThis.URL('./fixtures/', import.meta.url).pathname;
const SHOTS = process.env.SHOTS || '/tmp/claude-0/-home-claude/7c20a5a1-b5cf-5e73-87c9-df7896a28ca7/scratchpad/shots';
mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, hasTouch: true, locale: 'fr-FR', acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
let step = 0;
const log = (m) => console.log(`✓ ${String(++step).padStart(2, '0')} ${m}`);
const shot = (n) => page.screenshot({ path: `${SHOTS}/${n}.png` });

await page.goto(URL);
await page.waitForSelector('.empty h2');

// ---------- Import XLSX ----------
await page.click('text=Ouvrir les réglages');
await page.click('text=Importer un tableau');
await page.setInputFiles('input[type=file]', FIX + 'competences.xlsx');
await page.waitForSelector('text=Ligne des intitulés');
assert.equal(await page.inputValue('input[type=number]'), '3'); // ligne d'en-tête détectée (titre + ligne vide ignorés)
log('XLSX lu : en-têtes détectés à la ligne 3');
await page.click('text=Suivant : colonnes');
// la correspondance automatique doit avoir trouvé les 8 champs
const selected = await page.$$eval('select', (ss) => ss.map((s) => s.value));
assert.ok(selected.filter((v) => v !== '').length >= 8, 'correspondance automatique : ' + selected);
log('correspondance automatique des colonnes (8 champs)');
await page.click('text=Suivant : aperçu');
await page.waitForSelector('text=Total des barèmes : 20 / 20');
assert.equal(await page.locator('table.edit tbody tr').count(), 4);
assert.ok(await page.locator('text=Aucun critère de réussite renseigné').count() >= 1); // avertissement ligne 7
await shot('11-import-apercu');
log('aperçu : 4 compétences, total 20, avertissement sur la ligne sans critères');
assert.equal(await page.locator('#iw-finish').isDisabled(), true); // destination non renseignée
await page.fill('label:has-text("Nom du modèle") input', 'Badminton importé');
await page.fill('label:has-text("Activité sportive") input', 'Badminton');
assert.equal(await page.locator('#iw-finish').isDisabled(), false);
await page.click('#iw-finish');
await page.waitForSelector('text=Badminton importé');
log('modèle importé et visible dans la liste');

// ---------- Import CSV avec erreurs : correction + mise à l'échelle ----------
await page.click('text=Importer un tableau');
await page.setInputFiles('input[type=file]', FIX + 'competences.csv');
await page.waitForSelector('text=Ligne des intitulés');
await page.click('text=Suivant : colonnes');
await page.click('text=Suivant : aperçu');
await page.waitForSelector('text=Barème manquant');
assert.equal(await page.locator('#iw-finish').isDisabled(), true);
log('CSV : barème manquant signalé, import bloqué');
// on corrige la case « barème » de la dernière ligne
await page.locator('table.edit tbody tr').last().locator('input[aria-label="max"]').fill('5');
await page.press('table.edit tbody tr:last-child input[aria-label="max"]', 'Tab');
await page.waitForSelector('text=Total des barèmes : 25 / 20');
await page.click('text=Mettre à l\'échelle sur 20');
await page.waitForSelector('text=Total des barèmes : 20 / 20');
log('somme 25 → mise à l\'échelle automatique sur 20');
await page.fill('label:has-text("Nom du modèle") input', 'Test CSV');
await page.fill('label:has-text("Activité sportive") input', 'Athlétisme');
await page.selectOption('label:has-text("Niveau scolaire") select', '5e');
await page.click('#iw-finish');
await page.waitForSelector('text=Athlétisme');
log('CSV corrigé et importé au niveau 5e');

// ---------- Classe, élèves arrivés / partis ----------
await page.click('.seg >> text=Classes');
await page.click('text=Nouvelle classe');
await page.fill('input[placeholder="ex. 6e A"]', '6e B');
await page.press('input[placeholder="ex. 6e A"]', 'Tab');
await page.click('text=Coller une liste');
await page.fill('.dlg textarea', 'Anna\nBruno\nChloé D\nChloé F');
await page.click('.dlg-foot >> text=Ajouter');
await page.waitForTimeout(150);
assert.equal(await page.locator('.listrow input[aria-label="Prénom"]').count(), 4);
assert.deepEqual(await page.$$eval('.listrow input[aria-label="Initiale du nom"]', (els) => els.map((e) => e.value)), ['', '', 'D', 'F']);
log('liste collée : 4 élèves, initiales reconnues (Chloé D / Chloé F)');
await page.click('text=Terminer');

// évaluation sur 6e B avec le modèle importé
await page.click('[aria-label="Retour"]');
await page.click('text=Nouvelle évaluation');
await page.waitForSelector('.dlg select');
await page.locator('.dlg select').first().selectOption({ label: '6e B (6e) — 4 élèves' });
await page.click('.dlg-foot >> text=Créer');
await page.waitForSelector('table.grid');
// Bruno : toutes compétences à « Acquis », puis on l'utilise comme élève qui partira
const rowOf = (n) => page.locator(`tbody tr:has(.nm:text-is("${n}"))`);
for (let c = 0; c < 4; c++) { await rowOf('Bruno').locator('td.cell').nth(c).click(); await page.click('.lvbtn.ac'); await page.click('.sheet >> text=Valider >> nth=0'); }
const brunoTotal = (await rowOf('Bruno').locator('td.total').textContent()).trim();
log(`ancienne évaluation : Bruno a ${brunoTotal}`);

// Bruno quitte la classe, Dina arrive
await page.click('[aria-label="Retour aux évaluations"]');
await page.click('text=Réglages'); await page.click('.seg >> text=Classes');
await page.locator('.listrow:has-text("6e B") >> text=Modifier').first().click();
await page.locator('.listrow').nth(1).locator('[aria-label="L\'élève quitte la classe"]').click(); // 2e ligne = Bruno
await page.fill('[aria-label="Prénom du nouvel élève"]', 'Dina');
await page.press('[aria-label="Prénom du nouvel élève"]', 'Enter');
await page.press('[aria-label="Initiale du nom"] >> nth=0', 'Enter');
await page.waitForSelector('text=Anciens élèves');
assert.ok(await page.locator('.panel:has-text("Anciens élèves") >> text=Bruno').count());
log('Bruno déplacé dans « Anciens élèves » (historique conservé), Dina ajoutée');
await page.click('text=Terminer');

// nouvelle évaluation : Dina présente, Bruno absent ; ancienne évaluation inchangée
await page.click('[aria-label="Retour"]');
await page.click('text=Nouvelle évaluation');
await page.waitForSelector('.dlg select');
console.log('   options de classe :', await page.locator('.dlg select').first().locator('option').allTextContents());
await page.locator('.dlg select').first().selectOption({ label: '6e B (6e) — 4 élèves' });
await page.click('.dlg-foot >> text=Créer');
await page.waitForSelector('table.grid');
const names2 = await page.$$eval('tbody .nm', (els) => els.map((e) => e.firstChild.textContent.trim()));
assert.deepEqual(names2.sort(), ['Anna', 'Chloé D.', 'Chloé F.', 'Dina']);
log('nouvelle évaluation : Dina présente, Bruno absent');
await page.click('[aria-label="Retour aux évaluations"]');
const oldCards = await page.$$eval('.card .d', (els) => els.map((e) => e.textContent));
assert.ok(oldCards.some((t) => /1\/4 notés/.test(t)), 'ancienne évaluation : ' + oldCards.join(' | '));
log('ancienne évaluation intacte : toujours 4 élèves dont Bruno noté (carte « 1/4 notés »)');
// l'historique de Bruno est consultable depuis l'ancienne évaluation
await page.locator('.card:has-text("1/4 notés")').first().click();
await page.waitForSelector('table.grid');
await rowOf('Bruno').locator('.st').click();
await page.click('.popmenu >> text=Historique');
await page.waitForSelector('table.hist');
assert.match(await page.textContent('table.hist tbody'), /Test CSV|Badminton importé|\/20/);
await shot('12-historique-bruno');
await page.click('.dlg >> text=Fermer');
log('historique de l\'élève parti toujours consultable');
await page.click('[aria-label="Retour aux évaluations"]');

// ---------- Conflit Drive (interface) ----------
await page.evaluate(async () => {
  const app = window.__app, repo = app.repo;
  const cls = repo.list('classes').find((c) => c.name === '6e B');
  const remoteCls = structuredClone(cls);
  remoteCls.name = '6e B (version Drive)';
  remoteCls.updatedAt = cls.updatedAt + 5000;
  remoteCls.deviceId = 'autre-tablette';
  cls.name = '6e B (version tablette)';
  await repo.save('classes', cls);
  window.__fakeDrive = { writes: 0, last: null };
  app.sync.engine.api = {
    async getRemote() { return { version: window.__fakeDrive.writes, data: { app: 'eps-eval', schema: 1, records: { models: [], classes: [remoteCls], evaluations: [] } } }; },
    async putRemote(d) { window.__fakeDrive.writes++; window.__fakeDrive.last = d; },
  };
  app.sync.auth.hasValidToken = () => true;
  await repo.setMeta('driveConnected', true);
  app.sync.syncNow({ manual: true });
});
await page.waitForSelector('.dlg >> text=Conflit de synchronisation');
const before = await page.evaluate(() => window.__app.repo.list('classes').find((c) => c.name.startsWith('6e B')).name);
assert.equal(before, '6e B (version tablette)'); // rien n'a été écrasé tant qu'on n'a pas décidé
await shot('13-conflit');
await page.click('text=Garder la version Google Drive');
await page.click('.dlg-foot >> text=Appliquer ces choix');
await page.waitForFunction(() => window.__fakeDrive.writes >= 0 && window.__app.syncState !== 'syncing', null, { timeout: 8000 });
await page.waitForTimeout(300);
const after = await page.evaluate(() => window.__app.repo.list('classes').find((c) => c.name.startsWith('6e B')).name);
assert.equal(after, '6e B (version Drive)');
log('conflit : dialogue affiché, rien d\'écrasé avant décision, choix « Drive » appliqué');
assert.equal(await page.evaluate(() => window.__app.syncState), 'synced');
log('état de synchro : « Synchronisé »');

// état « hors connexion » avec Drive connecté
await ctx.setOffline(true);
await page.evaluate(() => window.dispatchEvent(new Event('offline')));
await page.waitForTimeout(100);
assert.match(await page.textContent('.syncchip'), /Hors connexion/);
await ctx.setOffline(false);
log('état « Hors connexion » affiché');

// ---------- Export puis import JSON par l'interface (fusion) ----------
await page.click('text=Réglages'); await page.click('.seg >> text=Données et synchronisation');
const [dl] = await Promise.all([page.waitForEvent('download'), page.click('text=Exporter une sauvegarde')]);
const file = await dl.path();
await page.setInputFiles('input[type=file][accept*=json]', file);
await page.waitForSelector('.dlg >> text=Importer une sauvegarde');
await page.click('.dlg-foot >> text=Fusionner');
await page.waitForSelector('.toast:has-text("Fusion terminée")');
log('import JSON (fusion) : aucune perte, message de bilan');

// fichier invalide
writeFileSync('/tmp/claude-0/pas-une-sauvegarde.json', '{"hello":1}');
await page.setInputFiles('input[type=file][accept*=json]', '/tmp/claude-0/pas-une-sauvegarde.json');
await page.waitForSelector('.toast:has-text("pas une sauvegarde")');
log('fichier JSON invalide refusé proprement');

await browser.close();
console.log(errors.length ? '\nERREURS JS :\n' + errors.join('\n') : '\nAucune erreur JavaScript.');
process.exit(errors.length ? 1 : 0);
