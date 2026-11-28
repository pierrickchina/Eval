// Test v1.9 dans Chromium : bibliothèque Projet EPS, note calculée Duathlon, tournoi pré-rempli + Basket 5e,
// rôles (tableau, rotation), matériel interdit, Tables & Rings (séances, inapte, classement, montée-descente, Résultats,
// proposition dans l'évaluation), compteur Mario Kart, chrono Circuit training.
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
const unfoldTool = async (label) => { const f = page.locator(`.actframe.folded:has(.foldicons i[title^="${label}"]) .foldhead`); if (await f.count()) await f.first().click(); };
const unfold = async (name) => { const f = page.locator('.actframe.folded', { hasText: name }).locator('.foldhead'); if (await f.count()) await f.click(); }; // 1.13 : activités repliées
await page.addInitScript(() => { try { localStorage.setItem('eps-skip-tour', '1'); } catch {} });
await page.goto(URL); await page.waitForSelector('.empty h2');
const home = async () => { await page.goto(URL); await page.waitForSelector('.topbar'); await page.evaluate(async () => (await import('./js/app.js')).go('home')); await page.waitForSelector('.toolbar .seg'); };

// 1. Bibliothèque installée au premier lancement
const libs = await page.evaluate(() => window.__app.repo.list('models').filter((m) => m.library).map((m) => m.activity).sort());
assert.deepEqual(libs, ['Acrosport', 'Basket', 'Boxe française', 'Circuit training', 'Danse', 'Duathlon', 'Gymnastique', 'Lutte', 'Mario Kart', 'Tennis de table', 'Ultimate', 'Vélo']);
await page.click('.topbar >> text=Réglages');
assert.equal(await page.locator('.tag.lib').count(), 12);
log('bibliothèque Projet EPS : 12 modèles installés, étiquette « Projet EPS »');
// modifier puis remettre l'origine
await page.evaluate(async () => { const r = window.__app.repo; const m = r.list('models').find((x) => x.activity === 'Vélo'); m.levels['5e'].competences[0].name = 'Corrigé'; await r.save('models', m); });
await page.reload(); await page.click('.topbar >> text=Réglages');
await page.locator('.listrow:has-text("Vélo") [aria-label="Actions"]').click();
await page.click('text=Remettre la version d\'origine'); await page.click('.dlg-foot >> text=Remettre l\'origine');
await page.waitForFunction(() => window.__app.repo.list('models').find((x) => x.activity === 'Vélo').levels['5e'].competences[0].name === 'Le cycliste responsable');
log('« Remettre la version d\'origine » : la grille du projet revient');

// 2. Classe 4e + activité Duathlon : note calculée
const ids = await page.evaluate(async () => {
  const { newActivity } = await import('./js/logic/activities.js');
  const r = window.__app.repo; const uid = () => Math.random().toString(36).slice(2, 10);
  const mk = (name, level, names, acts) => ({ id: uid(), name, level, color: '#cfe3ff', year: '2026-2027', students: names.map((f) => ({ id: uid(), first: f, initial: '', active: true })), activities: acts.map(([a, t]) => newActivity(a, t)), createdAt: Date.now() });
  const c4 = mk('4e A', '4e', ['Ali', 'Bea', 'Cam', 'Dan'], [['Duathlon', ['evaluation']]]);
  const c3 = mk('3e B', '3e', ['Eva', 'Fab', 'Gil', 'Hana', 'Ivo', 'Jil', 'Kim', 'Lou', 'Max'], [['Boxe française', ['evaluation', 'rings', 'equipes']], ['Tennis de table', ['tables']]]);
  const c5 = mk('5e C', '5e', ['Nina', 'Oscar', 'Paul', 'Rita', 'Sam', 'Tess', 'Ugo', 'Vera'], [['Basket', ['equipes', 'tournoi']]]);
  for (const c of [c4, c3, c5]) await r.save('classes', c);
  return { c4: c4.id, c3: c3.id, c5: c5.id, a4: c4.activities[0].id, box: c3.activities[0].id, tt: c3.activities[1].id, bk: c5.activities[0].id };
});
await home(); await page.click(`.home-grid >> text=4e A`); await page.waitForSelector('.actframe');
await page.click('.tooltile:has-text("Évaluation")');
await page.selectOption('.dlg select >> nth=1', { label: 'Duathlon — Projet EPS' });
await page.click('.dlg-foot >> text=Créer');
await page.click('button.nm >> nth=0'); await page.waitForSelector('.perfrow');
// fiche élève : première compétence = course
const card = page.locator('.compcard').first();
await card.locator('.perfrow >> text=Saisir').click();
await page.click('.dlg .seg >> text=Fille');
await page.fill('.dlg input[type=text]', '8\'00');
await page.waitForSelector('.perfout:has-text("Acquis")');
await page.click('.dlg-foot >> text=Appliquer');
await page.waitForSelector('.compcard >> nth=0 >> .lvrow.ac.on');
assert.ok((await card.locator('.perfrow').textContent()).includes('Fille · 8\'00'));
log('Duathlon 4e : fille en 8\'00 → « acquis » proposé et appliqué (saisie mémorisée)');

