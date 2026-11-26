// Éditeur de modèle d'évaluation : compétences, barèmes (somme = 20), niveaux de réussite.
import { app, registerView, go, render } from '../app.js';
import { h, btn, icon, iconBtn, toast, confirmDialog } from './dom.js';
import { clone, uid, parseNum, fmt, now } from '../util.js';
import { SCHOOL_LEVELS, LEVELS, newModel, newCompetence } from '../data/schema.js';
import { validateTable, validateModel, setCompetenceMax, applyCoefficients, sumMax } from '../logic/model.js';

let ME = null; // { key, model, active, open:Set, dirty }

function start(id) {
  const existing = id ? app.repo.get('models', id) : null;
  const model = existing ? clone(existing) : newModel();
  const levels = SCHOOL_LEVELS.filter((l) => model.levels[l]);
  ME = { key: id ?? 'new', model, active: levels[0] || null, open: new Set(), dirty: !existing, step: (app.repo.getMeta('settings', {}) || {}).step || 0.5 };
}

export function openModelDraft(model, level) {
  ME = { key: 'draft-' + model.id, model, active: level, open: new Set(), dirty: true, step: 0.5 };
  go('modelEdit', { id: 'draft-' + model.id });
}

registerView('modelEdit', ({ id }) => {
  if (!ME || ME.key !== (id ?? 'new')) start(id);
  const m = ME.model;
  const v = validateModel(m);
  const levelsOn = SCHOOL_LEVELS.filter((l) => m.levels[l]);
  if (!levelsOn.includes(ME.active)) ME.active = levelsOn[0] || null;

  const save = btn('Enregistrer', { icon: 'check', cls: 'primary', disabled: !v.ok, onClick: async () => {
    const cur = validateModel(ME.model);
    if (!cur.ok) return toast(cur.errors[0]);
    const rec = clone(ME.model);
    for (const lv of Object.values(rec.levels)) for (const c of lv.competences) delete c.srcRow;
    rec.name = rec.name.trim(); rec.activity = rec.activity.trim();
    await app.repo.save('models', rec);
    ME = null;
    toast(`Modèle « ${rec.name} » enregistré.`, { ms: 2500 });
    go('settings', { tab: 'models' });
  } });
  save.id = 'm-save';

  const leave = async () => {
    if (ME.dirty && !(await confirmDialog('Abandonner les modifications de ce modèle ?', 'Abandonner'))) return;
    ME = null;
    go('settings', { tab: 'models' });
  };

  return h('div', { class: 'main' },
    h('div', { class: 'topbar' },
      iconBtn('back', 'Retour', leave, '', { 'data-back': '1' }),
      h('h1', { class: 'grow' }, app.repo.get('models', ME.model.id) ? 'Modifier le modèle' : 'Nouveau modèle'),
      btn('Annuler', { onClick: leave }), save),
    h('div', { class: 'settings scroll', 'data-keep': 'modeledit' },
      h('div', { class: 'panel' },
        h('div', { class: 'row wrap' },
          h('label', { class: 'field', style: { flex: '1 1 260px' } }, 'Nom du modèle',
            h('input', { type: 'text', 'data-fid': 'm-name', value: m.name, placeholder: 'ex. Badminton – cycle 3', onInput: (e) => { m.name = e.target.value; ME.dirty = true; refreshSave(); } })),
          h('label', { class: 'field', style: { flex: '1 1 260px' } }, 'Activité sportive',
            h('input', { type: 'text', 'data-fid': 'm-act', value: m.activity, placeholder: 'ex. Badminton', onInput: (e) => { m.activity = e.target.value; ME.dirty = true; refreshSave(); } }))),
        h('div', { style: { marginTop: '12px' } }, h('div', { class: 'muted small', style: { marginBottom: '6px', fontWeight: 600 } }, 'Niveaux scolaires (chacun a son propre tableau de compétences)'),
          h('div', { class: 'chips' }, SCHOOL_LEVELS.map((l) => h('button', { type: 'button', class: `chip ${m.levels[l] ? 'on' : ''}`, onClick: () => toggleLevel(l) }, l))))),
      levelsOn.length ? levelPanel(levelsOn) : h('div', { class: 'panel muted' }, 'Choisissez au moins un niveau scolaire pour définir les compétences.'),
      v.ok ? null : h('div', { class: 'panel', id: 'm-errors', style: { background: '#fff7e0' } }, h('b', null, 'À corriger avant d\'enregistrer'), h('ul', { style: { margin: '6px 0 0', paddingLeft: '20px' } }, v.errors.map((e) => h('li', null, e))))));
});

