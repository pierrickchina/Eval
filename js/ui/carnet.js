// Carnet de bord d'une classe : cadres d'activités (« Handball · 3e B ») contenant des tuiles d'outils.
// La tuile Évaluation se déplie sur place (liste des évaluations de l'activité, sans nouvelle page).
import { app, go, render } from '../app.js';
import { h, btn, icon, iconBtn, openDialog, popMenu, toast } from './dom.js';
import { fmtDate, todayISO, collator } from '../util.js';
import { createEvaluation } from '../logic/evaluation.js';
import { studentTotals } from '../logic/scoring.js';
import {
  TOOLS, ACTIVITY_COLORS, activityColor, toolColor, toolLabel, evTitle, newActivity, activitiesOf, activityEvals, hasTool, touchTool, visibleTools, deleteImpact, ensureActivities,
} from '../logic/activities.js';
import { duplicateDialog } from './home.js';

const E = { open: new Set(), all: new Set() }; // activités dépliées (évaluations) / outils masqués affichés
const saveClass = (cls) => app.repo.save('classes', cls);

/** Range les évaluations orphelines (import, synchro, ancienne version) dans leur activité, puis enregistre. */
export function repairActivities(cls) {
  const r = ensureActivities([cls], app.repo.list('evaluations'));
  if (r.classes.length || r.evals.length) {
    Promise.all([...r.classes.map((c) => saveClass(c)), ...r.evals.map((e) => app.repo.save('evaluations', e))]).then(() => render());
  }
}

// ---------- Vue principale ----------

export function hubTab(cls) {
  const acts = activitiesOf(cls);
  return h('div', { class: 'hub scroll grow', 'data-keep': 'hub' },
    acts.length ? acts.map((a) => activityFrame(cls, a))
      : h('div', { class: 'empty' }, h('h2', null, 'Aucune activité'),
        h('p', null, 'Une activité, c\'est une APSA travaillée avec cette classe (handball, badminton…). Elle contient les outils : évaluation, puis d\'autres.'),
        btn('Nouvelle activité', { icon: 'plus', cls: 'primary', onClick: () => newActivityDialog(cls) })));
}

function activityFrame(cls, act) {
  const evals = app.repo.list('evaluations');
  const { shown, hidden } = visibleTools(act.tools);
  const showAll = E.all.has(act.id);
  const tools = showAll ? [...shown, ...hidden] : shown;
  const add = iconBtn('plus', 'Ajouter un outil', () => popMenu(add, [
    ...Object.entries(TOOLS).map(([type, t]) => ({
      label: type === 'evaluation' ? 'Nouvelle évaluation…' : `${t.label} (bientôt)`,
      onClick: () => (type === 'evaluation' ? addEvaluation(cls, act) : toast(`${t.label} : bientôt disponible.`)),
    })),
    '-',
    { label: 'Gérer les outils…', onClick: () => manageToolsDialog(cls, act) },
  ]), 'boxed');
  const more = iconBtn('more', 'Options de l\'activité', () => popMenu(more, [
    { label: 'Nom et couleur…', onClick: () => editActivityDialog(cls, act) },
    { label: 'Gérer les outils…', onClick: () => manageToolsDialog(cls, act) },
    '-',
    { label: 'Supprimer l\'activité…', danger: true, onClick: () => deleteActivity(cls, act) },
  ]), 'boxed');
  const tile = (t) => {
    if (t.type === 'evaluation') {
      const list = activityEvals(evals, cls, act), n = list.length, open = E.open.has(act.id) && n > 1;
      // 0 évaluation : création ; 1 seule : ouverture directe ; plusieurs : la liste se déplie pour choisir
      const press = () => {
        if (n === 0) return addEvaluation(cls, act);
        if (n === 1) return openEval(cls, list[0]);
        E.open.has(act.id) ? E.open.delete(act.id) : E.open.add(act.id);
        render();
      };
      return h('button', { type: 'button', style: { '--tc': toolColor('evaluation') }, class: `tooltile ${open ? 'on' : ''}`, 'aria-expanded': n > 1 ? open : null, onClick: press },
        icon(TOOLS.evaluation.icon), h('b', null, 'Évaluation'),
        h('span', { class: 'muted small' }, n === 0 ? 'Aucune · toucher pour créer' : n === 1 ? '1 évaluation · toucher pour ouvrir' : `${n} évaluations`));
    }
    return h('button', { type: 'button', style: { '--tc': toolColor(t.type) }, class: 'tooltile soon', onClick: () => toast(`${toolLabel(t.type)} : bientôt disponible.`) },
      icon(TOOLS[t.type]?.icon || 'file'), h('b', null, toolLabel(t.type)), h('span', { class: 'muted small' }, 'bientôt'));
  };
  return h('section', { class: 'actframe', style: { '--ac': activityColor(act) } },
    h('div', { class: 'acthead' }, h('h2', { class: 'grow' }, `${act.name} · ${cls.name}`), add, more),
    h('div', { class: 'tooltiles' }, tools.map(tile),
      null),
    hidden.length ? h('button', { type: 'button', class: 'linkbtn', onClick: () => { showAll ? E.all.delete(act.id) : E.all.add(act.id); render(); } },
      showAll ? 'Masquer les outils peu utilisés' : `Afficher ${hidden.length} outil${hidden.length > 1 ? 's' : ''} peu utilisé${hidden.length > 1 ? 's' : ''}`) : null,
    E.open.has(act.id) && hasTool(act, 'evaluation') && activityEvals(evals, cls, act).length > 1 ? evalList(cls, act) : null);
}