// 3. Tournoi : pré-rempli + Basket 5e (+1 / +10 / +100)
await page.evaluate(async (ids) => {
  const r = window.__app.repo; const c = r.get('classes', ids.c5); const a = c.activities[0];
  const T = await import('./js/logic/teams.js');
  const s1 = T.newSet({ name: 'Leçon 1', date: '2026-11-01', mode: 'teams', students: c.students.map((s) => s.id) });
  const s2 = T.newSet({ name: 'Leçon 2', date: '2026-11-20', mode: 'teams', students: c.students.map((s) => s.id) });
  T.addTeam(s2); T.addTeam(s2); s2.teams[0].members = c.students.slice(0, 4).map((s) => s.id); s2.teams[1].members = c.students.slice(4).map((s) => s.id);
  a.equipes = { sets: [s2, s1] };
  await r.save('classes', c);
}, ids);
await home(); await page.click('.home-grid >> text=5e C'); await unfoldTool('Tournoi'); await page.click('.tooltile:has-text("Tournoi")');
await page.click('.empty >> text=Nouveau tournoi'); await page.waitForSelector('.setup');
assert.equal(await page.locator('.setup .listrow').count(), 2, 'équipes de la leçon la plus récente');
assert.ok(await page.locator('details.tn-more label:has-text("Indicateur") input:checked').count(), 'indicateur activé par défaut');
await page.click('.topbar >> text=Créer le tournoi'); await page.waitForSelector('.tn-board');
const labels = await page.locator('.tn-pts >> nth=0 >> .pbtn').allTextContents();
assert.deepEqual(labels, ['+1', '+10', '+100', '−1', '−10', '−100']);
log('tournoi : composition la plus récente, indicateur de changement activé, Basket 5e +1/+10/+100 et retraits discrets');
await page.click('.tn-pts >> nth=0 >> text=+100');
await home(); await page.click('.home-grid >> text=5e C'); await unfoldTool('Tournoi'); await page.click('.tooltile:has-text("Tournoi")');
await page.click('.topbar >> text=Nouveau tournoi'); await page.waitForSelector('.setup');
assert.equal(await page.evaluate(() => document.querySelector('.setup').textContent.includes('Basket 5e')), true);
log('nouveau tournoi : réglages du dernier tournoi repris');

