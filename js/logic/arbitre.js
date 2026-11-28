// Certificat de rôle (1.13, remplace la Certification d'arbitre de la 1.12) : un certificat PAR ACTIVITÉ et PAR RÔLE
// (arbitre, juge-spectateur, coach). Niveaux dans les mots de l'élève, pris dans les grilles du Projet EPS.
// act.arbitre = { roles: [{ id, kind, label, levels:[4], criteria:[{id,name,text}] }], modes: { self, teacher },
//                 students: { sid: { [roleId]: { self:{critId: 0..3}, selfLevel, level, levelAt } } } }
// L'appli ne propose jamais de niveau : le niveau retenu est celui de l'enseignant (sans sa validation : celui de l'élève).

export const KINDS = { arbitre: { label: 'Arbitre', icon: 'whistle' }, juge: { label: 'Juge-spectateur', icon: 'eye' }, coach: { label: 'Coach', icon: 'megaphone' } };
export const WHISTLE = [null, { name: 'bronze', color: '#b9733a' }, { name: 'argent', color: '#8e99a8' }, { name: 'or', color: '#d4a20a' }];
export const SELF_SCALE = ['Pas encore', 'En partie', 'Oui', 'Très bien'];
export const AR_LEVELS = ['Non certifié', 'Jeune officiel', 'Arbitre certifié', 'Arbitre référent'];

const C = (id, name, text) => ({ id, name, text });
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const ARB_CRIT = (third) => [C('regle', 'Règlement', 'Je connais les règles et je les applique.'), C('decision', 'Décision', 'Je décide vite et juste, et je l\'annonce clairement (voix, geste, sifflet).'), third, C('attitude', 'Attitude', 'Je reste calme et impartial, je m\'impose avec respect.')];
const R = (kind, label, levels, criteria) => ({ kind, label, levels, criteria });

/** Rôles pré-remplis selon l'activité (tableau validé avec l'enseignant). */
export function defaultRoles(activityName) {
  const n = norm(activityName);
  if (/tennis de table|ping|\btt\b/.test(n)) return [R('arbitre', 'Arbitre', ['Je ne compte pas encore', 'Arbitre compteur', 'Arbitre polyvalent', 'Arbitre organisateur'],
    [C('regle', 'Règlement', 'Je connais le comptage, le service et les changements de côté.'), C('feuille', 'Score', 'J\'annonce le score et je remplis la feuille sans erreur.'), C('organise', 'Organisation', 'J\'organise la rencontre (qui sert, qui joue ensuite).'), C('attitude', 'Attitude', 'Je reste concentré et je justifie mes choix avec fermeté et diplomatie.')])];
  if (/basket/.test(n)) return [R('arbitre', 'Arbitre', ['Je ne siffle pas encore', 'Arbitre d\'une règle', 'Arbitre polyvalent', 'Co-arbitre référent'],
    [C('present', 'Présence', 'Je suis présent·e, je suis le jeu et je me déplace.'), C('regle', 'Règle', 'Je reconnais et je siffle la règle confiée (puis plusieurs règles).'), C('equipe', 'Co-arbitrage', 'Je communique avec mon co-arbitre.'), C('attitude', 'Attitude', 'Je siffle juste, ni pour tout ni pour rien.')])];
  if (/hand/.test(n)) return [R('arbitre', 'Arbitre', ['Je découvre', 'Arbitre de table', 'Arbitre de champ', 'Arbitre référent'], ARB_CRIT(C('placement', 'Placement', 'Je me déplace avec le jeu pour bien voir l\'action.')))];
  if (/ultimate|ulti/.test(n)) return [R('arbitre', 'Joueur-arbitre', ['J\'appelle le prof', 'Je reconnais mes fautes', 'Joueur-arbitre', 'Joueur-arbitre-juge'],
    [C('fautes', 'Fautes', 'Je reconnais mes fautes.'), C('regle', 'Règles', 'Je connais les règles et je les applique.'), C('desaccord', 'Désaccord', 'En cas de désaccord, je discute calmement et je trouve un compromis.')])];
  if (/acro/.test(n)) return [R('juge', 'Spectateur-juge', ['Spectateur', 'Spectateur attentif', 'Spectateur-juge', 'Juge référent'],
    [C('concentre', 'Concentration', 'Je suis concentré du début à la fin.'), C('fiche', 'Fiche', 'Je m\'appuie sur la fiche (FIT / ART) pour juger.'), C('avis', 'Avis', 'Je donne un avis juste et bienveillant.')])];
  if (/danse/.test(n)) return [R('juge', 'Spectateur', ['Spectateur distrait', 'Spectateur respectueux', 'Spectateur critique', 'Spectateur-conseiller'],
    [C('respect', 'Respect', 'Je regarde en silence et je respecte le travail des autres.'), C('outils', 'Observation', 'Je m\'appuie sur les outils donnés pour faire un retour.'), C('avis', 'Avis', 'Je donne un retour bienveillant et pertinent.')])];
  if (/boxe|\bbf\b/.test(n)) return [
    R('arbitre', 'Arbitre-juge', ['Je découvre', 'Juge (je tiens la fiche)', 'Arbitre', 'Arbitre-juge référent'], ARB_CRIT(C('placement', 'Placement', 'Je reste auprès des tireurs et je sépare au « Stop ».'))),
    R('coach', 'Coach (partenaire de sparring)', ['Je ne sais pas encore', 'Sparring immobile', 'Sparring en mouvement', 'Sparring adapté au boxeur'],
      [C('cibles', 'Cibles', 'Je présente des cibles claires et pertinentes.'), C('rythme', 'Rythme', 'Je me déplace et j\'adapte le rythme au boxeur.'), C('riposte', 'Riposte', 'Je riposte si son niveau le permet.')])];
  if (/lutte|judo|combat/.test(n)) return [R('arbitre', 'Arbitre / Juge', ['Je découvre', 'Juge (décompte, fiche)', 'Arbitre (sécurité, arrêts)', 'Arbitre-juge référent'],
    ARB_CRIT(C('securite', 'Sécurité', 'J\'arrête le combat pour la sécurité, la fin, le tombé.')))];
  if (/duathlon/.test(n)) return [R('coach', 'Coach', ['Je regarde sans aider', 'Coach compteur', 'Coach de passage', 'Coach-conseiller'],
    [C('fiche', 'Fiche', 'Je remplis la fiche d\'observation sans oubli et je récupère le vortex.'), C('passage', 'Passages', 'J\'annonce les temps de passage et la zone de lancer.'), C('conseil', 'Conseil', 'J\'encourage et je conseille mon coureur avant, pendant et après.')])];
  if (/circuit|\bct\b|renfo/.test(n)) return [R('coach', 'Coach', ['Je regarde sans corriger', 'Coach qui encourage', 'Coach correcteur', 'Coach expert'],
    [C('concentre', 'Concentration', 'Je suis concentré sur mon sportif, sans le déranger.'), C('corrige', 'Correction', 'Je corrige avec les fiches fournies.'), C('encourage', 'Encouragement', 'J\'encourage mon camarade.')])];
  return [R('arbitre', 'Arbitre', AR_LEVELS.slice(), ARB_CRIT(C('placement', 'Placement', 'Je me place pour bien voir l\'action.')))];
}

