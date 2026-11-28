// Test v1.5 dans Chromium : accueil (onglets Classes/Outils, tri, filtre), carnet de bord, activités, outils, avertissements de suppression.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { openClass, goHome, openEvalList } from './nav.mjs';
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
const unfold = async (name) => { const f = page.locator('.actframe.folded', { hasText: name }).locator('.foldhead'); if (await f.count()) await f.click(); }; // 1.13 : activités repliées
const route = () => page.evaluate(() => window.__app.route.name);

await page.addInitScript(() => { try { localStorage.setItem('eps-skip-tour', '1'); } catch {} });
await page.goto(URL);
await page.waitForSelector('.empty h2');
await page.evaluate(async () => {
  const S = await import('./js/data/schema.js'), E = await import('./js/logic/evaluation.js'), C = await import('./js/logic/scoring.js');
  const app = window.__app;
  const mk = (act) => { const m = S.newModel(); m.name = 'Grille ' + act; m.activity = act;
    m.levels['3e'] = { competences: [10, 10].map((x, i) => Object.assign(S.newCompetence(x), { name: 'C' + i })) };
    m.levels['6e'] = { competences: [10, 10].map((x, i) => Object.assign(S.newCompetence(x), { name: 'C' + i })) };
    return m; };
  const hand = mk('Handball'), bad = mk('Badminton');
  await app.repo.save('models', hand); await app.repo.save('models', bad);
  const c3 = S.newClass('3e B', '3e'), c6 = S.newClass('6e A', '6e'), c6b = S.newClass('6e C', '6e'), c5 = S.newClass('5e A', '5e');
  for (const c of [c3, c6, c6b, c5]) ['Léa', 'Tom'].forEach((f) => c.students.push(S.newStudent(f)));
  c3.infos = { x: { text: 'à supprimer', u: 1 } };
  for (const c of [c3, c6, c6b, c5]) await app.repo.save('classes', c);
  for (const [m, d] of [[hand, '2026-10-05'], [hand, '2026-11-10']]) {
    const ev = E.createEvaluation({ cls: c3, model: m, date: d });
    ev.model.competences.forEach((c) => C.setScore(ev, c3.students[0].id, c.id, 7));
    await app.repo.save('evaluations', ev);
  }
  await app.repo.save('evaluations', E.createEvaluation({ cls: c3, model: bad, date: '2026-11-20' }));
});
await page.reload();
await page.waitForSelector('.home-grid .card');

// ---------- Accueil ----------
assert.deepEqual(await page.locator('.topbar ~ .toolbar .seg').first().locator('button').allTextContents(), ['Classes', 'Outils']);
assert.equal(await page.locator('text=Nouvelle évaluation').count(), 0, 'plus de bouton « Nouvelle évaluation » sur l\'accueil');
assert.equal(await page.locator('.topbar button:has-text("Classes")').count(), 0, 'plus de bouton « Classes »');
const names = () => page.$$eval('.home-grid .card .t', (els) => els.map((e) => e.textContent));
assert.deepEqual(await names(), ['6e A', '6e C', '5e A', '3e B']);
log('accueil : onglets Classes | Outils, tuiles triées par niveau (6e → 3e)');
assert.equal(await page.locator('.toolbar .seg').count(), 1, 'plus de tri par nom / niveau');
await page.selectOption('select[aria-label="Niveau"]', '6e');
assert.deepEqual(await names(), ['6e A', '6e C']);
await page.selectOption('select[aria-label="Niveau"]', '');
log('filtre par niveau (plus de tri manuel)');
await page.click('.toolbar .seg >> nth=0 >> text=Outils');
await page.waitForSelector('.tooltile.big >> text=Chronomètre');
await page.waitForSelector('.tooltile.big >> text=Tournoi');
await page.click('.toolbar .seg >> nth=0 >> text=Classes');
log('onglet Outils : état vide + « + » (liste des outils prévus)');

