// Test v1.6 dans Chromium : fondations (reprendre, épinglés, affichage, démo, visite), chronomètre, équipes (libre et en activité, clubs).
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const { chromium } = createRequire(import.meta.url)('playwright');
const URL = process.argv[2] || 'http://127.0.0.1:8765/index.html';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, hasTouch: true, locale: 'fr-FR' });
const page = await ctx.newPage();
const errors = []; setTimeout(() => {}, 0);
page.on('pageerror', (e) => { errors.push('pageerror: ' + e.message); console.log('PAGEERR', e.message); });
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
let n = 0; const log = (m) => console.log(`✓ ${String(++n).padStart(2, '0')} ${m}`);

// 1. visite guidée sur installation vide
await page.addInitScript(() => { try { localStorage.setItem('eps-skip-welcome', '1'); } catch {} });
await page.goto(URL);
await page.waitForSelector('.dlg h2:has-text("Bienvenue")');
await page.click('.dlg >> text=Suivant'); await page.click('.dlg >> text=Suivant'); await page.click('.dlg >> text=Suivant');
await page.click('.dlg >> text=Terminer');
await page.waitForSelector('.empty h2');
log('visite guidée à la première ouverture, 4 écrans');
await page.goto(URL); // 1.13 : ouvrir l'appli (et non actualiser) part de l'accueil
await page.waitForSelector('.empty h2');
assert.equal(await page.locator('.dlg').count(), 0, 'plus de visite après coup');
log('visite non rejouée');

// 2. démo
await page.click('text=Essayer avec une classe de démonstration');
await page.waitForSelector('[aria-label="Options de la classe"]');
assert.match(await page.textContent('.actframe'), /Handball \(démo\)/);
assert.ok(await page.locator('.actframe .tooltile:has-text("Chronomètre")').count());
assert.ok(await page.locator('.actframe .tooltile:has-text("Équipes")').count());
log('classe de démonstration : activité avec Évaluation, Chronomètre, Équipes');

// 3. équipes dans l'activité
await page.click('.actframe .tooltile:has-text("Équipes")');
await page.waitForSelector('.empty h2:has-text("Aucune composition")');
await page.click('.empty >> text=Nouvelle composition');
await page.click('.dlg-foot >> text=Créer');
await page.waitForSelector('.teams');
assert.equal(await page.locator('.tstrip .schip').count(), 20);
log('composition créée : 20 élèves non placés');
// zone « non placés » sur une ligne : toucher l'étiquette = tout afficher ; double-tap dans la zone = replier
const zh0 = (await page.locator('[data-zone="unplaced"]').boundingBox()).height;
await page.click('[data-toggle="unplaced"]');
await page.waitForSelector('[data-zone="unplaced"].open');
const zb = await page.locator('[data-zone="unplaced"]').boundingBox();
assert.ok(zb.height > zh0 + 20, 'zone dépliée sur plusieurs lignes');
await page.mouse.click(zb.x + zb.width - 6, zb.y + zb.height - 6); await page.mouse.click(zb.x + zb.width - 6, zb.y + zb.height - 6);
await page.waitForFunction(() => !document.querySelector('[data-zone="unplaced"].open'));
log('non placés : dépliés (étiquette) puis repliés (double-tap)');
await page.click('[aria-label="Options"]'); await page.click('.popmenu >> text=/Générer les/');
await page.fill('.dlg input[type=number] >> nth=0', '4');
await page.click('.dlg-foot >> text=Générer');
await page.waitForSelector('.tcard');
assert.equal(await page.locator('.tcard').count(), 4);
assert.equal(await page.locator('.tstrip .schip').count(), 0);
const sizes = await page.$$eval('.tcard .tz', (zs) => zs.map((z) => z.querySelectorAll('.schip').length));
assert.deepEqual(sizes, [5, 5, 5, 5]);
log('tirage au sort en 4 équipes de 5');
await page.click('.toast >> text=Annuler');
await page.waitForFunction(() => document.querySelectorAll('.tcard').length === 0 && document.querySelectorAll('.tstrip .schip').length === 20);
log('« Annuler » restaure l\'état avant tirage');
await page.click('[aria-label="Options"]'); await page.click('.popmenu >> text=/Générer les/');
await page.fill('.dlg input[type=number] >> nth=0', '4');
await page.click('.dlg-foot >> text=Générer');
await page.waitForFunction(() => document.querySelectorAll('.tcard').length === 4);
await page.click('.topbar >> text=Mélanger');
await page.waitForFunction(() => document.querySelectorAll('.tstrip .schip').length === 0);
log('mélanger');

