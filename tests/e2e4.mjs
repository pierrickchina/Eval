// Test v1.2 dans Chromium : bouton Précédent, en-tête, fiche compacte, auto-évaluation + code, partage, copie de sécurité.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { openFirstEval, openClass, goHome } from './nav.mjs';
import { mkdirSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const URL = process.argv[2] || 'http://127.0.0.1:8765/index.html';
const SHOTS = process.env.SHOTS || '/tmp/claude-0/-home-claude/7c20a5a1-b5cf-5e73-87c9-df7896a28ca7/scratchpad/shots';
mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, hasTouch: true, locale: 'fr-FR', acceptDownloads: true });
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
  const app = window.__app;
  const long = 'L\'élève s\'engage dans le jeu, démarque ses partenaires, propose des solutions variées en attaque, communique avec l\'équipe et adapte ses choix au rapport de force.';
  const m = S.newModel(); m.name = 'Handball — modèle 6e très long titre'; m.activity = 'Handball';
  const comps = [8, 5, 4, 3].map((mx, i) => Object.assign(S.newCompetence(mx), { name: 'Compétence ' + (i + 1) }));
  comps.forEach((c) => c.levels.forEach((l) => { l.text = long; }));
  m.levels['6e'] = { competences: comps };
  await app.repo.save('models', m);
  const cls = S.newClass('6e A', '6e');
  ['Léa', 'Tom', 'Inès'].forEach((f) => cls.students.push(S.newStudent(f)));
  await app.repo.save('classes', cls);
  await app.repo.save('evaluations', E.createEvaluation({ cls, model: m, date: '2026-11-26' }));
  await app.repo.setMeta('appVersion', '1.1.0'); // simule une mise à jour depuis la 1.1
});
await page.reload();
await page.waitForSelector('.card');
log('copie de sécurité interne créée au 1er lancement avec des données');
assert.ok(await page.evaluate(() => !!window.__app.repo.getMeta('safetyBackup')));

// ---------- Bouton Précédent ----------
await openFirstEval(page);
assert.equal(await route(), 'eval');
// l'en-tête : titre complet, annuler/rétablir, un seul bouton ⋮
const title = await page.locator('.evtitle h1').evaluate((el) => [el.scrollWidth, el.clientWidth]);
assert.ok(title[0] <= title[1] + 1, 'titre non coupé');
assert.equal(await page.locator('.topbar [aria-label="Options de l\'évaluation"]').count(), 1);
assert.equal(await page.locator('.topbar .btn').count(), 0, 'plus de boutons texte dans l\'en-tête');
await page.screenshot({ path: `${SHOTS}/v12-entete.png` });
log('en-tête : titre complet, annuler/rétablir et un seul menu ⋮');

await page.locator('.nm').first().click();
await page.waitForSelector('.compcard');
await page.screenshot({ path: `${SHOTS}/v12-fiche.png` });
const h1 = await page.locator('.compcard').first().boundingBox();
await page.goBack();
await page.waitForSelector('table.grid');
assert.equal(await route(), 'eval');
log('Précédent : fiche élève → tableau');
await page.goBack();
await page.waitForSelector('.hub');
assert.equal(await route(), 'classPage');
log('Précédent : tableau → carnet de bord de la classe');
await page.goBack();
await page.waitForSelector('.home-grid .card');
assert.equal(await route(), 'home');
log('Précédent : carnet de bord → accueil');
await page.click('text=Réglages');
await page.waitForSelector('.seg');
await page.goBack();
await page.waitForSelector('.card');
assert.equal(await route(), 'home');
log('Précédent : réglages → accueil');
await openClass(page);
await page.locator('.actframe [aria-label="Ajouter un outil"]').first().click();
await page.click('.addgrid >> text=Nouvelle évaluation');
await page.waitForSelector('.dlg');
await page.goBack();
await page.waitForFunction(() => !document.querySelector('.dlg'));
assert.equal(await route(), 'classPage');
await page.goBack();
await page.waitForSelector('.home-grid .card');
assert.equal(await route(), 'home');
log('Précédent : ferme d\'abord la fenêtre ouverte');
await page.click('text=Réglages'); await page.click('.seg >> text=Classes'); await page.click('.listrow >> text=Modifier');
await page.waitForSelector('text=Enregistré automatiquement');
await page.goBack();
await page.waitForSelector('.seg');
assert.equal(await route(), 'settings');
log('Précédent : éditeur de classe → réglages');
await page.goBack();
await page.waitForSelector('.card');
await page.goBack(); // à l'accueil : prévient avant de quitter
await page.waitForSelector('.toast');
assert.match(await page.textContent('.toast'), /encore une fois/);
log('Précédent à l\'accueil : avertissement avant de quitter');

