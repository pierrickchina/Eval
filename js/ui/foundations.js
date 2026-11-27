// Fondations 1.6 : « Reprendre où j'en étais », outils épinglés, affichage (texte / contraste),
// visite guidée, classe de démonstration, partage d'un modèle d'évaluation par petit fichier.
import { app, go, render } from '../app.js';
import { h, btn, icon, openDialog, toast, download } from './dom.js';
import { uid, todayISO, schoolYear } from '../util.js';
import { newActivity, activitiesOf, TOOLS, toolColor, activityEvals } from '../logic/activities.js';

// ---------- Affichage et confort (réglages généraux, mémorisés sur cette tablette) ----------

const DISPLAY_KEY = 'eps-display';
const DISPLAY_DEFAULTS = { text: 'normal', contrast: false, theme: 'light', font: 'system', motion: 'normal', vibrate: true, sound: true };
export function getDisplay() {
  try { return { ...DISPLAY_DEFAULTS, ...(JSON.parse(localStorage.getItem(DISPLAY_KEY) || '{}')) }; } catch { return { ...DISPLAY_DEFAULTS }; }
}
export function applyDisplay(d = getDisplay()) {
  const el = document.documentElement;
  el.dataset.text = d.text;
  el.dataset.contrast = d.contrast ? 'high' : '';
  el.dataset.theme = d.theme;          // light = clair pastel, dark = sombre doux
  el.dataset.font = d.font;            // system = habituelle, lisible = DejaVu Sans (embarquée, hors connexion)
  el.dataset.motion = d.motion;        // reduced = pas de clignotement ni d'animation
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = d.theme === 'dark' ? '#1f2228' : '#f7f5f1';
}
export function setDisplay(patch) {
  const d = { ...getDisplay(), ...patch };
  try { localStorage.setItem(DISPLAY_KEY, JSON.stringify(d)); } catch { /* ignore */ }
  applyDisplay(d);
}
export function displayPanel() {
  const d = getDisplay();
  const seg = (items, cur, key) => h('div', { class: 'seg', style: { margin: '6px 0 12px' } }, items.map(([k, l]) => h('button', { type: 'button', class: cur === k ? 'on' : '', 'aria-pressed': String(cur === k), onClick: () => { setDisplay({ [key]: k }); render(); } }, l)));
  // values : [valeur cochée, valeur décochée] quand le réglage n'est pas un simple oui/non
  const check = (label, key, on, note, values = [true, false]) => h('label', { class: 'row', style: { minHeight: '44px' } },
    h('input', { type: 'checkbox', class: 'bigchk', checked: on, onChange: (e) => { setDisplay({ [key]: values[e.target.checked ? 0 : 1] }); if (key === 'vibrate' && e.target.checked) buzz('tap'); if (key === 'sound' && e.target.checked) buzz('change'); render(); } }),
    h('span', null, label, note ? h('small', { class: 'muted', style: { display: 'block' } }, note) : null));
  return h('div', { class: 'panel' }, h('h3', null, 'Affichage et confort'),
    h('div', { class: 'muted small' }, 'Thème'),
    seg([['light', 'Clair pastel'], ['dark', 'Sombre doux']], d.theme, 'theme'),
    h('div', { class: 'muted small' }, 'Taille du texte'),
    seg([['normal', 'Normal'], ['large', 'Grand'], ['xlarge', 'Très grand']], d.text, 'text'),
    h('div', { class: 'muted small' }, 'Police'),
    seg([['system', 'Habituelle'], ['lisible', 'Très lisible']], d.font, 'font'),
    check('Contraste renforcé', 'contrast', d.contrast),
    check('Réduire les animations', 'motion', d.motion === 'reduced', 'Pas de clignotement ni d\'effet de mouvement.', ['reduced', 'normal']),
    h('h3', { style: { marginTop: '14px' } }, 'Vibrations et sons'),
    check('Vibrations', 'vibrate', d.vibrate, 'Petite vibration à chaque point marqué, plus longue au changement et à la fin du temps.'),
    check('Sons', 'sound', d.sound, 'Bip au moment du changement et à la fin du temps (tournoi, chronomètre).'));
}

