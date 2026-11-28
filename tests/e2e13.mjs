// Test v1.12 dans Chromium : accueil (cartes de classe, icônes), outils par rubriques, ajout d'outil en grille,
// Retour unique, fenêtres fermées au changement d'écran, certification d'arbitre (sifflet), test VMA, boxe (ateliers fixes, fiche),
// oublis (nombre visible), sauvegarde (un seul encadré), accueil d'un outil la première fois.
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
const go = (name, p = {}) => page.evaluate(async ([name, p]) => (await import('./js/app.js')).go(name, p), [name, p]);

const ids = await page.evaluate(async () => {
  const { newActivity } = await import('./js/logic/activities.js'); const r = window.__app.repo; const uid = () => Math.random().toString(36).slice(2, 10);
  const c = { id: uid(), name: '3e B', level: '3e', color: '#cfe3ff', year: '2026-2027', students: ['Ali', 'Bea', 'Cam', 'Dan', 'Eli', 'Fay'].map((f) => ({ id: uid(), first: f, initial: '', active: true })), createdAt: Date.now() };
  const hb = newActivity('Handball', ['evaluation', 'equipes', 'arbitre'], Date.now());
  const bx = newActivity('Boxe française', ['evaluation'], Date.now() - 1000);
  c.activities = [hb, bx]; await r.save('classes', c); return { c: c.id, hb: hb.id, bx: bx.id, s0: c.students[0].id };
});
const home = async () => { await go('home'); await page.waitForSelector('.toolbar .seg'); };

// 1. Accueil : grande carte colorée de la classe
await home();
await page.waitForSelector('.clscard');
assert.ok(await page.locator('.clscard svg.clsicon').count());
assert.match(await page.textContent('.clscard .d'), /3e · 6 élèves · 2 activités/);
assert.deepEqual(await page.locator('.clscard .clsact').allTextContents(), ['Handball', 'Boxe française']);
log('accueil : grande carte de classe (icône, niveau, élèves, activités récentes en premier)');

// 2. Outils : rubriques et couleurs de texte
await page.click('.toolbar .seg >> text=Outils');
assert.deepEqual(await page.locator('h3.toolsec').allTextContents(), ['Pour toutes les activités', 'Par activité', 'Autres et à venir']);
assert.deepEqual(await page.locator('.actglabel').allTextContents(), ['Jeux athlétiques et Duathlon', 'Circuit training', 'Boxe et lutte', 'Tennis de table', 'Course d\'orientation']); // 1.13
assert.deepEqual((await page.locator('.actgroup:has-text("Jeux athlétiques") .tooltile b').allTextContents()).sort(), ['Fiches Duathlon', 'Mario Kart', 'Test VMA']);
assert.ok(await page.locator('.tooltiles.big >> nth=0 >> .tooltile:has-text("Rotation d\'ateliers")').count());
const col = await page.$eval('.tooltile.big b', (b) => getComputedStyle(b).color);
assert.notEqual(col, 'rgb(29, 32, 40)', 'titre dans la teinte de l\'outil');
log('outils : rubriques (dont « Autres et à venir »), titre dans la couleur de l\'outil');

// 3. Icône de classe : symbole et couleurs choisis séparément
await go('classEdit', { id: ids.c, from: 'classPage' }); await page.waitForSelector('.iconpick');
await page.click('.iconpick >> nth=0 >> [aria-label="Montagne de droite"]');
await page.click('.iconpick >> nth=1 >> [aria-label="Couleurs Menthe"]');
await page.waitForFunction((id) => window.__app.repo.get('classes', id).icon?.palette === 'menthe', ids.c);
assert.deepEqual(await page.evaluate((id) => window.__app.repo.get('classes', id).icon, ids.c), { shape: 'right', palette: 'menthe' });
log('icône de classe : 5 symboles × 5 couleurs, choisis séparément');

// 4. Retour unique : accueil → classe → outil → Retour → classe → Retour → accueil
await home(); await page.click('.toolbar .seg >> text=Classes'); await page.click('.clscard'); await page.waitForSelector('[aria-label="Options de la classe"]');
await unfold('Handball'); await page.click('.actframe:has-text("Handball") .tooltile:has-text("Certificat de rôle")'); await page.waitForSelector('.argrid');
await page.click('[aria-label="Retour"]'); await page.waitForSelector('[aria-label="Options de la classe"]');
await page.click('[aria-label="Retour"]'); await page.waitForSelector('.clscard');
log('Retour = écran précédent, partout (accueil → classe → outil → classe → accueil)');

