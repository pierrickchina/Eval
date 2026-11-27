// Activités d'une classe (APSA travaillée avec cette classe) et outils qu'elles contiennent.
// Les activités sont stockées DANS l'enregistrement de la classe : cls.activities = [{ id, name, tools, createdAt }].
// Un outil = { type, addedAt, lastUsed }. Les évaluations sont rattachées par ev.activityId.
import { uid, now } from '../util.js';

/** Registre des outils. available:false → affiché « bientôt » (structure prête, outil à venir). */
export const TOOLS = {
  evaluation: { label: 'Évaluation', icon: 'file', available: true, hint: 'Grilles, notes, bilans' },
  tournoi: { label: 'Suivi de tournoi', icon: 'users', available: false, hint: 'Bientôt' },
  tables: { label: 'Suivi des tables', icon: 'users', available: false, hint: 'Bientôt (tennis de table)' },
};
export const toolLabel = (type) => (TOOLS[type] ? TOOLS[type].label : type);

const key = (s) => String(s || '').trim().toLowerCase();
const DAY = 86400000;

export function newActivity(name, types = ['evaluation'], t = now()) {
  return { id: uid(), name: String(name).trim(), tools: types.map((type) => ({ type, addedAt: t, lastUsed: t })), createdAt: t };
}

export const activitiesOf = (cls) => (Array.isArray(cls.activities) ? cls.activities : (cls.activities = []));
export const activityEvals = (evals, cls, act) =>
  evals.filter((e) => !e.deleted && e.classId === cls.id && e.activityId === act.id)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.createdAt || 0) - (a.createdAt || 0)));

export function hasTool(act, type) { return act.tools.some((t) => t.type === type); }
export function touchTool(act, type, t = now()) { const x = act.tools.find((y) => y.type === type); if (x) x.lastUsed = t; }

/**
 * Migration / réparation (idempotente) : toute évaluation sans activité valide est rangée dans l'activité
 * de même nom (modèle) de sa classe, créée si besoin avec l'outil Évaluation. Supprime l'ancien champ infos.
 * Retourne { classes: [classes modifiées], evals: [évaluations modifiées] } (objets mutés en place).
 */
export function ensureActivities(classes, evals, t = now()) {
  const dirtyC = new Set(), dirtyE = [];
  const byId = new Map(classes.filter((c) => !c.deleted).map((c) => [c.id, c]));
  for (const c of byId.values()) {
    if (!Array.isArray(c.activities)) { c.activities = []; dirtyC.add(c); }
    if ('infos' in c) { delete c.infos; dirtyC.add(c); }
  }
  for (const ev of evals) {
    if (ev.deleted) continue;
    const cls = byId.get(ev.classId);
    if (!cls) continue;
    const ok = ev.activityId && cls.activities.some((a) => a.id === ev.activityId);
    if (ok) {
      const a = cls.activities.find((x) => x.id === ev.activityId);
      if (!hasTool(a, 'evaluation')) { a.tools.push({ type: 'evaluation', addedAt: t, lastUsed: t }); dirtyC.add(cls); }
      continue;
    }
    const name = (ev.model && ev.model.activity) || 'Activité';
    let act = cls.activities.find((a) => key(a.name) === key(name));
    if (!act) { act = newActivity(name, ['evaluation'], ev.createdAt || t); cls.activities.push(act); dirtyC.add(cls); }
    else if (!hasTool(act, 'evaluation')) { act.tools.push({ type: 'evaluation', addedAt: t, lastUsed: t }); dirtyC.add(cls); }
    ev.activityId = act.id; dirtyE.push(ev);
    const last = Math.max(act.tools.find((x) => x.type === 'evaluation').lastUsed || 0, ev.updatedAt || ev.createdAt || 0);
    act.tools.find((x) => x.type === 'evaluation').lastUsed = last;
  }
  return { classes: [...dirtyC], evals: dirtyE };
}

/** Outils affichés : utilisés/ajoutés récemment (≤ days), au plus max ; les autres sont derrière le « + ». */
export function visibleTools(tools, t = now(), { days = 60, max = 6 } = {}) {
  const sorted = [...tools].sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0));
  const shown = [], hidden = [];
  for (const x of sorted) (shown.length < max && t - (x.lastUsed || x.addedAt || 0) <= days * DAY ? shown : hidden).push(x);
  if (!shown.length && hidden.length) shown.push(hidden.shift()); // jamais un cadre sans aucun outil visible
  const order = new Map(tools.map((x, i) => [x.type, i]));
  shown.sort((a, b) => order.get(a.type) - order.get(b.type)); // ordre stable (les tuiles ne sautent pas)
  hidden.sort((a, b) => order.get(a.type) - order.get(b.type));
  return { shown, hidden };
}

/**
 * Ce qui serait supprimé (pour l'avertissement). type = null → toute l'activité.
 * Retourne { evals:[{id, label, date, notes, selfEvals, obs}], lines:[texte], empty }.
 */
export function deleteImpact(evals, cls, act, type = null) {
  const touchesEval = type == null || type === 'evaluation';
  const list = touchesEval ? activityEvals(evals, cls, act) : [];
  const items = list.map((ev) => {
    const cells = Object.values(ev.results || {}).flatMap((r) => Object.values(r || {}));
    const obs = cells.reduce((n, c) => n + ((c && c.obs && c.obs.length) || 0), 0);
    const marks = cells.filter((c) => c && (c.level != null || c.score != null)).length;
    return {
      id: ev.id, label: (ev.model && ev.model.name) || 'Évaluation', date: ev.date, marks, obs,
      notes: Object.values(ev.notes || {}).filter((n) => n && n.text).length,
      selfEvals: Object.values(ev.selfEval || {}).filter((s) => s && s.done).length,
      students: (ev.students || []).length,
    };
  });
  return { evals: items, empty: !items.length };
}

/** Outils libres (utilisables sans classe ni activité), proposés dans l'onglet Outils de l'accueil. Aucun pour l'instant. */
export const FREE_TOOLS = [];
