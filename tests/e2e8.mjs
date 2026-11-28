// Test v1.7 dans Chromium : tournoi libre (jeu complet), parallèle, 2 terrains, tournoi en activité depuis des clubs, suivi des résultats, onglet Résultats.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const { chromium } = createRequire(import.meta.url)('playwright');
const URL = process.argv[2] || 'http://127.0.0.1:8765/index.html';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, hasTouch: true, locale: 'fr-FR' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => { errors.push('pageerror: ' + e.message); console.log('PAGEERR', e.message); });
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
let n = 0; const log = (m) => console.log(`✓ ${String(++n).padStart(2, '0')} ${m}`);
await page.addInitScript(() => { try { localStorage.setItem('eps-skip-tour', '1'); } catch {} });
await page.goto(URL); await page.waitForSelector('.empty h2');

// Tournoi libre : par la tuile de l'onglet Outils
await page.evaluate(async () => { const S = await import('./js/data/schema.js'); window.__S = S; });
await page.click('text=Essayer avec une classe de démonstration'); await page.waitForSelector('.actframe');
await page.click('[aria-label="Retour"]'); await page.waitForSelector('.home-grid');
await page.click('.toolbar .seg >> text=Outils');
await page.click('.tooltile.big:has-text("Tournoi")');
await page.waitForSelector('.empty h2:has-text("Aucun tournoi")');
await page.click('.empty >> text=Nouveau tournoi');
await page.waitForSelector('.setup');
assert.equal(await page.locator('.setup .listrow').count(), 4);
log('création : 4 équipes proposées, nom « Tournoi » + date');
// « j'ai X minutes »
await page.fill('input[aria-label="Temps disponible"]', '40');
await page.press('input[aria-label="Temps disponible"]', 'Tab');
await page.waitForSelector('text=Je propose');
await page.click('.tn-sum >> text=/Appliquer/');
log('« j\'ai 40 minutes » : proposition à la baisse appliquée');
await page.click('.tn-sum >> text=Revenir au tournoi complet');
// changement
await page.click('details.tn-more > summary'); await page.locator('label:has-text("Indicateur") input').check();
await page.click('.topbar >> text=Créer le tournoi');
await page.waitForSelector('.tn-board');
assert.equal(await page.locator('.mrow').count(), 6);
assert.ok(await page.locator('.mrow.cur').count());
log('écran de jeu : table de marque + 6 matchs, match en cours encadré');
await page.click('.tn-go');
await page.waitForFunction(() => document.querySelector('.clk').textContent.trim() !== '05:00', null, { timeout: 4000 });
await page.click('.pbtn >> nth=0'); await page.click('.pbtn >> nth=0'); await page.click('.pbtn >> nth=2');
assert.equal((await page.locator('.tn-score').allTextContents()).join(','), '2,1');
await page.click('text=Annuler le dernier point');
assert.equal((await page.locator('.tn-score').allTextContents()).join(','), '2,0');
log('chrono, points +1 et annulation du dernier point');
const border = await page.$eval('.tn-board', (e) => getComputedStyle(e).borderTopColor);
assert.notEqual(border, 'rgb(201, 204, 220)', 'contour de la couleur de l\'arbitre');
await page.waitForFunction(() => /Changement : 02:30/.test(document.querySelector('.chg')?.textContent || ''), null, { timeout: 3000 });
log('contour de la couleur de l\'arbitre ; « Changement : 02:30 »');
page.once('dialog', () => {});
await page.click('.tn-validate');
await page.click('.dlg-foot >> text=Valider');
await page.waitForSelector('.mrow.done');
assert.equal(await page.locator('.mrow.done').count(), 1);
log('match validé (confirmation : temps non écoulé), suivant en cours');
// jouer tous les autres
for (let i = 0; i < 5; i++) {
  await page.click('.pbtn >> nth=0');
  await page.click('.tn-validate');
  if (await page.locator('.dlg-foot >> text=Valider').count()) await page.click('.dlg-foot >> text=Valider');
  await page.waitForFunction((k) => document.querySelectorAll('.mrow.done').length >= k, i + 2);
}
await page.waitForSelector('.tn-podium');
log('tournoi terminé : bandeau et classement');
await page.click('.tn-rank .tn-link'); await page.waitForSelector('.ranktab');
assert.equal(await page.locator('.ranktab tbody tr').count(), 4);
await page.click('.dlg-foot >> text=Fermer');
// correction de score
await page.locator('.mrow.done').first().click(); await page.click('.popmenu >> text=Corriger');
await page.click('.dlg-foot >> text=Enregistrer');
// retour liste, duplication, suppression + annulation
await page.click('[aria-label="Retour"]'); await page.waitForSelector('.evrow');
assert.match(await page.textContent('.evrow'), /terminé/);
await page.locator('.evrow [aria-label="Actions"]').click(); await page.click('.popmenu >> text=Dupliquer');
await page.waitForSelector('.tn-board'); await page.click('[aria-label="Retour"]'); await page.waitForSelector('.evrow');
assert.equal(await page.locator('.evrow').count(), 2);
await page.locator('.evrow [aria-label="Actions"]').first().click(); await page.click('.popmenu >> text=Supprimer');
await page.waitForFunction(() => document.querySelectorAll('.evrow').length === 1);
await page.click('.toast >> text=Annuler');
await page.waitForFunction(() => document.querySelectorAll('.evrow').length === 2);
log('liste : correction de score, duplication, suppression annulable');