// ---------- Carnet de bord ----------
await openClass(page, '3e B');
assert.equal(await page.locator('.actframe').count(), 2);
assert.deepEqual(await page.$$eval('.actframe h2', (e) => e.map((x) => x.textContent).sort()), ['Badminton · 3e B', 'Handball · 3e B']);
assert.equal(await page.locator('text=Infos').count(), 0);
assert.equal(await page.evaluate(() => 'infos' in window.__app.repo.list('classes').find((c) => c.name === '3e B')), false);
log('évaluations existantes rangées dans l\'activité du même nom ; infos supprimées');
await page.screenshot({ path: `${SHOTS}/v15-carnet.png` });

assert.equal(await page.locator('.hubhead').count(), 0);
assert.equal(await page.locator('text=Nouvelle évaluation').count(), 0, 'plus de « Nouvelle évaluation » isolée dans le carnet');
assert.equal(await page.locator('.actframe [aria-label="Ajouter un outil"]').count(), 1, 'un seul « + » discret, sur l\'activité dépliée');
assert.equal(await page.locator('.actframe.folded').count(), 1, '1.13 : les autres activités sont des bandeaux');
await unfold('Handball');
const hand = page.locator('.actframe', { hasText: 'Handball' });
await hand.locator('.tooltile').first().click();
assert.equal(await hand.locator('.evrow').count(), 2);
await page.screenshot({ path: `${SHOTS}/v15-carnet-deplie.png` });
await hand.locator('.tooltile').first().click();
assert.equal(await hand.locator('.evrow').count(), 0);
log('plusieurs évaluations : la tuile se déplie / se replie sur place');
// une seule évaluation : un appui ouvre directement
await unfold('Badminton');
await page.locator('.actframe', { hasText: 'Badminton' }).locator('.tooltile').first().click();
await page.waitForSelector('table.grid');
assert.equal(await route(), 'eval');
await page.click('[aria-label="Retour"]');
await page.waitForSelector('.hub');
log('une seule évaluation : un appui sur la tuile l\'ouvre directement');

// nouvelle activité
await page.click('.toolbar >> text=Nouvelle activité');
await page.click('.dlg-foot >> text=Créer');
assert.ok(await page.locator('.toast').count(), 'nom obligatoire');
await page.fill('.dlg input[type=text]', 'handball');
await page.click('.dlg-foot >> text=Créer');
assert.equal(await page.locator('.actframe').count(), 2, 'doublon (même nom, casse ignorée) refusé');
await page.fill('.dlg input[type=text]', 'Tennis de table');
assert.equal(await page.locator(".dlg label:has-text(\"Interclasses\")").count(), 0); // outils « plus tard » : absents de la création
await page.click('.dlg-foot >> text=Créer');
await page.waitForSelector('.actframe:has-text("Tennis de table")');
assert.match(await page.locator('.actframe:has-text("Tennis de table") .tooltile').first().textContent(), /Aucune/);
log('nouvelle activité : nom obligatoire, doublon refusé, outils « bientôt » désactivés');

// aucune évaluation : un appui sur la tuile propose d'en créer une, activité présélectionnée
await unfold('Tennis de table');
await page.locator('.actframe:has-text("Tennis de table") .tooltile').first().click();
await page.waitForSelector('.dlg select');
assert.equal(await page.locator('.dlg select').first().locator('option:checked').textContent(), 'Tennis de table');
assert.equal((await page.textContent('.dlg')).includes('null'), false, 'plus de « null » dans la fenêtre');
await page.selectOption('.dlg select >> nth=1', { label: 'Badminton — Grille Badminton' });
await page.fill('.dlg input[type=text]', 'Match de poule');
await page.click('.dlg-foot >> text=Créer');
await page.waitForSelector('table.grid');
assert.match(await page.textContent('.evtitle h1'), /Match de poule/);
await page.click('[aria-label="Retour"]');
await page.waitForSelector('.hub');
await unfold('Tennis de table');
const tt = page.locator('.actframe:has-text("Tennis de table")');
assert.match(await tt.locator('.tooltile').first().textContent(), /1 évaluation/);
log('aucune évaluation : la tuile propose d\'en créer une ; l\'évaluation porte le nom choisi');