// 4. Équipes : rôles (tableau, rotation) + matériel interdit
await home(); await page.click('.home-grid >> text=5e C'); await unfoldTool('Équipes'); await page.click('.tooltile:has-text("Équipes")');
await page.waitForSelector('.tgrid'); assert.match(await page.textContent('.titlemenu'), /Leçon 2/); // 1.10 : la plus récente s'ouvre directement
await page.click('.topbar [aria-label="Options"]'); await page.click('.popmenu >> text=Rôles…');
await page.waitForSelector('.rtable');
await page.click('.dlg >> text=Faire tourner les rôles');
const r1 = await page.evaluate((ids) => { const c = window.__app.repo.get('classes', ids.c5); return c.activities[0].equipes.sets.find((s) => s.name === 'Leçon 2').roles; }, ids);
assert.equal(Object.keys(r1).length, 8);
await page.click('.dlg >> text=Faire tourner les rôles');
const r2 = await page.evaluate((ids) => { const c = window.__app.repo.get('classes', ids.c5); return c.activities[0].equipes.sets.find((s) => s.name === 'Leçon 2').roles; }, ids);
assert.ok(Object.keys(r1).every((sid) => r1[sid][0] !== r2[sid][0]), 'chacun change de rôle');
const team0 = await page.evaluate((ids) => window.__app.repo.get('classes', ids.c5).activities[0].equipes.sets.find((s) => s.name === 'Leçon 2').teams[0].members, ids);
assert.equal(new Set(team0.map((s) => r2[s][0])).size, 4, 'rôles différents dans une équipe');
log('rôles : tableau équipes × rôles, rotation (chacun change, pas de doublon dans une équipe)');
await page.click('.dlg-foot >> text=Fermer');
await page.locator('.tgrid .schip').first().click();
await page.click('.popmenu >> text=/Matériel interdit/');
await page.waitForSelector('.tgrid .schip .nomat');
log('matériel interdit : point rouge à côté du prénom');

// 5. Rings (boxe 3e) : séances, inapte, classement, montée-descente
await home(); await page.click('.home-grid >> text=3e B'); await unfoldTool('Rings'); await page.click('.tooltile:has-text("Rings")');
await page.click('.empty >> text=Nouvelle séance');
await page.click('.dlg-foot >> text=Créer la séance'); await page.waitForSelector('.ldgrid');
const sizes = await page.locator('.ldcard').evaluateAll((els) => els.map((e) => e.querySelectorAll('.ldchip').length));
assert.deepEqual(sizes, [3, 3, 3]);
log('rings : 9 élèves → 3 rings de 3');
// classement de chaque ring
await page.click('.topbar >> text=Classement final');
for (let i = 0; i < 3; i++) { const c = page.locator('.ldcard').nth(i); await c.locator('.ldchip').nth(0).click(); await c.locator('.ldchip').nth(1).click(); }
// (1er touché = 1er ; le 2e touché parmi les restants = 2e ; le dernier se range seul)
const ranking = await page.evaluate((ids) => window.__app.repo.get('classes', ids.c3).activities[0].ladders.rings.sessions[0].ranking, ids);
assert.ok(Object.values(ranking).length === 3 && Object.values(ranking).every((x) => x.length === 3));
await page.click('.topbar >> text=Terminé');
// inapte : un élève du ring 2 sort, le ring reste à 2
await page.locator('.ldcard').nth(1).locator('.ldchip').first().click();
await page.click('.popmenu >> text=/inapte/');
await page.waitForSelector('.ldbox.inapte .ldchip');
assert.equal(await page.locator('.ldcard').nth(1).locator('.ldchip').count(), 2);
log('inapte : l\'élève va dans la case « Inapte », son ring se réorganise');
const s1 = await page.evaluate((ids) => window.__app.repo.get('classes', ids.c3).activities[0].ladders.rings.sessions[0], ids);
// séance suivante d'après les résultats
await page.click('[aria-label="Retour"]'); await page.click('.topbar >> text=Nouvelle séance');
assert.ok(await page.locator('.dlg input[name=place]:checked').evaluate((e) => e.parentElement.textContent.includes('résultats')));
await page.click('.dlg-foot >> text=Créer la séance'); await page.waitForSelector('.ldgrid');
const s2 = await page.evaluate((ids) => window.__app.repo.get('classes', ids.c3).activities[0].ladders.rings.sessions.at(-1), ids);
const r = s1.ranking;
const top1 = r[2][0], last1 = r[1].at(-1), last2 = r[2].at(-1), first3 = r[3][0];
const where = (s, u) => s.tables.find((t) => t.units.includes(u))?.n;
assert.equal(where(s2, top1), 1, 'le 1er du ring 2 monte');
assert.equal(where(s2, last1), 2, 'le dernier du ring 1 descend');
assert.equal(where(s2, first3), 2, 'le 1er du ring 3 monte');
assert.equal(where(s2, last2), 3, 'le dernier du ring 2 descend');
log('séance suivante : le 1er monte, le dernier descend, les autres restent');