function evalList(cls, act) {
  const list = activityEvals(app.repo.list('evaluations'), cls, act);
  return h('div', { class: 'evlist' }, list.map((ev) => evRow(cls, ev)));
}

const openEval = (cls, ev) => go('eval', { id: ev.id, from: 'classPage', classId: cls.id });

function progress(ev) {
  const t = ev.students.map((s) => studentTotals(ev, s.id));
  return `${t.filter((x) => x.final != null).length}/${t.filter((x) => x.usable).length} notés`;
}

function evRow(cls, ev) {
  const open = () => openEval(cls, ev);
  const more = iconBtn('more', 'Actions', (e) => {
    e.stopPropagation();
    popMenu(more, [
      { label: 'Renommer…', onClick: () => renameEvaluation(ev) },
      { label: 'Dupliquer…', onClick: () => duplicateDialog(ev) },
      { label: 'Supprimer', danger: true, onClick: () => deleteEvaluation(ev) },
    ]);
  }, 'sm');
  return h('div', { class: 'evrow', role: 'button', tabindex: 0, onClick: open, onKeydown: (e) => { if (e.key === 'Enter') open(); } },
    h('div', { class: 'grow' }, h('div', { class: 't' }, evTitle(ev, true)), h('div', { class: 'muted small' }, `${fmtDate(ev.date)} · ${progress(ev)}`)), more);
}

function renameEvaluation(ev) {
  let title = ev.title || '';
  const dlg = openDialog({
    title: 'Nom de l\'évaluation',
    body: h('label', { class: 'field' }, 'Nom (laisser vide pour reprendre celui du modèle)',
      h('input', { type: 'text', value: title, placeholder: evTitle({ model: ev.model }, true), autofocus: true, onInput: (e) => { title = e.target.value; } })),
    actions: [{ label: 'Annuler' }, { label: 'Enregistrer', primary: true, keepOpen: true, onClick: async () => {
      ev.title = title.trim(); dlg.close(); render(); await app.repo.save('evaluations', ev); return false;
    } }],
  });
}

async function deleteEvaluation(ev) {
  await app.repo.remove('evaluations', ev.id);
  render();
  toast(`Évaluation « ${evTitle(ev)} » supprimée.`, {
    action: 'Annuler', ms: 9000, onAction: async () => { await app.repo.restore('evaluations', ev.id); render(); },
  });
}

// ---------- Nouvelle activité / renommer ----------