// « + » : ajouter une évaluation par le menu
await tt.locator('[aria-label="Ajouter un outil"]').click();
assert.ok(await page.locator('.addgrid >> text=Certificat de rôle').count()); // 1.12 : grille d'icônes
assert.equal(await page.locator('.addgrid >> text=Interclasses').count(), 0); // outil libre seulement
await page.click('.addgrid >> text=Nouvelle évaluation');
await page.waitForSelector('.dlg select');
await page.click('.dlg-foot >> text=Créer');
await page.waitForSelector('table.grid');
await page.click('[aria-label="Options de l\'évaluation"]');
await page.click('.popmenu >> text=Nom de l\'évaluation');
await page.fill('.dlg input[type=text]', 'Bilan');
await page.click('.dlg-foot >> text=Enregistrer');
assert.match(await page.textContent('.evtitle h1'), /Bilan/);
await page.click('[aria-label="Retour"]');
await page.waitForSelector('.hub');
assert.match(await tt.locator('.tooltile').first().textContent(), /2 évaluations/);
await tt.locator('.tooltile').first().click();
assert.deepEqual((await tt.locator('.evrow .t').allTextContents()).sort(), ['Bilan', 'Match de poule']);
log('« + » → Nouvelle évaluation ; nom modifiable dans l\'évaluation ; liste affichée avec les noms');
await tt.locator('.evrow', { hasText: 'Bilan' }).locator('[aria-label="Actions"]').click();
await page.click('.popmenu >> text=Supprimer');
await page.waitForTimeout(300);
assert.match(await tt.locator('.tooltile').first().textContent(), /1 évaluation/);
log('évaluation supprimée depuis la liste (annulable)');

