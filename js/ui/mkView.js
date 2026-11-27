// Outil Compteur Mario Kart (fiches MK V1, V2, V3) : chrono de course, tours, malus, objectif, pièces, cadeaux tirés au hasard, total.
// Mémorisé sur la tablette (par activité, ou pour l'outil libre) jusqu'à « Remettre à zéro ».
import { app, registerView, go, render } from '../app.js';
import { h, btn, icon, iconBtn, openDialog, popMenu, toast } from './dom.js';
import { clone } from '../util.js';
import { vestOf, VEST_COLORS } from '../logic/teams.js';
import { levelInfo } from '../data/schema.js';
import { buzz, getDisplay } from './foundations.js';
import { clockText } from './chronoView.js';
import { helpItem } from './help.js';
import { presetFor, savePreset } from './presets.js';
import { activitiesOf } from '../logic/activities.js';
import * as MK from '../logic/mariokart.js';

const V = { fix: false, ticker: null, ended: false };
const keyOf = (r) => `mk:${r.scope === 'act' ? r.actId : 'free'}`;
const backTo = (r) => (r.from === 'classPage' && r.classId ? go('classPage', { id: r.classId }) : go('home'));
const actOf = (r) => (r.scope === 'act' ? activitiesOf(app.repo.get('classes', r.classId) || { activities: [] }).find((a) => a.id === r.actId) : null);
const PRESET_KEYS = ['version', 'durationMin', 'bonus', 'objectives'];

function stateOf(r) {
  let st = app.repo.getMeta(keyOf(r), null);
  if (!st) { st = MK.newMK(); const p = actOf(r) ? presetFor(actOf(r).name, 'mariokart') : null; if (p) Object.assign(st, p); }
  return MK.normalizeMK(st);
}

function tick() {
  if (app.route.name !== 'mariokart') { clearInterval(V.ticker); V.ticker = null; return; }
  const st = stateOf(app.route);
  const left = st.durationMin * 60000 - MK.elapsedMs(st);
  const el = document.querySelector('.mkclock');
  if (left <= 0 && st.clock.startedAt) { st.clock.base = st.durationMin * 60000; st.clock.startedAt = null; app.repo.setMeta(keyOf(app.route), st); buzz('end'); render(); return; }
  if (el) { const txt = clockText(left, false); const d = el.querySelector('b'); if (d && d.textContent !== txt) d.textContent = txt; el.classList.toggle('warn', left <= 60000); }
}

