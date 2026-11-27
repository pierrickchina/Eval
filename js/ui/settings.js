// Réglages : modèles, classes, général (trimestres, notation, auto-évaluation, affichage, application), sauvegarde (+ Drive).
import { displayPanel, demoPanel, importModelButton, shareModel } from './foundations.js';
import { app, registerView, go, render, syncChip, updateSyncChips } from '../app.js';
import { h, btn, icon, iconBtn, openDialog, popMenu, toast, confirmDialog, download } from './dom.js';
import { collator, uid, clone, fmtDate, now, nextSchoolYear } from '../util.js';
import { SCHOOL_LEVELS, defaultLevels } from '../data/schema.js';
import { installLibrary, originalOf } from '../data/library.js';
import { allPresets, savePreset, removePreset, norm } from './presets.js';
import { kivaouSettingsDialog } from './kivaouView.js';
import { mkSettingsDialog } from './mkView.js';
import { KV_DEFAULT } from '../logic/kivaou.js';
import { newMK } from '../logic/mariokart.js';
import { CT_PRESETS, CT_DEFAULT, CT_LIMITS, totalOf as ctTotal } from '../logic/intervals.js';
import { SPORTS } from '../logic/tournament.js';
import { shareBackup, downloadBackup, backupText, changesSinceBackup, makeSafetyCopy, safetyInfo, restoreSafetyCopy } from './backup.js';
import { DEFAULT_CODE } from './selfEval.js';
import { getTrimesters, defaultTrimesters } from '../logic/classes.js';
import { schoolYear } from '../util.js';
import { validateModel } from '../logic/model.js';

const TABS = [['models', 'Modèles'], ['classes', 'Classes'], ['presets', 'Préréglages équipe EPS'], ['general', 'Général'], ['data', 'Sauvegarde']];

registerView('settings', ({ tab = 'models' }) => {
  const body = tab === 'models' ? modelsTab() : tab === 'classes' ? classesTab() : tab === 'presets' ? presetsTab() : dataTab(tab);
  return h('div', { class: 'main' },
    h('div', { class: 'topbar' },
      iconBtn('back', 'Retour', () => go('home'), '', { 'data-back': '1' }),
      h('h1', { class: 'grow' }, 'Réglages'),
      syncChip()),
    h('div', { class: 'toolbar' }, h('div', { class: 'seg' }, TABS.map(([k, l]) =>
      h('button', { class: tab === k ? 'on' : '', onClick: () => go('settings', { tab: k }) }, l)))),
    h('div', { class: 'settings scroll', 'data-keep': 'settings-' + tab }, body));
});

async function softDelete(store, rec, label) {
  await app.repo.remove(store, rec.id);
  render();
  toast(`${label} supprimé(e).`, { action: 'Annuler', ms: 9000, onAction: async () => { await app.repo.restore(store, rec.id); render(); } });
}

// ---------- Préréglages de l'équipe EPS ----------

