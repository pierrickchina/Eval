// Mode auto-évaluation : la tablette est confiée aux élèves.
// L'élève ne voit QUE sa propre fiche (aucune note, remarque ou observation de l'enseignant).
// Sortie protégée par un code (0007 par défaut, modifiable dans Réglages). Le verrou survit à un rechargement.
import { app, registerView, go, render } from '../app.js';
import { h, btn, openDialog, confirmDialog, toast } from './dom.js';
import { fmt } from '../util.js';
import { LEVELS, studentLabel } from '../data/schema.js';
import { orderedStudents } from '../logic/evaluation.js';
import { setSelfLevel, selfCell, selfTotals, selfDone, validateSelf } from '../logic/selfeval.js';

export const DEFAULT_CODE = '0007';
const KEY = 'eps-selfeval-lock';
const S = { sid: null };

export const getLock = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } };
const setLock = (id) => { try { if (id) localStorage.setItem(KEY, JSON.stringify({ id })); else localStorage.removeItem(KEY); } catch { /* ignore */ } };
export const exitCode = () => String((app.repo.getMeta('settings', {}) || {}).selfCode || DEFAULT_CODE);

/** Lancement depuis le menu de l'évaluation. */
export async function startSelfEval(ev) {
  const ok = await confirmDialog('La tablette passe en mode élève : chaque élève ne verra que sa propre auto-évaluation, sans aucune de vos notes ni remarques. Pour en sortir, il faudra le code. Conseil : activez « Épingler l\'écran » sur la tablette pour empêcher de quitter l\'application.', 'Passer en mode élève', { danger: false });
  if (!ok) return;
  setLock(ev.id);
  S.sid = null;
  go('selfEval', { id: ev.id });
}

/** Au démarrage : si le mode élève était actif, on y revient (même après fermeture de l'application). */
export function resumeRoute() {
  const l = getLock();
  if (!l) return null;
  const ev = app.repo.get('evaluations', l.id);
  if (!ev || ev.deleted) { setLock(null); return null; }
  return { name: 'selfEval', id: l.id };
}

app.selfEvalBack = () => { if (S.sid) { S.sid = null; render(); } };

const save = (ev) => app.repo.save('evaluations', ev);

registerView('selfEval', ({ id }) => {
  const ev = app.repo.get('evaluations', id);
  if (!ev || ev.deleted) { setLock(null); queueMicrotask(() => go('home')); return h('div'); }
  if (S.sid && !ev.students.some((s) => s.id === S.sid)) S.sid = null;
  return h('div', { class: 'main selfscreen' }, S.sid ? studentScreen(ev) : listScreen(ev));
});

function exitDialog(ev) {
  const input = h('input', { type: 'password', inputmode: 'numeric', class: 'codeinput', maxlength: 8, autocomplete: 'off', 'aria-label': 'Code', autofocus: true });
  openDialog({
    title: 'Sortir du mode élève', body: [h('p', { class: 'dlg-msg' }, 'Code de l\'enseignant :'), input],
    actions: [{ label: 'Annuler' }, { label: 'Valider', primary: true, onClick: () => {
      if (input.value === exitCode()) { setLock(null); S.sid = null; go('eval', { id: ev.id }); return true; }
      input.value = ''; input.classList.remove('shake'); void input.offsetWidth; input.classList.add('shake');
      toast('Code incorrect.', { ms: 2000 });
      return false;
    } }],
  });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') document.querySelector('.dlg-foot .btn.primary')?.click(); });
}

function listScreen(ev) {
  const list = orderedStudents(ev, { sort: 'alpha' }).filter((s) => (ev.status?.[s.id] || 'present') !== 'absent');
  return [
    h('div', { class: 'selfhead' },
      h('div', { class: 'grow' }, h('h1', null, 'Auto-évaluation'), h('div', { class: 'muted' }, `${ev.model.activity} — touche ton prénom`)),
      btn('Enseignant', { cls: 'small', onClick: () => exitDialog(ev), title: 'Sortir du mode élève (code)' })),
    h('div', { class: 'selflist' }, list.map((s) => {
      const done = selfDone(ev, s.id);
      return h('button', { type: 'button', class: `selfname ${done ? 'done' : ''}`, onClick: () => {
        if (done) return toast('Tu as déjà validé ton auto-évaluation. Merci !', { ms: 3000 });
        S.sid = s.id; render();
      } }, studentLabel(s), done ? h('span', null, '✓') : null);
    })),
  ];
}

function studentScreen(ev) {
  const s = ev.students.find((x) => x.id === S.sid);
  const t = selfTotals(ev, s.id);
  const pick = (cid, key) => { if (setSelfLevel(ev, s.id, cid, key)) { render(); save(ev); } }; // affichage immédiat, enregistrement ensuite
  const cards = ev.model.competences.map((c) => h('div', { class: 'compcard' },
    h('div', { class: 'ch' }, h('b', null, c.name), h('span', { class: 'muted' }, `/${fmt(c.max)}`)),
    c.afc ? h('div', { class: 'afc' }, c.afc) : null,
    LEVELS.map((l) => {
      const d = c.levels.find((x) => x.key === l.key);
      return h('button', { type: 'button', class: `lvrow ${l.key} ${selfCell(ev, s.id, c.id)?.level === l.key ? 'on' : ''}`, onClick: () => pick(c.id, l.key) },
        h('span', { class: 'lvh' }, `${l.symbol} ${l.label}`, h('small', null, d.min === d.max ? `${fmt(d.value)} pt` : `${fmt(d.min)}–${fmt(d.max)} pts`)),
        h('span', { class: 'crit' }, d.text || ''));
    })));
  return [
    h('div', { class: 'selfhead' },
      btn('Liste', { icon: 'back', onClick: () => { S.sid = null; render(); } }),
      h('div', { class: 'grow' }, h('h1', null, studentLabel(s)), h('div', { class: 'muted' }, 'Choisis, pour chaque compétence, ce qui te ressemble le plus.'))),
    h('div', { class: 'selfbody' }, cards),
    h('div', { class: 'selffoot' },
      h('div', { class: 'grow' }, t.complete ? `Ma note : ${fmt(t.final)}/20` : `${t.filled}/${t.total} compétences choisies`),
      btn('Valider mon auto-évaluation', { icon: 'check', cls: 'primary', disabled: !t.complete, onClick: async () => {
        if (!(await confirmDialog('Une fois validée, tu ne pourras plus la modifier. Tu valides ?', 'Je valide', { danger: false }))) return;
        validateSelf(ev, s.id);
        await save(ev);
        S.sid = null; render();
        toast(`Merci ${s.first} ! Passe la tablette à un camarade ou à ton professeur.`, { ms: 4500 });
      } }))
  ];
}
