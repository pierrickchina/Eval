// Test v1.1 dans Chromium : brouillons, « à placer », textes longs, remarque, partage, migration, impression.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { openFirstEval, goHome } from './nav.mjs';
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
const shot = (name) => page.screenshot({ path: `${SHOTS}/v11-${name}.png` });

await page.addInitScript(() => { try { localStorage.setItem('eps-skip-tour', '1'); } catch {} });
await page.goto(URL);
await page.waitForSelector('.empty h2');

// Données : modèle à l'ANCIENNE règle (EC à 55 %), méta levelRule absente → doit être migré au rechargement
await page.evaluate(async () => {
  const S = await import('./js/data/schema.js');
  const E = await import('./js/logic/evaluation.js');
  const app = window.__app;
  const long = 'L\'élève s\'engage dans le jeu, démarque ses partenaires, propose des solutions variées en attaque, communique en permanence avec l\'équipe et adapte ses choix au rapport de force ; il garde un comportement exemplaire même en cas de défaite et aide les autres à progresser.';
  const m = S.newModel(); m.name = 'Hand 6e'; m.activity = 'Handball';
  const comps = [8, 5, 4, 3].map((mx, i) => Object.assign(S.newCompetence(mx), { name: 'Compétence ' + (i + 1) }));
  comps.forEach((c) => { c.levels = [
    { key: 'na', text: 'Ne participe pas', min: 0, max: c.max * 0.3, value: 0 },
    { key: 'ec', text: long, min: c.max * 0.4, max: c.max * 0.6, value: c.max * 0.55 },
    { key: 'ac', text: long + ' ' + long, min: c.max * 0.7, max: c.max * 0.9, value: c.max * 0.8 },
    { key: 'de', text: long, min: c.max, max: c.max, value: c.max } ]; });
  m.levels['6e'] = { competences: comps };
  await app.repo.save('models', m);
  const cls = S.newClass('6e A', '6e');
  ['Léa', 'Tom', 'Inès'].forEach((f) => cls.students.push(S.newStudent(f)));
  await app.repo.save('classes', cls);
  await app.repo.setMeta('levelRule', 1);
});
await page.reload();
await page.waitForSelector('.topbar');
const mig = await page.evaluate(() => window.__app.repo.list('models').find((m) => !m.library).levels['6e'].competences.map((c) => c.levels.find((l) => l.key === 'ec').value / c.max));
assert.deepEqual(mig, [0.5, 0.5, 0.5, 0.5]);
assert.ok((await page.evaluate(() => window.__app.repo.list('models').find((m) => !m.library).levels['6e'].competences[0].levels[1].text)).startsWith('L\'élève'));
log('migration : « en cours » = moitié du barème, textes conservés');

// Évaluation
await page.evaluate(async () => {
  const E = await import('./js/logic/evaluation.js');
  const a = window.__app;
  const ev = E.createEvaluation({ cls: a.repo.list('classes')[0], model: a.repo.list('models').find((m) => !m.library), date: '2026-11-26' });
  await a.repo.save('evaluations', ev);
});
await page.reload();
await openFirstEval(page); // migration v1.5 : l'évaluation créée sans activité est rangée au démarrage

// Ouvre la cellule Léa / Compétence 1 et note des brouillons
await page.click('td.cell >> nth=0');
await page.waitForSelector('.sheet .lvdraft');
await page.click('.sheet .lvdraft.de');
await page.click('.sheet .lvdraft.ac');
await page.click('.sheet .lvdraft.ac');
await page.waitForSelector('.obsrow .obschip');
assert.equal(await page.locator('.obsrow .obschip').count(), 3);
assert.match(await page.textContent('.obsrow'), /2 ✓\s+1 ★/);
assert.equal(await page.textContent('td.cell >> nth=0'), '★✓✓', 'traces discrètes dans le tableau, sans note');
assert.equal(await page.locator('td.cell >> nth=0').evaluate((el) => el.classList.contains('empty')), true);
await page.screenshot({ path: `${SHOTS}/v11-brouillon.png` });
log('3 observations brouillon ; cellule toujours sans degré ni note');

// À placer
assert.match(await page.textContent('.toplace'), /À placer \(1\)/);
await page.click('.toplace');
assert.equal(await page.locator('tbody tr').count(), 1);
await page.click('.toplace');
assert.equal(await page.locator('tbody tr').count(), 3);
log('filtre « À placer »');

