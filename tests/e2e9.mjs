// Test v1.8 dans Chromium : nom PEPS, réglages d'affichage et de confort (thème, police, animations), vibration sur +1.
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
await page.addInitScript(() => {
  try { localStorage.setItem('eps-skip-tour', '1'); } catch {}
  window.__vib = []; navigator.vibrate = (p) => { window.__vib.push(p); return true; };
});
await page.goto(URL); await page.waitForSelector('.empty h2');

assert.equal(await page.title(), 'PEPS');
const man = await page.evaluate(async () => (await (await fetch('manifest.webmanifest')).json()).name);
assert.equal(man, 'PEPS');
log('nom de l\'application : PEPS (titre et manifeste)');

await page.click('text=Essayer avec une classe de démonstration'); await page.waitForSelector('.actframe');
await page.click('[aria-label="Retour"]'); await page.waitForSelector('.home-grid');
assert.ok(await page.locator('.topbar .brand img[src="icons/logo.svg"]').count(), 'logo discret dans l\'accueil');
log('logo discret dans la barre de l\'accueil');

await page.click('.topbar >> text=Réglages'); await page.click('.seg >> text=Général');
const panel = page.locator('.panel:has-text("Affichage et confort")');
await panel.locator('.seg >> text=Sombre doux').click();
assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'dark');
const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
assert.equal(bg, 'rgb(31, 34, 40)');
await panel.locator('.seg >> text=Très lisible').click();
assert.equal(await page.evaluate(() => document.documentElement.dataset.font), 'lisible');
await page.waitForFunction(() => document.fonts.check('16px "PEPS Lisible"'));
await panel.locator('label:has-text("Réduire les animations") input').check();
assert.equal(await page.evaluate(() => document.documentElement.dataset.motion), 'reduced');
log('réglages : sombre doux, police très lisible (chargée hors ligne), animations réduites');

await page.reload(); await page.waitForSelector('.topbar');
assert.deepEqual(await page.evaluate(() => [document.documentElement.dataset.theme, document.documentElement.dataset.font, document.documentElement.dataset.motion]), ['dark', 'lisible', 'reduced']);
log('réglages mémorisés après rechargement');

// vibration sur +1 (et pas quand elle est désactivée)
await page.goto(URL); await page.waitForSelector('.toolbar .seg');
await page.click('.toolbar .seg >> text=Outils'); await page.click('.tooltile.big:has-text("Tournoi")');
await page.click('.empty >> text=Nouveau tournoi'); await page.click('.topbar >> text=Créer le tournoi'); await page.waitForSelector('.tn-board');
await page.click('.pbtn >> nth=0');
assert.deepEqual(await page.evaluate(() => window.__vib), [15]);
await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('eps-display')); d.vibrate = false; localStorage.setItem('eps-display', JSON.stringify(d)); window.__vib = []; });
await page.click('.pbtn >> nth=0');
assert.deepEqual(await page.evaluate(() => window.__vib), []);
log('vibration à chaque point marqué, coupée si le réglage est désactivé');

const anim = await page.evaluate(() => getComputedStyle(document.querySelector('.tn-board')).animationName);
assert.ok(anim === 'none');
log('animations réduites appliquées à la table de marque');

assert.deepEqual(errors, []);
console.log('\nAucune erreur JavaScript.');
await browser.close();