// ---------- Fiche compacte ----------
await goHome(page);
await openFirstEval(page);
await page.locator('.nm').first().click();
await page.waitForSelector('.compcard');
const row = await page.locator('.lvrow.ac >> nth=0').boundingBox();
assert.ok(row.height < 120, 'case de degré compacte, hauteur ' + row.height);
const t1 = await page.locator('.lvrow.ac .lvh >> nth=0').boundingBox(), t2 = await page.locator('.lvrow.ac .crit >> nth=0').boundingBox();
assert.ok(t1.y < t2.y, 'titre au-dessus du texte');
assert.ok(t2.width > row.width - 40, 'texte sur toute la largeur');
const dr = await page.locator('.lvdraft.side >> nth=0').boundingBox();
assert.ok(dr.width < 70 && dr.height < 32, 'boutons brouillon petits');
log(`fiche : case ${Math.round(row.height)} px de haut, titre en haut, texte pleine largeur, brouillons petits`);

// ---------- Auto-évaluation ----------
await page.click('[aria-label="Plus d\'options"]');
await page.click('.popmenu >> text=Historique'); await page.click('.dlg >> text=Fermer');
log('historique/résumé dans le menu ⋮ de la fiche');
await page.goBack(); await page.waitForSelector('table.grid');
await page.click('.nm >> nth=0'); await page.click('.compcard >> nth=0 >> .lvrow.ec'); // note du prof pour Léa : en cours
await page.goBack(); await page.waitForSelector('table.grid');
await page.click('[aria-label="Options de l\'évaluation"]');
await page.click('.popmenu >> text=Auto-évaluation');
await page.click('.dlg-foot >> text=Passer en mode élève');
await page.waitForSelector('.selflist');
assert.equal(await route(), 'selfEval');
assert.equal(await page.locator('.selfname').count(), 3);
const bodyText = await page.textContent('body');
assert.ok(!/Moyenne de classe|Remarque|Groupes/.test(bodyText), 'aucune information de l\'enseignant');
log('mode élève : liste des prénoms seulement');
await page.screenshot({ path: `${SHOTS}/v12-self-liste.png` });

// Précédent n'en sort pas
await page.waitForFunction(() => !document.querySelector('.toast'), null, { timeout: 6000 }); // laisse disparaître l'ancien message
await page.goBack(); await page.waitForTimeout(150);
assert.equal(await route(), 'selfEval');
assert.equal(await page.locator('.toast').count(), 0, 'aucun message de sortie en mode élève');
log('Précédent ne permet pas de quitter le mode élève');

// Léa s'auto-évalue
await page.click('.selfname >> text=Léa');
await page.waitForSelector('.selfbody');
const txt = await page.textContent('.selfbody');
assert.ok(!/Remarque|brouillon|\+ ✓/i.test(txt), 'pas de brouillon ni remarque');
assert.equal(await page.locator('.selfbody .lvrow.ec.on').count(), 0, 'la note du professeur n\'est pas visible');
assert.equal(await page.locator('.bigvalid').count(), 0, 'pas de bouton Valider tant que tout n\'est pas choisi');
for (let i = 0; i < 3; i++) await page.click(`.selfbody .compcard >> nth=${i} >> .lvrow.ac`);
assert.equal(await page.locator('.bigvalid').count(), 0);
await page.click('.selfbody .compcard >> nth=3 >> .lvrow.ac');
await page.waitForSelector('.bigvalid');
assert.equal(await page.locator('.recapchip').count(), 4, 'une pastille de note par compétence');
assert.match(await page.textContent('.recapchip >> nth=0'), /Compétence 1 : 6,5\/8/);
assert.match(await page.textContent('.recaptitle'), /Note estimée : 15,5\/20/);
assert.ok(await page.locator('.bigvalid').isVisible());
await page.screenshot({ path: `${SHOTS}/v12-self-fiche.png` });
const note = (await page.textContent('.recaptitle')).trim();
await page.click('.bigvalid');
await page.click('.dlg-foot >> text=Je valide');
await page.waitForSelector('.selflist');
assert.equal(await page.locator('.selfname.done').count(), 1);
assert.match(await page.textContent('.selfname.done'), /Léa/);
log(`auto-évaluation de Léa validée (${note.trim()}) ; elle apparaît « faite » dans la liste`);
// pas modifiable une fois validée
await page.click('.selfname.done');
assert.equal(await page.locator('.selfbody').count(), 0);
log('une auto-évaluation validée n\'est plus modifiable par l\'élève');