export function newActivityDialog(cls) {
  const names = [...new Set([...app.repo.list('models').map((m) => m.activity), ...app.repo.list('classes').flatMap((c) => activitiesOf(c).map((a) => a.name))])]
    .filter(Boolean).sort(collator.compare);
  const st = { name: '', tools: new Set(['evaluation']), color: ACTIVITY_COLORS[activitiesOf(cls).length % ACTIVITY_COLORS.length] };
  const dup = (n) => activitiesOf(cls).some((a) => a.name.trim().toLowerCase() === n.trim().toLowerCase());
  const dlg = openDialog({
    title: `Nouvelle activité · ${cls.name}`,
    body: [
      h('label', { class: 'field' }, 'Nom de l\'activité',
        h('input', { type: 'text', list: 'act-names', placeholder: 'Handball, Badminton…', autofocus: true, onInput: (e) => { st.name = e.target.value; } }),
        h('datalist', { id: 'act-names' }, names.map((n) => h('option', { value: n })))),
      h('div', { class: 'muted small' }, 'Couleur du cadre (modifiable ensuite)'),
      h('div', { class: 'swatches' }, ACTIVITY_COLORS.map((c) => h('button', { type: 'button', class: 'swatch', style: { background: c }, 'aria-label': `Couleur ${c}`,
        onClick: (e) => { st.color = c; e.currentTarget.parentNode.querySelectorAll('.swatch').forEach((x) => x.classList.toggle('on', x === e.currentTarget)); } }))),
      h('div', { class: 'muted small' }, 'Outils de l\'activité'),
      Object.entries(TOOLS).map(([type, t]) => h('label', { class: 'row', style: { opacity: t.available ? 1 : .55 } },
        h('input', { type: 'checkbox', checked: st.tools.has(type), disabled: !t.available, style: { width: '22px', height: '22px' },
          onChange: (e) => { e.target.checked ? st.tools.add(type) : st.tools.delete(type); } }),
        h('span', null, t.label, h('span', { class: 'muted small' }, t.available ? '' : ' — bientôt')))),
    ],
    actions: [{ label: 'Annuler' }, { label: 'Créer', primary: true, keepOpen: true, onClick: async () => {
      const name = st.name.trim();
      if (!name) { toast('Donnez un nom à l\'activité.'); return false; }
      if (dup(name)) { toast('Cette classe a déjà une activité de ce nom.'); return false; }
      const act = newActivity(name, [...st.tools], undefined, st.color);
      activitiesOf(cls).push(act);
      dlg.close();
      render();
      await saveClass(cls);
      return false;
    } }],
  });
}

/** Nom et couleur (pastel) du cadre d'activité. */
function editActivityDialog(cls, act) {
  let name = act.name, color = activityColor(act);
  const sw = h('div', { class: 'swatches' });
  const paintSw = () => sw.replaceChildren(...ACTIVITY_COLORS.map((c) => h('button', { type: 'button', class: `swatch ${c === color ? 'on' : ''}`,
    style: { background: c }, 'aria-label': `Couleur ${c}`, 'aria-pressed': c === color, onClick: () => { color = c; paintSw(); } })));
  paintSw();
  const dlg = openDialog({
    title: 'Nom et couleur de l\'activité',
    body: [h('label', { class: 'field' }, 'Nom', h('input', { type: 'text', value: act.name, autofocus: true, onInput: (e) => { name = e.target.value; } })),
      h('div', { class: 'muted small' }, 'Couleur du cadre'), sw],
    actions: [{ label: 'Annuler' }, { label: 'Enregistrer', primary: true, keepOpen: true, onClick: async () => {
      name = name.trim();
      if (!name) return false;
      if (activitiesOf(cls).some((a) => a !== act && a.name.trim().toLowerCase() === name.toLowerCase())) { toast('Ce nom existe déjà dans cette classe.'); return false; }
      act.name = name; act.color = color; dlg.close(); render(); await saveClass(cls); return false;
    } }],
  });
}

// ---------- Outils : ajout / retrait, suppression avec avertissement ----------