const PRESET_TOOLS = { kivaou: 'Kivaou', mariokart: 'Mario Kart', circuit: 'Circuit training', tournoi: 'Tournoi' };
function presetSummary(tool, p) {
  if (tool === 'kivaou') return `${p.maxMin} min max · malus ${p.malusMin} min · ${p.courses.map((c) => `${c.name} (${c.balises})`).join(', ')}${p.grouped ? ' · départ groupé' : ''}`;
  if (tool === 'mariokart') { const filled = Object.values(p.objectives || {}).flatMap((x) => Object.values(x)).filter((x) => x != null).length; return `${(p.version || 'v1').toUpperCase()} · ${p.durationMin} min · ${p.bonus?.length || 0} bonus · ${filled ? `${filled} objectif(s) rempli(s)` : 'objectifs à remplir'}`; }
  if (tool === 'circuit') return `${p.work} s / ${p.rest} s · ${p.stations} exercices × ${p.rounds} tour(s)`;
  if (tool === 'tournoi') return `${SPORTS[p.sport]?.label || p.sport} · ${p.halves === 2 ? `2 × ${p.halfMin}` : p.halfMin} min · ${p.courts} terrain(s) · ${p.format === 'double' ? 'aller-retour' : 'tous contre tous'}`;
  return '';
}
function editPreset(label, tool) {
  const cur = (allPresets()[norm(label)] || {})[tool];
  const done = async (S) => { await savePreset(label, tool, S); render(); };
  if (tool === 'kivaou') return kivaouSettingsDialog(cur || KV_DEFAULT, done, label, { presetOnly: true });
  if (tool === 'mariokart') return mkSettingsDialog(cur || newMK(), (S) => done({ version: S.version, durationMin: S.durationMin, bonus: S.bonus, objectives: S.objectives }), label, { presetOnly: true });
  if (tool === 'circuit') return ctPresetDialog(label, cur || CT_DEFAULT, done);
  toast('Le préréglage Tournoi s\'enregistre depuis un tournoi : ⋮ › « Enregistrer comme préréglage de l\'équipe EPS ».', { ms: 5000 });
}
function ctPresetDialog(label, initial, done) {
  const S = { work: initial.work, rest: initial.rest, stations: initial.stations, rounds: initial.rounds, roundRest: initial.roundRest || 0, prep: initial.prep ?? 5 };
  const body = h('div', { class: 'dlg-body kvdlg' });
  const step = (k, lab, unit) => { const [lo, hi, st] = CT_LIMITS[k]; return h('div', { class: 'ctrow' }, h('span', { class: 'ctl' }, lab), h('div', { class: 'stepper' },
    h('button', { type: 'button', 'aria-label': 'Moins', disabled: S[k] <= lo, onClick: () => { S[k] = Math.max(lo, S[k] - st); paint(); } }, icon('minus', 18)), h('output', null, `${S[k]}${unit}`),
    h('button', { type: 'button', 'aria-label': 'Plus', disabled: S[k] >= hi, onClick: () => { S[k] = Math.min(hi, S[k] + st); paint(); } }, icon('plus', 18))), h('span')); };
  const paint = () => body.replaceChildren(
    h('div', { class: 'field' }, 'Partir d\'un préréglage', h('div', { class: 'seg wrap' }, CT_PRESETS.map((p) => h('button', { type: 'button', onClick: () => { Object.assign(S, p.cfg); paint(); } }, p.label)))),
    step('work', 'Travail', ' s'), step('rest', 'Récupération', ' s'), step('stations', 'Exercices', ''), step('rounds', 'Tours', ''), step('roundRest', 'Récup. entre tours', ' s'),
    h('p', { class: 'muted small' }, `Durée : ${Math.floor(ctTotal(S) / 60)} min ${String(ctTotal(S) % 60).padStart(2, '0')} s`));
  paint();
  openDialog({ title: `Préréglage Circuit training · ${label}`, body, actions: [{ label: 'Annuler' }, { label: 'Enregistrer', primary: true, onClick: () => done(S) }] });
}
function presetsTab() {
  const all = allPresets();
  const keys = Object.keys(all).sort((a, b) => collator.compare(all[a].label || a, all[b].label || b));
  const addDlg = () => {
    // choix par boutons : activités des classes + APSA courantes (le clavier reste possible)
    const names = [...new Set([...app.repo.list('classes').flatMap((c) => (c.activities || []).map((a) => a.name)), 'Course d\'orientation', 'Mario Kart', 'Circuit training', 'Basket', 'Handball', 'Ultimate', 'Futsal'])].sort(collator.compare);
    const st = { name: '' };
    const body = h('div', { class: 'dlg-body kvdlg' });
    const toolFor = (n) => { const x = norm(n); return /orientation|\bco\b|kivaou/.test(x) ? ['kivaou'] : /mario|\bmk\b/.test(x) ? ['mariokart'] : /circuit|\bct\b/.test(x) ? ['circuit'] : ['kivaou', 'mariokart', 'circuit']; };
    const paint = () => body.replaceChildren(
      h('div', { class: 'field' }, '1. L\'activité', h('div', { class: 'kvpick' }, names.map((n) => h('button', { type: 'button', class: `kvchip ${st.name === n ? 'on' : ''}`, onClick: () => { st.name = n; paint(); } }, n))),
        h('input', { type: 'text', value: names.includes(st.name) ? '' : st.name, placeholder: 'ou un autre nom…', onInput: (e) => { st.name = e.target.value; } })),
      h('div', { class: 'field' }, '2. L\'outil', h('div', { class: 'kvpick' }, (st.name ? toolFor(st.name) : ['kivaou', 'mariokart', 'circuit']).map((k) => h('button', { type: 'button', class: 'kvchip course',
        onClick: () => { if (!st.name.trim()) return toast('Choisissez d\'abord l\'activité.'); dlg.close(); editPreset(st.name.trim(), k); } }, PRESET_TOOLS[k])))),
      h('p', { class: 'muted small' }, 'Le préréglage Tournoi s\'enregistre depuis un tournoi (⋮).'));
    paint();
    const dlg = openDialog({ title: 'Nouveau préréglage', body, wide: true, actions: [{ label: 'Annuler' }] });
  };
  return [
    h('div', { class: 'row wrap', style: { marginBottom: '12px' } }, btn('Nouveau préréglage', { icon: 'plus', cls: 'primary', onClick: addDlg }),
      h('span', { class: 'muted small' }, 'Par activité, les valeurs de départ des outils. Elles s\'appliquent quand on ouvre l\'outil dans une activité de ce nom (« Basket » vaut aussi pour « Basket 3e »). Plus tard : fichier à partager entre collègues.')),
    keys.length ? keys.map((k) => h('div', { class: 'panel' }, h('h3', null, all[k].label || k),
      Object.entries(PRESET_TOOLS).filter(([t]) => all[k][t]).map(([t, l]) => h('div', { class: 'listrow' },
        h('div', { class: 'grow' }, h('b', null, l), h('div', { class: 'muted small' }, presetSummary(t, all[k][t]))),
        t !== 'tournoi' ? btn('Modifier', { cls: 'small', onClick: () => editPreset(all[k].label || k, t) }) : null,
        iconBtn('trash', `Retirer le préréglage ${l}`, async () => { await removePreset(k, t); render(); }, 'sm'))),
      h('div', { class: 'row wrap', style: { marginTop: '6px' } }, Object.entries(PRESET_TOOLS).filter(([t]) => !all[k][t] && t !== 'tournoi').map(([t, l]) => btn(`+ ${l}`, { cls: 'small soft', onClick: () => editPreset(all[k].label || k, t) })))))
      : h('div', { class: 'empty' }, h('h2', null, 'Aucun préréglage'), h('p', null, 'Exemple : « Course d\'orientation » → Kivaou avec vos parcours et votre temps maximum ; « Mario Kart » → V2, 12 minutes, vos objectifs.')),
  ];
}

