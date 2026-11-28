// Certification d'arbitre (1.12) : un certificat PAR ACTIVITÉ (l'arbitrage d'une APSA ne vaut pas pour une autre).
// act.arbitre = { levels:[4 noms], criteria:[{id,name,text}], modes:{self,peer,teacher}, students:{ sid: {...} } }
// Trois façons d'évaluer, activables et combinables : auto-évaluation, avis des pairs, validation par l'enseignant.
// L'appli ne propose jamais de niveau automatiquement : le niveau retenu est celui de l'enseignant
// (ou, si sa validation est désactivée, celui que l'élève s'attribue).

export const AR_LEVELS = ['Non certifié', 'Jeune officiel', 'Arbitre certifié', 'Arbitre référent'];
export const WHISTLE = [null, { name: 'bronze', color: '#b9733a' }, { name: 'argent', color: '#8e99a8' }, { name: 'or', color: '#d4a20a' }];
export const SELF_SCALE = ['Pas encore', 'En partie', 'Oui', 'Très bien'];
export const PEER = { up: '👍', mid: '👌', down: '👎' };

const C = (id, name, text) => ({ id, name, text });
/** Critères pré-remplis selon l'activité (même structure partout, textes adaptés). */
export function defaultCriteria(activityName) {
  const n = String(activityName || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const table = /tennis de table|\btt\b|ping|badminton|bad\b|raquette/.test(n);
  const combat = /boxe|lutte|judo|combat|\bbf\b/.test(n);
  const juge = /gym|acro|danse|athle|duathlon/.test(n);
  return [
    C('regle', 'Règlement', table ? 'Je connais le comptage des points, le service et les changements de côté.' : combat ? 'Je connais les touches autorisées et les fautes (touche appuyée, cible interdite).' : juge ? 'Je connais les critères de réussite et les éléments à observer.' : 'Je connais les règles essentielles : marcher, contact, sorties, engagement.'),
    C('decision', 'Décision', 'Je décide vite et juste, et je l\'annonce clairement (voix, geste, sifflet).'),
    table ? C('feuille', 'Tenir la feuille', 'Je compte et j\'annonce le score sans erreur, je remplis la feuille de match.')
      : combat ? C('placement', 'Placement', 'Je me place pour voir les deux tireurs et je sépare au « Stop ».')
        : juge ? C('feuille', 'Tenir la feuille', 'Je note sans erreur ce que j\'observe.')
          : C('placement', 'Placement', 'Je me déplace avec le jeu pour bien voir l\'action.'),
    C('attitude', 'Attitude', 'Je reste calme et impartial, je m\'impose avec respect.'),
  ];
}

export function arbitreOf(act) {
  act.arbitre ??= { levels: AR_LEVELS.slice(), criteria: defaultCriteria(act.name), modes: { self: true, peer: true, teacher: true }, students: {} };
  const A = act.arbitre;
  A.students ??= {}; A.modes ??= { self: true, peer: true, teacher: true }; A.levels ??= AR_LEVELS.slice(); A.criteria ??= defaultCriteria(act.name);
  return A;
}
export const recOf = (A, sid) => (A.students[sid] ??= { self: {}, selfLevel: null, peers: [], level: null });

/** Niveau retenu (0 à 3, ou null) : validation de l'enseignant ; sans elle, le niveau que l'élève s'attribue. */
export function levelOf(A, sid) {
  const r = A?.students?.[sid];
  if (!r) return null;
  if (A.modes?.teacher !== false) return r.level ?? null;
  return A.modes?.self !== false ? r.selfLevel ?? null : null;
}
/** Badge : 1 bronze, 2 argent, 3 or ; rien pour « non certifié ». */
export const whistleOf = (A, sid) => WHISTLE[levelOf(A, sid) ?? 0] || null;

/** Avis des pairs : compte des 👍 / 👌 / 👎 par critère. */
export function peerSummary(A, sid) {
  const r = A.students[sid];
  const out = {};
  for (const c of A.criteria) out[c.id] = { up: 0, mid: 0, down: 0 };
  for (const p of r?.peers || []) for (const [cid, v] of Object.entries(p.crit || {})) if (out[cid] && out[cid][v] != null) out[cid][v]++;
  return out;
}
export function addPeer(A, sid, crit, by = '') { recOf(A, sid).peers.push({ at: Date.now(), by, crit: { ...crit } }); }
export function setTeacherLevel(A, sid, lv) { const r = recOf(A, sid); r.level = lv; r.levelAt = Date.now(); }
export function setSelf(A, sid, cid, v) { recOf(A, sid).self[cid] = v; }
export function setSelfLevel(A, sid, lv) { recOf(A, sid).selfLevel = lv; }
/** Effectifs par niveau (pour l'en-tête). */
export function counts(A, sids) { const c = [0, 0, 0, 0]; let none = 0; for (const s of sids) { const l = levelOf(A, s); if (l == null) none++; else c[l]++; } return { c, none }; }