/** Fenêtre d'avertissement : liste précisément ce qui sera supprimé. Résout true si l'utilisateur confirme. */
export function dangerDialog({ title = 'Attention, vous allez supprimer des données', intro, lines, confirm = 'Supprimer définitivement' }) {
  return new Promise((resolve) => {
    let done = false;
    const end = (v) => { if (!done) { done = true; resolve(v); } };
    openDialog({
      title: `⚠ ${title}`,
      body: [h('p', { class: 'dlg-msg', style: { fontWeight: 650 } }, intro),
        h('ul', { class: 'dangerlist' }, lines.map((l) => h('li', null, l))),
        h('p', { class: 'dlg-msg' }, 'Cette action est définitive : les données ne pourront pas être retrouvées (sauf dans une sauvegarde antérieure).')],
      actions: [{ label: 'Annuler', onClick: () => end(false) }, { label: confirm, danger: true, onClick: () => end(true) }],
      onClose: () => end(false),
    });
  });
}

const plural = (n, w) => `${n} ${w}${n > 1 ? 's' : ''}`;
function impactLines(impact) {
  return impact.evals.map((e) => {
    const parts = [plural(e.marks, 'résultat'), e.obs ? plural(e.obs, 'observation') : null, e.notes ? plural(e.notes, 'remarque') : null,
      e.selfEvals ? plural(e.selfEvals, 'auto-évaluation') : null].filter(Boolean);
    return `Évaluation « ${e.label} » du ${fmtDate(e.date)} (${plural(e.students, 'élève')}) : ${parts.join(', ')}`;
  });
}

async function removeEvaluations(impact) {
  for (const e of impact.evals) await app.repo.remove('evaluations', e.id);
}

async function deleteActivity(cls, act) {
  const impact = deleteImpact(app.repo.list('evaluations'), cls, act, null);
  const ok = await dangerDialog({
    intro: `Supprimer l'activité « ${act.name} » de ${cls.name} supprime aussi tout ce qu'elle contient :`,
    lines: impact.empty ? ['Aucune donnée enregistrée dans cette activité.'] : impactLines(impact),
  });
  if (!ok) return;
  await removeEvaluations(impact);
  cls.activities = activitiesOf(cls).filter((a) => a !== act);
  E.open.delete(act.id); E.all.delete(act.id);
  render();
  await saveClass(cls);
}

function manageToolsDialog(cls, act) {
  const sel = new Set(act.tools.map((t) => t.type));
  openDialog({
    title: `Outils · ${act.name}`,
    body: Object.entries(TOOLS).map(([type, t]) => h('label', { class: 'row', style: { opacity: t.available || sel.has(type) ? 1 : .55 } },
      h('input', { type: 'checkbox', checked: sel.has(type), disabled: !t.available && !sel.has(type), style: { width: '22px', height: '22px' },
        onChange: (e) => { e.target.checked ? sel.add(type) : sel.delete(type); } }),
      h('span', null, t.label, h('span', { class: 'muted small' }, t.available ? '' : ' — bientôt')))),
    actions: [{ label: 'Annuler' }, { label: 'Enregistrer', primary: true, keepOpen: true, onClick: async (dlg) => {
      const removed = act.tools.filter((t) => !sel.has(t.type));
      const added = [...sel].filter((type) => !hasTool(act, type));
      if (removed.length) {
        const impacts = removed.map((t) => ({ t, imp: deleteImpact(app.repo.list('evaluations'), cls, act, t.type) }));
        const lines = impacts.flatMap(({ t, imp }) => (imp.empty ? [`Outil « ${toolLabel(t.type)} » : aucune donnée enregistrée.`] : [`Outil « ${toolLabel(t.type)} » :`, ...impactLines(imp)]));
        if (impacts.some(({ imp }) => !imp.empty)) {
          dlg.close();
          const ok = await dangerDialog({ intro: `Retirer ${removed.length > 1 ? 'ces outils' : 'cet outil'} de « ${act.name} » supprime les données suivantes :`, lines });
          if (!ok) return false;
          for (const { imp } of impacts) await removeEvaluations(imp);
        } else dlg.close();
      } else dlg.close();
      act.tools = act.tools.filter((t) => sel.has(t.type));
      const t0 = Date.now();
      for (const type of added) act.tools.push({ type, addedAt: t0, lastUsed: t0 });
      render();
      await saveClass(cls);
      return false;
    } }],
  });
}

// ---------- Nouvelle évaluation (depuis le carnet) ----------