// ---------- Modèles ----------

const libOpts = () => ({ uid, defaultLevels, step: (app.repo.getMeta('settings', {}) || {}).step || 0.5 });
function resetLibraryModel(m) {
  confirmDialog(`Les corrections apportées au modèle « ${m.activity} » seront remplacées par la grille du Projet EPS. Les évaluations déjà créées ne changent pas.`, 'Remettre l\'origine', { danger: false }).then(async (ok) => {
    if (!ok) return; const o = originalOf(m, libOpts()); if (!o) return; await app.repo.save('models', o); toast('Version d\'origine remise.'); render();
  });
}
function libraryDialog() {
  const missing = () => { const have = new Set(app.repo.list('models').filter((m) => m.library).map((m) => m.activity)); return ['Mario Kart', 'Duathlon', 'Circuit training', 'Acrosport', 'Danse', 'Gymnastique', 'Basket', 'Ultimate', 'Tennis de table', 'Boxe française', 'Lutte', 'Vélo'].filter((a) => !have.has(a)); };
  const miss = missing();
  openDialog({ title: 'Bibliothèque Projet EPS', body: h('div', { class: 'dlg-body' },
    h('p', null, 'Les grilles du Projet EPS du collège sont livrées avec PEPS : Mario Kart 5e, Duathlon 4e et 3e, Circuit training 3e, Acrosport 5e, Danse 5e et 4e, Gymnastique 6e, Basket 5e et 3e, Ultimate 6e et 4e, Tennis de table 6e à 3e, Boxe française 3e, Lutte 6e, Vélo 5e.'),
    h('p', { class: 'muted small' }, 'Vous pouvez les corriger librement (Modifier) ; le menu ⋮ d\'un modèle permet de remettre sa version d\'origine. En 6e, les barèmes proposés sont indicatifs : l\'évaluation se fait surtout par niveaux de maîtrise.'),
    h('p', null, miss.length ? `Modèles absents (supprimés) : ${miss.join(', ')}.` : 'Tous les modèles de la bibliothèque sont présents.')),
    actions: [{ label: 'Fermer' }, miss.length ? { label: 'Rajouter les modèles absents', primary: true, onClick: async () => { const n = await installLibrary(app.repo, { ...libOpts(), force: true }); toast(`${n} modèle(s) rajouté(s).`); render(); } } : null].filter(Boolean) });
}