// ---------- Vibrations et sons ----------

let audio = null;
function tone(freq, ms, at = 0) {
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
    const t0 = audio.currentTime + at / 1000;
    const o = audio.createOscillator(), g = audio.createGain();
    o.type = 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.35, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + ms / 1000);
    o.connect(g).connect(audio.destination); o.start(t0); o.stop(t0 + ms / 1000 + 0.05);
  } catch { /* pas de son disponible */ }
}
/** Retour tactile et sonore. kind : tap (point marqué), undo (point retiré), change (moment du changement), end (fin du temps). */
export function buzz(kind) {
  const d = getDisplay();
  const pattern = { tap: 15, undo: [10, 50, 10], change: [80, 90, 80], end: [300, 150, 300] }[kind];
  if (d.vibrate && pattern && navigator.vibrate) { try { navigator.vibrate(pattern); } catch { /* ignore */ } }
  if (!d.sound) return;
  if (kind === 'change') { tone(880, 180); tone(880, 180, 260); }
  if (kind === 'end') { tone(660, 400); tone(660, 400, 520); tone(520, 700, 1040); }
}

// ---------- Reprendre où j'en étais ----------

const RESUME_KEY = 'eps-resume';
const RESUMABLE = new Set(['eval', 'classPage', 'equipes']);
/** Appelé par go() : mémorise le dernier écran « de travail » (jamais un écran d'accueil ou de réglages). */
export function noteRoute(route) {
  if (!RESUMABLE.has(route.name)) return;
  if (route.name === 'equipes' && !route.setId) return;
  try { localStorage.setItem(RESUME_KEY, JSON.stringify({ ...route, at: Date.now() })); } catch { /* ignore */ }
}
/** Retourne { route, label } si l'élément existe toujours, sinon null. */
export function resumeInfo() {
  let r;
  try { r = JSON.parse(localStorage.getItem(RESUME_KEY) || 'null'); } catch { r = null; }
  if (!r) return null;
  const repo = app.repo;
  if (r.name === 'eval') {
    const ev = repo.get('evaluations', r.id);
    if (!ev || ev.deleted) return null;
    return { route: r, label: `${ev.title?.trim() || ev.model.activity} · ${ev.classInfo?.name || ''}` };
  }
  if (r.name === 'classPage') {
    const c = repo.get('classes', r.id);
    return c && !c.deleted ? { route: r, label: `Classe ${c.name}` } : null;
  }
  if (r.name === 'equipes') {
    const c = r.scope === 'act' ? repo.get('classes', r.classId) : null;
    const act = c ? activitiesOf(c).find((a) => a.id === r.actId) : null;
    const set = act ? act.equipes?.sets?.find((s) => s.id === r.setId)
      : repo.list('freetools').map((x) => x.set).find((s) => s?.id === r.setId);
    return set ? { route: r, label: `Équipes · ${set.name}` } : null;
  }
  return null;
}
export function resumeChip({ compact = false } = {}) {
  const info = resumeInfo();
  if (!info) return null;
  const { at, ...route } = info.route; // eslint-disable-line no-unused-vars
  return h('button', { type: 'button', class: `chip resume ${compact ? 'compact' : ''}`, title: info.label, onClick: () => go(route.name, route) }, icon('resume', 18), h('span', null, h('b', null, 'Reprendre'), h('small', null, info.label)));
}

// ---------- Dernière tâche d'une classe (raccourci sur la carte de l'accueil) ----------

