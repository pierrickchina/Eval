// Exercices de Circuit training : les 20 fiches de l'équipe (images d'origine) + 4 ajouts (pictogrammes dessinés pour PEPS).
// Types (code couleur) : haut du corps (rouge), bas du corps (bleu), gainage (vert), cardio (jaune). Un exercice peut avoir plusieurs types.
// Chaque consigne : [texte, sécurité ?] (la sécurité était en gras sur les fiches).

export const EX_TYPES = {
  haut: { label: 'Haut du corps', color: '#e5484d', soft: '#fbdadb' },
  bas: { label: 'Bas du corps', color: '#2f6fe0', soft: '#d9e6fb' },
  gainage: { label: 'Gainage', color: '#2e9b4f', soft: '#d8f0df' },
  cardio: { label: 'Cardio', color: '#e0a800', soft: '#fbefc5' },
};
export const MATERIAL = { banc: 'Banc', corde: 'Corde à sauter', medecine: 'Medecine ball' };

const S = true; // consigne de sécurité
const ex = (n, id, name, types, how, levels, extra = {}) => ({ n, id, name, types, how, levels, img: `img/exos/${id}.jpg`, ...extra });

// Pictogrammes des exercices ajoutés (même trait que les icônes de l'application)
const pict = (inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 160" fill="none" stroke="#2f3440" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"><rect x="0" y="0" width="240" height="160" rx="18" fill="#f7f5f1" stroke="none"/><path d="M14 136h212" stroke="#c9c4ba" stroke-width="4"/>${inner}</svg>`;
const BANC = '<path d="M28 96h86M36 96v40M106 96v40" stroke="#6fb0c6" stroke-width="8"/>';
export const PICTS = {
  'pompes-toucher-epaule': pict('<circle cx="58" cy="76" r="12" fill="#2f3440"/><path d="M76 88L206 126M78 90v40M78 90l26 16-14 6" /><path d="M66 132h26" stroke="#2f3440" stroke-width="5"/><path d="M112 66c10 2 14 10 12 20" stroke="#e5484d" stroke-width="4"/><path d="M118 82l6 6 5-7" stroke="#e5484d" stroke-width="4"/>'),
  dips: pict(`${BANC}<circle cx="122" cy="50" r="11" fill="#2f3440"/><path d="M120 62l2 44M118 70l-18 4-6 22M122 106h34l50 24"/><path d="M96 58v-14M92 48l4-6 4 6" stroke="#e5484d" stroke-width="4"/>`),
  'pompes-inclinees': pict(`${BANC}<circle cx="70" cy="58" r="11" fill="#2f3440"/><path d="M84 70l124 58M88 72l-8 24"/>`),
  'corde-a-sauter': pict('<circle cx="120" cy="28" r="11" fill="#2f3440"/><path d="M120 40v50M120 90l-12 34M120 90l12 34M120 52l-26 26M120 52l26 26"/><path d="M94 78Q120 182 146 78" stroke="#e0a800" stroke-width="4"/><path d="M94 78Q120 -10 146 78" stroke="#e0a800" stroke-width="3" stroke-dasharray="6 7"/><path d="M98 132l-8 6M142 132l8 6" stroke="#c9c4ba" stroke-width="4"/>'),
};

export const EXERCISES = [
  ex(1, 'pompes', 'Pompes', ['haut'], [['Corps gainé, abdominaux et fessiers contractés, pieds joints et mains écartées à largeur d\'épaules.', S], ['Il s\'agit d\'abaisser tout le corps en restant gainé.', S], ['Expirez en poussant.', S]], ['sur les genoux', 'sur les pieds']),
  ex(2, 'squats', 'Squats', ['bas'], [['Jambes écartées à largeur d\'épaules, plier les jambes pour amener les cuisses à l\'horizontale.'], ['Veiller à ce que les genoux restent au-dessus des pieds. Les pieds sont le plus à plat possible.', S], ['Le dos, droit, s\'incline légèrement vers l\'avant.', S]], ['normal', 'sautés']),
  ex(3, 'planche', 'Planche', ['gainage'], [['En appui sur les avant-bras et les pointes de pieds.'], ['Corps droit (pas de fesses relevées ou rentrées).', S]], ['statique', 'dynamique d\'avant en arrière']),
  ex(4, 'fentes', 'Fentes', ['bas'], [['Genou près du sol (sans le toucher).', S], ['Rester gainé, le dos droit.', S]], ['normal', 'sautées']),
  ex(5, 'chaise', 'La chaise', ['bas'], [['Les cuisses à l\'horizontale, à 90 degrés par rapport au mur.', S], ['Le dos est collé au mur, les bras allongés le long du buste.', S]], ['chaise', 'chaise avec medecine ball'], { material2: 'medecine' }),
  ex(6, 'crunchs', 'Crunchs', ['gainage'], [['Ne jamais poser les omoplates au sol.'], ['Éviter les abdos avec les mains derrière la nuque.', S]], ['normal', 'kick down crunch (toucher les genoux avec les coudes, jambes en flexion et extension)']),
  ex(7, 'gainage-militaire', 'Gainage militaire', ['haut', 'gainage'], [['Mouvement répété plusieurs fois, lentement.', S], ['Le gainage doit permettre d\'avoir le dos droit et aligné.', S]], ['normal', 'pompe entre chaque descente']),
  ex(8, 'jumping-jacks', 'Jumping jacks', ['cardio'], [['Reste gainé tout du long.', S], ['Amplitude maximale.']], ['normaux', 'claquer des mains']),
  ex(9, 'course-sur-place', 'Course sur place', ['cardio'], [['S\'aider des bras pour rester équilibré.', S], ['Garder le buste droit.', S]], ['tipping', 'montées de genoux']),
  ex(10, 'pompes-ouverture', 'Pompes en ouverture', ['haut'], [['Réalise une pompe.'], ['Verrouille coude et épaule pour ouvrir un bras complètement.'], ['Alterne bras gauche et bras droit.']], ['sur les genoux', 'sur les pieds']),
  ex(11, 'gainage-lateral', 'Gainage latéral', ['gainage'], [['Corps aligné, gainé.', S], ['Changer de côté au milieu de l\'exercice.']], ['normal', 'dynamique (battement du bassin du bas vers le haut)']),
  ex(12, 'mountain-climbers', 'Mountain climbers', ['cardio'], [['En appui sur les mains, bras tendus.'], ['Remonter les genoux au plus près du torse, avec intensité.'], ['RESPIRE.', S], ['Dos droit.', S]], ['normal', 'un saut toutes les 6 montées de genoux']),
  ex(13, 'crunchs-lateraux', 'Crunchs latéraux', ['gainage'], [['Position crunch, pieds au sol.', S]], ['normal (toucher ses chevilles droite puis gauche)', 'cycliste (toucher ses genoux avec ses coudes, jambes qui pédalent)'], { img2: 'img/exos/crunchs-lateraux-2.jpg' }),
  ex(14, 'extension-hanches', 'Extension des hanches', ['bas'], [['Jambe gainée, battement sans toucher l\'autre jambe.', S], ['Alignement du corps.', S]], ['normal', 'en gainage latéral']),
  ex(15, 'hip-thrust', 'Hip thrust', ['bas'], [['Pieds écartés à largeur d\'épaules.', S], ['Ceinture abdominale gainée.', S], ['Monter les hanches jusqu\'à l\'alignement du bassin.']], []),
  ex(16, 'burpees', 'Burpees', ['haut', 'cardio'], [['Amortir le saut, saut droit.', S], ['Alignement du corps.', S]], ['normal', 'avec pompe']),
  ex(17, 'high-kick', 'High kick', ['cardio', 'bas'], [['Pieds écartés à largeur d\'épaules.', S], ['Ceinture abdominale et scapulaire gainée.', S], ['Monter la jambe jusqu\'à l\'alignement du bassin.'], ['Changer de côté à la moitié du temps.']], []),
  ex(18, 'extensions-mollet', 'Extensions de mollet', ['bas'], [['Garder l\'équilibre.', S], ['Amortir pour ne pas choquer les talons.', S]], ['normal', 'sautées']),
  ex(19, 'superman', 'Superman', ['gainage'], [['Appui bassin / sol.', S], ['Ne pas se reposer entre chaque répétition.', S], ['Ne pas trop cambrer.', S]], ['normal', 'écarter les bras et les jambes']),
  ex(20, 'gainage-inverse', 'Gainage inversé', ['gainage'], [['Gainage soutenu.', S], ['Aligner le bassin.', S]], []),
  // Ajouts 1.10 (pictogrammes)
  ex(21, 'pompes-toucher-epaule', 'Pompes toucher d\'épaule', ['haut'], [['En position de pompe, bras tendus, corps gainé.', S], ['Une main vient toucher l\'épaule opposée, puis on alterne.'], ['Le bassin ne bouge pas : pieds un peu écartés pour rester stable.', S]], ['sur les genoux', 'sur les pieds'], { img: null, pict: 'pompes-toucher-epaule' }),
  ex(22, 'dips', 'Dips sur banc', ['haut'], [['Mains au bord du banc, doigts vers l\'avant, dos proche du banc.', S], ['Plier les coudes vers l\'arrière jusqu\'à 90 degrés, puis pousser.'], ['Les épaules restent basses, loin des oreilles.', S]], ['jambes pliées', 'jambes tendues'], { img: null, pict: 'dips', material: 'banc' }),
  ex(23, 'pompes-inclinees', 'Pompes inclinées', ['haut'], [['Mains sur le banc, écartées à largeur d\'épaules.'], ['Corps gainé et aligné des épaules aux pieds.', S], ['Descendre la poitrine vers le banc, expirer en poussant.']], ['banc haut', 'banc bas'], { img: null, pict: 'pompes-inclinees', material: 'banc' }),
  ex(24, 'corde-a-sauter', 'Corde à sauter', ['cardio'], [['Sauts légers sur l\'avant des pieds, genoux souples.', S], ['Les coudes restent près du corps, ce sont les poignets qui tournent.'], ['Regard devant, buste droit.', S]], ['pieds joints', 'pas de course ou double saut'], { img: null, pict: 'corde-a-sauter', material: 'corde' }),
];

export const exById = (id) => EXERCISES.find((e) => e.id === id);
/** Exercices utilisables avec le matériel disponible (`have` : { banc: true, corde: false… }). */
export const usable = (have = {}) => EXERCISES.filter((e) => !e.material || have[e.material] !== false);
/** Tirage au hasard, dans un type (ou dans tous), en évitant si possible le dernier tiré. */
export function randomExercise(type = null, have = {}, last = null, rnd = Math.random) {
  const pool = usable(have).filter((e) => !type || e.types.includes(type));
  const pick = pool.length > 1 ? pool.filter((e) => e.id !== last) : pool;
  return pick.length ? pick[Math.floor(rnd() * pick.length)] : null;
}