function modelsTab() {
  const models = app.repo.list('models').sort((a, b) => collator.compare(a.activity + a.name, b.activity + b.name));
  return [
    h('div', { class: 'row wrap', style: { marginBottom: '12px' } },
      btn('Nouveau modèle', { icon: 'plus', cls: 'primary', onClick: () => go('modelEdit', { id: null }) }),
      btn('Importer un tableau (CSV / Excel)', { icon: 'upload', onClick: () => go('import') }),
      importModelButton(() => render()),
      btn('Bibliothèque Projet EPS', { icon: 'file', onClick: () => libraryDialog() }),
      h('span', { class: 'muted small' }, 'Un modèle = une activité + un tableau de compétences par niveau scolaire (total des barèmes = 20).')),
    models.length ? h('div', { class: 'panel' }, models.map((m) => {
      const more = iconBtn('more', 'Actions', () => popMenu(more, [
        { label: 'Modifier', onClick: () => go('modelEdit', { id: m.id }) },
        { label: 'Partager ce modèle (fichier sans données d\'élèves)', onClick: () => shareModel(m) },
        m.library ? { label: 'Remettre la version d\'origine', onClick: () => resetLibraryModel(m) } : null,
        { label: 'Dupliquer', onClick: async () => { const c = clone(m); c.id = uid(); c.name += ' (copie)'; for (const lv of Object.values(c.levels)) for (const comp of lv.competences) comp.id = uid(); delete c.deleted; delete c.library; delete c.libraryVersion; await app.repo.save('models', c); render(); } },
        { label: 'Supprimer', danger: true, onClick: () => softDelete('models', m, `Modèle « ${m.name} »`) },
      ].filter(Boolean)), 'sm');
      const v = validateModel(m);
      return h('div', { class: 'listrow' },
        h('div', { class: 'grow' }, h('b', null, m.activity), h('span', { class: 'muted' }, ` — ${m.name}`),
          h('div', { class: 'chips', style: { marginTop: '4px' } }, SCHOOL_LEVELS.filter((l) => m.levels[l]).map((l) =>
            h('span', { class: 'tag', title: `${m.levels[l].competences.length} compétences` }, `${l} · ${m.levels[l].competences.length} comp.`)),
          m.library ? h('span', { class: 'tag lib', title: 'Grille du Projet EPS livrée avec PEPS (modifiable)' }, 'Projet EPS') : null,
          v.ok ? null : h('span', { class: 'tag', style: { background: 'var(--danger-soft)' } }, 'à corriger'))),
        btn('Modifier', { cls: 'small', onClick: () => go('modelEdit', { id: m.id }) }), more);
    })) : h('div', { class: 'empty' }, h('h2', null, 'Aucun modèle'), h('p', null, 'Créez un modèle ou importez votre tableau de compétences.')),
  ];
}

