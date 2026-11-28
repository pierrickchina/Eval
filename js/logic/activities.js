// Activités d'une classe (APSA travaillée avec cette classe) et outils qu'elles contiennent.
// Les activités sont stockées DANS l'enregistrement de la classe : cls.activities = [{ id, name, tools, createdAt }].
// Un outil = { type, addedAt, lastUsed }. Les évaluations sont rattachées par ev.activityId.
import { uid, now } from '../util.js';

/** Couleurs pastel proposées pour les cadres d'activité (pas de rouge : le rouge est la couleur de l'outil Évaluation). */
/** Couleurs d'activité (1.8) : elles encadrent l'activité dans le carnet (cadre + en-tête). */
export const ACTIVITY_COLORS = ['#9dcfe0', '#a9d3b0', '#ead27a', '#c2b4ec', '#9fd9c8', '#f2b796', '#b7c1d3', '#efb0bc'];
// anciennes couleurs (≤ 1.7) → nouvelles, même ordre
const LEGACY_ACT = { '#cfe3ff': '#9dcfe0', '#d6efd2': '#a9d3b0', '#fff0b8': '#ead27a', '#e4dbf8': '#c2b4ec', '#cdeeea': '#9fd9c8', '#ffe0c2': '#f2b796', '#e6e6ec': '#b7c1d3', '#dfe9c2': '#efb0bc' };
export const activityColor = (act) => LEGACY_ACT[act.color] || act.color || ACTIVITY_COLORS[0];

/** Registre des outils. Chaque outil a SA couleur pastel, toujours la même, pour le repérer d'un coup d'œil.
 *  available:false → affiché « bientôt » (structure prête, outil à venir). */
