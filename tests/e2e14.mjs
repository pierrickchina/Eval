// Test v1.13 dans Chromium : actualiser = même écran, carnet replié, outils selon l'activité (+ Autres), en-tête aux couleurs
// de l'activité, Séance du jour (statuts, tirage, pris en compte par Équipes / VMA), rotation d'ateliers générique, flèches,
// équipes ↔ clubs, Kabaddi depuis Équipes, défi de classe (CT), certificat de rôle (boxe : 2 rôles), VMA dans Résultats + tri, export CSV.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const { chromium } = createRequire(import.meta.url)('playwright');
const URL = process.argv[2] || 'http://127.0.0.1:8765/index.html';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, hasTouch: true, locale: 'fr-FR', acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => { errors.push('pageerror: ' + e.message); console.log('PAGEERR', e.message); });
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
let n = 0; const log = (m) => console.log(`✓ ${String(++n).padStart(2, '0')} ${m}`);
await page.addInitScript(() => { try { localStorage.setItem('eps-skip-tour', '1'); localStorage.setItem('eps-display', JSON.stringify({ motion: 'reduced' })); } catch {} });
await page.goto(URL); await page.waitForSelector('.toolbar .seg, .empty h2');
const go = (name, p = {}) => page.evaluate(async ([name, p]) => (await import('./js/app.js')).go(name, p), [name, p]);

const ids = await page.evaluate(async () => {
  const { newActivity } = await import('./js/logic/activities.js'); const T = await import('./js/logic/teams.js');
  const r = window.__app.repo; const uid = () => Math.random().toString(36).slice(2, 10);
  const c = { id: uid(), name: '4e A', level: '4e', color: '#cfe3ff', year: '2026-2027', students: ['Ali', 'Bea', 'Cam', 'Dan', 'Eli', 'Fay', 'Gus', 'Hoa'].map((f) => ({ id: uid(), first: f, initial: '', active: true })), createdAt: Date.now() };
  const bx = newActivity('Boxe française', ['evaluation', 'kabaddi', 'arbitre', 'equipes'], Date.now() - 5000);
  const du = newActivity('Duathlon', ['evaluation', 'vma'], Date.now());
  const set = T.newSet({ name: 'Leçon 1', date: '2026-01-01' }); const t1 = T.addTeam(set), t2 = T.addTeam(set);
  t1.members = c.students.slice(0, 4).map((s) => s.id); t2.members = c.students.slice(4).map((s) => s.id);
  bx.equipes = { sets: [set] };
  du.vma = { results: { [c.students[0].id]: { stage: 6, vma: 11, dist: 900, date: '2026-11-20' }, [c.students[1].id]: { stage: 9, vma: 12.5, dist: 1500, date: '2026-11-20' } } };
  c.activities = [bx, du]; await r.save('classes', c);
  return { c: c.id, bx: bx.id, du: du.id, s: c.students.map((s) => s.id) };
});

// 1. Carnet : seule l'activité utilisée en dernier est dépliée
await go('classPage', { id: ids.c }); await page.waitForSelector('.actframe');
await page.waitForSelector(".actframe:not(.folded)"); await page.waitForTimeout(200);
assert.equal(await page.locator(".actframe:not(.folded)").count(), 1);
assert.match(await page.textContent('.actframe:not(.folded) h2'), /Duathlon/);
assert.ok(await page.locator('.actframe.folded:has-text("Boxe") .foldicons i').count() >= 3);
await page.click('.actframe.folded .foldhead'); await page.waitForSelector('.actframe:not(.folded):has-text("Boxe")');
log('carnet : activité récente dépliée, les autres en bandeau (icônes), un toucher déplie');

// 2. « + » : outils de l'activité seulement, puis « Autres »
await page.locator('.actframe:has-text("Boxe") [aria-label="Ajouter un outil"]').click(); await page.waitForSelector('.addgrid');
const lab = await page.locator('.addgrid .addtile b').allTextContents();
assert.ok(lab.includes('Boxe française · rotation') && lab.includes('Rings') && lab.includes('Circuit training'));
assert.ok(!lab.includes('Mario Kart') && !lab.includes('Kivaou') && !lab.includes('Tables'));
await page.click('.addtile.other'); await page.waitForSelector('.addgrid >> text=Mario Kart');
await page.click('.dlg [aria-label="Fermer"]');
log('« + » : seulement les outils de la boxe (+ généraux), « Autres » montre le reste');