// glisser-déposer d'un élève vers les non placés puis vers une autre équipe
const chip = page.locator('.tcard .tz .schip').first();
const sid = await chip.getAttribute('data-sid');
const box = await chip.boundingBox();
const side = await page.locator('.tstrip .zone').first().boundingBox();
await page.mouse.move(box.x + 10, box.y + 10); await page.mouse.down();
await page.mouse.move(side.x + 40, side.y + 40, { steps: 8 }); await page.mouse.up();
await page.waitForFunction((s) => document.querySelector(`.tstrip .schip[data-sid="${s}"]`), sid);
log('glisser-déposer vers « non placés »');
const tz2 = await page.locator('.tcard .tz').nth(1).boundingBox();
const c2 = await page.locator(`.tstrip .schip[data-sid="${sid}"]`).boundingBox();
await page.mouse.move(c2.x + 10, c2.y + 10); await page.mouse.down();
await page.mouse.move(tz2.x + 40, tz2.y + 40, { steps: 8 }); await page.mouse.up();
await page.waitForFunction((s) => document.querySelector(`.tcard .schip[data-sid="${s}"]`), sid);
log('glisser-déposer vers une équipe');

// menu d'élève : dispensé + rôle
await page.locator(`.tcard .schip[data-sid="${sid}"]`).click();
await page.click('.popmenu >> text=Dispensé');
await page.waitForFunction((s) => document.querySelector(`.tcard .schip.st-dispense[data-sid="${s}"]`), sid);
await page.locator(`.tcard .schip[data-sid="${sid}"]`).click();
await page.click('.popmenu >> text=Rôle : Capitaine'); // 1.10 : rôle en un toucher
assert.ok(await page.locator(`.schip[data-sid="${sid}"] .sr`).count());
log('dispensé (reste dans son équipe) + rôle visible');

// persistance
await page.goto(URL); // 1.13 : ouvrir l'appli (et non actualiser) part de l'accueil
await page.waitForSelector('.chip.resume');
assert.match(await page.textContent('.chip.resume'), /Reprendre.*Équipes · Leçon 1/);
await page.click('.chip.resume');
await page.waitForSelector('.teams');
assert.equal(await page.locator('.tcard').count(), 4);
log('rechargement : composition conservée, « Reprendre : Équipes · Leçon 1 » la rouvre');

// plein écran
await page.click('[aria-label="Affichage plein écran"]');
await page.waitForSelector('.fcard');
assert.equal(await page.locator('.fcard').count(), 4);
await page.click('[aria-label="Fermer l\'affichage plein écran"]');
await page.waitForSelector('.tlayout');
log('affichage plein écran');

// contraintes
await page.click('[aria-label="Options"]');
await page.click('.popmenu >> text=Contraintes');
await page.click('.dlg >> text=Ajouter');
await page.waitForSelector('.dlg .listrow');
await page.click('.dlg-foot >> text=Terminé');
log('contrainte ajoutée');

// dupliquer pour la leçon suivante
await page.click('[aria-label="Options"]');
await page.click('.popmenu >> text=Dupliquer pour la leçon suivante');
await page.waitForSelector('.teams');
// 1.12 : Retour = écran précédent (ici l'accueil, d'où « Reprendre » a ouvert la composition)
const rt = await page.evaluate(() => { const { setId, ...r } = window.__app.route; return r; });
await page.click('[aria-label="Retour"]'); await page.waitForSelector('.toolbar .seg');
await page.evaluate(async (r) => { const { name, ...p } = r; (await import('./js/app.js')).go(name, p); }, rt);
await page.waitForSelector('.evrow');
assert.equal(await page.locator('.evrow').count(), 2);
log('duplication : deux compositions');
await page.locator('.evrow [aria-label="Actions"]').first().click();
await page.click('.popmenu >> text=Supprimer');
await page.waitForFunction(() => document.querySelectorAll('.evrow').length === 1);
await page.click('.toast >> text=Annuler');
await page.waitForFunction(() => document.querySelectorAll('.evrow').length === 2);
log('suppression annulable');