/** Dernière chose faite avec cette classe : dernière évaluation modifiée ou dernier outil utilisé. { label, route } ou null. */
export function lastTask(cls) {
  const evals = app.repo.list('evaluations').filter((e) => !e.deleted && e.classId === cls.id);
  let best = null;
  for (const a of activitiesOf(cls)) {
    for (const ev of activityEvals(evals, cls, a)) {
      const t = ev.updatedAt || ev.createdAt || 0;
      if (!best || t > best.t) best = { t, label: `${a.name} · ${ev.title?.trim() || 'Évaluation'}`, route: { name: 'eval', id: ev.id, from: 'classPage', classId: cls.id } };
    }
    for (const tool of a.tools) {
      if (tool.type === 'evaluation' || !TOOLS[tool.type]?.available || !tool.lastUsed || tool.lastUsed === tool.addedAt) continue;
      if (!best || tool.lastUsed > best.t) best = { t: tool.lastUsed, label: `${a.name} · ${TOOLS[tool.type].label}`, route: { name: TOOLS[tool.type].route, from: 'classPage', classId: cls.id, scope: 'act', actId: a.id } };
    }
  }
  return best;
}

// ---------- Outils épinglés ----------

export const pinnedTools = () => (app.repo.getMeta('pinnedTools', null) || []).filter((t) => TOOLS[t]?.available && TOOLS[t].free);
export function togglePin(type) {
  const cur = pinnedTools();
  return app.repo.setMeta('pinnedTools', cur.includes(type) ? cur.filter((t) => t !== type) : [...cur, type]);
}
export function openFreeTool(type) { go(TOOLS[type].route, { from: 'home', scope: 'free' }); }
export function pinnedStrip() {
  const pins = pinnedTools();
  if (!pins.length) return null;
  return h('div', { class: 'pinstrip' }, pins.map((t) => h('button', { type: 'button', class: 'pinchip', style: { '--tc': toolColor(t) }, onClick: () => openFreeTool(t) }, icon(TOOLS[t].icon, 20), TOOLS[t].label)));
}

// ---------- Visite guidée ----------

const TOUR = [
  ['Bienvenue', 'PEPS fonctionne sans connexion. Vos classes, évaluations et outils restent sur cette tablette ; pensez à la sauvegarde (bouton « Sauvegarder » de l\'accueil).'],
  ['Les classes', 'Chaque classe a un carnet de bord : des activités (handball, badminton…) qui contiennent des outils — Évaluation, Chronomètre, Équipes. Le « + » d\'une activité ajoute un outil.'],
  ['Les outils libres', 'Onglet « Outils » : chronomètre et équipes utilisables sans classe. L\'étoile ☆ épingle un outil en haut de l\'accueil.'],
  ['Aide et retour', 'Le « ? » de chaque outil donne l\'essentiel en 3 lignes. Après une suppression ou un tirage, un bouton « Annuler » apparaît quelques secondes.'],
];
export function startTour(done) {
  let i = 0;
  const body = h('div', null);
  const dots = () => h('div', { class: 'tourdots' }, TOUR.map((_, k) => h('span', { class: k === i ? 'on' : '' })));
  const dlg = openDialog({ title: '', body, actions: [] });
  const paint = () => {
    body.replaceChildren(
      h('h2', { style: { margin: '0 0 8px' } }, TOUR[i][0]), h('p', { class: 'dlg-msg' }, TOUR[i][1]), dots(),
      h('div', { class: 'row', style: { justifyContent: 'flex-end', marginTop: '14px' } },
        btn('Passer', { onClick: () => finish() }),
        i > 0 ? btn('Précédent', { onClick: () => { i--; paint(); } }) : null,
        btn(i === TOUR.length - 1 ? 'Terminer' : 'Suivant', { cls: 'primary', onClick: () => (i === TOUR.length - 1 ? finish() : (i++, paint())) })));
  };
  const finish = async () => { dlg.close(); await app.repo.setMeta('tourDone', true); done?.(); };
  paint();
}
/** Visite guidée : seulement sur une installation vide (jamais pour quelqu'un qui a déjà ses données). */
export function maybeTour() {
  try { if (localStorage.getItem('eps-skip-tour')) return; } catch { /* ignore */ }
  const r = app.repo;
  if (r.getMeta('tourDone', false) || r.list('classes').length || r.list('evaluations').length || r.list('models').some((m) => !m.library)) return;
  startTour();
}