// ---------- Classes ----------

function classesTab() {
  const classes = app.repo.list('classes').sort((a, b) => collator.compare(b.year || '', a.year || '') || collator.compare(a.name, b.name));
  return [
    h('div', { class: 'row wrap', style: { marginBottom: '12px' } },
      btn('Nouvelle classe', { icon: 'plus', cls: 'primary', onClick: () => go('classEdit', { id: null }) }),
      h('span', { class: 'muted small' }, 'Seuls le prénom et l\'initiale du nom (si nécessaire) sont enregistrés.')),
    classes.length ? h('div', { class: 'panel' }, classes.map((c) => {
      const act = c.students.filter((s) => s.active !== false).length;
      const more = iconBtn('more', 'Actions', () => popMenu(more, [
        { label: 'Modifier', onClick: () => go('classEdit', { id: c.id }) },
        { label: 'Passer à l\'année suivante…', onClick: () => nextYear(c) },
        { label: 'Supprimer', danger: true, onClick: () => softDelete('classes', c, `Classe « ${c.name} »`) },
      ]), 'sm');
      return h('div', { class: 'listrow' },
        h('i', { class: 'dotc', style: { background: c.color } }),
        h('div', { class: 'grow' }, h('b', null, c.name), h('span', { class: 'muted' }, ` — ${c.level}${c.year ? ' · ' + c.year : ''}`),
          h('div', { class: 'muted small' }, `${act} élève${act > 1 ? 's' : ''}`)),
        btn('Modifier', { cls: 'small', onClick: () => go('classEdit', { id: c.id }) }), more);
    })) : h('div', { class: 'empty' }, h('h2', null, 'Aucune classe'), h('p', null, 'Créez une classe puis ajoutez ses élèves.')),
  ];
}

/** Dates des trimestres, par année scolaire (utilisées par le filtre de la page Classe). */
function trimestersPanel(classes) {
  const years = [...new Set([schoolYear(), ...classes.map((c) => c.year).filter(Boolean)])].sort().reverse();
  const st = trimestersPanel.st ??= { year: years[0] };
  if (!years.includes(st.year)) st.year = years[0];
  const all = () => ({ ...(app.repo.getMeta('settings', {}) || {}) });
  const trims = getTrimesters(all(), st.year);
  const saveTrims = (arr) => { const s = all(); s.trimesters = { ...(s.trimesters || {}), [st.year]: arr }; return app.repo.setMeta('settings', s); };
  return h('div', { class: 'panel' }, h('h3', null, 'Trimestres'),
    h('p', { class: 'muted small', style: { margin: '0 0 8px' } }, 'Dates de début et de fin de chaque trimestre, utilisées pour filtrer les notes d\'une classe. Dates proposées à titre indicatif : vérifiez-les avec le calendrier de votre collège.'),
    h('label', { class: 'field', style: { maxWidth: '220px', marginBottom: '8px' } }, 'Année scolaire',
      h('select', { value: st.year, onChange: (e) => { st.year = e.target.value; render(); } }, years.map((y) => h('option', { value: y }, y)))),
    trims.map((t, i) => h('div', { class: 'row wrap', style: { marginBottom: '6px' } },
      h('b', { style: { width: '110px' } }, `Trimestre ${i + 1}`),
      h('label', { class: 'row' }, 'du', h('input', { type: 'date', value: t.start, onChange: async (e) => { const a = trims.map((x) => ({ ...x })); a[i].start = e.target.value || t.start; await saveTrims(a); render(); } })),
      h('label', { class: 'row' }, 'au', h('input', { type: 'date', value: t.end, onChange: async (e) => { const a = trims.map((x) => ({ ...x })); a[i].end = e.target.value || t.end; await saveTrims(a); render(); } })))),
    btn('Remettre les dates proposées', { cls: 'small', onClick: async () => { await saveTrims(defaultTrimesters(st.year)); render(); } }));
}