// 3. Séance du jour : statuts, tirage au sort, dernières équipes
await page.click('.toolbar .seg >> text=Séance du jour'); await page.waitForSelector('.tdgrid');
await page.click(`.tdst[data-sid="${ids.s[0]}"]`); // absent
await page.click(`.tdst[data-sid="${ids.s[1]}"]`); await page.click(`.tdst[data-sid="${ids.s[1]}"]`); // dispensé
assert.match(await page.textContent(`.tdst[data-sid="${ids.s[0]}"]`), /Absent/);
assert.match(await page.textContent(`.tdst[data-sid="${ids.s[1]}"]`), /Dispensé/);
assert.match(await page.textContent('.tdcounts'), /6 Présents.*1 Absent.*1 Dispensé/);
for (let i = 0; i < 6; i++) { await page.click('.tddraw .btn'); const nm = await page.textContent('.tdname'); assert.ok(!/^(Ali|Bea)$/.test(nm.trim()), 'jamais un absent ou un dispensé'); }
assert.match(await page.textContent('.tdteams'), /Équipe 1/);
log('séance du jour : présent → absent → dispensé, compteurs, tirage parmi ceux qui pratiquent, dernières équipes');

// 4. Kabaddi : équipes reprises de la séquence, prénoms sur les boutons, absents exclus
await go('kabaddi', { from: 'classPage', classId: ids.c, scope: 'act', actId: ids.bx }); await page.waitForSelector('.kbattack');
const names = await page.locator('.kbp .kbname').allTextContents();
assert.ok(names.some((x) => /Cam|Dan|Eli|Fay|Gus|Hoa/.test(x)));
assert.ok(!names.includes('Ali') && !names.includes('Bea'), 'absent / dispensé du jour exclus');
assert.ok(await page.locator('.topbar.actbar .barcls svg').count(), 'en-tête aux couleurs de l\'activité + icône de la classe');
log('Kabaddi : équipes de l\'outil Équipes (prénoms), absents du jour exclus ; en-tête couleur activité + icône classe');

// 5. Équipes : statuts du jour + transformer en clubs / dupliquer en équipes
await page.evaluate(async (ids) => { const r = window.__app.repo; const c = r.get('classes', ids.c); c.activities.find((a) => a.id === ids.bx).equipes.sets[0].date = new Date().toISOString().slice(0, 10); await r.save('classes', c); }, ids);
await go('equipes', { from: 'classPage', classId: ids.c, scope: 'act', actId: ids.bx, latest: 1 }); await page.waitForSelector('.teams');
assert.equal(await page.evaluate((ids) => window.__app.repo.get('classes', ids.c).activities.find((a) => a.id === ids.bx).equipes.sets[0].status[ids.s[0]], ids), 'absent');
await page.click('.topbar [aria-label="Options"]'); await page.click('.popmenu >> text=Transformer en clubs (1 équipe = 1 club)');
await page.waitForFunction((ids) => window.__app.repo.get('classes', ids.c).activities.find((a) => a.id === ids.bx).equipes.sets[0].mode === 'clubs', ids);
await page.click('.topbar [aria-label="Options"]'); await page.click('.popmenu >> text=Dupliquer en équipes…');
await page.waitForFunction((ids) => window.__app.repo.get('classes', ids.c).activities.find((a) => a.id === ids.bx).equipes.sets.length === 2, ids);
const sets = await page.evaluate((ids) => window.__app.repo.get('classes', ids.c).activities.find((a) => a.id === ids.bx).equipes.sets.map((s) => [s.mode, s.clubs.length]), ids);
assert.deepEqual(sets, [['clubs', 2], ['teams', 0]]);
log('équipes : absent du jour repris, 1 équipe = 1 club, « Dupliquer en équipes » garde l\'original');

// 6. Certificat de rôle (boxe) : deux rôles, arbitre-juge et coach (partenaire de sparring)
await go('arbitre', { from: 'classPage', classId: ids.c, scope: 'act', actId: ids.bx }); await page.waitForSelector('.argrid');
assert.equal(await page.locator('.topbar .seg button').count(), 2);
await page.click('.topbar .seg >> text=Coach (partenaire de sparring)');
await page.click('.arcard >> nth=2'); await page.click('.dlg .arlvbtn:has-text("Sparring en mouvement")'); await page.click('.dlg-foot >> text=Enregistrer');
await page.waitForSelector('.arcard >> nth=2 >> .whistle.argent');
assert.match(await page.textContent('.arcounts'), /Auto-éval\. faites : 0 \/ 8/);
log('certificat de rôle : boxe = arbitre-juge + coach (sparring), badge argent, compteur d\'auto-évaluations');