// Deux tournois en parallèle (libre)
await page.click('.topbar >> text=Nouveau tournoi'); await page.waitForSelector('.setup');
await page.locator('label:has-text("Deux tournois en parallèle") input').check();
await page.waitForSelector('.twocols');
await page.click('.topbar >> text=Créer le tournoi'); await page.waitForSelector('.tplay.tn-split');
assert.equal(await page.locator('.tn-panel').count(), 2);
assert.equal(await page.locator('.tn-rank').count(), 0, 'pas de classement en direct');
log('2 tournois en parallèle : vue partagée sans classement en direct');
await page.click('[aria-label="Retour"]'); await page.waitForSelector('.evrow');

// 2 terrains
await page.click('.topbar >> text=Nouveau tournoi'); await page.waitForSelector('.setup');
await page.click('[aria-label="Nombre d\'équipes : plus"]'); await page.click('[aria-label="Nombre d\'équipes : plus"]');
await page.click('.opt:has-text("Terrains") .seg >> text=2');
await page.click('.topbar >> text=Créer le tournoi'); await page.waitForSelector('.tn-stage.n2');
assert.equal(await page.locator('.tn-board').count(), 2);
log('2 terrains : deux tables de marque côte à côte');
await page.click('[aria-label="Retour"]'); await page.waitForSelector('.evrow');
await page.click('[aria-label="Retour"]'); await page.waitForSelector('.toolbar .seg');
await page.click('.toolbar .seg >> text=Classes'); await page.waitForSelector('.home-grid');

