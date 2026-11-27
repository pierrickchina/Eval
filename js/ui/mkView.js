// Outil Compteur Mario Kart : un grand compteur de tours par groupe + compteurs de bonus (liste réglable).
// Mémorisé sur la tablette (par activité, ou pour l'outil libre) jusqu'à « Remettre à zéro ».
import { app, registerView, go, render } from '../app.js';
import { h, btn, icon, iconBtn, openDialog, popMenu, toast } from './dom.js';
import { clone } from '../util.js';
import { vestOf, VEST_COLORS } from '../logic/teams.js';
import { levelInfo } from '../data/schema.js';
import { buzz } from './foundations.js';
import { helpItem } from './help.js';
import * as MK from '../logic/mariokart.js';

const V = { fix: false };
const keyOf = (r) => `mk:${r.scope === 'act' ? r.actId : 'free'}`;
const stateOf = (r) => app.repo.getMeta(keyOf(r), null) || MK.newMK();
const backTo = (r) => (r.from === 'classPage' && r.classId ? go('classPage', { id: r.classId }) : go('home'));

registerView('mariokart', (r) => {
  const st = stateOf(r);
  const save = () => { st.updatedAt = Date.now(); return app.repo.setMeta(keyOf(r), st); };
  const apply = (fn, kind = 'tap') => { fn(); buzz(V.fix ? 'undo' : kind); save(); render(); }; // save d'abord : la mémoire est lue au rendu
  const d = () => (V.fix ? -1 : 1);
  const act = r.scope === 'act' ? app.repo.get('classes', r.classId)?.activities?.find((a) => a.id === r.actId) : null;
  const card = (g) => {
    const v = vestOf(g.color);
    const cb = h('button', { type: 'button', class: 'vestbtn', 'aria-label': 'Couleur', style: { background: v.hex } });
    cb.addEventListener('click', () => popMenu(cb, VEST_COLORS.filter((c) => c.id !== 'sans').map((c) => ({ label: c.label, active: c.id === g.color, onClick: () => apply(() => { g.color = c.id; }) }))));
    return h('section', { class: 'mkcard', style: { '--v': v.hex } },
      h('header', null, h('input', { type: 'text', class: 'tname', value: g.name, 'aria-label': 'Nom du groupe', onChange: (e) => { g.name = e.target.value.trim() || g.name; save(); } }), cb),
      h('div', { class: 'mklaps' },
        h('button', { type: 'button', class: 'mkbig', 'aria-label': `${V.fix ? 'Retirer' : 'Ajouter'} un tour à ${g.name}`, onClick: () => apply(() => MK.addLap(g, d())) },
          h('b', null, String(g.laps)), h('span', null, g.laps === 1 ? 'tour' : 'tours')),
        h('button', { type: 'button', class: 'mkminus', 'aria-label': `Retirer un tour à ${g.name}`, disabled: !g.laps, onClick: () => apply(() => MK.addLap(g, -1), 'undo') }, '−')),
      h('div', { class: 'mklevel muted small' }, `Groupe performant : ${levelInfo(MK.lapsLevel(g.laps)).label.toLowerCase()}`),
      h('div', { class: 'mkbonus' }, st.bonus.map((b) => h('button', { type: 'button', class: `mkb ${g.bonus[b] ? 'on' : ''}`, onClick: () => apply(() => MK.addBonus(g, b, d())) },
        h('span', null, b), h('b', null, String(g.bonus[b] || 0))))));
  };
  const m = iconBtn('more', 'Options', () => popMenu(m, [
    { label: 'Bonus (liste)…', onClick: () => bonusDialog(st, save) },
    '-',
    { label: 'Remettre à zéro', danger: true, onClick: () => { const snap = clone(st); MK.resetMK(st); save(); render(); toast('Compteurs remis à zéro.', { action: 'Annuler', ms: 9000, onAction: () => { Object.assign(st, snap); save(); render(); } }); } },
    helpItem('mariokart'),
  ]), 'boxed');
  return h('div', { class: 'main mk' },
    h('div', { class: 'topbar' }, iconBtn('back', 'Retour', () => backTo(r), '', { 'data-back': '1' }),
      h('div', { class: 'grow evtitle' }, h('h1', null, 'Mario Kart'), h('div', { class: 'sub' }, act ? act.name : 'Compteur de tours et de bonus')),
      h('div', { class: 'stepper', role: 'group', 'aria-label': 'Nombre de groupes' },
        h('button', { type: 'button', 'aria-label': 'Un groupe de moins', disabled: st.groups.length <= 1, onClick: () => apply(() => MK.setGroupCount(st, st.groups.length - 1)) }, icon('minus', 18)),
        h('output', null, `${st.groups.length} groupes`),
        h('button', { type: 'button', 'aria-label': 'Un groupe de plus', disabled: st.groups.length >= 8, onClick: () => apply(() => MK.setGroupCount(st, st.groups.length + 1)) }, icon('plus', 18))),
      btn(V.fix ? 'Correction : −1' : 'Corriger', { icon: 'undo', cls: V.fix ? 'danger' : '', onClick: () => { V.fix = !V.fix; render(); } }),
      m),
    V.fix ? h('div', { class: 'ldhint warnbg' }, 'Mode correction : chaque toucher retire 1 (tours et bonus). Touchez « Correction » pour revenir.') : null,
    h('div', { class: `mkgrid scroll n${st.groups.length}`, 'data-keep': 'mkgrid' }, st.groups.map(card)));
});

function bonusDialog(st, save) {
  const list = st.bonus.slice();
  const dlg = openDialog({ title: 'Bonus', body: h('div'), actions: [
    { label: 'Liste d\'origine', onClick: () => { st.bonus = MK.MK_BONUS.slice(); save(); render(); } },
    { label: 'Enregistrer', primary: true, onClick: () => { st.bonus = list.map((x) => x.trim()).filter(Boolean).filter((x, i, a) => a.indexOf(x) === i); save(); render(); } }] });
  const paint = () => dlg.content.replaceChildren(
    ...list.map((b, i) => h('div', { class: 'listrow' },
      h('input', { type: 'text', value: b, 'aria-label': 'Bonus', style: { flex: 1 }, onChange: (e) => { list[i] = e.target.value; } }),
      iconBtn('up', 'Monter', () => { if (i) { [list[i - 1], list[i]] = [list[i], list[i - 1]]; paint(); } }, 'sm'),
      iconBtn('trash', 'Retirer', () => { list.splice(i, 1); paint(); }, 'sm'))),
    btn('Ajouter un bonus', { icon: 'plus', cls: 'small soft', onClick: () => { list.push('Nouveau bonus'); paint(); } }));
  paint();
}
