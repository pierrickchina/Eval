// Accueil : navigateur d'évaluations, tri/filtre, nouvelle évaluation, duplication.
import { app, registerView, go, render, syncChip } from '../app.js';
import { h, btn, icon, iconBtn, classBadge, openDialog, popMenu, toast } from './dom.js';
import { fmtDate, todayISO, collator } from '../util.js';
import { createEvaluation, duplicateEvaluation } from '../logic/evaluation.js';
import { studentTotals } from '../logic/scoring.js';
import { shareBackup, backupText, backupNeedsAttention, changesSinceBackup } from './backup.js';

const F = { cls: '', act: '', sort: 'date' };

registerView('home', () => {
  const repo = app.repo;
  const all = repo.list('evaluations');
  const classNames = [...new Set(all.map((e) => e.classInfo.name))].sort(collator.compare);
  const acts = [...new Set(all.map((e) => e.model.activity))].sort(collator.compare);
  if (F.cls && !classNames.includes(F.cls)) F.cls = '';
  if (F.act && !acts.includes(F.act)) F.act = '';

  let list = all.filter((e) => (!F.cls || e.classInfo.name === F.cls) && (!F.act || e.model.activity === F.act));
  const cmp = {
    date: (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt),
    class: (a, b) => collator.compare(a.classInfo.name, b.classInfo.name) || (a.date < b.date ? 1 : -1),
    activity: (a, b) => collator.compare(a.model.activity, b.model.activity) || (a.date < b.date ? 1 : -1),
  }[F.sort];
  list = list.sort(cmp);

  const sel = (opts, value, onChange, firstLabel) =>
    h('select', { onChange: (e) => { onChange(e.target.value); render(); }, value }, firstLabel != null ? h('option', { value: '' }, firstLabel) : null,
      opts.map((o) => h('option', { value: o }, o)));

  const hasSetup = repo.list('classes').length && repo.list('models').length;

  return h('div', { class: 'main' },
    h('div', { class: 'topbar' },
      h('div', { class: 'grow evtitle' }, h('h1', null, 'EPS'), h('div', { class: 'sub' }, 'Évaluations')),
      syncChip(),
      btn('Réglages', { icon: 'gear', onClick: () => go('settings') }),
      btn('Nouvelle évaluation', { icon: 'plus', cls: 'primary', onClick: () => newEvaluationDialog() })),
    all.length || repo.list('classes').length ? backupBar() : null,
    all.length ? h('div', { class: 'toolbar' },
      sel(classNames, F.cls, (v) => (F.cls = v), 'Toutes les classes'),
      sel(acts, F.act, (v) => (F.act = v), 'Toutes les activités'),
      h('div', { class: 'seg' }, [['date', 'Date'], ['class', 'Classe'], ['activity', 'Activité']].map(([k, l]) =>
        h('button', { class: F.sort === k ? 'on' : '', onClick: () => { F.sort = k; render(); } }, l))),
      h('span', { class: 'muted small' }, `${list.length} évaluation${list.length > 1 ? 's' : ''}`)) : null,
    all.length
      ? h('div', { class: 'home-grid scroll grow', 'data-keep': 'home' }, list.map(evCard))
      : h('div', { class: 'empty' },
          h('h2', null, hasSetup ? 'Aucune évaluation pour l\'instant' : 'Bienvenue 👋'),
          h('p', null, hasSetup
            ? 'Touchez « Nouvelle évaluation » pour commencer.'
            : 'Pour commencer, créez une classe et un modèle d\'évaluation dans les réglages.'),
          hasSetup ? btn('Nouvelle évaluation', { icon: 'plus', cls: 'primary', onClick: () => newEvaluationDialog() })
            : btn('Ouvrir les réglages', { icon: 'gear', cls: 'primary', onClick: () => go('settings') })));
});

/** Rappel discret de la dernière sauvegarde, avec bouton de partage (Drive…) en une touche. */
function backupBar() {
  const warn = backupNeedsAttention(), n = changesSinceBackup();
  return h('div', { class: `backupbar ${warn ? 'warn' : ''}` },
    h('span', { class: 'grow' }, `${warn ? '⚠ ' : '✓ '}${backupText()}`, n && warn ? ` · ${n} élément(s) modifié(s) depuis` : ''),
    btn('Sauvegarder', { icon: 'cloud', cls: 'small', onClick: async () => { await shareBackup(); render(); } }));
}

function evCard(ev) {
  const more = iconBtn('more', 'Actions', (e) => {
    e.stopPropagation();
    popMenu(more, [
      { label: 'Dupliquer…', onClick: () => duplicateDialog(ev) },
      { label: 'Supprimer', danger: true, onClick: () => deleteEvaluation(ev) },
    ]);
  }, 'sm');
  return h('div', { class: 'card', role: 'button', tabindex: 0, onClick: () => go('eval', { id: ev.id }),
    onKeydown: (e) => { if (e.key === 'Enter') go('eval', { id: ev.id }); } },
  classBadge(ev.classInfo.color, 48),
  h('div', { class: 'body' },
    h('div', { class: 't' }, ev.classInfo.name),
    h('div', { class: 'a' }, ev.model.activity),
    h('div', { class: 'd' }, `${fmtDate(ev.date)} · ${progress(ev)}`)),
  more);
}

/** Avancement : élèves dont la note finale est complète / élèves présents. */
function progress(ev) {
  const t = ev.students.map((s) => studentTotals(ev, s.id));
  const present = t.filter((x) => x.usable).length;
  return `${t.filter((x) => x.final != null).length}/${present} notés`;
}