export const TOOLS = {
  evaluation: { label: 'Évaluation', icon: 'file', color: '#dcd3f3', available: true, hint: 'Grilles, notes, bilans',
    help: ['Une grille d\'évaluation par séance ou par cycle, avec notes sur 20 et niveaux de maîtrise.', 'Touchez la tuile : elle ouvre l\'évaluation (ou la liste s\'il y en a plusieurs).', 'Le « + » du cadre crée une nouvelle évaluation.'] },
  chrono: { label: 'Chronomètre', icon: 'chrono', color: '#f4e6ae', available: true, free: true, route: 'chrono', hint: 'Grand affichage, 1 à 4 panneaux',
    help: ['Affiche en très gros un chronomètre ou un minuteur, lisible de toute la salle ; jusqu\'à 4 panneaux côte à côte.', 'Chaque panneau est un chronomètre ou un minuteur ; « +1 min » et « Tout démarrer » vont plus vite.', 'Rien n\'est enregistré : tout s\'efface en quittant.'] },
  equipes: { label: 'Équipes', icon: 'teams', color: '#f8d7c4', available: true, free: true, route: 'equipes', hint: 'Compositions, clubs, tirages',
    help: ['Composez vos équipes en glissant les élèves, ou laissez l\'outil tirer au sort, par niveau ou en duos de tutorat.', 'Chaque équipe a un nom et une couleur de chasuble ; les rôles et les contraintes (ensemble / séparés) restent discrets.', 'Bandeau « non placés » et zones « à répartir » : double-tap (ou toucher leur titre) pour voir tous les noms.', 'Gardez une composition par leçon : dupliquez-la, modifiez-la, l\'ancienne reste consultable.'] },
  tournoi: { label: 'Tournoi', icon: 'trophy', color: '#cde7f0', family: 'collectif', available: true, free: true, route: 'tournoi', hint: 'Calendrier équilibré, table de marque',
    help: ['Choisissez les équipes, le sport et la durée : l\'outil prépare un calendrier où chacun joue et arbitre autant, avec des repos bien répartis.', 'Table de marque lisible de loin (paysage ou portrait) : gros boutons +1 aux couleurs des maillots, chrono, « Ensuite : » pour préparer le match suivant. Toucher un match de la liste pour l\'échanger, changer l\'arbitre ou corriger un score.', 'Dans une activité, les équipes viennent de l\'outil Équipes et les résultats sont conservés.'] },
  tables: { label: 'Tables', icon: 'paddle', color: '#cfe8cf', family: 'raquette', available: true, route: 'tables', hint: 'Montante-descendante, duos, ronde',
    help: ['Répartit les élèves sur les tables (8 au plus) : libre, par niveau moyen, ou d\'après les résultats de la séance précédente ; aussi en duos ou en ronde à l\'italienne.', 'Pendant la séance, rangez le classement final de chaque table : il ne change rien tout de suite. À la séance suivante, le 1er monte, le dernier descend, les autres restent.', 'Un élève inapte ou absent va dans la case « Inapte » et sa table se réorganise. Les feuilles de poule restent sur papier : la tablette garde seulement qui gagne et qui perd.'] },
  rings: { label: 'Rings', icon: 'glove', color: '#f3d3d8', family: 'combat', available: true, route: 'rings', hint: 'Groupes de combat, montée et descente',
    help: ['Répartit les élèves en groupes sur les rings (8 au plus) : libre, par niveau moyen, ou d\'après les résultats de la séance précédente.', 'Rangez le classement final de chaque ring pendant la séance : il prend effet à la séance suivante (le 1er monte, le dernier descend).', 'Le niveau atteint (rings hauts, intermédiaires, derniers) est proposé dans l\'évaluation, pour la compétence « Performance ».'] },
  mariokart: { label: 'Mario Kart', icon: 'flag', color: '#f6d6e6', family: 'course', available: true, free: true, route: 'mariokart', hint: 'Chrono, tours, malus, cadeaux',
    help: ['Règle V1, V2 ou V3 (⋮ › Réglages) : chrono de course (12 min), tours, malus, objectif en cc, pièces en V3 (10 pièces = 1 cadeau).', '« Tirer un cadeau » tire un bonus au hasard et affiche son effet. Total = tours × 2 − malus + points de l\'objectif validé.', 'Les compteurs restent en mémoire jusqu\'à « Remettre à zéro » ; « Corriger » fait retirer 1 à chaque toucher.'] },
  circuit: { label: 'Circuit training', icon: 'bolt', color: '#d8e2f6', available: true, free: true, route: 'circuit', hint: 'Chrono, exercices, circuits',
    help: ['Chrono : travail, récupération, exercices, tours. Un cadenas fige un réglage, les autres s\'ajustent. Préréglages : 5 min Workout, 8 min Workout, 30 s / 30 s.', 'Exercices : 24 fiches illustrées, triées par couleur (haut du corps, bas du corps, gainage, cardio), tirage au hasard, matériel à cocher.', 'Circuits : donnez un nom, choisissez les exercices ; dans le chrono, l\'écran affiche alors l\'exercice en cours et le suivant.'] },
  kivaou: { label: 'Kivaou', icon: 'compass', color: '#cfe8dc', available: true, route: 'kivaou', hint: 'Course d\'orientation : qui va où',
    help: ['Un groupe = des élèves + un parcours, puis GO : son minuteur part (orange à 2 min, rouge à 1 min, noir quand le temps est dépassé).', 'Le bandeau du haut dit toujours combien de groupes ne sont pas rentrés ; les retards passent en tête. « Arrivé » note l\'heure de retour.', 'Touchez un groupe rentré pour saisir ses balises. L\'onglet Bilan classe les élèves : temps + malus par balise manquée, hors temps toujours derniers. Départ groupé : ⋮.'] },
  duathlon: { label: 'Fiches Duathlon', icon: 'track', color: '#f1dcc6', family: 'course', available: true, free: true, route: 'duathlon', hint: 'Fiches élèves 4e et 3e',
    help: ['Affiche les fiches élèves du Duathlon 4e et 3e, en image.', 'Les élèves remplissent les fiches papier.', 'La note se calcule dans l\'évaluation (fiche de l\'élève › Saisir).'] },
  kabaddi: { label: 'Kabaddi', icon: 'hand', color: '#f7d4c0', available: true, free: true, route: 'kabaddi', hint: 'Attaques de 2 min, +100 / +10, Ace',
    help: ['Chaque équipe attaque chacune des autres pendant 2 minutes (chrono). Seuls les attaquants marquent.', 'Chaque joueur de l\'équipe qui attaque a son bouton : +100 pour sa 1re élimination, puis +10. Boutons d\'équipe : Ace +1000, Faute −1.', 'Tableau Attaque × Défense et total, lisible aussi au vidéoprojecteur.'] },
  boxefps: { label: 'Boxe française · rotation', icon: 'glovespin', color: '#f0cbd3', family: 'combat', available: true, free: true, route: 'boxefps', hint: 'Horloge des 6 ateliers, groupes A à F',
    help: ['Forme de pratique scolaire (3e) : 6 ateliers (assaut en 1 touche, assaut normal, coaching, deux fois), groupes A à F.', 'Chaque atelier garde sa place, sa couleur et son icône ; seules les lettres des groupes tournent.', 'Le chrono de 6 minutes s\'arrête et sonne à la fin ; « Rotation suivante » fait avancer chaque groupe d\'un atelier et relance le chrono. Onglet Fiche : la fiche d\'observation.'] },
  montee: { label: 'Montée de niveau', icon: 'lvlup', color: '#d7ecc4', family: 'raquette', available: true, route: 'montee', hint: '10 niveaux de défis, glisser-déposer',
    help: ['Trois fiches de 10 défis (et une vierge), modifiables (⋮). Glissez le prénom de l\'élève sur son niveau.', 'Tout le monde part du niveau 1. Les niveaux vides restent petits mais leur défi reste lisible.', 'Toucher un prénom : monter, descendre ou choisir le niveau.'] },
  interclasses: { label: 'Interclasses', icon: 'cupwreath', color: '#d6e2f5', family: 'collectif', available: true, free: true, freeOnly: true, route: 'interclasses', hint: 'Classes A à E, deux tournois',
    help: ['Ultimate (6e, 4e) ou basket (5e, 3e) : chaque classe a deux équipes (Frisbee / Disque, ou filles / garçons) ; un seul terrain possible, les tournois alternent.', 'Scores saisis comme dans le Tournoi (avec ou sans table de marque) ; sponsor = bonus réglable.', 'Onglets Classements / Titres : lisibles aussi au vidéoprojecteur.'] },
  rotation: { label: 'Rotation d\'ateliers', icon: 'cycle', color: '#d9e6c8', available: true, free: true, route: 'rotation', hint: 'Ateliers, groupes, temps : les groupes tournent',
    help: ['Réglez le nombre d\'ateliers, leur titre et leur couleur, les groupes et le temps sur un atelier (⋮ › Réglages).', 'Les ateliers restent à leur place ; seules les lettres des groupes tournent, dans le sens des flèches.', 'Au bout du temps, le chrono sonne : « Rotation suivante » fait avancer les groupes et relance le chrono.'] },
  arbitre: { label: 'Certificat de rôle', icon: 'whistle', color: '#ece0bd', available: true, route: 'arbitre', hint: 'Arbitre, juge, coach : niveaux bronze, argent, or',
    help: ['Un certificat par activité et par rôle (arbitre, juge-spectateur, coach) : 4 niveaux dans les mots de l\'élève, pris dans les grilles du Projet EPS.', 'L\'élève peut s\'auto-évaluer (repère « auto-éval. faite » dans la liste) ; l\'enseignant valide le niveau.', 'Le badge du rôle (bronze, argent, or) s\'affiche à côté du prénom dans les outils de l\'activité.'] },
  vma: { label: 'Test VMA', icon: 'shuttle', color: '#f3e3b8', family: 'course', available: true, free: true, route: 'vma', hint: 'Léger navette 20 m, bips et allures',
    help: ['Léger navette 20 m : départ 8,5 km/h, +0,5 km/h par palier d\'1 minute. La tablette donne les bips.', 'Quand un élève s\'arrête, touchez son prénom (ou notez le palier) : sa VMA s\'affiche.', 'Tableau d\'allures : distance à parcourir en 30 s, 1 min et 3 min selon le % de VMA.'] },
};
/** Nom affiché d'une évaluation : le nom donné par l'enseignant, sinon l'activité du modèle (long : le nom de la grille). */
export const evTitle = (ev, long = false) => (ev.title && ev.title.trim()) || (ev.model && ((long && ev.model.name) || ev.model.activity)) || 'Évaluation';
/** Couleurs réservées aux futurs outils (une par outil, jamais deux fois la même). */
/** Outils proposés d'office selon le nom de l'activité (l'évaluation est toujours cochée). */
export function toolsForActivity(name) {
  const n = String(name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const t = ['evaluation'];
  if (/circuit|\bct\b|renfo/.test(n)) t.push('circuit');
  if (/tennis de table|ping|\btt\b/.test(n)) t.push('tables', 'montee');
  if (/boxe|\bbf\b/.test(n)) t.push('rings', 'boxefps');
  if (/lutte|judo|combat/.test(n)) t.push('rings', 'chrono');
  if (/kabaddi/.test(n)) t.push('kabaddi');
  if (/mario|\bmk\b/.test(n)) t.push('mariokart');
  if (/duathlon/.test(n)) t.push('duathlon', 'vma', 'chrono');
  if (/jeux? athl/.test(n)) t.push('mariokart', 'vma', 'chrono');
  if (/orientation|\bco\b|kivaou/.test(n)) t.push('kivaou');
  if (/hand|basket|foot|futsal|ultimate|volley|rugby|football/.test(n)) t.push('equipes', 'tournoi', 'chrono');
  if (/acro|danse/.test(n)) t.push('equipes', 'chrono');
  if (/gym/.test(n)) t.push('chrono');
  return [...new Set(t)].filter((x) => TOOLS[x]?.available);
}
/** Rubriques de l'onglet Outils (1.13). */
export const TOOL_SECTIONS = { all: ['chrono', 'tournoi', 'interclasses', 'rotation', 'arbitre'], other: ['equipes'] };
/** Outils généraux : proposés dans toutes les activités. */
export const GENERAL_TOOLS = ['evaluation', 'chrono', 'equipes', 'tournoi', 'arbitre', 'rotation'];
/** Outils spécialisés : les activités auxquelles ils sont liés (un outil peut servir à plusieurs activités). */
export const TOOL_GROUPS = [
  { label: 'Jeux athlétiques et Duathlon', re: /jeux? athl|duathlon|athle/, tools: ['mariokart', 'vma', 'duathlon'] },
  { label: 'Circuit training', re: /circuit|\bct\b|renfo/, tools: ['circuit'] },
  { label: 'Boxe et lutte', re: /boxe|\bbf\b|lutte|judo|combat/, tools: ['boxefps', 'rings', 'kabaddi'] },
  { label: 'Tennis de table', re: /tennis de table|ping|\btt\b/, tools: ['tables', 'montee'] },
  { label: 'Course d\'orientation', re: /orientation|\bco\b/, tools: ['kivaou'] },
];
const TOOL_ACTS = {
  mariokart: /jeux? athl|duathlon/, vma: /jeux? athl|duathlon/, duathlon: /duathlon/,
  circuit: /circuit|\bct\b|renfo|boxe|\bbf\b/, kivaou: /orientation|\bco\b/, tables: /tennis de table|ping|\btt\b/, montee: /tennis de table|ping|\btt\b/,
  kabaddi: /boxe|\bbf\b|lutte|kabaddi/, rings: /boxe|\bbf\b|lutte|judo|combat/, boxefps: /boxe|\bbf\b/,
};
const normName = (name) => String(name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
/** Cet outil est-il proposé pour cette activité ? (généraux : toujours ; spécialisés : selon l'activité) */
export const toolFits = (type, activityName) => GENERAL_TOOLS.includes(type) || !!TOOL_ACTS[type]?.test(normName(activityName));
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