registerView('mariokart', (r) => {
  const st = stateOf(r);
  if (!V.ticker) V.ticker = setInterval(tick, 250);
  const save = () => { st.updatedAt = Date.now(); return app.repo.setMeta(keyOf(r), st); };
  const apply = (fn, kind = 'tap') => { fn(); buzz(V.fix ? 'undo' : kind); save(); render(); }; // save d'abord : la mémoire est lue au rendu
  const d = () => (V.fix ? -1 : 1);
  const act = actOf(r);
  const ver = st.version;
  const running = !!st.clock.startedAt;
  const left = st.durationMin * 60000 - MK.elapsedMs(st);
  const card = (g) => {
    const v = vestOf(g.color);
    const cb = h('button', { type: 'button', class: 'vestbtn', 'aria-label': 'Couleur', style: { background: v.hex } });
    cb.addEventListener('click', () => popMenu(cb, VEST_COLORS.filter((c) => c.id !== 'sans').map((c) => ({ label: c.label, active: c.id === g.color, onClick: () => apply(() => { g.color = c.id; }) }))));
    const need = MK.objectiveLaps(st, g), met = MK.objectiveMet(st, g);
    const objBtn = h('button', { type: 'button', class: `mkobj ${g.objective ? (met ? 'met' : 'on') : ''}`, onClick: (e) => popMenu(e.currentTarget, [
      { label: 'Pas d\'objectif', active: !g.objective, onClick: () => apply(() => { g.objective = null; g.objOk = null; }) },
      ...MK.CC.map((cc) => ({ label: `${cc}cc (${MK.CC_POINTS[cc]} pt${MK.CC_POINTS[cc] > 1 ? 's' : ''})${st.objectives[cc]?.[g.size] != null ? ` · ${st.objectives[cc][g.size]} tours` : ''}`, active: g.objective === cc, onClick: () => apply(() => { g.objective = cc; g.objOk = null; }) })),
      '-',
      ...[3, 4, 5].map((n) => ({ label: `Groupe de ${n} élèves`, active: g.size === n, onClick: () => apply(() => { g.size = n; }) })),
      g.objective && need == null ? { label: g.objOk ? 'Objectif : non validé' : 'Objectif : validé', onClick: () => apply(() => { g.objOk = !g.objOk; }) } : null,
    ].filter(Boolean)) }, g.objective ? `${g.objective}cc${need != null ? ` · ${g.laps}/${need} tours` : ''}${met ? ' ✓' : ''}` : 'Objectif : aucun');
    return h('section', { class: 'mkcard', style: { '--v': v.hex } },
      h('header', null, h('input', { type: 'text', class: 'tname', value: g.name, 'aria-label': 'Nom du groupe', onChange: (e) => { g.name = e.target.value.trim() || g.name; save(); } }), cb),
      h('div', { class: 'mklaps' },
        h('button', { type: 'button', class: 'mkbig', 'aria-label': `${V.fix ? 'Retirer' : 'Ajouter'} un tour à ${g.name}`, onClick: () => apply(() => MK.addLap(g, d())) },
          h('b', null, String(g.laps)), h('span', null, g.laps === 1 ? 'tour' : 'tours')),
        h('button', { type: 'button', class: 'mkminus', 'aria-label': `Retirer un tour à ${g.name}`, disabled: !g.laps, onClick: () => apply(() => MK.addLap(g, -1), 'undo') }, '−')),
      h('div', { class: 'mkline' },
        h('span', { class: 'mklab' }, 'Malus'),
        h('div', { class: 'stepper' },
          h('button', { type: 'button', 'aria-label': 'Malus : moins', disabled: !g.malus, onClick: () => apply(() => MK.addMalus(g, -1), 'undo') }, icon('minus', 16)),
          h('output', null, String(g.malus || 0)),
          h('button', { type: 'button', 'aria-label': 'Malus : plus', onClick: () => apply(() => MK.addMalus(g, 1)) }, icon('plus', 16))),
        objBtn),
      ver === 'v3' ? h('div', { class: 'mkline' },
        h('span', { class: 'mklab' }, `Pièces ${g.coins || 0}`),
        [1, 2, 3].map((n) => h('button', { type: 'button', class: 'mkcoin', onClick: () => apply(() => { const won = MK.addCoins(g, V.fix ? -n : n); if (won) { g.gifts += won; toast(`${g.name} : ${MK.COINS_PER_GIFT} pièces, un cadeau !`, { ms: 2500 }); } }) }, `${V.fix ? '−' : '+'}${n}`))) : null,
      ver !== 'v1' ? h('div', { class: 'mkline' },
        btn(ver === 'v3' ? (g.gifts ? `Tirer un cadeau (${g.gifts})` : 'Tirer un cadeau') : 'Tirer un cadeau', { icon: 'star', cls: `mkgift ${ver === 'v3' && g.gifts ? 'primary' : ''}`, disabled: ver === 'v3' && !g.gifts,
          onClick: () => giftDraw(st, g, () => { if (ver === 'v3') g.gifts = Math.max(0, g.gifts - 1); save(); render(); }) })) : null,
      ver === 'v1' ? null : h('div', { class: 'mkbonus' }, st.bonus.map((b) => h('button', { type: 'button', class: `mkb ${g.bonus[b] ? 'on' : ''}`, title: MK.MK_BONUS_DESC[b] || '', onClick: () => apply(() => MK.addBonus(g, b, d())) },
        h('span', null, b), h('b', null, String(g.bonus[b] || 0))))),
      h('div', { class: 'mktotal' }, h('span', { class: 'muted small' }, `Groupe performant : ${levelInfo(MK.lapsLevel(g.laps)).label.toLowerCase()}`), h('b', null, `${MK.totalOf(st, g)} pts`)));
  };
  const m = iconBtn('more', 'Options', () => popMenu(m, [
    { label: 'Réglages (version, durée, objectifs, bonus)…', onClick: () => mkSettingsDialog(st, (S) => { Object.assign(st, S); save(); render(); }, act?.name) },
    '-',
    { label: 'Remettre à zéro', danger: true, onClick: () => { const snap = clone(st); MK.resetMK(st); save(); render(); toast('Compteurs remis à zéro.', { action: 'Annuler', ms: 9000, onAction: () => { Object.assign(st, snap); save(); render(); } }); } },
    helpItem('mariokart'),
  ]), 'boxed');
  return h('div', { class: 'main mk' },
    h('div', { class: 'topbar' }, iconBtn('back', 'Retour', () => backTo(r), '', { 'data-back': '1' }),
      h('div', { class: 'grow evtitle' }, h('h1', null, `Mario Kart ${MK.MK_VERSIONS[ver].label}`), h('div', { class: 'sub' }, act ? act.name : 'Compteur de course')),
      h('div', { class: `mkclock ${left <= 60000 ? 'warn' : ''} ${left <= 0 ? 'done' : ''}` }, h('b', null, clockText(Math.max(0, left), false)),
        btn(running ? 'Pause' : left <= 0 ? 'Terminé' : MK.elapsedMs(st) ? 'Reprendre' : 'Départ', { icon: running ? 'pause' : 'play', cls: `mkgo ${running ? '' : 'primary'}`, disabled: left <= 0,
          onClick: () => apply(() => { if (running) { st.clock.base = MK.elapsedMs(st); st.clock.startedAt = null; } else st.clock.startedAt = Date.now(); }, 'change') }),
        MK.elapsedMs(st) && !running ? iconBtn('reset', 'Remettre le chrono à zéro', () => apply(() => { st.clock = { base: 0, startedAt: null }; })) : null),
      h('div', { class: 'stepper', role: 'group', 'aria-label': 'Nombre de groupes' },
        h('button', { type: 'button', 'aria-label': 'Un groupe de moins', disabled: st.groups.length <= 1, onClick: () => apply(() => MK.setGroupCount(st, st.groups.length - 1)) }, icon('minus', 18)),
        h('output', null, `${st.groups.length} gr.`),
        h('button', { type: 'button', 'aria-label': 'Un groupe de plus', disabled: st.groups.length >= 8, onClick: () => apply(() => MK.setGroupCount(st, st.groups.length + 1)) }, icon('plus', 18))),
      btn(V.fix ? 'Correction : −1' : 'Corriger', { icon: 'undo', cls: V.fix ? 'danger' : '', onClick: () => { V.fix = !V.fix; render(); } }),
      m),
    V.fix ? h('div', { class: 'ldhint warnbg' }, 'Mode correction : chaque toucher retire 1 (tours, pièces et bonus). Touchez « Correction » pour revenir.') : null,
    h('div', { class: `mkgrid scroll n${st.groups.length}`, 'data-keep': 'mkgrid' }, st.groups.map(card)));
});