// renommer
await tt.locator('[aria-label="Options de l\'activité"]').click();
await page.click('.popmenu >> text=Nom et couleur');
await page.fill('.dlg input[type=text]', 'Ping-pong');
await page.locator('.dlg .swatch').nth(3).click();
await page.click('.dlg-foot >> text=Enregistrer');
await page.waitForSelector('.actframe:has-text("Ping-pong")');
await unfold('Ping-pong');
assert.match(await page.locator('.actframe:has-text("Ping-pong") .tooltile').first().textContent(), /1 évaluation/, 'renommer ne détache pas les évaluations');
const frameColor = await page.locator('.actframe:has-text("Ping-pong")').evaluate((el) => el.style.getPropertyValue('--ac'));
assert.equal(frameColor, '#c2b4ec');
const tc = await page.locator('.actframe:has-text("Ping-pong") .tooltile').first().evaluate((el) => el.style.getPropertyValue('--tc'));
assert.equal(tc, '#dcd3f3', 'l\'outil Évaluation est toujours lilas');
assert.equal(await page.evaluate(() => window.__app.repo.list('classes').find((c) => c.name === '3e B').activities.every((a) => /^#/.test(a.color))), true);
log('activité renommée + couleur de cadre choisie (lilas) ; outil Évaluation toujours rouge pastel');

// ---------- Suppression : avertissement précis ----------
await unfold('Handball');
const hf = page.locator('.actframe', { hasText: 'Handball' });
await hf.locator('[aria-label="Options de l\'activité"]').click();
await page.click('.popmenu >> text=Gérer les outils');
await page.locator('.dlg label:has-text("Évaluation") input').uncheck();
await page.click('.dlg-foot >> text=Enregistrer');
await page.waitForSelector('.dlg >> text=Attention, vous allez supprimer des données');
const txt = await page.textContent('.dlg');
assert.match(txt, /Évaluation « Grille Handball » du 5 oct\. 2026/);
assert.match(txt, /Évaluation « Grille Handball » du 10 nov\. 2026/);
assert.match(txt, /2 résultats/);
assert.match(txt, /définitive/);
await page.screenshot({ path: `${SHOTS}/v15-avertissement.png` });
await page.click('.dlg-foot >> text=Annuler');
assert.equal(await page.evaluate(() => window.__app.repo.list('evaluations').filter((e) => e.model.activity === 'Handball').length), 2);
assert.equal(await page.evaluate(() => window.__app.repo.list('classes').find((c) => c.name === '3e B').activities.find((a) => a.name === 'Handball').tools.length), 1);
log('retrait de l\'outil Évaluation : avertissement détaillé (évaluations, dates, résultats) ; « Annuler » ne supprime rien');

await hf.locator('[aria-label="Options de l\'activité"]').click();
await page.click('.popmenu >> text=Supprimer l\'activité');
await page.waitForSelector('.dlg >> text=Attention, vous allez supprimer des données');
await page.click('.dlg-foot >> text=Supprimer définitivement');
await page.waitForFunction(() => !document.querySelector('.actframe h2')?.textContent.includes('Handball') || document.querySelectorAll('.actframe').length === 2);
await page.waitForTimeout(400);
assert.equal(await page.locator('.actframe:has-text("Handball")').count(), 0);
assert.equal(await page.evaluate(() => window.__app.repo.list('evaluations').filter((e) => e.model.activity === 'Handball').length), 0);
log('suppression de l\'activité confirmée : activité et évaluations supprimées');

// ---------- Notes : actions à la suite des onglets, tri ----------
await page.click('.toolbar .seg >> text=Notes');
await page.waitForSelector('table.notes');
const tb = await page.locator('.toolbar').first().evaluate((el) => [...el.querySelectorAll('.seg button, select, .btn')].map((x) => x.getBoundingClientRect().top));
assert.ok(Math.max(...tb) - Math.min(...tb) < 20, 'onglets et actions sur la même ligne');
assert.ok(await page.locator('.toolbar >> text=PDF').count());
await page.selectOption('select[aria-label="Tri des élèves"]', 'alpha');
assert.deepEqual(await page.$$eval('table.notes tbody th .nm', (e) => e.map((x) => x.firstChild.textContent.trim())), ['Léa', 'Tom']);
await page.selectOption('select[aria-label="Tri des élèves"]', 'mean');
assert.equal((await page.$$eval('table.notes tbody th .nm', (e) => e[0].firstChild.textContent.trim())), 'Léa', 'meilleure moyenne en premier (Léa a des notes, Tom aucune)');
log('onglet Notes : filtre, tri et impression à la suite des onglets ; tri des élèves');
await page.click('.toolbar .seg >> text=Oublis');
assert.ok(await page.locator('.toolbar >> text=3 croix et +').count());
assert.equal(await page.locator('.forgethead').count(), 0);
log('onglet Oublis : filtre et légende à la suite des onglets');
// l'onglet est mémorisé dans la classe, pas d'une classe à l'autre
await goHome(page);
await openClass(page, '3e B');
assert.ok(await page.locator('.seg button.on >> text=Oublis').count(), 'même classe : onglet conservé');
await goHome(page);
await openClass(page, '6e A');
assert.ok(await page.locator('.seg button.on >> text=Carnet de bord').count(), 'autre classe : retour sur le carnet de bord');
await goHome(page);
log('onglet mémorisé dans la classe, carnet de bord à l\'ouverture d\'une autre classe');

// ---------- Retour / persistance ----------
await page.reload();
await page.waitForSelector('.home-grid .card');
await openClass(page, '3e B');
assert.equal(await page.locator('.actframe').count(), 2);
await goHome(page);
assert.equal(await route(), 'home');
log('rechargement : activités conservées ; Retour → accueil');

assert.equal(errors.length, 0, errors.join('\n'));
console.log('\nAucune erreur JavaScript.');
await browser.close();