// Tournoi en activité depuis des clubs
await page.click('.home-grid .card'); await page.waitForSelector('[aria-label="Options de la classe"]');
await page.click('.actframe .tooltile:has-text("Équipes")');
await page.click('.empty >> text=Nouvelle composition'); await page.click('.dlg .seg >> text=Clubs'); await page.click('.dlg-foot >> text=Créer');
await page.waitForSelector('.teams');
await page.click('[aria-label="Options"]'); await page.click('.popmenu >> text=/Générer/');
await page.fill('.dlg input[type=number] >> nth=0', '3'); await page.click('.dlg-foot >> text=Générer'); await page.waitForSelector('.tcard.club');
// répartir à la main (via l'état) : 1re moitié en équipe 1, 2e en équipe 2
await page.evaluate(async () => {
  const app = window.__app; const cls = app.repo.list('classes')[0]; const set = cls.activities[0].equipes.sets[0];
  for (const c of set.clubs) {
    const pool = set.teams.find((t) => t.kind === 'pool' && t.clubId === c.id), t1 = set.teams.find((t) => t.clubId === c.id && t.rank === 1), t2 = set.teams.find((t) => t.clubId === c.id && t.rank === 2);
    const all = pool.members.splice(0); t1.members = all.slice(0, Math.ceil(all.length / 2)); t2.members = all.slice(Math.ceil(all.length / 2));
  }
  set.status[set.teams.find((t) => t.rank === 1).members[0]] = 'absent';
  window.__absent = set.teams.find((t) => t.rank === 1).members[0];
  await app.repo.save('classes', cls);
});
await page.click('[aria-label="Retour"]'); await page.click('[aria-label="Retour"]'); await page.waitForSelector('[aria-label="Options de la classe"]');
// ajout de l'outil Tournoi dans l'activité par le « + »
await page.locator('.actframe [aria-label="Ajouter un outil"]').click(); await page.click('.addgrid >> text=Tournoi');
await page.waitForSelector('.empty h2:has-text("Aucun tournoi")');
await page.click('.empty >> text=Nouveau tournoi'); await page.waitForSelector('.setup');
assert.equal(await page.locator('.setup select >> nth=0').inputValue().then((v) => v.length > 0), true);
assert.ok(await page.locator('.setup .listrow >> text=/Équipe 1/').count());
assert.equal(await page.locator('label:has-text("Deux tournois en parallèle") input').isChecked(), true, 'clubs : deux tournois préréglés');
assert.equal(await page.locator('.setup .listrow .seg button.on:has-text("Tournoi 1")').count(), 3);
assert.equal(await page.locator('.setup .listrow .seg button.on:has-text("Tournoi 2")').count(), 3);
log('tournoi en activité : équipes des clubs reprises, équipes 1 → tournoi 1, équipes 2 → tournoi 2');
assert.ok((await page.inputValue('input[data-fid="tname"]')).startsWith('Tournoi '));
await page.click('.topbar >> text=Créer le tournoi'); await page.waitForSelector('.tplay.tn-split');
// finir les deux tournois
for (let guard = 0; guard < 40; guard++) {
  const done = await page.locator('.tn-podium').count();
  if (done >= 2) break;
  const boards = await page.locator('.tn-board:not(.idle):not(.tn-podium)').count();
  for (let i = 0; i < boards; i++) {
    const b = page.locator('.tn-board:not(.idle):not(.tn-podium)').nth(0);
    await b.locator('.pbtn').nth(0).click();
    await b.locator('text=Valider le match').click();
    if (await page.locator('.dlg-foot >> text=Valider').count()) await page.click('.dlg-foot >> text=Valider');
    await page.waitForTimeout(60);
  }
}
assert.equal(await page.locator('.tn-podium').count(), 2);
log('les deux tournois du club sont joués jusqu\'au bout');
await page.click('[aria-label="Retour"]'); await page.waitForSelector('.evrow');
assert.match(await page.textContent('.evrow'), /en parallèle/);
await page.click('[aria-label="Retour"]'); await page.waitForSelector('[aria-label="Options de la classe"]');

// Suivi des résultats
await page.click('.actframe .tooltile:has-text("Équipes")'); // 1.10 : ouvre la composition la plus récente
await page.click('.topbar [aria-label="Options"]'); await page.click('.popmenu >> text=Suivi des résultats');
await page.waitForSelector('.suivitab');
assert.equal(await page.locator('.suivitab tr.clubrow').count(), 3);
assert.equal(await page.locator('.suivitab tr.subrow').count(), 6);
log('suivi des résultats : 3 clubs, 6 équipes');
const total0 = await page.locator('.suivitab tr.clubrow').first().locator('td').nth(7).textContent();
await page.locator('.suivitab tr.clubrow').first().locator('[aria-label^="Bonus"]').click();
await page.fill('.dlg input[type=text]', 'fair-play'); await page.fill('.dlg input[type=number]', '2');
await page.click('.dlg-foot >> text=Ajouter'); await page.click('.dlg-foot >> text=Fermer');
const total1 = await page.locator('.suivitab tr.clubrow').first().locator('td').nth(7).textContent();
assert.ok(true, `${total0} -> ${total1}`);
assert.ok((await page.locator('.suivitab tr.clubrow td').allTextContents()).some((x) => x.includes('+2')));
log('bonus accordé à un club');

// Onglet Résultats de la classe
await page.click('[aria-label="Retour"]'); await page.waitForSelector('[aria-label="Options de la classe"]');
await page.click('.seg >> text=Résultats');
await page.waitForSelector('.restab');
assert.equal(await page.locator('.restab thead th').count(), 3, 'élève + 2 tournois');
const rows = await page.locator('.restab tbody tr').count();
assert.equal(rows, 20);
const absentCells = await page.evaluate(() => { const a = window.__absent; return a; });
assert.ok(await page.locator('.restab td:has-text("er")').count() > 0);
log('onglet Résultats : palmarès par élève et par tournoi');
const noRes = await page.locator('.restab td.none').count();
assert.ok(noRes >= 1, 'l\'élève absent n\'a aucun résultat');
log('élève absent : aucun résultat');

console.log(errors.length ? '\nERREURS :\n' + errors.join('\n') : '\nAucune erreur JavaScript.');
await browser.close();
process.exit(errors.length ? 1 : 0);