function refreshSave() {
  const b = document.getElementById('m-save');
  if (b) b.disabled = !validateModel(ME.model).ok;
}

async function toggleLevel(l) {
  const m = ME.model;
  if (m.levels[l]) {
    if (m.levels[l].competences.length && !(await confirmDialog(`Supprimer le tableau de compétences du niveau ${l} ?`, 'Supprimer'))) return;
    delete m.levels[l];
    if (ME.active === l) ME.active = SCHOOL_LEVELS.find((x) => m.levels[x]) || null;
  } else {
    m.levels[l] = { competences: [] };
    ME.active = l;
  }
  ME.dirty = true;
  render();
}

function levelPanel(levelsOn) {
  const m = ME.model;
  const lv = ME.active;
  const comps = m.levels[lv].competences;
  const step = ME.step;
  const t = validateTable(comps);

  const sumbar = h('div', { class: `sumbar ${t.ok ? 'ok' : 'bad'}`, id: 'm-sum' });
  const paintSum = (sum) => {
    const diff = Math.round((20 - sum) * 1e4) / 1e4;
    sumbar.className = `sumbar ${Math.abs(diff) < 1e-6 && comps.length ? 'ok' : 'bad'}`;
    sumbar.replaceChildren(icon(Math.abs(diff) < 1e-6 && comps.length ? 'check' : 'close', 20),
      h('span', null, `Total des barèmes : ${fmt(sum)} / 20`,
        Math.abs(diff) < 1e-6 ? '' : diff > 0 ? ` — il manque ${fmt(diff)} point(s)` : ` — ${fmt(-diff)} point(s) en trop`));
  };
  paintSum(t.sum);
  const liveSum = () => {
    let s = 0;
    document.querySelectorAll('input[data-max]').forEach((i) => { const v = parseNum(i.value); if (v > 0) s += v; });
    paintSum(Math.round(s * 1e4) / 1e4);
  };

  const rows = comps.flatMap((c, i) => {
    const row = h('tr', null,
      h('td', { style: { whiteSpace: 'nowrap' } },
        iconBtn('up', 'Monter', () => move(comps, i, -1), 'sm', { disabled: i === 0 }),
        iconBtn('down', 'Descendre', () => move(comps, i, 1), 'sm', { disabled: i === comps.length - 1 })),
      h('td', null, h('input', { type: 'text', 'data-fid': 'n-' + c.id, value: c.name, placeholder: 'Nom de la compétence', 'aria-label': 'Nom', onInput: (e) => { c.name = e.target.value; ME.dirty = true; } , onChange: refreshSave })),
      h('td', null, h('input', { type: 'text', 'data-fid': 'a-' + c.id, value: c.afc, placeholder: 'Ex. AFC 1.2', 'aria-label': 'AFC', onInput: (e) => { c.afc = e.target.value; ME.dirty = true; } })),
      h('td', null, h('input', { type: 'text', class: 'num', inputmode: 'decimal', 'data-max': '1', 'data-fid': 'x-' + c.id, value: String(c.max).replace('.', ','), 'aria-label': 'Barème',
        onInput: liveSum,
        onChange: (e) => { const v = parseNum(e.target.value); if (v > 0) { setCompetenceMax(c, Math.round(v / step) * step, step); ME.dirty = true; } render(); } })),
      h('td', null, h('input', { type: 'text', class: 'num', inputmode: 'decimal', 'data-fid': 'k-' + c.id, value: String(c.coef ?? 1).replace('.', ','), 'aria-label': 'Coefficient', title: 'Sert uniquement à répartir les 20 points (bouton « Répartir selon les coefficients »)',
        onChange: (e) => { const v = parseNum(e.target.value); c.coef = v > 0 ? v : 1; ME.dirty = true; e.target.value = String(c.coef).replace('.', ','); } })),
      h('td', { style: { whiteSpace: 'nowrap' } },
        btn(ME.open.has(c.id) ? 'Niveaux ▲' : 'Niveaux ▼', { cls: 'small soft', onClick: () => { ME.open.has(c.id) ? ME.open.delete(c.id) : ME.open.add(c.id); render(); } }),
        iconBtn('trash', 'Supprimer la compétence', () => { comps.splice(i, 1); ME.dirty = true; render(); }, 'sm')));
    if (!ME.open.has(c.id)) return [row];
    const det = h('tr', null, h('td', { colspan: 6 }, levelsEditor(c)));
    return [row, det];
  });

  return h('div', { class: 'panel' },
    h('div', { class: 'row wrap', style: { marginBottom: '10px' } },
      h('div', { class: 'seg' }, levelsOn.map((l) => h('button', { class: l === lv ? 'on' : '', onClick: () => { ME.active = l; render(); } },
        l, validateTable(m.levels[l].competences).ok ? '' : ' ⚠'))),
      h('div', { class: 'grow' }),
      levelsOn.length > 1 ? h('select', { 'aria-label': 'Copier un tableau', value: '', onChange: (e) => {
        const src = e.target.value; if (!src) return;
        m.levels[lv].competences = clone(m.levels[src].competences).map((c) => ({ ...c, id: uid() }));
        ME.dirty = true; render();
      } }, h('option', { value: '' }, 'Copier le tableau depuis…'), levelsOn.filter((x) => x !== lv && m.levels[x].competences.length).map((x) => h('option', { value: x }, x))) : null),
    sumbar,
    comps.length ? h('div', { style: { overflow: 'auto', marginTop: '8px' } }, h('table', { class: 'edit' },
      h('thead', null, h('tr', null, h('th'), h('th', null, 'Compétence'), h('th', null, 'AFC / référence'), h('th', null, 'Barème'), h('th', null, 'Coef.'), h('th'))),
      h('tbody', null, rows))) : h('p', { class: 'muted' }, `Aucune compétence pour le niveau ${lv}.`),
    h('div', { class: 'row wrap', style: { marginTop: '10px' } },
      btn('Ajouter une compétence', { icon: 'plus', cls: 'soft', onClick: () => { const c = newCompetence(Math.max(0.5, Math.min(5, 20 - sumMax(comps) || 5)), step); comps.push(c); ME.open.clear(); ME.open.add(c.id); ME.dirty = true; render(); } }),
      btn('Répartir selon les coefficients', { disabled: !comps.length, title: 'Redistribue les 20 points proportionnellement aux coefficients', onClick: () => { applyCoefficients(comps, step); ME.dirty = true; render(); } }),
      h('span', { class: 'muted small' }, 'La somme des barèmes doit valoir exactement 20.')));
}