// 3b. reprise des équipes dans une évaluation de l'activité
await page.evaluate(async () => {
  const S = await import('./js/data/schema.js'), E = await import('./js/logic/evaluation.js');
  const app = window.__app; const cls = app.repo.list('classes')[0];
  const m = S.newModel(); m.name = 'G'; m.activity = 'Handball (démo)';
  m.levels['5e'] = { competences: [10, 10].map((x, i) => Object.assign(S.newCompetence(x), { name: 'C' + i })) };
  await app.repo.save('models', m);
  const ev = E.createEvaluation({ cls, model: m, date: '2026-11-20' }); ev.activityId = cls.activities[0].id;
  await app.repo.save('evaluations', ev); window.__evid = ev.id;
});
await page.click('[aria-label="Retour"]'); await page.waitForSelector('.toolbar .seg'); // liste ouverte depuis l'accueil (voir plus haut)
await page.evaluate(async () => (await import('./js/app.js')).go('classPage', { id: window.__app.repo.list('classes')[0].id }));
await page.waitForSelector('[aria-label="Options de la classe"]');
await page.click('.actframe .tooltile:has-text("Évaluation")');
await page.waitForSelector('table.grid');
await page.click('[aria-label="Options de l\'évaluation"]');
await page.click('.popmenu >> text=Équipes et groupes de niveau');
await page.selectOption('.dlg select >> nth=0', { index: 1 });
await page.click('.dlg-foot >> text=Terminé');
await page.waitForSelector('.tag.team');
assert.ok((await page.locator('tbody .tag.team').count()) >= 10, 'équipes reprises dans la grille');
log('équipes reprises dans l\'évaluation');
// le lien est vivant : une modification dans l'outil Équipes se retrouve dans l'évaluation
await page.evaluate(async () => {
  const app = window.__app; const cls = app.repo.list('classes')[0]; const set = cls.activities[0].equipes.sets[0];
  set.teams[0].name = 'Les Rouges'; await app.repo.save('classes', cls);
});
await page.evaluate(() => window.__app.route && document.querySelector('.topbar') && (window.__rr = 1));
await page.click('[aria-label="Retour"]'); await page.waitForSelector('[aria-label="Options de la classe"]');
await page.click('.actframe .tooltile:has-text("Évaluation")');
await page.waitForSelector('table.grid');
await page.waitForSelector('tbody .tag.team:has-text("Les Rouges")');
log('lien vivant : le renommage d\'une équipe est repris dans l\'évaluation');
await page.click('[aria-label="Retour"]'); await page.waitForSelector('[aria-label="Options de la classe"]');
await page.click('.actframe .tooltile:has-text("Évaluation")'); await page.waitForSelector('table.grid');
await page.click('[aria-label="Retour"]'); await page.waitForSelector('[aria-label="Options de la classe"]');
await page.click('[aria-label="Retour"]'); await page.waitForSelector('.home-grid');

await page.click('.toolbar .seg >> text=Outils');
assert.equal(await page.locator('.pinbtn.on').count(), 0); // 1.11 : aucun favori au départ
await page.click('.tooltile.big:has-text("Équipes") .pinbtn'); await page.waitForSelector('.tooltiles.fav .tooltile:has-text("Équipes")');
assert.match(await page.textContent('.toolsec.fav'), /Favoris/);
assert.ok(await page.locator('.chip.resume').count(), 'reprendre');
log('favori en tête de l\'onglet Outils + puce « Reprendre »');
await page.click('.tooltiles.fav .tooltile:has-text("Équipes")');
await page.click('.empty >> text=Nouvelle composition');
await page.click('.dlg .seg >> text=Clubs');
await page.locator('.dlg label:has-text("5e DÉMO") input').check();
await page.click('.dlg-foot >> text=Créer');
await page.waitForSelector('.teams');
await page.click('[aria-label="Options"]'); await page.click('.popmenu >> text=/Générer les/');
await page.fill('.dlg input[type=number] >> nth=0', '4');
await page.click('.dlg-foot >> text=Générer');
await page.waitForSelector('.tcard.club');
assert.equal(await page.locator('.tcard.club').count(), 4);
assert.equal(await page.locator('.tcard.club .subteams .sub').count(), 8);
log('mode Clubs : 4 clubs de 2 équipes');
await page.click('[aria-label="Retour"]');
await page.click('[aria-label="Retour"]');
await page.waitForSelector('.tooltiles.fav');

// 5. Chronomètre
await page.click('.tooltile.big:has-text("Chronomètre")');
await page.waitForSelector('.empty h2:has-text("Aucun panneau")');
await page.click('.empty >> text=Ajouter un panneau');
await page.click('.dlg >> text=Chronomètre (compte vers le haut)');
await page.waitForSelector('.cpanel');
await page.click('.topbar >> text=Tout démarrer');
await page.waitForTimeout(1300);
const t = await page.textContent('.cdigits');
assert.notEqual(t.trim(), '0:00', 'le chrono avance');
await page.click('.topbar >> text=Tout en pause');
log('chronomètre : ajout, démarrage, pause (' + t.trim() + ')');
await page.click('[aria-label="Mode affichage (masque les boutons)"]');
assert.ok(await page.locator('.chrono.display').count());
await page.click('.sr-back', { force: true });
await page.click('[aria-label="Retour"]');
await page.waitForSelector('.tooltiles.fav');
log('mode affichage et retour (à l\'onglet Outils d\'où l\'on vient)');
await page.click('.toolbar .seg >> text=Classes'); await page.waitForSelector('.home-grid');

// 6. Affichage : texte et contraste
await page.click('text=Réglages'); await page.click('.seg >> text=Général');
await page.click('.seg >> text=Très grand');
assert.equal(await page.evaluate(() => document.documentElement.dataset.text), 'xlarge');
await page.locator('label:has-text("Contraste renforcé") input').check();
assert.equal(await page.evaluate(() => document.documentElement.dataset.contrast), 'high');
await page.goto(URL); // 1.13 : ouvrir l'appli (et non actualiser) part de l'accueil
assert.equal(await page.evaluate(() => document.documentElement.dataset.text), 'xlarge');
log('taille du texte et contraste mémorisés');

console.log(errors.length ? '\nERREURS :\n' + errors.join('\n') : '\nAucune erreur JavaScript.');
await browser.close();
process.exit(errors.length ? 1 : 0);