// 5. Fenêtres et menus fermés au changement d'écran
await page.click('.clscard'); await page.waitForSelector('[aria-label="Options de la classe"]');
await page.click('[aria-label="Options de la classe"]'); await page.waitForSelector('.popmenu');
await go('home'); await page.waitForSelector('.clscard');
assert.equal(await page.locator('.popmenu, .backdrop').count(), 0);
log('changement d\'écran : plus aucun menu ni fenêtre par-dessus');

// 6. Ajouter un outil : grille d'icônes sans les outils déjà présents
await page.click('.clscard'); await page.waitForSelector('.actframe');
await unfold('Boxe'); await page.locator('.actframe:has-text("Boxe") [aria-label="Ajouter un outil"]').click();
await page.waitForSelector('.addgrid');
const labels = await page.locator('.addgrid .addtile b').allTextContents();
assert.ok(labels.includes('Boxe française · rotation') && labels.includes('Nouvelle évaluation'));
assert.ok(!labels.some((l) => /ouvrir/i.test(l)));
await page.click('.addgrid >> text=Boxe française · rotation'); await page.waitForSelector('.bxdial');
log('« + » d\'une activité : grille d\'icônes, seulement les outils absents');

// 7. Boxe : ateliers fixes (couleur + icône), seules les lettres tournent ; consignes ; fiche
const bg0 = await page.$eval('.bxat', (e) => getComputedStyle(e).backgroundColor);
assert.equal(await page.locator('.bxrule').count(), 3);
assert.equal(await page.locator('.bxat svg').count(), 6);
await page.evaluate(async (k) => { const r = window.__app.repo; const { BX_ATELIERS } = await import('./js/ui/boxeView.js'); const st = r.getMeta(k) || { durationMin: 6, ateliers: BX_ATELIERS.slice(), rot: 0 }; st.clock = { base: 6 * 60000, startedAt: null }; await r.setMeta(k, st); (await import('./js/app.js')).render(); }, `bx:${ids.bx}`);
await page.click('.bxcenter >> text=Rotation suivante');
assert.equal(await page.locator('.bxat >> nth=1 >> .bxg').textContent(), 'A');
assert.equal(await page.$eval('.bxat', (e) => getComputedStyle(e).backgroundColor), bg0, 'l\'atelier garde sa couleur');
await page.click('.topbar .seg >> text=Fiche'); await page.waitForSelector('.bxfiche img');
assert.equal(await page.locator('.bxfiche img').count(), 2);
log('boxe : ateliers fixes (couleur, icône, consignes), lettres qui tournent, onglet Fiche');

// 8. Certificat de rôle (Handball : arbitre) : auto-évaluation, validation → badge argent
await go('arbitre', { from: 'classPage', classId: ids.c, scope: 'act', actId: ids.hb }); await page.waitForSelector('.argrid');
assert.equal(await page.locator('.arcard').count(), 6);
await page.click('.arcard >> nth=0');
await page.click('.dlg .arcrit >> nth=0 >> button:has-text("Oui")');
assert.equal(await page.locator('.dlg >> text=Ajouter cet avis').count(), 0, '1.13 : plus d\'avis des pairs');
await page.click('.dlg .field:has-text("je pense être") >> text=Arbitre de champ');
await page.click('.dlg .arlvbtn:has-text("Arbitre de champ")');
await page.click('.dlg-foot >> text=Enregistrer');
await page.waitForSelector('.arcard >> nth=0 >> .whistle.argent');
assert.match(await page.textContent('.arcard >> nth=0'), /Auto-évaluation faite/);
assert.match(await page.textContent('.arcard >> nth=1'), /Auto-évaluation à faire/);
log('certificat de rôle : niveaux du handball, auto-évaluation visible dans la liste, validation → badge argent');
await go('equipes', { from: 'classPage', classId: ids.c, scope: 'act', actId: ids.hb }); await page.waitForSelector('.topbar');
await page.evaluate(async (ids) => { const { newSet } = await import('./js/logic/teams.js'); const r = window.__app.repo; const c = r.get('classes', ids.c); const a = c.activities.find((x) => x.id === ids.hb); a.equipes ??= { sets: [] }; const s = newSet ? newSet({ name: 'Leçon 1', students: c.students.map((x) => x.id) }) : null; if (s) { a.equipes.sets.push(s); await r.save('classes', c); } (await import('./js/app.js')).go('equipes', { from: 'classPage', classId: ids.c, scope: 'act', actId: ids.hb, latest: 1 }); }, ids);
await page.waitForSelector('.schip');
assert.ok(await page.locator(`.schip[data-sid="${ids.s0}"] .whistle.argent`).count(), 'sifflet à côté du prénom dans Équipes');
log('sifflet d\'arbitre à côté du prénom dans les outils de l\'activité (Équipes)');

