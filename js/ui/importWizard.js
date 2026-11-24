// Assistant d'import d'un tableau de compétences (CSV / XLSX exporté de Google Sheets).
import { app, registerView, go, render } from '../app.js';
import { h, btn, icon, iconBtn, toast, confirmDialog } from './dom.js';
import { fmt, parseNum, clone } from '../util.js';
import { SCHOOL_LEVELS, LEVELS, newModel } from '../data/schema.js';
import { parseCSV, decodeText } from '../import/csv.js';
import { readXlsx } from '../import/xlsx.js';
import { FIELDS, guessHeaderRow, guessMapping, buildCompetences } from '../import/mapper.js';
import { validateTable, rescaleTo20, setCompetenceMax, sumMax } from '../logic/model.js';

let IW = null;
const fresh = () => ({ step: 1, fileName: '', sheets: [], sheetIdx: 0, headerRow: 0, mapping: {}, comps: [], issues: [], target: { mode: 'new', modelId: '', name: '', activity: '', level: '6e' } });

registerView('import', () => {
  IW ??= fresh();
  const steps = ['Fichier', 'Colonnes', 'Aperçu et validation'];
  return h('div', { class: 'main' },
    h('div', { class: 'topbar' },
      iconBtn('back', 'Retour', () => { IW = null; go('settings', { tab: 'models' }); }),
      h('h1', { class: 'grow' }, 'Importer un tableau de compétences'),
      h('div', { class: 'seg' }, steps.map((s, i) => h('button', { class: IW.step === i + 1 ? 'on' : '', disabled: i + 1 > IW.step, style: { cursor: 'default' } }, `${i + 1}. ${s}`)))),
    h('div', { class: 'settings scroll', 'data-keep': 'import' }, IW.step === 1 ? step1() : IW.step === 2 ? step2() : step3()));
});

// ---- Étape 1 : fichier ----
function step1() {
  const sheet = IW.sheets[IW.sheetIdx];
  const input = h('input', { type: 'file', accept: '.csv,.txt,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', hidden: true, onChange: async (e) => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try {
      const buf = await f.arrayBuffer();
      if (/\.xlsx$/i.test(f.name)) IW.sheets = await readXlsx(buf);
      else if (/\.xls$/i.test(f.name)) throw new Error('Format .xls (ancien Excel) non pris en charge : enregistrez le fichier en .xlsx ou .csv depuis Google Sheets (Fichier › Télécharger).');
      else IW.sheets = [{ name: f.name, rows: parseCSV(decodeText(buf)) }];
      IW.fileName = f.name;
      IW.sheetIdx = Math.max(0, IW.sheets.findIndex((s) => s.rows.some((r) => r.some((c) => String(c).trim()))));
      selectSheet();
      IW.target.name = IW.target.name || f.name.replace(/\.[^.]+$/, '');
      render();
    } catch (err) { toast(err.message, { ms: 8000 }); }
  } });
  return [
    h('div', { class: 'panel' },
      h('p', { style: { marginTop: 0 } }, 'Dans Google Sheets : ', h('b', null, 'Fichier › Télécharger › Microsoft Excel (.xlsx)'), ' ou ', h('b', null, 'Valeurs séparées par des virgules (.csv)'), '. Puis choisissez le fichier ici.'),
      btn(IW.fileName ? 'Choisir un autre fichier' : 'Choisir un fichier…', { icon: 'upload', cls: 'primary', onClick: () => input.click() }), input),
    sheet ? h('div', { class: 'panel' },
      h('div', { class: 'row wrap' },
        h('b', null, IW.fileName),
        IW.sheets.length > 1 ? h('label', { class: 'field' }, 'Feuille', h('select', { value: IW.sheetIdx, onChange: (e) => { IW.sheetIdx = +e.target.value; selectSheet(); render(); } },
          IW.sheets.map((s, i) => h('option', { value: i }, s.name)))) : null,
        h('label', { class: 'field' }, 'Ligne des intitulés de colonnes',
          h('input', { type: 'number', min: 1, value: IW.headerRow + 1, style: { width: '110px' }, onChange: (e) => { IW.headerRow = Math.max(0, (+e.target.value || 1) - 1); IW.mapping = guessMapping(sheet.rows[IW.headerRow] || []); render(); } }))),
      previewTable(sheet.rows, IW.headerRow, 8),
      h('div', { class: 'row', style: { marginTop: '12px', justifyContent: 'flex-end' } }, btn('Suivant : colonnes', { icon: 'next', cls: 'primary', onClick: () => { IW.step = 2; render(); } }))) : null,
  ];
}

