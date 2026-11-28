// Test v1.11 dans Chromium : Kabaddi, Boxe (rotation), Montée de niveau, Interclasses (+ projection), tournoi en alternance
// sur un terrain en suivi simple, retour direct depuis Équipes, classement des tables sans déplacement, Mario Kart V1/V2.
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
const unfold = async (name) => { const f = page.locator('.actframe.folded', { hasText: name }).locator('.foldhead'); if (await f.count()) await f.click(); }; // 1.13 : activités repliées
await page.addInitScript(() => { try { localStorage.setItem('eps-skip-tour', '1'); localStorage.setItem('eps-display', JSON.stringify({ motion: 'reduced' })); } catch {} });
await page.goto(URL); await page.waitForSelector('.empty h2');
const home = async () => { await page.goto(URL); await page.waitForSelector('.topbar'); await page.evaluate(async () => (await import('./js/app.js')).go('home')); await page.waitForSelector('.toolbar .seg'); };
const tool = async (label) => { await home(); await page.click('.toolbar .seg >> text=Outils'); await page.click(`.tooltile.big:has-text("${label}")`); };

// 1. Kabaddi
await tool('Kabaddi'); await page.waitForSelector('.kbattack');
const p4 = page.locator('.kbp >> nth=3');
assert.equal(await p4.locator('b').textContent(), '+100');
await p4.click(); assert.equal(await p4.locator('b').textContent(), '+10');
await p4.click(); await page.locator('.kbp >> nth=0').click();
await page.click('.kbace'); await page.click('.kbfaute');
assert.match(await page.textContent('.kbscore'), /^1209/);
await page.click('.kbteam >> text=Attaque suivante');
assert.match(await page.textContent('.kbtab tbody tr >> nth=0'), /1209/);
log('Kabaddi : +100 puis +10 par attaquant, Ace +1000, faute −1, tableau Attaque × Défense');
assert.equal(await page.locator('.topbar >> text=Projection').count(), 0);
assert.ok(await page.locator('.kbp >> nth=0 >> .kbhand svg').count());
log('1.12 : Kabaddi sans mode projection, main « touché » sur les boutons');

// 2. Boxe : horloge de rotation
await tool('Boxe française'); await page.waitForSelector('.bxdial');
assert.equal(await page.locator('.bxat').count(), 6);
assert.equal(await page.locator('.bxat >> nth=0 >> .bxg').textContent(), 'A');
await page.evaluate(async () => { const st = window.__app.repo.getMeta('bx:free') || { durationMin: 6, ateliers: ['Assaut en 1 touche', 'Assaut normal', 'Coaching', 'Assaut en 1 touche', 'Assaut normal', 'Coaching'], rot: 0 }; st.clock = { base: 6 * 60000, startedAt: null }; await window.__app.repo.setMeta('bx:free', st); (await import('./js/app.js')).render(); });
await page.click('.bxcenter >> text=Rotation suivante');
assert.equal(await page.locator('.bxat >> nth=1 >> .bxg').textContent(), 'A');
assert.match(await page.textContent('.bxrot'), /Rotation 2/);
assert.ok(await page.locator('.bxcenter >> text=Pause').count(), 'le chrono repart');
log('Boxe : 6 ateliers, au bout du temps « Rotation suivante » fait avancer les groupes et relance le chrono');