function nextYear(c) {
  const o = { year: nextSchoolYear(c.year), name: c.name, level: c.level };
  openDialog({
    title: 'Passer à l\'année suivante',
    body: [
      h('p', { class: 'dlg-msg' }, 'Crée une nouvelle classe avec les mêmes élèves (identifiants conservés : leur historique les suit). L\'ancienne classe et ses évaluations restent intactes. Vous pourrez ensuite retirer les élèves qui partent et ajouter les nouveaux.'),
      h('label', { class: 'field' }, 'Nom de la classe', h('input', { type: 'text', value: o.name, onInput: (e) => { o.name = e.target.value; } })),
      h('label', { class: 'field' }, 'Niveau', h('select', { value: o.level, onChange: (e) => { o.level = e.target.value; } }, SCHOOL_LEVELS.map((l) => h('option', { value: l }, l)))),
      h('label', { class: 'field' }, 'Année scolaire', h('input', { type: 'text', value: o.year, onInput: (e) => { o.year = e.target.value; } })),
    ],
    actions: [{ label: 'Annuler' }, { label: 'Créer la classe', primary: true, onClick: async () => {
      const n = clone(c);
      n.id = uid(); n.name = o.name.trim() || c.name; n.level = o.level; n.year = o.year.trim(); n.createdAt = now(); delete n.deleted;
      n.students = c.students.filter((s) => s.active !== false).map((s) => ({ ...s }));
      delete n.forgets; delete n.infos; // oublis et infos restent sur l'ancienne classe (année terminée)
      await app.repo.save('classes', n);
      go('classEdit', { id: n.id });
    } }],
  });
}

// ---------- Données ----------

