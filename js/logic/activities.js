// Activités d'une classe (APSA travaillée avec cette classe) et outils qu'elles contiennent.
// Les activités sont stockées DANS l'enregistrement de la classe : cls.activities = [{ id, name, tools, createdAt }].
// Un outil = { type, addedAt, lastUsed }. Les évaluations sont rattachées par ev.activityId.
import { uid, now } from '../util.js';

/** Couleurs pastel proposées pour les cadres d'activité (pas de rouge : le rouge est la couleur de l'outil Évaluation). */
export const ACTIVITY_COLORS = ['#cfe3ff', '#d6efd2', '#fff0b8', '#e4dbf8', '#cdeeea', '#ffe0c2', '#e6e6ec', '#dfe9c2'];
export const activityColor = (act) => act.color || ACTIVITY_COLORS[0];

/** Registre des outils. Chaque outil a SA couleur pastel, toujours la même, pour le repérer d'un coup d'œil.
 *  available:false → affiché « bientôt » (structure prête, outil à venir). */
export const TOOLS = {
  evaluation: { label: 'Évaluation', icon: 'file', color: '#f6b8b8', available: true, hint: 'Grilles, notes, bilans',
    help: ['Une grille d\'évaluation par séance ou par cycle, avec notes sur 20 et niveaux de maîtrise.', 'Touchez la tuile : elle ouvre l\'évaluation (ou la liste s\'il y en a plusieurs).', 'Le « + » du cadre crée une nouvelle évaluation.'] },
  chrono: { label: 'Chronomètre', icon: 'chrono', color: '#fbe08a', available: true, free: true, route: 'chrono', hint: 'Grand affichage, 1 à 4 panneaux',
    help: ['Affiche en très gros un chronomètre ou un minuteur, lisible de toute la salle ; jusqu\'à 4 panneaux côte à côte.', 'Chaque panneau est un chronomètre ou un minuteur ; « +1 min » et « Tout démarrer » vont plus vite.', 'Rien n\'est enregistré : tout s\'efface en quittant.'] },
  equipes: { label: 'Équipes', icon: 'teams', color: '#f5c28a', available: true, free: true, route: 'equipes', hint: 'Compositions, clubs, tirages',
    help: ['Composez vos équipes en glissant les élèves, ou laissez l\'outil tirer au sort, par niveau ou en duos de tutorat.', 'Chaque équipe a un nom et une couleur de chasuble ; les rôles et les contraintes (ensemble / séparés) restent discrets.', 'Gardez une composition par leçon : dupliquez-la, modifiez-la, l\'ancienne reste consultable.'] },
  tournoi: { label: 'Suivi de tournoi', icon: 'trophy', color: '#b8d4f6', available: false, hint: 'Bientôt' },
  tables: { label: 'Suivi des tables', icon: 'racket', color: '#b8e6bd', available: false, hint: 'Bientôt (tennis de table)' },
};
/** Nom affiché d'une évaluation : le nom donné par l'enseignant, sinon l'activité du modèle (long : le nom de la grille). */
export const evTitle = (ev, long = false) => (ev.title && ev.title.trim()) || (ev.model && ((long && ev.model.name) || ev.model.activity)) || 'Évaluation';
/** Couleurs réservées aux futurs outils (une par outil, jamais deux fois la même). */
export const toolColor = (type) => (TOOLS[type] && TOOLS[type].color) || '#d9d9e3';
export const toolLabel = (type) => (TOOLS[type] ? TOOLS[type].label : type);

const key = (s) => String(s || '').trim().toLowerCase();
const DAY = 86400000;

export function newActivity(name, types = ['evaluation'], t = now(), color = ACTIVITY_COLORS[0]) {
  return { id: uid(), name: String(name).trim(), color, tools: types.map((type) => ({ type, addedAt: t, lastUsed: t })), createdAt: t };
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
    c.activities.forEach((a, i) => { if (!a.color) { a.color = ACTIVITY_COLORS[i % ACTIVITY_COLORS.length]; dirtyC.add(c); } });
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
    if (!act) { act = newActivity(name, ['evaluation'], ev.createdAt || t, ACTIVITY_COLORS[cls.activities.length % ACTIVITY_COLORS.length]); cls.activities.push(act); dirtyC.add(cls); }
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

/** Outils libres (utilisables sans classe ni activité), proposés dans l'onglet Outils de l'accueil. */
export const FREE_TOOLS = Object.entries(TOOLS).filter(([, t]) => t.free && t.available).map(([type]) => type);