// 7. Rotation d'ateliers générique : réglages (ateliers, couleurs, groupes), flèches, rotation
await go('rotation', { from: 'home', scope: 'free' }); await page.waitForSelector('.bxdial');
assert.equal(await page.locator('.bxat').count(), 4); assert.equal(await page.locator('.rarrow').count(), 4);
await page.click('.topbar [aria-label="Options"]'); await page.click('.popmenu >> text=Réglages (ateliers, groupes, durée)…');
await page.click('.dlg [aria-label="Ateliers : plus"]'); await page.click('.dlg [aria-label="Ateliers : plus"]');
await page.fill('.dlg [aria-label="Titre de l\'atelier 1"]', 'Saut'); await page.press('.dlg [aria-label="Titre de l\'atelier 1"]', 'Tab');
await page.click('.dlg [aria-label="Groupes : moins"]');
await page.click('.dlg-foot >> text=Enregistrer');
assert.equal(await page.locator('.bxat').count(), 6);
const cols = await page.locator('.bxat').evaluateAll((els) => els.map((e) => getComputedStyle(e).backgroundColor));
assert.equal(new Set(cols).size, 6, 'chaque atelier a sa couleur');
assert.match(await page.textContent('.bxat >> nth=0'), /Saut/);
assert.equal(await page.locator('.bxg.free').count(), 3, '3 groupes pour 6 ateliers : 3 ateliers libres');
await page.evaluate(async () => { const r = window.__app.repo; const st = r.getMeta('rot:free'); st.clock = { base: st.durationMin * 60000, startedAt: null }; await r.setMeta('rot:free', st); (await import('./js/app.js')).render(); });
await page.click('.bxcenter >> text=Rotation suivante');
assert.equal((await page.textContent('.bxat >> nth=1 >> .bxg')).trim(), 'A');
log('rotation d\'ateliers : 6 ateliers aux couleurs différentes, titres, 3 groupes, flèches de sens, rotation');

// 8. Circuit training : préréglage « Défi de classe » (relais de 5 × 30 s, 4 exercices, 2 blocs, 25 min 30)
await go('circuit', { from: 'home', scope: 'free' }); await page.waitForSelector('.ctset');
await page.click('.ctset >> text=Défi de classe');
assert.match(await page.textContent('.ctset'), /25:30|25 min 30/);
await page.evaluate(() => { localStorage.setItem('eps-circuit2', JSON.stringify({ ...JSON.parse(localStorage.getItem('eps-circuit2')), prep: 0 })); });
await page.click('.cctrl >> text=Démarrer'); await page.waitForSelector('.ctrelay');
assert.match(await page.textContent('.ctphase'), /Élève 1 \/ 5/);
log('défi de classe : relais « Élève 1 / 5 », 4 exercices × 2 blocs = 25 min 30');

// 9. Résultats : VMA, tri par colonne
await go('classPage', { id: ids.c }); await page.click('.toolbar .seg >> text=Résultats'); await page.waitForSelector('.vmares');
const firstName = () => page.locator('.vmares tbody tr >> nth=0 >> td >> nth=0').textContent();
await page.click('.vmares th:has-text("VMA")'); assert.equal(await firstName(), 'Ali');
await page.click('.vmares th:has-text("VMA")'); assert.equal(await firstName(), 'Bea');
log('Résultats : Test VMA (palier, VMA, distance), tri par colonne (2e toucher = ordre inverse)');

// 10. Export des notes (CSV)
await page.evaluate(async (ids) => { const r = window.__app.repo; await r.save('evaluations', { id: 'ev1', classId: ids.c, activityId: ids.du, title: 'Duathlon', date: '2026-11-20', model: { activity: 'Duathlon', competences: [{ id: 'k', name: 'K', max: 20, levels: [] }] }, cells: {}, statuses: {}, createdAt: Date.now(), updatedAt: Date.now() }); }, ids);
const [dl] = await Promise.all([page.waitForEvent('download'), (async () => { await page.click('[aria-label="Options de la classe"]'); await page.click('.popmenu >> text=Exporter les notes (tableur CSV)'); })()]);
assert.match(dl.suggestedFilename(), /notes-4e-A\.csv/);
log('export des notes : fichier CSV de la classe');

// 11. Actualiser = même écran
await go('arbitre', { from: 'classPage', classId: ids.c, scope: 'act', actId: ids.bx }); await page.waitForSelector('.argrid');
await page.reload(); await page.waitForSelector('.argrid');
await page.click('[aria-label="Retour"]'); await page.waitForSelector('[aria-label="Options de la classe"]');
log('actualiser : on reste sur le même écran, et Retour garde son historique');

// 12. Écrans sans défilement de page (1280 × 800)
for (const [name, p, sel] of [['classPage', { id: ids.c }, '.hub'], ['rotation', { scope: 'free', from: 'home' }, '.bxdial'], ['duathlon', { from: 'home' }, '.duimgs']]) {
  await go(name, p); await page.waitForSelector(sel);
  const over = await page.evaluate(() => document.scrollingElement.scrollHeight - document.scrollingElement.clientHeight);
  assert.ok(over <= 1, `${name} : la page ne défile pas`);
}
log('en-tête fixe : aucune page ne défile en entier');

assert.deepEqual(errors, []);
console.log('\nAucune erreur JavaScript.');
await browser.close();