function dataTab(which = 'data') {
  const repo = app.repo;
  const settings = repo.getMeta('settings', {}) || {};
  const setSetting = (k, v) => repo.setMeta('settings', { ...(repo.getMeta('settings', {}) || {}), [k]: v });
  const last = repo.getMeta('lastSync');
  const counts = `${repo.list('classes').length} classes · ${repo.list('models').length} modèles · ${repo.list('evaluations').length} évaluations`;
  const ctl = app.sync;

  const fileInput = h('input', { type: 'file', accept: '.json,.txt,application/json,text/plain', hidden: true, onChange: async (e) => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    let obj;
    try { obj = JSON.parse(await f.text()); } catch { return toast('Fichier illisible : ce n\'est pas un JSON valide.'); }
    importDialog(obj, f.name);
  } });

  const inst = window.__installPrompt;
  const P = [
    displayPanel(), demoPanel(),
    h('div', { class: 'panel' }, h('h3', null, 'Sauvegarde'),
      h('p', { class: 'muted', style: { margin: '0 0 10px' } }, `Contenu actuel : ${counts}. Les données sont enregistrées automatiquement dans la tablette. « Partager » ouvre le menu de la tablette : choisissez Google Drive (dossier de votre choix), Mes fichiers ou un mail.`),
      h('p', { class: 'small', style: { margin: '0 0 10px' } }, h('b', null, backupText()),
        changesSinceBackup() ? h('span', { class: 'muted' }, ` · ${changesSinceBackup()} élément(s) modifié(s) depuis`) : null),
      h('div', { class: 'row wrap' },
        btn('Partager la sauvegarde (Drive…)', { icon: 'cloud', cls: 'primary', onClick: async () => { await shareBackup(); render(); } }),
        btn('Télécharger la sauvegarde', { icon: 'download', onClick: async () => { await downloadBackup(); render(); } }),
        btn('Importer une sauvegarde…', { icon: 'upload', onClick: () => fileInput.click() }), fileInput),
      safetyInfo() ? h('div', { class: 'row wrap', style: { marginTop: '10px' } },
        h('span', { class: 'muted small grow' }, `Copie de sécurité interne : ${new Date(safetyInfo().at).toLocaleString('fr-FR')} (${safetyInfo().reason}).`),
        btn('Restaurer cette copie', { cls: 'small', onClick: async () => {
          if (!(await confirmDialog('Les données actuelles seront remplacées par la copie de sécurité. Continuer ?', 'Restaurer'))) return;
          try { await restoreSafetyCopy(); toast('Copie de sécurité restaurée.'); updateSyncChips(); render(); } catch (e) { toast(e.message); }
        } })) : null),

    h('div', { class: 'panel' }, h('h3', null, 'Google Drive'),
      h('p', { class: 'muted', style: { margin: '0 0 10px' } }, 'Les données sont sauvegardées dans un dossier privé de l\'application sur votre Drive (invisible dans « Mon Drive »). Fonctionne hors connexion : tout est envoyé au retour du réseau. Une sauvegarde plus ancienne n\'écrase jamais des données plus récentes.'),
      h('label', { class: 'field', style: { maxWidth: '640px' } }, 'Identifiant client OAuth Google (voir le guide README)',
        h('input', { type: 'text', placeholder: 'xxxxxxxx.apps.googleusercontent.com', value: settings.googleClientId || '', onChange: (e) => { setSetting('googleClientId', e.target.value.trim()); } })),
      h('div', { class: 'row wrap', style: { marginTop: '10px' } },
        btn(ctl?.connected ? 'Reconnecter' : 'Se connecter à Google Drive', { icon: 'cloud', cls: 'primary', onClick: () => ctl.connect() }),
        btn('Synchroniser maintenant', { icon: 'cloud', disabled: !ctl?.connected, onClick: () => ctl.syncNow({ manual: true }) }),
        h('label', { class: 'row' }, h('input', { type: 'checkbox', style: { width: '22px', height: '22px' }, checked: settings.autoSync !== false, onChange: (e) => { setSetting('autoSync', e.target.checked); } }), 'Synchroniser automatiquement')),
      h('p', { class: 'small', style: { margin: '10px 0 0' } },
        h('b', null, 'État : '), h('span', { class: 'syncchip-inline' }, ctl?.statusText() || 'Local uniquement'),
        last ? h('span', { class: 'muted' }, ` — dernière synchronisation : ${new Date(last).toLocaleString('fr-FR')}`) : null),
      ctl?.lastError ? h('p', { class: 'small', style: { color: 'var(--danger)', margin: '6px 0 0' } }, ctl.lastError) : null),

    h('div', { class: 'panel' }, h('h3', null, 'Notation'),
      h('label', { class: 'field', style: { maxWidth: '360px', marginBottom: '12px' } }, 'Pas de saisie des notes (nouvelles évaluations)',
        h('select', { value: String(settings.step || 0.5), onChange: (e) => { setSetting('step', Number(e.target.value)); } },
          [[0.25, 'Quart de point (0,25)'], [0.5, 'Demi-point (0,5) — par défaut'], [1, 'Point entier (1)']].map(([v, l]) => h('option', { value: String(v) }, l)))),
      h('label', { class: 'row' }, h('input', { type: 'checkbox', style: { width: '22px', height: '22px' }, checked: !!settings.showProvisional,
        onChange: (e) => { setSetting('showProvisional', e.target.checked); } }),
      h('span', null, 'Afficher une estimation provisoire sur 20 quand toutes les compétences ne sont pas encore renseignées', h('div', { class: 'muted small' }, 'Désactivé par défaut : la note finale n\'est affichée que lorsque tout est renseigné.')))),

    h('div', { class: 'panel' }, h('h3', null, 'Auto-évaluation des élèves'),
      h('label', { class: 'field', style: { maxWidth: '260px' } }, 'Code pour quitter le mode élève',
        h('input', { type: 'text', inputmode: 'numeric', maxlength: 8, value: settings.selfCode || DEFAULT_CODE, onChange: (e) => { const v = e.target.value.trim(); setSetting('selfCode', v || DEFAULT_CODE); toast('Code enregistré.'); } })),
      h('p', { class: 'muted small', style: { margin: '8px 0 0' } }, 'Le mode se lance depuis le menu ⋮ d\'une évaluation. Le code protège la tablette devant les élèves, il n\'est pas un secret absolu.')),

    h('div', { class: 'panel' }, h('h3', null, 'Application'),
      h('div', { class: 'row wrap' },
        inst ? btn('Installer sur cet appareil', { icon: 'download', cls: 'primary', onClick: async () => { inst.prompt(); await inst.userChoice; window.__installPrompt = null; render(); } }) : null,
        btn('Rechercher une mise à jour', { onClick: async () => {
          const reg = await navigator.serviceWorker?.getRegistration();
          if (!reg) return toast('Le mode hors connexion n\'est pas actif (ouvrez l\'application via HTTPS).');
          await reg.update(); toast('Recherche effectuée. Une nouvelle version, si elle existe, vous sera proposée.');
        } })),
      h('p', { class: 'muted small', style: { margin: '10px 0 0' } },
        `Version ${window.__APP_VERSION || '1.11.0'} · ${navigator.onLine ? 'en ligne' : 'hors connexion'} · `,
        h('span', { id: 'persist-state' }, 'stockage…')),
    ),
  ];
  // P : 0 affichage, 1 découverte, 2 sauvegarde, 3 Drive, 4 notation, 5 auto-évaluation, 6 application
  return which === 'general'
    ? [P[4], P[5], P[0], P[1], trimestersPanel(app.repo.list('classes')), P[6]] // trimestres en avant-dernier
    : [P[2], P[3]];
}