export function arbitreOf(act) {
  act.arbitre ??= {};
  const A = act.arbitre;
  if (!A.roles) { // 1re ouverture, ou reprise d'un certificat 1.12 (un seul rôle « arbitre »)
    const roles = defaultRoles(act.name).map((r, i) => ({ id: `r${i + 1}`, ...r }));
    if (A.levels) { roles[0].levels = A.levels; roles[0].criteria = A.criteria || roles[0].criteria; }
    const old = A.students || {};
    A.students = {};
    for (const [sid, r] of Object.entries(old)) if (r && ('level' in r || 'self' in r)) A.students[sid] = { r1: { self: r.self || {}, selfLevel: r.selfLevel ?? null, level: r.level ?? null } };
    A.roles = roles; delete A.levels; delete A.criteria;
  }
  A.students ??= {};
  A.modes = { self: A.modes?.self !== false, teacher: A.modes?.teacher !== false };
  return A;
}
export const roleOf = (A, roleId) => A.roles.find((r) => r.id === roleId) || A.roles[0];
export const recOf = (A, sid, roleId) => ((A.students[sid] ??= {})[roleId] ??= { self: {}, selfLevel: null, level: null });
const peek = (A, sid, roleId) => A?.students?.[sid]?.[roleId] || null;

/** Niveau retenu (0 à 3, ou null) pour un rôle. */
export function levelOf(A, sid, roleId) {
  const r = peek(A, sid, roleId);
  if (!r) return null;
  if (A.modes?.teacher !== false) return r.level ?? null;
  return A.modes?.self !== false ? r.selfLevel ?? null : null;
}
/** L'élève a-t-il fait son auto-évaluation pour ce rôle ? */
export const selfDone = (A, sid, roleId) => { const r = peek(A, sid, roleId); return !!r && (r.selfLevel != null || Object.keys(r.self || {}).length > 0); };
/** Badges d'un élève : un par rôle certifié (bronze, argent, or). */
export function badgesOf(A, sid) {
  if (!A?.roles) return [];
  return A.roles.map((ro) => { const lv = levelOf(A, sid, ro.id); return lv ? { role: ro, lv, metal: WHISTLE[lv], icon: KINDS[ro.kind]?.icon || 'whistle', title: `${ro.label} : ${ro.levels[lv]}` } : null; }).filter(Boolean);
}
export function setTeacherLevel(A, sid, roleId, lv) { const r = recOf(A, sid, roleId); r.level = lv; r.levelAt = Date.now(); }
export function setSelf(A, sid, roleId, cid, v) { recOf(A, sid, roleId).self[cid] = v; }
export function setSelfLevel(A, sid, roleId, lv) { recOf(A, sid, roleId).selfLevel = lv; }
export function counts(A, roleId, sids) { const c = [0, 0, 0, 0]; for (const s of sids) c[levelOf(A, s, roleId) ?? 0]++; return c; }
