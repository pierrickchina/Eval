// Aides de navigation communes aux tests e2e (v1.5) : accueil (tuiles de classes) → carnet de bord → évaluations.
export async function openClass(page, idx = 0) { // idx : numéro de tuile ou texte (ex. « 6e B »)
  await page.waitForSelector('.home-grid .card');
  await (typeof idx === 'string' ? page.locator('.home-grid .card', { hasText: idx }).first() : page.locator('.home-grid .card').nth(idx)).click();
  await page.waitForSelector('[aria-label="Options de la classe"]');
}
/** Dans le carnet de bord : crée l'activité si elle n'existe pas encore. */
export async function ensureActivity(page, name) {
  await page.waitForSelector('.toolbar >> text=Nouvelle activité');
  if (await page.locator('.actframe', { hasText: name }).count()) return;
  await page.locator('.toolbar >> text=Nouvelle activité').click();
  await page.fill('.dlg input[type=text]', name);
  await page.click('.dlg-foot >> text=Créer');
  await page.waitForSelector(`.actframe:has-text("${name}")`);
}
/** Dans le carnet de bord : crée une évaluation via le « + » du cadre de l'activité. */
export async function addEvaluationVia(page, activity = null, { title = null, modelText = null } = {}) {
  const frame = activity ? page.locator('.actframe', { hasText: activity }).first() : page.locator('.actframe').first();
  await frame.locator('[aria-label="Ajouter un outil"]').click();
  await page.click('.addgrid >> text=Nouvelle évaluation');
  await page.waitForSelector('.dlg select');
  if (modelText) await page.locator('.dlg select').nth(1).selectOption({ label: modelText });
  if (title) await page.fill('.dlg input[type=text]', title);
  await page.click('.dlg-foot >> text=Créer');
  await page.waitForSelector('table.grid');
}
/** Depuis l'accueil : ouvre la classe, crée l'activité si besoin, puis une évaluation. */
export async function newEvaluation(page, { cls = 0, activity = null, modelText = null, title = null } = {}) {
  await openClass(page, cls);
  if (activity) await ensureActivity(page, activity);
  await addEvaluationVia(page, activity, { title, modelText });
}
/** Dans le carnet de bord : déplie la liste d'évaluations de l'activité (utile à partir de 2 évaluations). */
export async function openEvalList(page, activity = null) {
  const frame = activity ? page.locator('.actframe', { hasText: activity }).first() : page.locator('.actframe').first();
  if (!(await frame.locator('.evlist').count())) await frame.locator('.tooltile').first().click();
  await frame.locator('.evlist').waitFor();
  return frame;
}
/** Depuis l'accueil : ouvre une évaluation de la classe (ouverture directe s'il n'y en a qu'une). */
export async function openFirstEval(page, { cls = 0, activity = null, nth = 0 } = {}) {
  await openClass(page, cls);
  const frame = activity ? page.locator('.actframe', { hasText: activity }).first() : page.locator('.actframe').first();
  const single = /1 évaluation/.test(await frame.locator('.tooltile').first().textContent());
  if (single) await frame.locator('.tooltile').first().click();
  else { await openEvalList(page, activity); await frame.locator('.evrow').nth(nth).click(); }
  await page.waitForSelector('table.grid');
}
/** Remonte avec « Retour » jusqu'à l'accueil (qui est le seul écran avec le bouton Réglages et les onglets Classes/Outils). */
export async function goHome(page) {
  for (let i = 0; i < 4; i++) {
    if (await page.locator('.topbar >> text=Réglages').count() && await page.locator('.seg >> text=Outils').count()) return;
    await page.click('[aria-label="Retour"]');
    await page.waitForTimeout(120);
  }
}