function move(arr, i, d) {
  const j = i + d;
  if (j < 0 || j >= arr.length) return;
  [arr[i], arr[j]] = [arr[j], arr[i]];
  ME.dirty = true;
  render();
}

function levelsEditor(c) {
  // « En cours » : note maximale et note proposée = toujours la moitié du barème (non modifiables)
  const num = (l, key) => h('input', { type: 'text', class: 'num', inputmode: 'decimal', 'data-fid': `l-${c.id}-${l.key}-${key}`, value: String(l[key]).replace('.', ','), 'aria-label': `${key} ${l.key}`,
    readOnly: l.key === 'ec' && key !== 'min', title: l.key === 'ec' && key !== 'min' ? 'Fixé à la moitié du barème' : '',
    onChange: (e) => { const v = parseNum(e.target.value); if (!Number.isNaN(v)) { l[key] = Math.min(c.max, Math.max(0, Math.round(v / ME.step) * ME.step)); ME.dirty = true; } render(); } });
  return h('div', { class: 'lvedit' },
    h('div'), h('div', { class: 'h' }, 'Critères observés / attendus'), h('div', { class: 'h' }, 'Note min'), h('div', { class: 'h' }, 'Note max'), h('div', { class: 'h' }, 'Note proposée'),
    LEVELS.map((lv) => {
      const l = c.levels.find((x) => x.key === lv.key);
      return [
        h('span', { class: `lvchip ${lv.key}` }, `${lv.symbol} ${lv.label}`),
        h('textarea', { rows: 2, 'data-fid': `t-${c.id}-${lv.key}`, 'aria-label': `Critères ${lv.label}`, placeholder: 'Texte descriptif…', onInput: (e) => { l.text = e.target.value; ME.dirty = true; } }, l.text || ''),
        num(l, 'min'), num(l, 'max'), num(l, 'value'),
      ];
    }),
    h('div', { style: { gridColumn: '1 / -1' }, class: 'muted small' }, 'La note proposée est celle appliquée quand on choisit ce niveau (modifiable ensuite à la main). « En cours » est toujours calé sur la moitié du barème ; « Dépassé » = barème maximal.'));
}
