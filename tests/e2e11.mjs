// Test v1.10 dans Chromium : outils pré-cochés, Kivaou (GO, couleurs, retard, arrivé, balises, bilan, départ groupé),
// Tables (glisser-déposer, séance suivante, plan de salle), Circuit training (exercices, hasard, matériel, circuit, cadenas),
// Mario Kart (V2, cadeau tiré), fiches Duathlon, préréglages de l'équipe EPS, grille sans note.
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
const home = async () => { await page.goto(URL); await page.waitForSelector('.topbar'); await page.evaluate(async () => (await import('./js/app.js')).go('home')); await page.waitForSelector('.toolbar .seg'); };
const noNull = async () => assert.ok(!(await page.evaluate(() => /\bnull\b/.test(document.body.innerText))), 'aucun « null » affiché');

const ids = await page.evaluate(async () => {
  const r = window.__app.repo; const uid = () => Math.random().toString(36).slice(2, 10);
  const c = { id: uid(), name: '6e B', level: '6e', color: '#cfe3ff', year: '2026-2027', students: ['Ali', 'Bea', 'Cam', 'Dan', 'Eli', 'Fay', 'Gus', 'Hoa'].map((f) => ({ id: uid(), first: f, initial: '', active: true })), activities: [], createdAt: Date.now() };
  await r.save('classes', c);
  return { c: c.id };
});

// 1. Nouvelle activité : outils cochés d'après le nom
await home(); await page.click('.home-grid >> text=6e B');
await page.click('text=Nouvelle activité');
await page.fill('.dlg input[type=text]', 'Course d\'orientation');
assert.ok(await page.locator('.dlg label:has-text("Kivaou") input:checked').count());
assert.ok(await page.locator('.dlg label:has-text("Évaluation") input:checked').count());
await page.click('.dlg-foot >> text=Créer'); await page.waitForSelector('.actframe:has-text("Course d\'orientation")');
log('nouvelle activité « Course d\'orientation » : Évaluation et Kivaou cochés d\'office');