async function deleteEvaluation(ev) {
  await app.repo.remove('evaluations', ev.id);
  render();
  toast(`Évaluation « ${ev.classInfo.name} · ${ev.model.activity} » supprimée.`, {
    action: 'Annuler', ms: 9000,
    onAction: async () => { await app.repo.restore('evaluations', ev.id); render(); },
  });
}

// ---------- Nouvelle évaluation ----------

export function newEvaluationDialog() {
  const repo = app.repo;
  const classes = repo.list('classes').sort((a, b) => collator.compare(a.name, b.name));
  const models = repo.list('models');
  if (!classes.length || !models.length) {
    openDialog({
      title: 'Nouvelle évaluation',
      body: h('p', { class: 'dlg-msg' }, !classes.length
        ? 'Créez d\'abord un groupe classe dans les réglages.'
        : 'Créez d\'abord un modèle d\'évaluation dans les réglages.'),
      actions: [{ label: 'Annuler' }, { label: 'Ouvrir les réglages', primary: true, onClick: () => go('settings', { tab: !classes.length ? 'classes' : 'models' }) }],
    });
    return;
  }
  const st = { classId: classes[0].id, modelId: '', date: todayISO() };
  const body = h('div', { class: 'dlg-body', style: { padding: 0 } });
  const create = { label: 'Créer', primary: true, disabled: true, keepOpen: true, onClick: async (dlg) => {
    const cls = repo.get('classes', st.classId), model = repo.get('models', st.modelId);
    try {
      const ev = createEvaluation({ cls, model, date: st.date, step: (repo.getMeta('settings', {}) || {}).step || 0.5 });
      await repo.save('evaluations', ev);
      dlg.close();
      go('eval', { id: ev.id });
    } catch (e) { toast(e.message); }
    return false;
  } };
  const dlg = openDialog({ title: 'Nouvelle évaluation', body, actions: [{ label: 'Annuler' }, create] });
  const createBtn = () => dlg.foot.lastChild;

  const paint = () => {
    const cls = repo.get('classes', st.classId);
    const ok = models.filter((m) => m.levels[cls.level]).sort((a, b) => collator.compare(a.activity + a.name, b.activity + b.name));
    if (!ok.some((m) => m.id === st.modelId)) st.modelId = ok[0]?.id || '';
    body.replaceChildren(
      h('label', { class: 'field' }, 'Groupe classe',
        h('select', { value: st.classId, onChange: (e) => { st.classId = e.target.value; paint(); } },
          classes.map((c) => h('option', { value: c.id }, `${c.name} (${c.level}) — ${c.students.filter((s) => s.active !== false).length} élèves`)))),
      ok.length
        ? h('label', { class: 'field' }, 'Activité / modèle d\'évaluation',
            h('select', { value: st.modelId, onChange: (e) => { st.modelId = e.target.value; } },
              ok.map((m) => h('option', { value: m.id }, `${m.activity} — ${m.name}`))))
        : h('p', { class: 'dlg-msg', style: { color: 'var(--danger)' } }, `Aucun modèle ne contient de tableau pour le niveau ${cls.level}. Ajoutez ce niveau à un modèle dans les réglages.`),
      h('label', { class: 'field' }, 'Date', h('input', { type: 'date', value: st.date, onChange: (e) => { st.date = e.target.value || todayISO(); } })),
      cls.students.some((s) => s.active !== false) ? null : h('p', { class: 'muted small' }, 'Cette classe n\'a pas encore d\'élèves : vous pourrez en ajouter dans l\'évaluation.'));
    createBtn().disabled = !ok.length;
  };
  paint();
}

// ---------- Duplication ----------

export function duplicateDialog(ev) {
  const repo = app.repo;
  const cls = repo.get('classes', ev.classId);
  const o = { date: todayISO(), groups: true, results: false, sync: !!cls && !cls.deleted };
  const chk = (key, label, hint) =>
    h('label', { class: 'row', style: { alignItems: 'flex-start' } },
      h('input', { type: 'checkbox', checked: o[key], style: { width: '22px', height: '22px', marginTop: '2px' }, onChange: (e) => { o[key] = e.target.checked; } }),
      h('span', null, label, hint ? h('div', { class: 'muted small' }, hint) : null));
  openDialog({
    title: 'Dupliquer l\'évaluation',
    body: [
      h('p', { class: 'muted', style: { margin: 0 } }, `${ev.classInfo.name} · ${ev.model.activity} (${fmtDate(ev.date)})`),
      h('label', { class: 'field' }, 'Date de la nouvelle évaluation', h('input', { type: 'date', value: o.date, onChange: (e) => { o.date = e.target.value || todayISO(); } })),
      chk('groups', 'Reprendre les équipes et groupes de niveau'),
      cls && !cls.deleted ? chk('sync', 'Mettre à jour la liste d\'élèves avec la classe actuelle', 'Inclut les élèves arrivés depuis ; retire ceux qui sont partis.') : null,
      chk('results', 'Copier aussi les résultats et statuts', 'Par défaut, la nouvelle évaluation démarre vide.'),
    ],
    actions: [{ label: 'Annuler' }, { label: 'Dupliquer', primary: true, onClick: async () => {
      const copy = duplicateEvaluation(ev, { date: o.date, cls: o.sync ? cls : null, keepGroups: o.groups, keepResults: o.results, syncStudents: o.sync });
      await repo.save('evaluations', copy);
      go('eval', { id: copy.id });
    } }],
  });
}