function selectSheet() {
  const sheet = IW.sheets[IW.sheetIdx];
  IW.headerRow = guessHeaderRow(sheet.rows);
  IW.mapping = guessMapping(sheet.rows[IW.headerRow] || []);
}

function previewTable(rows, headerRow, n) {
  const cols = Math.max(...rows.slice(0, headerRow + n + 1).map((r) => r.length), 1);
  return h('div', { style: { overflow: 'auto', maxHeight: '260px', marginTop: '10px', border: '1px solid var(--line)', borderRadius: '10px' } },
    h('table', { class: 'hist' }, h('tbody', null, rows.slice(0, headerRow + n + 1).map((r, i) =>
      h('tr', { style: i === headerRow ? { background: 'var(--accent-soft)', fontWeight: 700 } : i < headerRow ? { opacity: .5 } : null },
        h('td', { class: 'muted small' }, i + 1), Array.from({ length: cols }, (_, j) => h('td', { style: { maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, r[j] ?? '')))))));
}

// ---- Étape 2 : correspondance des colonnes ----
function step2() {
  const sheet = IW.sheets[IW.sheetIdx];
  const header = sheet.rows[IW.headerRow] || [];
  const colLabel = (i) => `Col. ${i + 1}${String(header[i] ?? '').trim() ? ' — ' + String(header[i]).trim().slice(0, 40) : ''}`;
  const ncols = Math.max(header.length, ...sheet.rows.slice(IW.headerRow, IW.headerRow + 6).map((r) => r.length));
  const ready = IW.mapping.name != null && IW.mapping.max != null;
  return [
    h('div', { class: 'panel' },
      h('p', { style: { marginTop: 0 } }, 'Indiquez à quelle colonne du fichier correspond chaque champ de l\'application. La proposition ci-dessous est automatique : corrigez-la si besoin.'),
      h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '10px' } }, FIELDS.map((f) =>
        h('label', { class: 'field' }, f.label + (f.required ? ' *' : ''),
          h('select', { value: IW.mapping[f.key] ?? '', onChange: (e) => { if (e.target.value === '') delete IW.mapping[f.key]; else IW.mapping[f.key] = +e.target.value; render(); } },
            h('option', { value: '' }, '— aucune —'), Array.from({ length: ncols }, (_, i) => h('option', { value: i }, colLabel(i)))))))),
    h('div', { class: 'panel' }, h('h3', null, 'Aperçu du fichier'), previewTable(sheet.rows, IW.headerRow, 6)),
    h('div', { class: 'row', style: { justifyContent: 'space-between' } },
      btn('Retour', { icon: 'back', onClick: () => { IW.step = 1; render(); } }),
      btn('Suivant : aperçu', { icon: 'next', cls: 'primary', disabled: !ready, title: ready ? '' : 'Associez au moins la compétence et le barème',
        onClick: () => { const r = buildCompetences(sheet.rows, IW.mapping, { headerRow: IW.headerRow }); IW.comps = r.competences; IW.issues = r.issues; IW.step = 3; render(); } })),
  ];
}