// 2. Kivaou
await page.click('.actframe .tooltile:has-text("Kivaou")'); await page.waitForSelector('.kivaou');
await page.click('.topbar >> text=Nouveau groupe');
await page.click('.kvpick .kvchip >> text=Ali'); await page.click('.kvpick .kvchip >> text=Bea');
await page.click('.kvchip.course >> text=Boucle A');
await page.click('.dlg-foot button:text-is("Prêt")'); // 1.11 : Annuler / Prêt, puis GO sur la carte
await page.click('.kvcard.ready >> text=GO');
await page.waitForSelector('.kvcard.run');
assert.match(await page.textContent('.kvbanner'), /1 groupe pas rentré/);
assert.match(await page.textContent('.kvcard'), /Boucle A/);
assert.match(await page.textContent('.kvcard'), /Ali · Bea/);
// les élèves partis ne sont plus proposés
await page.click('.topbar >> text=Nouveau groupe');
assert.equal(await page.locator('.kvpick .kvchip:text-is("Ali")').count(), 0);
await page.click('.kvpick .kvchip >> text=Cam'); await page.click('.kvchip.course >> text=Défi');
await page.click('.dlg-foot button:text-is("Prêt")'); await page.click('.kvcard.ready >> text=GO'); await page.waitForSelector('.kvcard >> nth=1');
log('Kivaou : groupe + parcours + GO, bandeau « pas rentrés », élèves partis retirés du choix');
// couleurs : on recule l'heure de départ
await page.evaluate((cid) => { const c = window.__app.repo.get('classes', cid); const s = c.activities[0].kivaou.sessions[0]; s.groups[0].start -= 19 * 60000 + 10000; s.groups[1].start -= 21 * 60000; }, ids.c);
await page.waitForSelector('.kvcard.over'); await page.waitForSelector('.kvcard.warn1');
assert.match(await page.textContent('.kvbanner'), /en retard : Cam/);
assert.equal(await page.locator('.kvcard').first().getAttribute('data-st'), 'over'); // les retards en tête
log('Kivaou : rouge à 1 min, noir quand le temps est dépassé, retards en tête et nommés dans le bandeau');
await page.locator('.kvcard.over >> text=Arrivé').click();
await page.locator('.kvcard.warn1 >> text=Arrivé').click();
await page.waitForSelector('.kvbanner.ok');
await page.click('.kvbackhead');
await page.locator('.kvsmall >> nth=0').click();
await page.locator('.dlg .stepper >> nth=0 >> [aria-label="Moins"]').click();
await page.click('.dlg-foot >> text=Enregistrer');
await page.click('.topbar .seg >> text=Bilan');
await page.waitForSelector('.kvtab');
const rows = await page.locator('.kvtab tbody tr').allTextContents();
assert.equal(rows.length, 3);
assert.match(rows.at(-1), /H\.T\./); // hors temps : dernier
log('Kivaou : arrivés, balises saisies sans clavier, bilan (hors temps toujours derniers)');
// départ groupé
await page.click('.topbar .seg >> text=Course');
await page.click('.topbar [aria-label="Options"]'); await page.click('.popmenu >> text=Départ groupé');
await page.click('.topbar >> text=Nouveau groupe'); await page.click('.kvpick .kvchip >> text=Dan'); await page.click('.dlg-foot button:text-is("Prêt")');
await page.click('.topbar >> text=Nouveau groupe'); await page.click('.kvpick .kvchip >> text=Eli'); await page.click('.dlg-foot button:text-is("Prêt")');
await page.click('.topbar >> text=GO pour tous');
await page.waitForFunction(() => document.querySelectorAll('.kvcard.run').length === 2);
const starts = await page.evaluate((cid) => window.__app.repo.get('classes', cid).activities[0].kivaou.sessions[0].groups.slice(-2).map((g) => g.start), ids.c);
assert.equal(starts[0], starts[1]);
log('Kivaou : départ groupé, un seul GO pour toute la classe');
await noNull();

// 3. Résultats de la classe
await page.evaluate(async () => (await import('./js/app.js')).go('classPage', { id: window.__app.repo.list('classes').find((c) => c.name === '6e B').id }));
await page.click('.toolbar .seg >> text=Résultats'); await page.waitForSelector('.kvtab');
log('onglet Résultats : bilan Kivaou');

// 4. Circuit training : exercices, hasard, matériel, circuit, cadenas
await home(); await page.click('.toolbar .seg >> text=Outils');
await page.click('.tooltile.big:has-text("Circuit training")'); await page.click('.topbar .seg >> text=Exercices');
assert.equal(await page.locator('.excard').count(), 24);
await page.click('.extchip:has-text("Haut du corps")');
const haut = await page.locator('.excard b').allTextContents();
assert.ok(['Pompes', 'Burpees', 'Gainage militaire', 'Dips sur banc', 'Pompes toucher d\'épaule'].every((x) => haut.includes(x)));
await page.click('.exmat label:has-text("Banc") input');
await page.waitForFunction(() => ![...document.querySelectorAll('.excard b')].some((b) => b.textContent === 'Dips sur banc'));
await page.click('.topbar ~ .scroll >> text=Au hasard');
await page.waitForSelector('.exdetail .exhow li');
assert.match(await page.textContent('.dlg-head h2'), /Tiré au hasard/);
await page.click('.dlg-foot >> text=Fermer');
log('exercices : 24 fiches, tri par couleur, matériel décoché retiré, tirage au hasard avec consignes de sécurité');
await page.click('.topbar .seg >> text=Circuits'); await page.click('text=Nouveau circuit');
await page.fill('.dlg input[type=text]', 'Circuit test');
for (const x of ['Squats', 'Planche', 'Burpees']) await page.click(`.dlg .excard:has-text("${x}")`);
await page.click('.dlg-foot >> text=Enregistrer');
await page.locator('.evrow:has-text("Circuit test") [aria-label="Actions"]').click(); await page.click('.popmenu >> text=Afficher dans le chrono');
await page.waitForSelector('.ctimer');
await page.click('.ctimer >> text=Démarrer');
await page.evaluate(() => new Promise((res) => setTimeout(res, 5400)));
await page.waitForSelector('.ctnow:has-text("Squats")');
assert.match(await page.textContent('.ctnext'), /Planche/);
await page.click('.ctimer >> text=Pause'); await page.click('.ctimer >> text=Zéro');
log('circuit nommé affiché dans le chrono : exercice en cours et suivant');
await page.click('.ctrow:has-text("Durée totale") .ctlock');
const before = await page.textContent('.ctrow:has-text("Durée totale") output');
await page.click('.ctrow:has-text("Tours") [aria-label="Tours : plus"]');
assert.equal(await page.textContent('.ctrow:has-text("Durée totale") output'), before);
log('cadenas : durée totale verrouillée, les autres réglages s\'ajustent');