// Résultats de la classe + proposition dans l'évaluation (Performance)
await page.click('[aria-label="Retour"]'); await page.click('[aria-label="Retour"]');
await page.click('.toolbar .seg >> text=Résultats'); await page.waitForSelector('.ldover');
assert.equal(await page.locator('.ldover tbody tr').count(), 9);
log('onglet Résultats : tableau général des rings');
await page.click('.toolbar .seg >> text=Carnet de bord');
await unfold('Boxe'); await page.locator('.actframe:has-text("Boxe") .tooltile:has-text("Évaluation")').click();
await page.selectOption('.dlg select >> nth=1', { label: 'Boxe française — Projet EPS' });
await page.click('.dlg-foot >> text=Créer'); await page.click('button.nm >> nth=0'); await page.waitForSelector('.compcard');
await page.waitForSelector('.perfrow >> text=Tables & Rings');
await page.click('.perfrow >> text=/Proposer/');
assert.ok(await page.locator('.compcard:has(.perfrow) .lvrow.on').count());
log('évaluation boxe : niveau « Performance » proposé d\'après les rings');

// 6. Tables (tennis de table) en duos
await home(); await page.click('.home-grid >> text=3e B'); await unfold('Tennis de table'); await page.click('.tooltile:has-text("Tables")');
await page.click('.empty >> text=Nouvelle séance'); await page.click('.dlg .seg >> text=Duos');
await page.click('.dlg-foot >> text=Créer la séance'); await page.waitForSelector('.ldplan');
const duoSizes = await page.locator('.ldcard').evaluateAll((els) => els.map((e) => e.querySelectorAll('.ldchip').length));
assert.deepEqual(duoSizes, [3, 2]); // 5 duos : jamais un duo seul à une table
assert.ok((await page.locator('.ldchip').allTextContents()).some((t) => t.includes('+')));
log('tables en duos : 5 duos (2 par table, le duo en trop rejoint la 1re table)');

// 7. Mario Kart et Circuit training (outils libres)
await home(); await page.click('.toolbar .seg >> text=Outils');
await page.click('.tooltile.big:has-text("Mario Kart")'); await page.waitForSelector('.mkcard');
assert.equal(await page.locator('.mkcard').count(), 4);
assert.equal(await page.locator('.mkcard >> nth=0 >> .mkb').count(), 0); // 1.11 : pas de bonus en V1
await page.click('.mkcard >> nth=0 >> .mkbig'); await page.click('.mkcard >> nth=0 >> .mkbig');

assert.equal(await page.locator('.mkcard >> nth=0 >> .mkbig b').textContent(), '2');
await page.waitForTimeout(400); // laisser l'enregistrement se terminer avant de recharger
await home(); await page.click('.toolbar .seg >> text=Outils'); await page.click('.tooltile.big:has-text("Mario Kart")'); await page.waitForSelector('.mkcard');
assert.equal(await page.locator('.mkcard >> nth=0 >> .mkbig b').textContent(), '2');
log('Mario Kart : tours et bonus (liste MK), mémorisés après rechargement');
await home(); await page.click('.toolbar .seg >> text=Outils');
await page.click('.tooltile.big:has-text("Circuit")'); await page.waitForSelector('.ctimer');
await page.click('.ctset .seg >> text=5 min Workout');
await page.click('.ctimer >> text=Démarrer');
await page.waitForSelector('.ctimer.ph-prep');
assert.ok((await page.locator('.cttotal').textContent()).includes('05:40'));
log('Circuit training : préréglage 5 min Workout (3 × 3 exercices, 20 s / 20 s), préparation puis travail');
await home(); await page.click('.toolbar .seg >> text=Outils');
const secs = await page.locator('h3.toolsec').allTextContents();
assert.deepEqual(secs, ['Pour toutes les activités', 'Par activité', 'Autres et à venir']);
assert.ok(await page.locator('.tooltiles.big >> nth=0 >> .tooltile:has-text("Certificat de rôle")').count());
log('1.13 : rubriques Outils, Certificat de rôle dans « Pour toutes les activités »');

assert.deepEqual(errors, []);
console.log('\nAucune erreur JavaScript.');
await browser.close();