// ---- Étape 3 : aperçu, corrections, validation ----
function recheck() {
  const issues = [];
  IW.comps.forEach((c, i) => {
    const row = c.srcRow || i + 1;
    if (!String(c.name).trim()) issues.push({ row, field: 'name', message: 'Nom de compétence manquant.', blocking: true });
    if (!(Number(c.max) > 0)) issues.push({ row, field: 'max', message: 'Barème manquant ou invalide.', blocking: true });
    if (c.levels.every((l) => !l.text.trim()) && IW.mapping && ['na', 'ec', 'ac', 'de'].some((k) => IW.mapping[k] != null)) {
      issues.push({ row, field: 'levels', message: 'Aucun critère de réussite renseigné.', blocking: false });
    }
  });
  if (!IW.comps.length) issues.push({ row: 0, field: 'name', message: 'Aucune compétence à importer.', blocking: true });
  IW.issues = issues;
}

function step3() {
  recheck();
  const comps = IW.comps;
  const t = validateTable(comps);
  const T = IW.target;
  const models = app.repo.list('models');
  const blocking = IW.issues.filter((i) => i.blocking);
  const destOk = T.mode === 'existing' ? !!T.modelId : T.name.trim() && T.activity.trim();
  const canFinish = !blocking.length && t.ok && destOk;
  const has = (i, f) => IW.issues.some((x) => x.row === (comps[i].srcRow || i + 1) && x.field === f);

  const cellInput = (i, key, w, num) => h('input', { type: 'text', 'data-fid': `w-${i}-${key}`, value: num ? String(comps[i][key]).replace('.', ',') : comps[i][key] ?? '', style: { width: w, borderColor: has(i, key) ? 'var(--danger)' : '' }, 'aria-label': key,
    onChange: (e) => {
      if (num) { const v = parseNum(e.target.value); if (key === 'max') { if (v > 0) setCompetenceMax(comps[i], v); else comps[i].max = 0; } else comps[i][key] = v > 0 ? v : 1; }
      else comps[i][key] = e.target.value;
      render();
    } });
  const lvInput = (i, k) => h('textarea', { rows: 2, 'data-fid': `w-${i}-${k}`, style: { minWidth: '150px', minHeight: '56px' }, 'aria-label': 'critère ' + k, onChange: (e) => { comps[i].levels.find((l) => l.key === k).text = e.target.value; render(); } }, comps[i].levels.find((l) => l.key === k).text);

  return [
    h('div', { class: 'panel' },
      h('div', { class: `sumbar ${t.ok ? 'ok' : 'bad'}` }, icon(t.ok ? 'check' : 'close', 20),
        h('span', null, `Total des barèmes : ${fmt(t.sum)} / 20`, t.ok ? '' : t.diff > 0 ? ` — il manque ${fmt(t.diff)} point(s)` : ` — ${fmt(-t.diff)} point(s) en trop`)),
      !t.ok && comps.length ? h('div', { class: 'row', style: { marginTop: '8px' } },
        btn('Mettre à l\'échelle sur 20 automatiquement', { cls: 'soft', onClick: () => { rescaleTo20(comps); render(); } }),
        h('span', { class: 'muted small' }, 'Répartit les 20 points proportionnellement aux barèmes importés (modifiables ensuite).')) : null,
      blocking.length ? h('ul', { style: { margin: '10px 0 0', paddingLeft: '20px', color: '#8d2330' } }, blocking.map((i) => h('li', null, `Ligne ${i.row} : ${i.message}`))) : null,
      IW.issues.filter((i) => !i.blocking).length ? h('ul', { style: { margin: '8px 0 0', paddingLeft: '20px', color: '#8a5a00' } }, IW.issues.filter((i) => !i.blocking).map((i) => h('li', null, `Ligne ${i.row} : ${i.message}`))) : null),

    h('div', { class: 'panel' }, h('h3', null, 'Aperçu — modifiez directement les cases à corriger'),
      h('div', { style: { overflow: 'auto' } }, h('table', { class: 'edit' },
        h('thead', null, h('tr', null, ['', 'Compétence', 'AFC', 'Barème', 'Coef.', ...LEVELS.map((l) => l.label), ''].map((x) => h('th', null, x)))),
        h('tbody', null, comps.map((c, i) => h('tr', { class: IW.issues.some((x) => x.row === (c.srcRow || i + 1) && x.blocking) ? 'warnrow' : '' },
          h('td', { class: 'muted small' }, c.srcRow || i + 1),
          h('td', null, cellInput(i, 'name', '200px')), h('td', null, cellInput(i, 'afc', '110px')),
          h('td', null, cellInput(i, 'max', '70px', true)), h('td', null, cellInput(i, 'coef', '60px', true)),
          LEVELS.map((l) => h('td', null, lvInput(i, l.key))),
          h('td', null, iconBtn('trash', 'Ignorer cette ligne', () => { comps.splice(i, 1); render(); }, 'sm')))))))),

    h('div', { class: 'panel' }, h('h3', null, 'Destination'),
      h('div', { class: 'row wrap' },
        h('div', { class: 'seg' }, [['new', 'Nouveau modèle'], ['existing', 'Ajouter à un modèle existant']].map(([k, l]) =>
          h('button', { class: T.mode === k ? 'on' : '', onClick: () => { T.mode = k; render(); } }, l))),
        h('label', { class: 'field' }, 'Niveau scolaire', h('select', { value: T.level, onChange: (e) => { T.level = e.target.value; } }, SCHOOL_LEVELS.map((l) => h('option', { value: l }, l))))),
      T.mode === 'new'
        ? h('div', { class: 'row wrap', style: { marginTop: '10px' } },
          h('label', { class: 'field', style: { flex: '1 1 240px' } }, 'Nom du modèle', h('input', { type: 'text', value: T.name, onInput: (e) => { T.name = e.target.value; refreshFinish(); } })),
          h('label', { class: 'field', style: { flex: '1 1 240px' } }, 'Activité sportive', h('input', { type: 'text', value: T.activity, onInput: (e) => { T.activity = e.target.value; refreshFinish(); } })))
        : h('label', { class: 'field', style: { marginTop: '10px', maxWidth: '480px' } }, 'Modèle',
          h('select', { value: T.modelId, onChange: (e) => { T.modelId = e.target.value; refreshFinish(); } }, h('option', { value: '' }, '— choisir —'),
            models.map((m) => h('option', { value: m.id }, `${m.activity} — ${m.name}`))))),

    h('div', { class: 'row', style: { justifyContent: 'space-between' } },
      btn('Retour', { icon: 'back', onClick: () => { IW.step = 2; render(); } }),
      (() => { const b = btn('Importer le modèle', { icon: 'check', cls: 'primary', disabled: !canFinish, onClick: finish }); b.id = 'iw-finish'; return b; })()),
  ];
}

function refreshFinish() {
  const b = document.getElementById('iw-finish');
  if (!b) return;
  const T = IW.target;
  const destOk = T.mode === 'existing' ? !!T.modelId : T.name.trim() && T.activity.trim();
  b.disabled = !(destOk && validateTable(IW.comps).ok && !IW.issues.some((i) => i.blocking));
}

async function finish() {
  const T = IW.target;
  const comps = clone(IW.comps);
  comps.forEach((c) => delete c.srcRow);
  let model;
  if (T.mode === 'existing') {
    const m = app.repo.get('models', T.modelId);
    if (m.levels[T.level]?.competences.length && !(await confirmDialog(`Le niveau ${T.level} de « ${m.name} » contient déjà un tableau. Le remplacer ?`, 'Remplacer'))) return;
    model = clone(m);
  } else {
    model = newModel();
    model.name = T.name.trim();
    model.activity = T.activity.trim();
  }
  model.levels[T.level] = { competences: comps };
  await app.repo.save('models', model);
  IW = null;
  toast(`Modèle « ${model.name} » importé (${comps.length} compétences, niveau ${T.level}).`, { ms: 5000 });
  go('settings', { tab: 'models' });
}