export function newEvaluationDialog({ cls, activity = null }) {
  const repo = app.repo;
  const acts = activitiesOf(cls).filter((a) => hasTool(a, 'evaluation'));
  const models = repo.list('models').filter((m) => m.levels[cls.level]);
  if (!acts.length) {
    openDialog({ title: 'Nouvelle évaluation', body: h('p', { class: 'dlg-msg' }, 'Créez d\'abord une activité dans le carnet de bord de cette classe.'),
      actions: [{ label: 'Annuler' }, { label: 'Nouvelle activité', primary: true, onClick: () => newActivityDialog(cls) }] });
    return;
  }
  if (!models.length) {
    openDialog({ title: 'Nouvelle évaluation',
      body: h('p', { class: 'dlg-msg' }, `Aucun modèle d'évaluation ne contient de tableau pour le niveau ${cls.level}. Créez ou complétez un modèle dans les réglages.`),
      actions: [{ label: 'Annuler' }, { label: 'Ouvrir les réglages', primary: true, onClick: () => go('settings', { tab: 'models' }) }] });
    return;
  }
  const st = { actId: (activity || acts[0]).id, modelId: '', date: todayISO(), title: '' };
  const body = h('div', { class: 'dlg-body', style: { padding: 0 } });
  const dlg = openDialog({ title: `Nouvelle évaluation · ${cls.name}`, body, actions: [{ label: 'Annuler' }, { label: 'Créer', primary: true, keepOpen: true, onClick: async () => {
    const act = acts.find((a) => a.id === st.actId), model = repo.get('models', st.modelId);
    try {
      const ev = createEvaluation({ cls, model, date: st.date, step: (repo.getMeta('settings', {}) || {}).step || 0.5 });
      ev.activityId = act.id;
      if (st.title.trim()) ev.title = st.title.trim();
      touchTool(act, 'evaluation');
      await repo.save('evaluations', ev);
      saveClass(cls);
      dlg.close();
      go('eval', { id: ev.id, from: 'classPage', classId: cls.id });
    } catch (e) { toast(e.message); }
    return false;
  } }] });
  const paint = () => {
    const act = acts.find((a) => a.id === st.actId);
    const same = (m) => m.activity.trim().toLowerCase() === act.name.trim().toLowerCase();
    const ok = [...models].sort((a, b) => (same(b) - same(a)) || collator.compare(a.activity + a.name, b.activity + b.name));
    if (!ok.some((m) => m.id === st.modelId)) st.modelId = ok[0].id;
    body.replaceChildren(...[
      h('label', { class: 'field' }, 'Activité', h('select', { value: st.actId, onChange: (e) => { st.actId = e.target.value; paint(); } },
        acts.map((a) => h('option', { value: a.id }, a.name)))),
      h('label', { class: 'field' }, 'Modèle d\'évaluation', h('select', { value: st.modelId, onChange: (e) => { st.modelId = e.target.value; } },
        ok.map((m) => h('option', { value: m.id }, `${m.activity} — ${m.name}`)))),
      h('label', { class: 'field' }, 'Nom de l\'évaluation (facultatif)', h('input', { type: 'text', value: st.title, placeholder: 'ex. Match de poule, Bilan de cycle…', onInput: (e) => { st.title = e.target.value; } })),
      h('label', { class: 'field' }, 'Date', h('input', { type: 'date', value: st.date, onChange: (e) => { st.date = e.target.value || todayISO(); } })),
      cls.students.some((s) => s.active !== false) ? null : h('p', { class: 'muted small' }, 'Cette classe n\'a pas encore d\'élèves : vous pourrez en ajouter dans l\'évaluation.'),
    ].filter(Boolean)); // (un « null » passé tel quel s'afficherait en texte)
  };
  paint();
}

/** Ajoute l'outil Évaluation à l'activité si besoin, puis ouvre la fenêtre de création. */
export async function addEvaluation(cls, act) {
  if (!hasTool(act, 'evaluation')) { const t = Date.now(); act.tools.push({ type: 'evaluation', addedAt: t, lastUsed: t }); render(); await saveClass(cls); }
  newEvaluationDialog({ cls, activity: act });
}
