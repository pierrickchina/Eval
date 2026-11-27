// Mode projection commun (Kabaddi, Interclasses…) : plein écran, gros caractères, sans boutons ; appui long (1 s) pour sortir.
import { h } from './dom.js';

export function projectionShell(title, sub, content, onExit) {
  const root = h('div', { class: 'main projection' },
    h('header', { class: 'pj-head' }, h('h1', null, title), sub ? h('div', { class: 'pj-sub' }, sub) : null),
    h('div', { class: 'pj-body' }, content),
    h('div', { class: 'cexit' }, 'Maintenez 1 seconde pour revenir'),
    h('button', { type: 'button', class: 'sr-back', 'data-back': '1', onClick: onExit, 'aria-label': 'Quitter la projection' }));
  let timer = null;
  const clear = () => { clearTimeout(timer); timer = null; };
  root.addEventListener('pointerdown', () => { clear(); timer = setTimeout(onExit, 1000); });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) root.addEventListener(ev, clear);
  try { document.documentElement.requestFullscreen?.().catch(() => {}); } catch { /* facultatif */ }
  return root;
}
export function leaveFullscreen() { try { if (document.fullscreenElement) document.exitFullscreen?.(); } catch { /* */ } }