if (typeof navigator !== 'undefined' && navigator.storage?.persisted) {
  setInterval(async () => {
    const el = document.getElementById('persist-state');
    if (el) el.textContent = (await navigator.storage.persisted()) ? 'stockage protégé contre l\'effacement automatique' : 'stockage standard';
  }, 1500);
}

function importDialog(obj, fname) {
  if (obj?.app !== 'eps-eval') return toast('Ce fichier n\'est pas une sauvegarde de l\'application.');
  const n = (obj.classes?.length || 0) + ' classes, ' + (obj.models?.length || 0) + ' modèles, ' + (obj.evaluations?.length || 0) + ' évaluations';
  const run = (mode) => async () => {
    try {
      const r = await app.repo.importAll(obj, { mode });
      toast(mode === 'replace' ? 'Sauvegarde restaurée.' : `Fusion terminée : ${r.added} ajouté(s), ${r.updated} mis à jour, ${r.keptLocal} conservé(s) (plus récents ici).`, { ms: 7000 });
      updateSyncChips(); render();
    } catch (e) { toast(e.message); }
  };
  openDialog({
    title: 'Importer une sauvegarde',
    body: [h('p', { class: 'dlg-msg' }, `${fname} — ${n}${obj.exportedAt ? ' · exportée le ' + new Date(obj.exportedAt).toLocaleString('fr-FR') : ''}.`),
      h('p', { class: 'dlg-msg' }, h('b', null, 'Fusionner'), ' (recommandé) : ajoute ce qui manque et ne remplace une donnée de cette tablette que si la sauvegarde est plus récente.'),
      h('p', { class: 'dlg-msg' }, h('b', null, 'Remplacer tout'), ' : efface les données de cette tablette puis restaure la sauvegarde.')],
    actions: [{ label: 'Annuler' },
      { label: 'Remplacer tout', danger: true, onClick: async () => { if (await confirmDialog('Toutes les données actuelles de cette tablette seront remplacées par la sauvegarde (une copie de sécurité est gardée). Continuer ?', 'Remplacer')) { await makeSafetyCopy('avant « Remplacer tout »'); await run('replace')(); } else return false; } },
      { label: 'Fusionner', primary: true, onClick: run('merge') }],
  });
}