// Rechargement : le verrou persiste
await page.reload();
await page.waitForSelector('.selflist');
assert.equal(await route(), 'selfEval');
log('après rechargement de l\'application : toujours en mode élève');

// Code
await page.click('text=Enseignant');
await page.fill('.codeinput', '1234');
await page.click('.dlg-foot >> text=Valider');
await page.waitForSelector('.toast >> text=Code incorrect');
assert.equal(await route(), 'selfEval');
await page.fill('.codeinput', '0007');
await page.click('.dlg-foot >> text=Valider');
await page.waitForSelector('table.grid');
assert.equal(await route(), 'eval');
log('mauvais code refusé, code 0007 : retour à l\'évaluation');

// Affichage dans le tableau : italique, grisé, haut gauche
const selfEls = await page.locator('td.cell .self').count();
assert.equal(selfEls, 4);
const css = await page.locator('td.cell .self >> nth=0').evaluate((el) => { const c = getComputedStyle(el); return [c.fontStyle, c.top, c.left, c.fontSize]; });
assert.equal(css[0], 'italic');
await page.screenshot({ path: `${SHOTS}/v12-table-self.png` });
log('tableau : auto-évaluation en italique grisé, en haut à gauche des cases');
await page.click('td.cell >> nth=1');
assert.match(await page.textContent('.sheet'), /Auto-évaluation de l'élève : ✓ Acquis/);
log('saisie rapide : rappel de l\'auto-évaluation de l\'élève');

// Fiche : repère auto-éval, total
await page.click('.nm >> nth=0');
await page.waitForSelector('.compcard');
assert.equal(await page.locator('.selfmark').count(), 4);
assert.match(await page.textContent('.totalbar'), /Auto-évaluation : .*\(validée\)/);
await page.click('[aria-label="Plus d\'options"]');
await page.click('.popmenu >> text=Rouvrir');
log('(menu ⋮ de la fiche : statut, remarque, rouvrir)');
log('l\'enseignant peut rouvrir une auto-évaluation');

// ---------- Partage : repli ----------
await page.goBack(); await page.waitForSelector('table.grid'); await page.goBack(); await page.waitForSelector('.hub'); await page.goBack(); await page.waitForSelector('.backupchip'); // Retour : éval → classe → accueil
await page.evaluate(() => { window.__shared = null; navigator.canShare = (d) => d.files[0].type === 'application/json'; navigator.share = async (d) => { window.__shared = d.files[0].name; }; });
await page.click('.backupchip >> text=Sauvegarder');
await page.waitForFunction(() => window.__shared);
assert.match(await page.evaluate(() => window.__shared), /\.json$/);
log('partage : repli sur .json si le .txt est refusé');
await page.evaluate(() => { navigator.canShare = () => false; });
const [dl] = await Promise.all([page.waitForEvent('download'), page.click('.backupchip >> text=Sauvegarder')]);
assert.match(dl.suggestedFilename(), /\.txt$/);
await page.waitForSelector('.toast-act >> text=Ouvrir Drive');
log('partage impossible : téléchargement + bouton « Ouvrir Drive »');

assert.equal(errors.length, 0, errors.join('\n'));
console.log('\nAucune erreur JavaScript.');
await browser.close();