// Retrait par toucher
await page.click('.obsrow .obschip >> nth=0');
assert.equal(await page.locator('.obsrow .obschip').count(), 2);
log('un symbole brouillon se retire d\'une touche');

// Placer l'élève : le degré fixe la note ; EC = moitié
await page.click('.sheet .lvbtn.ec');
assert.equal(await page.inputValue('.sheet input[aria-label="Note"]'), '4');
assert.equal(await page.textContent('td.cell >> nth=0').then((t) => t.replace(/\s/g, '')), '4≈✓✓'.replace('≈', '≈'), 'note + symbole de degré + trace');
log('placer « en cours » sur /8 → note 4 ; les brouillons restent en trace');
await page.screenshot({ path: `${SHOTS}/v11-table.png` });

// Remarque
await page.click('.sheet >> text=Remarque');
await page.fill('.dlg textarea', 'A aidé un camarade en difficulté');
await page.click('.dlg >> text=Enregistrer');
await page.waitForSelector('.notemark');
log('remarque enregistrée (✎ dans le tableau)');

// Fiche élève : textes complets
await page.click('.nm >> nth=0');
await page.waitForSelector('.compcard');
const crit = await page.locator('.lvrow.ac .crit >> nth=0');
const box = await crit.boundingBox();
const sh = await crit.evaluate((el) => [el.scrollHeight, el.clientHeight]);
assert.ok(sh[0] <= sh[1] + 1, 'texte non coupé');
assert.ok(box.height > 60, 'texte long affiché sur plusieurs lignes');
assert.equal(await page.locator('textarea').count(), 0, 'plus de zone de remarque dans la fiche');
assert.equal(await page.locator('.seg[aria-label="Statut"]').count(), 0, 'plus de sélecteur de statut dans la fiche');
await page.click('[aria-label="Plus d\'options"]');
assert.match(await page.textContent('.popmenu'), /Remarque ✎/);
assert.match(await page.textContent('.popmenu'), /Statut : Absent/);
await page.keyboard.press('Escape'); await page.mouse.click(5, 400);
await page.click('.compcard >> nth=1 >> .lvdraft.de');
assert.match(await page.textContent('.compcard >> nth=1'), /Brouillon/);
await page.screenshot({ path: `${SHOTS}/v11-fiche.png` });
log('fiche élève : textes complets, brouillons, remarque');

await page.click('.compcard >> nth=2 >> .lvdraft.ec');

// Résumé annuel
await page.click('[aria-label="Plus d\'options"]');
await page.click('.popmenu >> text=Résumé');
await page.waitForSelector('.sumstats');
await page.screenshot({ path: `${SHOTS}/v11-resume.png` });
await page.click('.dlg >> text=Fermer');
log('résumé de l\'année affiché');

// Partage de la sauvegarde (API de partage simulée)
await page.evaluate(() => { window.__shared = null; navigator.canShare = () => true; navigator.share = async (d) => { window.__shared = d.files[0].name; }; });
await page.click('text=Tableau');
await goHome(page);
await page.waitForSelector('.backupchip');
assert.match(await page.textContent('.backupchip'), /jamais sauvegardé/);
await page.click('.backupchip >> text=Sauvegarder');
await page.waitForFunction(() => window.__shared);
assert.match(await page.evaluate(() => window.__shared), /^eval-eps-sauvegarde-\d{4}-\d{2}-\d{2}\.txt$/);
await page.waitForFunction(() => /aujourd'hui/.test(document.querySelector('.backupchip')?.textContent || ''));
log('« Sauvegarder » ouvre le partage avec le fichier JSON ; rappel mis à jour');
await page.screenshot({ path: `${SHOTS}/v11-accueil.png` });

// Impression : la zone d'impression est préparée
await page.evaluate(() => { window.print = () => { window.__printed = document.getElementById('print-root').innerText; }; });
await openFirstEval(page);
await page.click('[aria-label="Options de l\'évaluation"]');
await page.click('.popmenu >> text=Imprimer');
await page.waitForFunction(() => window.__printed);
assert.match(await page.evaluate(() => window.__printed), /Léa/);
log('export PDF : page d\'impression préparée');

assert.equal(errors.length, 0, errors.join('\n'));
console.log('\nAucune erreur JavaScript.');
await browser.close();