// 5. Mario Kart V2 : cadeau
await home(); await page.click('.toolbar .seg >> text=Outils'); await page.click('.tooltile.big:has-text("Mario Kart")');
await page.click('.topbar [aria-label="Options"]'); await page.click('.popmenu >> text=Réglages');
await page.click('.dlg .seg >> text=V2'); await page.click('.dlg-foot >> text=Enregistrer');
await page.waitForSelector('.mkgift');
await page.emulateMedia({ reducedMotion: 'reduce' });
await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('eps-display') || '{}'); d.motion = 'reduced'; localStorage.setItem('eps-display', JSON.stringify(d)); });
await page.locator('.mkcard >> nth=0 >> .mkgift').click();
await page.waitForSelector('.mkroll.final');
assert.ok((await page.textContent('.mkdesc')).length > 5);
await page.click('.mkoverlay >> text=OK');
assert.ok(await page.locator('.mkcard >> nth=0 >> .mkb.on').count());
await page.locator('.mkcard >> nth=0 >> .mkbig').click(); await page.locator('.mkcard >> nth=0 >> [aria-label="Malus : plus"]').click();
assert.match(await page.textContent('.mkcard >> nth=0 >> .mktotal b'), /^1 pts$/);
assert.match(await page.textContent('.mkclock b'), /12:00/);
log('Mario Kart V2 : chrono 12 min, cadeau tiré au hasard (effet affiché), total = tours × 2 − malus');

// 6. Fiches Duathlon
await home(); await page.click('.toolbar .seg >> text=Outils'); await page.click('.tooltile.big:has-text("Fiches Duathlon")');
await page.waitForSelector('.duimgs img'); assert.equal(await page.locator('.dutab').count(), 0);
await page.click('.topbar .seg >> text=3e');
assert.match(await page.getAttribute('.duimgs img >> nth=0', 'src'), /fiche-3e-1/);
log('1.12 : fiches Duathlon = seulement les images importées (4e / 3e)');

