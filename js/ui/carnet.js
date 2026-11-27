// Carnet de bord d'une classe : cadres d'activités (« Handball · 3e B ») contenant des tuiles d'outils.
// La tuile Évaluation se déplie sur place (liste des évaluations de l'activité, sans nouvelle page).
import { app, go, render } from '../app.js';
import { h, btn, icon, iconBtn, openDialog, popMenu, toast } from './dom.js';
import { fmtDate, todayISO, collator } from '../util.js';
import { createEvaluation } from '../logic/evaluation.js';
import { studentTotals } from '../logic/scoring.js';
import {
  TOOLS, toolLabel, newActivity, activitiesOf, activityEvals, hasTool, touchTool, visibleTools, deleteImpact, ensureActivities,
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
    h('div', { class: 'row wrap hubhead' },
      btn('Nouvelle activité', { icon: 'plus', cls: 'primary', onClick: () => newActivityDialog(cls) }),
      btn('Nouvelle évaluation', { icon: 'plus', onClick: () => newEvaluationDialog({ cls }) })),
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
  const more = iconBtn('more', 'Options de l\'activité', () => popMenu(more, [
    { label: 'Nouvelle évaluation…', onClick: () => newEvaluationDialog({ cls, activity: act }) },
    { label: 'Renommer…', onClick: () => renameDialog(cls, act) },
    { label: 'Gérer les outils…', onClick: () => manageToolsDialog(cls, act) },
    '-',
    { label: 'Supprimer l\'activité…', danger: true, onClick: () => deleteActivity(cls, act) },
  ]), 'boxed');
  const tile = (t) => {
    if (t.type === 'evaluation') {
      const n = activityEvals(evals, cls, act).length, open = E.open.has(act.id);
      return h('button', { type: 'button', class: `tooltile ${open ? 'on' : ''}`, 'aria-expanded': open, onClick: () => {
        open ? E.open.delete(act.id) : E.open.add(act.id); render();
      } }, icon(TOOLS.evaluation.icon), h('b', null, 'Évaluation'), h('span', { class: 'muted small' }, `${n} évaluation${n > 1 ? 's' : ''}`));
    }
    return h('button', { type: 'button', class: 'tooltile soon', onClick: () => toast(`${toolLabel(t.type)} : bientôt disponible.`) },
      icon(TOOLS[t.type]?.icon || 'file'), h('b', null, toolLabel(t.type)), h('span', { class: 'muted small' }, 'bientôt'));
  };
  return h('section', { class: 'actframe', style: { '--ac': cls.color } },
    h('div', { class: 'acthead' }, h('h2', { class: 'grow' }, `${act.name} · ${cls.name}`), more),
    h('div', { class: 'tooltiles' }, tools.map(tile),
      hidden.length ? h('button', { type: 'button', class: 'tooltile plus', 'aria-label': showAll ? 'Masquer les outils peu utilisés' : `Afficher ${hidden.length} outil(s) peu utilisé(s)`,
        onClick: () => { showAll ? E.all.delete(act.id) : E.all.add(act.id); render(); } }, icon(showAll ? 'minus' : 'plus'), h('span', { class: 'muted small' }, showAll ? 'Moins' : `${hidden.length} de plus`)) : null),
    E.open.has(act.id) && hasTool(act, 'evaluation') ? evalList(cls, act) : null);
}

function evalList(cls, act) {
  const list = activityEvals(app.repo.list('evaluations'), cls, act);
  return h('div', { class: 'evlist' },
    list.length ? list.map((ev) => evRow(cls, ev)) : h('div', { class: 'muted', style: { padding: '8px 4px' } }, 'Aucune évaluation pour cette activité.'),
    btn('Nouvelle évaluation', { icon: 'plus', cls: 'small', onClick: () => newEvaluationDialog({ cls, activity: act }) }));
}

function progress(ev) {
  const t = ev.students.map((s) => studentTotals(ev, s.id));
  return `${t.filter((x) => x.final != null).length}/${t.filter((x) => x.usable).length} notés`;
}