// 3. Montée de niveau + carnet (activité la plus récente en haut)
const ids = await page.evaluate(async () => {
  const { newActivity } = await import('./js/logic/activities.js'); const r = window.__app.repo; const uid = () => Math.random().toString(36).slice(2, 10);
  const c = { id: uid(), name: '4e C', level: '4e', color: '#cfe3ff', year: '2026-2027', students: ['Ali', 'Bea', 'Cam', 'Dan', 'Eli', 'Fay', 'Gus', 'Hoa'].map((f) => ({ id: uid(), first: f, initial: '', active: true })), createdAt: Date.now() };
  const a1 = newActivity('Handball', ['evaluation', 'equipes'], Date.now() - 86400000); const a2 = newActivity('Tennis de table', ['evaluation', 'montee', 'tables'], Date.now() - 2 * 86400000);
  a2.tools.forEach((t) => { t.lastUsed = Date.now(); });
  c.activities = [a1, a2]; await r.save('classes', c); return { c: c.id, hb: a1.id, tt: a2.id };
});
await home(); await page.click('.home-grid >> text=4e C');
assert.match(await page.textContent('.actframe >> nth=0'), /Tennis de table/);
log('carnet : l\'activité modifiée le plus récemment en haut');
await unfold('Tennis de table'); await page.click('.actframe:has-text("Tennis de table") .tooltile:has-text("Montée")'); await page.waitForSelector('.mtladder');
assert.equal(await page.locator('.mtrow').count(), 10);
assert.equal(await page.locator('.mtrow[data-zone="1"] .mtchip').count(), 8, '1.12 : tout le monde part du niveau 1');
const chip = page.locator('.mtrow[data-zone="1"] .mtchip').first(); const sid = await chip.getAttribute('data-sid');
const cb = await chip.boundingBox(), tb = await page.locator('.mtrow[data-zone="3"]').boundingBox();
await page.mouse.move(cb.x + 20, cb.y + 15); await page.mouse.down(); await page.mouse.move(cb.x + 50, cb.y + 40, { steps: 4 }); await page.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2, { steps: 10 }); await page.mouse.up();
await page.waitForSelector(`.mtrow[data-zone="3"] .mtchip[data-sid="${sid}"]`);
assert.ok(!(await page.locator('.mtrow[data-zone="3"]').getAttribute('class')).includes('empty'));
assert.ok((await page.locator('.mtrow[data-zone="9"]').getAttribute('class')).includes('empty'));
await page.click(`.mtchip[data-sid="${sid}"]`); await page.click('.popmenu >> text=Monter');
await page.waitForSelector(`.mtrow[data-zone="4"] .mtchip[data-sid="${sid}"]`);
log('montée de niveau : glisser-déposer, niveaux vides réduits, monter d\'un niveau');
await page.click('[aria-label="Retour"]'); await page.waitForSelector('[aria-label="Options de la classe"]');
log('retour : au carnet de la classe');

// 4. Tables : le classement ne déplace pas les élèves ; Équipes : Retour direct
await page.evaluate(async (ids) => { const LD = await import('./js/logic/ladder.js'); const r = window.__app.repo; const c = r.get('classes', ids.c); const a = c.activities.find((x) => x.id === ids.tt); LD.newSession(LD.ladderOf(a, 'tables'), { date: '2026-11-20', format: 'simple', place: 'niveau', students: c.students.map((s) => s.id) }); await r.save('classes', c); }, ids);
await home(); await page.click('.home-grid >> text=4e C'); await unfold('Tennis de table'); await page.click('.actframe:has-text("Tennis de table") .tooltile:has-text("Tables")'); await page.waitForSelector('.ldplan');
const before = await page.locator('.ldcard[data-zone="1"] .ldchip').evaluateAll((els) => els.map((e) => e.dataset.u));
await page.click('.topbar >> text=Classement final');
await page.locator('.ldcard[data-zone="1"] .ldchip').nth(2).click();
const after = await page.locator('.ldcard[data-zone="1"] .ldchip').evaluateAll((els) => els.map((e) => e.dataset.u));
assert.deepEqual(after, before);
assert.match(await page.locator('.ldcard[data-zone="1"] .ldchip').nth(2).textContent(), /^1/);
log('classement des tables : les élèves ne changent pas de place, seul le rang s\'affiche');
await page.click('[aria-label="Retour"]'); await page.waitForSelector('[aria-label="Options de la classe"]');
log('séance ouverte en direct : Retour = carnet de la classe');