// 7. Préréglages de l'équipe EPS
await home(); await page.click('.topbar >> text=Réglages'); await page.click('.seg >> text=Préréglages équipe EPS');
await page.click('.prhead:has-text("Kivaou")'); // 1.12 : un volet par outil
await page.click('.pracc.open >> text=Modifier les réglages…');
await page.locator('.dlg .stepper >> nth=0 >> [aria-label="Plus"]').click();
await page.click('.dlg-foot >> text=Enregistrer');
await page.waitForFunction(() => /21 min max/.test(document.querySelector('.pracc.open').textContent));
assert.match(await page.textContent('.pracc.open .prtag'), /Personnalisé/);
await page.click('.prhead:has-text("Tournoi")');
await page.click('.pracc:has-text("Tournoi") [aria-label="Durée : plus"]');
await page.waitForFunction(() => /6 min/.test(document.querySelector('.pracc:nth-of-type(1)')?.textContent || document.body.textContent));
await page.click('.pracc:has-text("Kivaou") >> text=Restaurer');
await page.waitForFunction(() => /D'origine/.test([...document.querySelectorAll('.pracc')].find((x) => x.textContent.includes('Kivaou')).querySelector('.prtag').textContent));
log('1.12 : préréglages par outil (volets), modification sur place, Restaurer');

// 8. Grille sans note
await page.click('.seg >> text=Modèles'); await page.click('text=Nouveau modèle');
await page.fill('input[data-fid="m-name"]', 'Niveaux seuls'); await page.fill('input[data-fid="m-act"]', 'Gym');
await page.click('.chip >> text=6e');
await page.click('text=Sans note en 6e');
await page.click('text=Ajouter une compétence');
await page.fill('.mecard >> nth=0 >> input[aria-label="Nom"]', 'Tourner en avant'); await page.press('.mecard >> nth=0 >> input[aria-label="Nom"]', 'Tab');
assert.ok(await page.locator('.mecards.noscore').count());
assert.equal(await page.locator('#m-save').isDisabled(), false);
log('grille sans note : niveaux seulement, barèmes masqués');

// 9. Tables : séance suivante + glisser-déposer + plan de salle
const t = await page.evaluate(async (cid) => {
  const { newActivity } = await import('./js/logic/activities.js'); const LD = await import('./js/logic/ladder.js');
  const r = window.__app.repo; const c = r.get('classes', cid);
  const a = newActivity('Tennis de table', ['evaluation', 'tables']); c.activities.push(a);
  const L = LD.ladderOf(a, 'tables'); const s = LD.newSession(L, { date: '2026-11-20', format: 'simple', place: 'niveau', students: c.students.map((x) => x.id) });
  await r.save('classes', c); return { a: a.id, s: s.id };
}, ids.c);
await page.evaluate(async ([cid, aid]) => (await import('./js/app.js')).go('tables', { scope: 'act', classId: cid, actId: aid, latest: 1, from: 'classPage' }), [ids.c, t.a]);
await page.waitForSelector('.ldplan');
// glisser un élève de la table 1 vers la table 2
const chip = page.locator('.ldcard[data-zone="1"] .ldchip').first();
const target = page.locator('.ldcard[data-zone="2"]');
const u = await chip.getAttribute('data-u');
const cb = await chip.boundingBox(), tb = await target.boundingBox();
await page.mouse.move(cb.x + 20, cb.y + 15); await page.mouse.down();
await page.mouse.move(cb.x + 60, cb.y + 40, { steps: 5 }); await page.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2, { steps: 10 }); await page.mouse.up();
await page.waitForSelector(`.ldcard[data-zone="2"] .ldchip[data-u="${u}"]`);
log('tables : plan de salle et glisser-déposer d\'un élève vers une autre table');
await page.click('.topbar >> text=Classement final');
for (const z of ['1', '2']) { const c = page.locator(`.ldcard[data-zone="${z}"]`); const k = await c.locator('.ldchip').count(); for (let i = 0; i < k - 1; i++) await c.locator('.ldchip').nth(i).click(); }
await page.click('.topbar >> text=Séance suivante');
assert.ok(await page.locator('.dlg input[name=place]:checked').evaluate((e) => e.parentElement.textContent.includes('résultats')));
await page.click('.dlg-foot >> text=Créer la séance'); await page.waitForSelector('.ldplan');
assert.equal(await page.evaluate(([cid, aid]) => window.__app.repo.get('classes', cid).activities.find((a) => a.id === aid).ladders.tables.sessions.length, [ids.c, t.a]), 2);
log('« Séance suivante » après le classement final : nouvelle séance d\'après les résultats');
await noNull();

assert.deepEqual(errors, []);
console.log('\nAucune erreur JavaScript.');
await browser.close();