function evRow(cls, ev) {
  const open = () => go('eval', { id: ev.id, from: 'classPage', classId: cls.id });
  const more = iconBtn('more', 'Actions', (e) => {
    e.stopPropagation();
    popMenu(more, [
      { label: 'Dupliquer…', onClick: () => duplicateDialog(ev) },
      { label: 'Supprimer', danger: true, onClick: () => deleteEvaluation(ev) },
    ]);
  }, 'sm');
  return h('div', { class: 'evrow', role: 'button', tabindex: 0, onClick: open, onKeydown: (e) => { if (e.key === 'Enter') open(); } },
    h('div', { class: 'grow' }, h('div', { class: 't' }, ev.model.name || ev.model.activity), h('div', { class: 'muted small' }, `${fmtDate(ev.date)} · ${progress(ev)}`)), more);
}

async function deleteEvaluation(ev) {
  await app.repo.remove('evaluations', ev.id);
  render();
  toast(`Évaluation du ${fmtDate(ev.date)} supprimée.`, {
    action: 'Annuler', ms: 9000, onAction: async () => { await app.repo.restore('evaluations', ev.id); render(); },
  });
}

// ---------- Nouvelle activité / renommer ----------

function newActivityDialog(cls) {
  const names = [...new Set([...app.repo.list('models').map((m) => m.activity), ...app.repo.list('classes').flatMap((c) => activitiesOf(c).map((a) => a.name))])]
    .filter(Boolean).sort(collator.compare);
  const st = { name: '', tools: new Set(['evaluation']) };
  const dup = (n) => activitiesOf(cls).some((a) => a.name.trim().toLowerCase() === n.trim().toLowerCase());
  const dlg = openDialog({
    title: `Nouvelle activité · ${cls.name}`,
    body: [
      h('label', { class: 'field' }, 'Nom de l\'activité',
        h('input', { type: 'text', list: 'act-names', placeholder: 'Handball, Badminton…', autofocus: true, onInput: (e) => { st.name = e.target.value; } }),
        h('datalist', { id: 'act-names' }, names.map((n) => h('option', { value: n })))),
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
      const act = newActivity(name, [...st.tools]);
      activitiesOf(cls).push(act);
      if (st.tools.has('evaluation')) E.open.add(act.id);
      dlg.close();
      render();
      await saveClass(cls);
      return false;
    } }],
  });
}

function renameDialog(cls, act) {
  let name = act.name;
  const dlg = openDialog({
    title: 'Renommer l\'activité',
    body: h('label', { class: 'field' }, 'Nom', h('input', { type: 'text', value: act.name, autofocus: true, onInput: (e) => { name = e.target.value; } })),
    actions: [{ label: 'Annuler' }, { label: 'Enregistrer', primary: true, keepOpen: true, onClick: async () => {
      name = name.trim();
      if (!name) return false;
      if (activitiesOf(cls).some((a) => a !== act && a.name.trim().toLowerCase() === name.toLowerCase())) { toast('Ce nom existe déjà dans cette classe.'); return false; }
      act.name = name; dlg.close(); render(); await saveClass(cls); return false;
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
  const st = { actId: (activity || acts[0]).id, modelId: '', date: todayISO() };
  const body = h('div', { class: 'dlg-body', style: { padding: 0 } });
  const dlg = openDialog({ title: `Nouvelle évaluation · ${cls.name}`, body, actions: [{ label: 'Annuler' }, { label: 'Créer', primary: true, keepOpen: true, onClick: async () => {
    const act = acts.find((a) => a.id === st.actId), model = repo.get('models', st.modelId);
    try {
      const ev = createEvaluation({ cls, model, date: st.date, step: (repo.getMeta('settings', {}) || {}).step || 0.5 });
      ev.activityId = act.id;
      touchTool(act, 'evaluation');
      E.open.add(act.id);
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
    body.replaceChildren(
      h('label', { class: 'field' }, 'Activité', h('select', { value: st.actId, onChange: (e) => { st.actId = e.target.value; paint(); } },
        acts.map((a) => h('option', { value: a.id }, a.name)))),
      h('label', { class: 'field' }, 'Modèle d\'évaluation', h('select', { value: st.modelId, onChange: (e) => { st.modelId = e.target.value; } },
        ok.map((m) => h('option', { value: m.id }, `${m.activity} — ${m.name}`)))),
      h('label', { class: 'field' }, 'Date', h('input', { type: 'date', value: st.date, onChange: (e) => { st.date = e.target.value || todayISO(); } })),
      cls.students.some((s) => s.active !== false) ? null : h('p', { class: 'muted small' }, 'Cette classe n\'a pas encore d\'élèves : vous pourrez en ajouter dans l\'évaluation.'));
  };
  paint();
}