// 9. Test VMA (outil libre) : départ, palier, arrêt d'un élève, allures
await home(); await page.click('.toolbar .seg >> text=Outils'); await page.click('.tooltile.big:has-text("Test VMA")'); await page.waitForSelector('.vmpanel');
await page.click('.vmpanel >> text=Départ');
await page.waitForSelector('.vmpanel.run', { timeout: 6000 });
assert.match(await page.textContent('.vmpanel.run .vmlbl'), /Palier 1/);
assert.match(await page.textContent('.vmpanel.run .vmbig'), /8,5 km\/h/);
await page.click('text=Arrêt d\'un élève');
await page.waitForSelector('.vmresrow');
assert.match(await page.textContent('.vmresrow'), /palier 1.*8,5 km\/h/);
page.once('dialog', () => {});
await page.click('text=Arrêter le test'); await page.click('.dlg-foot >> text=Arrêter');
await page.click('.topbar .seg >> text=Allures'); await page.waitForSelector('.vmtab');
assert.equal(await page.locator('.vmtab tbody tr').count(), 6);
assert.match(await page.textContent('.vmtab tr.hl'), /200 m/); // 12 km/h, 100 %, 1 min
log('test VMA : départ (3 s), palier et vitesse, arrêt noté avec la VMA, tableau d\'allures');

// 10. Oublis : le nombre reste visible
await go('classPage', { id: ids.c }); await page.click('.seg >> text=Oublis'); await page.waitForSelector('.forgetrow');
for (let i = 0; i < 9; i++) await page.locator('.forgetrow >> nth=0 >> .fbtn.primaryish').click();
assert.equal((await page.textContent('.forgetrow >> nth=0 >> .fcount')).trim(), '9');
const fs = await page.$eval('.forgetrow .crosses', (e) => getComputedStyle(e).getPropertyValue('--xs').trim());
assert.equal(fs, '13px');
log('oublis : nombre toujours affiché, croix plus petites quand il y en a beaucoup');

// 11. Sauvegarde : un seul encadré
await go('settings', { tab: 'data' }); await page.waitForSelector('.bkstate');
assert.ok(await page.locator('.bkstate >> text=Sauvegarder maintenant').count());
assert.ok(await page.locator('details.bkdrive').count());
log('sauvegarde : un encadré (dernière sauvegarde, changements, gros bouton, restauration, Drive en option)');

// 12. Première ouverture d'un outil : 3 cartes, une seule fois
await page.evaluate(() => localStorage.removeItem('eps-skip-tour'));
await home(); await page.click('.toolbar .seg >> text=Outils'); await page.click('.tooltile.big:has-text("Chronomètre")');
await page.waitForSelector('.welcards');
assert.equal(await page.locator('.welcard').count(), 3);
await page.click('.dlg-foot >> text=C\'est parti');
await home(); await page.click('.toolbar .seg >> text=Outils'); await page.click('.tooltile.big:has-text("Chronomètre")');
await page.waitForTimeout(500);
assert.equal(await page.locator('.welcards').count(), 0);
log('première ouverture d\'un outil : 3 cartes d\'accueil, une seule fois');

assert.deepEqual(errors, []);
console.log('\nAucune erreur JavaScript.');
await browser.close();
