// Éditeur de groupe classe : nom, niveau, couleur, élèves (sauvegarde automatique).
import { app, registerView, go, render } from '../app.js';
import { h, btn, iconBtn, toast, confirmDialog, openDialog } from './dom.js';
import { collator, now } from '../util.js';
import { SCHOOL_LEVELS, CLASS_COLORS, newClass, newStudent, studentLabel } from '../data/schema.js';

let CE = null; // { cls }

registerView('classEdit', ({ id }) => {
  if (!CE || CE.key !== (id ?? 'new')) {
    let cls = id ? app.repo.get('classes', id) : null;
    if (!cls) {
      cls = newClass('', '6e', CLASS_COLORS[app.repo.list('classes').length % CLASS_COLORS.length]);
      cls._fresh = true;
    }
    CE = { key: id ?? 'new', cls };
  }
  const c = CE.cls;
  const persist = async () => {
    delete c._fresh;
    await app.repo.save('classes', c);
  };
  const exists = !c._fresh;
  const active = c.students.filter((s) => s.active !== false);
  const left = c.students.filter((s) => s.active === false);

  // prénoms identiques sans initiale : à signaler
  const dupKey = (s) => s.first.trim().toLowerCase();
  const counts = {};
  active.forEach((s) => { counts[dupKey(s)] = (counts[dupKey(s)] || 0) + 1; });
  const needsInitial = (s) => counts[dupKey(s)] > 1 && !s.initial;

  const firstInput = h('input', { type: 'text', 'data-fid': 'add-first', 'data-draft': '1', placeholder: 'Prénom', 'aria-label': 'Prénom du nouvel élève', style: { flex: 1, minWidth: '160px' }, autofocus: !!(CE.focusAdd) });
  const initInput = h('input', { type: 'text', 'data-fid': 'add-init', 'data-draft': '1', placeholder: 'Initiale', 'aria-label': 'Initiale du nom', maxlength: 1, style: { width: '90px' } });
  const addNow = async () => {
    const first = firstInput.value.trim();
    if (!first) return firstInput.focus();
    if (!c.name.trim()) { toast('Donnez d\'abord un nom à la classe.'); return; }
    c.students.push(newStudent(first, initInput.value.trim().slice(0, 1)));
    for (const i of [firstInput, initInput]) { i.value = ''; delete i.dataset.dirty; } // saisie validée : ne pas la reporter
    await persist();
    CE.focusAdd = true;
    render();
    setTimeout(() => document.querySelector('[aria-label="Prénom du nouvel élève"]')?.focus(), 30);
  };
  firstInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); initInput.focus(); } });
  initInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addNow(); } });

  const studentRow = (s) => {
    const i = c.students.indexOf(s);
    return h('div', { class: `listrow ${needsInitial(s) ? 'warnrow' : ''}` },
      h('span', { class: 'muted small', style: { width: '26px', textAlign: 'right' } }, active.indexOf(s) + 1),
      h('input', { type: 'text', 'data-fid': 'f-' + s.id, value: s.first, 'aria-label': 'Prénom', style: { flex: 1, minWidth: '120px' }, onChange: async (e) => { s.first = e.target.value.trim() || s.first; await persist(); render(); } }),
      h('input', { type: 'text', 'data-fid': 'i-' + s.id, value: s.initial || '', 'aria-label': 'Initiale du nom', maxlength: 1, placeholder: needsInitial(s) ? 'requise' : '', style: { width: '90px', textAlign: 'center', textTransform: 'uppercase' },
        onChange: async (e) => { s.initial = e.target.value.trim().slice(0, 1); await persist(); render(); } }),
      iconBtn('up', 'Monter', () => moveStudent(s, -1), 'sm'),
      iconBtn('down', 'Descendre', () => moveStudent(s, 1), 'sm'),
      iconBtn('trash', 'L\'élève quitte la classe', () => removeStudent(s), 'sm'));
  };

  const moveStudent = async (s, d) => {
    const act = c.students.filter((x) => x.active !== false);
    const a = act.indexOf(s), b = a + d;
    if (b < 0 || b >= act.length) return;
    const ia = c.students.indexOf(act[a]), ib = c.students.indexOf(act[b]);
    [c.students[ia], c.students[ib]] = [c.students[ib], c.students[ia]];
    await persist(); render();
  };

  const removeStudent = async (s) => {
    const used = app.repo.list('evaluations').some((e) => e.students.some((x) => x.id === s.id));
    if (used) { s.active = false; s.leftAt = now(); }
    else c.students.splice(c.students.indexOf(s), 1);
    await persist(); render();
    toast(used ? `${s.first} a quitté la classe (ses résultats sont conservés).` : `${s.first} supprimé(e).`, {
      action: 'Annuler', ms: 7000,
      onAction: async () => { if (used) { s.active = true; delete s.leftAt; } else c.students.push(s); await persist(); render(); } });
  };

  return h('div', { class: 'main' },
    h('div', { class: 'topbar' },
      iconBtn('back', 'Retour', () => { CE = null; go('settings', { tab: 'classes' }); }),
      h('h1', { class: 'grow' }, exists ? c.name || 'Classe' : 'Nouvelle classe'),
      h('span', { class: 'muted small' }, exists ? 'Enregistré automatiquement' : ''),
      btn('Terminer', { icon: 'check', cls: 'primary', onClick: () => { CE = null; go('settings', { tab: 'classes' }); } })),
    h('div', { class: 'settings scroll', 'data-keep': 'classedit' },
      h('div', { class: 'panel' },
        h('div', { class: 'row wrap' },
          h('label', { class: 'field', style: { flex: '1 1 200px' } }, 'Nom de la classe',
            h('input', { type: 'text', 'data-fid': 'c-name', value: c.name, placeholder: 'ex. 6e A', autofocus: !exists, onChange: async (e) => { c.name = e.target.value.trim(); if (c.name) await persist(); render(); } })),
          h('label', { class: 'field' }, 'Niveau scolaire',
            h('select', { value: c.level, onChange: async (e) => { c.level = e.target.value; if (c.name) await persist(); render(); } }, SCHOOL_LEVELS.map((l) => h('option', { value: l }, l)))),
          h('label', { class: 'field' }, 'Année scolaire',
            h('input', { type: 'text', 'data-fid': 'c-year', value: c.year || '', style: { width: '130px' }, onChange: async (e) => { c.year = e.target.value.trim(); if (c.name) await persist(); } }))),
        h('div', { style: { marginTop: '12px' } }, h('div', { class: 'muted small', style: { fontWeight: 600, marginBottom: '6px' } }, 'Couleur'),
          h('div', { class: 'swatches' }, CLASS_COLORS.map((col) => h('button', { type: 'button', class: `swatch ${c.color === col ? 'on' : ''}`, style: { background: col }, 'aria-label': 'Couleur ' + col,
            onClick: async () => { c.color = col; if (c.name) await persist(); render(); } })),
          h('input', { type: 'color', value: c.color, 'aria-label': 'Couleur personnalisée', style: { width: '44px', height: '44px', padding: 0, border: 0, background: 'none' },
            onChange: async (e) => { c.color = e.target.value; if (c.name) await persist(); render(); } })))),

      h('div', { class: 'panel' }, h('h3', null, `Élèves (${active.length})`),
        h('div', { class: 'row wrap', style: { marginBottom: '8px' } }, firstInput, initInput,
          btn('Ajouter', { icon: 'plus', cls: 'primary', onClick: addNow }),
          btn('Coller une liste…', { onClick: () => pasteDialog(c, persist) })),
        h('p', { class: 'muted small', style: { margin: '0 0 6px' } }, 'Entrée valide le prénom, puis l\'initiale ajoute l\'élève. L\'initiale n\'est utile que pour distinguer deux élèves de même prénom. Un élève ajouté en cours d\'année est disponible dans les nouvelles évaluations seulement.'),
        active.length ? active.map(studentRow) : h('p', { class: 'muted' }, 'Aucun élève pour l\'instant.'),
        active.some(needsInitial) ? h('p', { class: 'small', style: { color: '#8a5a00' } }, 'Plusieurs élèves ont le même prénom : renseignez l\'initiale de leur nom pour les distinguer.') : null),

      left.length ? h('div', { class: 'panel' }, h('h3', null, 'Anciens élèves (historique conservé)'),
        left.map((s) => h('div', { class: 'listrow' }, h('span', { class: 'grow' }, studentLabel(s)),
          btn('Réintégrer', { cls: 'small', onClick: async () => { s.active = true; delete s.leftAt; await persist(); render(); } })))) : null));
});

function pasteDialog(c, persist) {
  let text = '';
  openDialog({
    title: 'Coller une liste d\'élèves',
    body: [h('p', { class: 'dlg-msg' }, 'Un élève par ligne. Pour distinguer deux élèves de même prénom, ajoutez l\'initiale après le prénom : « Léa M ».'),
      h('textarea', { rows: 10, placeholder: 'Léa M\nLéa D\nTom\nInès', autofocus: true, onInput: (e) => { text = e.target.value; } })],
    actions: [{ label: 'Annuler' }, { label: 'Ajouter', primary: true, onClick: async () => {
      if (!c.name.trim()) { toast('Donnez d\'abord un nom à la classe.'); return false; }
      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      for (const l of lines) {
        const m = /^(.*\S)\s+([A-Za-zÀ-ÿ])\.?$/.exec(l);
        c.students.push(m ? newStudent(m[1].trim(), m[2].toUpperCase()) : newStudent(l, ''));
      }
      await persist();
      toast(`${lines.length} élève(s) ajouté(s).`);
      render();
    } }],
  });
}