/** Tirage d'un cadeau avec une petite animation façon « boîte à objets » (images de la fiche MK bonus). */
function giftDraw(st, g, done) {
  const final = MK.drawGift(st);
  if (!final) return toast('Aucun bonus dans la liste (⋮ › Réglages).');
  MK.addBonus(g, final, 1);
  const pic = h('div', { class: 'mkpic' });
  const name = h('div', { class: 'mkroll' }, st.bonus[0]);
  const desc = h('p', { class: 'mkdesc' });
  const show = (b) => { name.textContent = b; const src = MK.bonusImg(b); pic.replaceChildren(src ? h('img', { src, alt: b }) : h('span', { class: 'mkq' }, '?')); };
  const ok = btn('OK', { cls: 'primary bigbtn', onClick: () => { ov.remove(); done(); } });
  ok.style.visibility = 'hidden';
  const ov = h('div', { class: 'mkoverlay', role: 'dialog', 'aria-label': 'Cadeau' }, h('div', { class: 'mkbox', style: { '--v': vestOf(g.color).hex } }, h('div', { class: 'mkboxt' }, `${g.name} · cadeau`), pic, name, desc, ok));
  document.body.append(ov);
  show(st.bonus[0]);
  const finish = () => { show(final); name.classList.add('final'); pic.classList.add('final'); desc.textContent = MK.MK_BONUS_DESC[final] || ''; ok.style.visibility = 'visible'; buzz('change'); };
  if (getDisplay().motion === 'reduced') return finish();
  let i = 0, delay = 60;
  const spin = () => {
    show(st.bonus[i++ % st.bonus.length]);
    buzz('tap');
    delay *= 1.16;
    if (delay > 320) return setTimeout(finish, 260);
    setTimeout(spin, delay);
  };
  spin();
}