// 5. Tournoi libre : deux tournois sur un terrain, suivi simple
await tool('Tournoi'); await page.click('.empty >> text=Nouveau tournoi'); await page.waitForSelector('.setup');
await page.locator('.switchrow input').check();
await page.click('.opt:has-text("Terrains") >> text=1 seul, en alternance');
await page.click('.opt:has-text("Table de marque") >> text=Sans (résultats seulement)');
await page.click('.topbar >> text=Créer le tournoi'); await page.waitForSelector('.tn-body.rs.two');
assert.equal(await page.locator('.rs-col').count(), 2);
assert.ok(await page.locator('.rs-aside .rs-ranks .tn-rank').count());
const nowTxt = await page.textContent('.rs-nowbtn small');
await page.click('.rs-nowbtn'); await page.click('.dlg .rs-dside >> nth=0 >> .tn-sbtn.plus'); await page.click('.dlg .rs-dside >> nth=0 >> .tn-sbtn.plus');
await page.click('.dlg-foot >> text=Valider le résultat');
await page.waitForSelector('.rscard.done');
assert.match(await page.textContent('.rscard.done .rs-score'), /2 – 0/);
assert.notEqual(await page.textContent('.rs-nowbtn small'), nowTxt, 'alternance : l\'autre tournoi joue ensuite');
await page.click('.rscard.done'); await page.click('.dlg .rs-dside >> nth=1 >> .tn-sbtn.plus'); await page.click('.dlg-foot >> text=Corriger');
await page.waitForFunction(() => /2 – 1/.test(document.querySelector('.rscard.done .rs-score').textContent));
log('1.12 : sans table de marque, tableau des matchs + classement en bas à droite, saisie et correction du score, alternance');

// 6. Interclasses
await tool('Interclasses'); await page.click('.empty >> text=Nouvel interclasse');
assert.deepEqual(await page.locator('.dlg .kvchip:not(.add)').allTextContents(), ['4A', '4B', '4C', '4D', '4E']); // 1.12 : classes A à E
for (const c of ['4D', '4E']) await page.click(`.dlg .kvchip:text-is("${c}")`);
await page.click('.dlg-foot >> text=Créer'); await page.waitForSelector('.ictour');
assert.equal(await page.locator('.ictour').count(), 2);
assert.match(await page.textContent('.ictour >> nth=0'), /Frisbee/);
await page.locator('.ictour >> nth=0 >> input[type=checkbox]').first().check();
await page.waitForFunction(() => /\b1\b/.test(document.querySelector('.ictour .ictab tbody tr td:nth-child(3)').textContent));
await page.click('.topbar >> text=Matchs et scores'); await page.waitForSelector('.tn-body.rs');
await page.click('.rs-nowbtn'); await page.click('.dlg .rs-dside >> nth=0 >> .tn-sbtn.plus'); await page.click('.dlg-foot >> text=Valider le résultat');
await page.click('[aria-label="Retour"]'); await page.waitForSelector('.ictour');
await page.click('.toolbar .seg >> text=Titres'); await page.waitForSelector('.ictitles');
assert.match(await page.textContent('.ictitles'), /Meilleure équipe Ultimate/);
log('interclasses : classes A à E, deux tournois (Frisbee / Disque), sponsor, saisie, onglets Classements / Titres');
await page.click('.toolbar .seg >> text=Classements'); await page.waitForSelector('.ictour');

// 7. Mario Kart V1 sans bonus, V2 avec image du cadeau ; Duathlon : fiches en image
await tool('Mario Kart'); await page.waitForSelector('.mkcard');
assert.equal(await page.locator('.mkb').count(), 0);
await page.click('.topbar [aria-label="Options"]'); await page.click('.popmenu >> text=Réglages'); await page.click('.dlg .seg >> text=V2'); await page.click('.dlg-foot >> text=Enregistrer');
await page.locator('.mkgift').first().click(); await page.waitForSelector('.mkpic.final img');
assert.match(await page.getAttribute('.mkpic img', 'src'), /img\/mk\/.+\.png/);
await page.click('.mkoverlay >> text=OK');
log('Mario Kart : V1 sans bonus, V2 : cadeau avec l\'image de la fiche');
await tool('Fiches Duathlon'); await page.waitForSelector('.duimgs img');
assert.equal(await page.locator('.duimgs img').count(), 2);
log('fiches Duathlon : les fiches élèves en image');

assert.deepEqual(errors, []);
console.log('\nAucune erreur JavaScript.');
await browser.close();