// ---------- Classe de démonstration ----------

const DEMO_NAMES = ['Léa', 'Samir', 'Chloé D', 'Chloé F', 'Noah', 'Inès', 'Adam', 'Jade', 'Yanis', 'Maëlys', 'Hugo', 'Aya', 'Lucas', 'Sofia', 'Ilyes', 'Emma', 'Tom', 'Nour', 'Léo', 'Zoé'];
export async function createDemo() {
  const repo = app.repo;
  if (repo.list('classes').some((c) => c.demo)) return toast('La classe de démonstration existe déjà.');
  const cls = {
    id: uid(), name: '5e DÉMO', level: '5e', color: '#cfe3ff', year: schoolYear(), demo: true,
    students: DEMO_NAMES.map((n) => { const m = n.match(/^(.+?)\s+([A-Z])$/); return { id: uid(), first: m ? m[1] : n, initial: m ? m[2] : '', active: true }; }),
    createdAt: Date.now(),
  };
  cls.activities = [newActivity('Handball (démo)', ['evaluation', 'chrono', 'equipes'], Date.now(), '#d6efd2')];
  await repo.save('classes', cls);
  toast('Classe de démonstration créée. Vous pouvez la supprimer à tout moment (Réglages › Classes).');
  go('classPage', { id: cls.id });
}
export function demoPanel() {
  const has = app.repo.list('classes').some((c) => c.demo);
  return h('div', { class: 'panel' }, h('h3', null, 'Découvrir l\'application'),
    h('div', { class: 'row wrap' },
      btn('Revoir la visite guidée', { onClick: () => startTour() }),
      has ? null : btn('Créer une classe de démonstration', { onClick: createDemo })),
    h('p', { class: 'muted small', style: { margin: '8px 0 0' } }, 'La classe de démonstration contient des prénoms fictifs : parfaite pour essayer les équipes et le chronomètre sans toucher à vos vraies classes.'));
}

// ---------- Partage d'un modèle d'évaluation (fichier léger, aucune donnée d'élève) ----------

const MODEL_TYPE = 'eps-modele';
export function modelToFile(m) {
  return JSON.stringify({ type: MODEL_TYPE, version: 1, model: { name: m.name, activity: m.activity, levels: m.levels } });
}
export async function shareModel(m) {
  const text = modelToFile(m);
  const name = `modele-${(m.activity || 'eval').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`;
  try {
    const file = new File([text], name, { type: 'application/json' });
    if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: `Modèle ${m.activity}` }); return; }
  } catch (e) { if (e?.name === 'AbortError') return; }
  download(name, text);
}
export function parseModelFile(text) {
  let o; try { o = JSON.parse(text); } catch { throw new Error('Fichier illisible.'); }
  if (o?.type !== MODEL_TYPE || !o.model?.levels) throw new Error('Ce fichier n\'est pas un modèle d\'évaluation EPS.');
  const m = o.model;
  for (const lv of Object.values(m.levels)) for (const c of lv.competences || []) c.id = uid(); // nouveaux identifiants
  return { id: uid(), name: String(m.name || 'Modèle importé'), activity: String(m.activity || ''), levels: m.levels, createdAt: Date.now() };
}
export function importModelButton(after) {
  const input = h('input', { type: 'file', accept: '.json,application/json', hidden: true, onChange: async (e) => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try { const m = parseModelFile(await f.text()); await app.repo.save('models', m); toast(`Modèle « ${m.activity} » ajouté.`); after?.(); } catch (err) { toast(err.message); }
  } });
  return [input, btn('Recevoir un modèle (fichier)', { icon: 'upload', onClick: () => input.click() })];
}