/** Réglages Mario Kart (aussi utilisés par Réglages › Préréglages de l'équipe EPS). */
export function mkSettingsDialog(initial, onSave, activityName = null, { presetOnly = false } = {}) {
  const S = JSON.parse(JSON.stringify({ version: initial.version || 'v1', durationMin: initial.durationMin || 12, bonus: initial.bonus || MK.MK_BONUS.slice(), objectives: initial.objectives || MK.emptyObjectives() }));
  let asPreset = presetOnly;
  const body = h('div', { class: 'dlg-body mkset' });
  const cell = (cc, n) => {
    const v = S.objectives[cc][n];
    return h('div', { class: 'mkcell' },
      h('button', { type: 'button', 'aria-label': 'Moins', onClick: () => { S.objectives[cc][n] = v == null ? null : v <= 1 ? null : v - 1; paint(); } }, '−'),
      h('output', null, v == null ? '—' : String(v)),
      h('button', { type: 'button', 'aria-label': 'Plus', onClick: () => { S.objectives[cc][n] = v == null ? 6 : Math.min(40, v + 1); paint(); } }, '+'));
  };
  const paint = () => body.replaceChildren(
    h('div', { class: 'field' }, 'Version', h('div', { class: 'seg' }, Object.entries(MK.MK_VERSIONS).map(([k, x]) => h('button', { type: 'button', class: S.version === k ? 'on' : '', onClick: () => { S.version = k; paint(); } }, x.label))), h('span', { class: 'muted small' }, MK.MK_VERSIONS[S.version].hint)),
    h('div', { class: 'field' }, 'Durée de la course', h('div', { class: 'stepper' },
      h('button', { type: 'button', 'aria-label': 'Moins', onClick: () => { S.durationMin = Math.max(1, S.durationMin - 1); paint(); } }, icon('minus', 18)), h('output', null, `${S.durationMin} min`),
      h('button', { type: 'button', 'aria-label': 'Plus', onClick: () => { S.durationMin = Math.min(60, S.durationMin + 1); paint(); } }, icon('plus', 18)))),
    h('div', { class: 'field' }, 'Objectifs : tours à faire (vide = à valider à la main)',
      h('table', { class: 'edit mkobjtab' }, h('thead', null, h('tr', null, h('th', null, ''), MK.CC.map((cc) => h('th', null, `${cc}cc`, h('div', { class: 'muted small' }, `${MK.CC_POINTS[cc]} pt · VMA ${MK.CC_VMA[cc]}`))))),
        h('tbody', null, [3, 4, 5].map((n) => h('tr', null, h('th', null, `${n} élèves`), MK.CC.map((cc) => h('td', null, cell(cc, n)))))))),
    h('div', { class: 'field' }, 'Bonus (cadeaux)', ...S.bonus.map((b, i) => h('div', { class: 'listrow' },
      h('input', { type: 'text', value: b, 'aria-label': 'Bonus', style: { flex: 1 }, onChange: (e) => { S.bonus[i] = e.target.value; } }),
      h('span', { class: 'muted small', style: { flex: 2 } }, MK.MK_BONUS_DESC[b] || ''),
      iconBtn('trash', 'Retirer', () => { S.bonus.splice(i, 1); paint(); }, 'sm'))),
      h('div', { class: 'row' }, btn('Ajouter un bonus', { icon: 'plus', cls: 'small soft', onClick: () => { S.bonus.push('Nouveau bonus'); paint(); } }), btn('Liste d\'origine', { cls: 'small soft', onClick: () => { S.bonus = MK.MK_BONUS.slice(); paint(); } }))),
    activityName && !presetOnly ? h('label', { class: 'row presetcheck' }, h('input', { type: 'checkbox', checked: asPreset, style: { width: '22px', height: '22px' }, onChange: (e) => { asPreset = e.target.checked; } }),
      h('span', null, `Enregistrer aussi comme préréglage de l'équipe EPS pour « ${activityName} »`)) : '');
  paint();
  openDialog({ title: presetOnly ? `Préréglage Mario Kart · ${activityName}` : 'Réglages Mario Kart', body, wide: true, actions: [{ label: 'Annuler' }, { label: 'Enregistrer', primary: true, onClick: async () => {
    S.bonus = S.bonus.map((x) => x.trim()).filter(Boolean).filter((x, i, a) => a.indexOf(x) === i);
    if (asPreset && activityName) await savePreset(activityName, 'mariokart', Object.fromEntries(PRESET_KEYS.map((k) => [k, S[k]])));
    onSave(S);
  } }] });
}
