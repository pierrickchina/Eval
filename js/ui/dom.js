// Aides DOM : création d'éléments, icônes, boîtes de dialogue, notifications.

export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  let value;
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') { for (const [sk, sv] of Object.entries(v)) { if (sk.startsWith('--')) el.style.setProperty(sk, sv); else el.style[sk] = sv; } } // (les variables CSS --x exigent setProperty)
    else if (k === 'value') value = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'checked' || k === 'disabled' || k === 'selected' || k === 'readOnly' || k === 'hidden') el[k] = true;
    else el.setAttribute(k, v === true ? '' : v);
  }
  const add = (c) => {
    if (c == null || c === false) return;
    if (Array.isArray(c)) c.forEach(add);
    else el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  };
  kids.forEach(add);
  if (value !== undefined) el.value = value;
  return el;
}

const ICONS = {
  paddle: 'M16 9a6 6 0 1 1-12 0 6 6 0 0 1 12 0z M7 14l-3.5 6.5 M20.5 18a1.8 1.8 0 1 1-3.6 0 1.8 1.8 0 0 1 3.6 0z',
  compass: 'M12 21a9 9 0 100-18 9 9 0 000 18z M15.5 8.5l-2 5-5 2 2-5z',
  ring: 'M3 7h18 M3 12h18 M3 17h18 M5 4v16 M19 4v16',
  flag: 'M5 21V4 M5 4h14v9H5 M5 8.5h14 M9.7 4v9 M14.3 4v9 M7.3 4v4.5 M12 8.5V13 M16.7 4v4.5',
  glove: 'M7 20.5h9V17l2.2-3.2V9.5A4.5 4.5 0 0013.7 5H10a5 5 0 00-5 5v3.5L7 16z M7 16.5h9 M11.5 5v3.5a2 2 0 01-2 2H8',
  bolt: 'M13 2L4 14h7l-1 8 9-12h-7z',
  medal: 'M12 15a6 6 0 100-12 6 6 0 000 12z M8.5 14L7 22l5-3 5 3-1.5-8',
  stairs: 'M3 20h5v-5h5v-5h5V5h3',
  back: 'M15 18l-6-6 6-6',
  undo: 'M9 14L4 9l5-5 M4 9h10a6 6 0 010 12h-3',
  redo: 'M15 14l5-5-5-5 M20 9H10a6 6 0 000 12h3',
  plus: 'M12 5v14 M5 12h14',
  minus: 'M5 12h14',
  gear: 'M4 7h10 M18 7h2 M4 17h2 M10 17h10 M16 5v4 M8 15v4',
  copy: 'M9 9h11v11H9z M5 15V5h10',
  trash: 'M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13',
  up: 'M6 15l6-6 6 6',
  down: 'M6 9l6 6 6-6',
  check: 'M5 13l4 4 10-10',
  close: 'M6 6l12 12 M18 6L6 18',
  users: 'M9 11a3 3 0 100-6 3 3 0 000 6z M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6 M17 11a3 3 0 000-6 M21 20c0-2.5-1.5-4.5-4-5.5',
  cloud: 'M7 18a4 4 0 010-8 5 5 0 019.5-1A4.5 4.5 0 0117 18z',
  more: 'M12 6h.01 M12 12h.01 M12 18h.01',
  chart: 'M4 20V4 M4 20h16 M8 16l4-5 3 3 5-7',
  next: 'M9 6l6 6-6 6',
  edit: 'M4 20h4L19 9l-4-4L4 16z',
  clip: 'M8 4h8l1 2h2v14H5V6h2z M9 12l2 2 4-4',
  download: 'M12 4v11 M7 11l5 5 5-5 M5 20h14',
  upload: 'M12 16V5 M7 9l5-5 5 5 M5 20h14',
  file: 'M7 3h7l4 4v14H7z M14 3v4h4',
  help: 'M12 21a9 9 0 100-18 9 9 0 000 18z M9.6 9.4a2.5 2.5 0 114.2 1.8c-.9.8-1.8 1.2-1.8 2.6 M12 17h.01',
  chrono: 'M12 21a8 8 0 100-16 8 8 0 000 16z M12 9v4.2l2.6 1.6 M9.5 2.5h5 M12 2.5V5',
  teams: 'M8.5 4L3 7l2 4 3-1.5V20h8V9.5L19 11l2-4-5.5-3c-.6 1.3-1.9 2-3.5 2s-2.9-.7-3.5-2z',
  club: 'M12 3l7.5 3v5.5c0 4.7-3.1 8.2-7.5 9.5-4.4-1.3-7.5-4.8-7.5-9.5V6z M9 11l2.2 2.2L15 9.5',
  trophy: 'M8 4h8v5a4 4 0 01-8 0z M8 6H5a3 3 0 003.2 4.2 M16 6h3a3 3 0 01-3.2 4.2 M12 13v4 M9 20h6 M10 17h4',
  racket: 'M11 3a6.5 6.5 0 100 13 6.5 6.5 0 000-13z M15.6 14.1l4 4',
  pin: 'M9 4h6l-1 6 3 3H7l3-3z M12 13v7',
  play: 'M8 5l11 7-11 7z',
  pause: 'M8 5v14 M16 5v14',
  reset: 'M4 12a8 8 0 108-8 M4 4v5h5',
  lock: 'M7 11h10v9H7z M9 11V8a3 3 0 016 0v3',
  expand: 'M4 9V4h5 M20 9V4h-5 M4 15v5h5 M20 15v5h-5',
  print: 'M7 9V4h10v5 M7 17H4v-7h16v7h-3 M7 14h10v6H7z',
  shuffle: 'M4 7h4l8 10h4 M4 17h4l2-2.5 M14 9l2-2h4 M18 5l2 2-2 2 M18 15l2 2-2 2',
  star: 'M12 4l2.4 5 5.6.7-4 3.9 1 5.6-5-2.7-5 2.7 1-5.6-4-3.9 5.6-.7z',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M12 15a3 3 0 100-6 3 3 0 000 6z',
  link: 'M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1 M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1',
  resume: 'M4 12a8 8 0 118 8 M4 20v-5h5 M12 8v4l3 2',
  share: 'M12 4v11 M7 8l5-5 5 5 M5 14v6h14v-6',
};

export function icon(name, size = 22) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', name === 'more' ? 3 : 2);
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  for (const d of (ICONS[name] || '').split(' M')) {
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', d.startsWith('M') ? d : 'M' + d);
    svg.append(p);
  }
  return svg;
}

/** Bouton avec icône et/ou texte. */
export function btn(label, { icon: ic, cls = '', onClick, title, disabled, ...rest } = {}) {
  return h('button', { type: 'button', class: `btn ${cls}`, onClick, title: title || (ic && !label ? label : null), 'aria-label': title || label || null, disabled, ...rest },
    ic ? icon(ic, 20) : null, label ? h('span', null, label) : null);
}

export function iconBtn(ic, title, onClick, cls = '', extra = {}) {
  return h('button', { type: 'button', class: `iconbtn ${cls}`, title, 'aria-label': title, onClick, ...extra }, icon(ic, 22));
}

// ---------- Dialogues ----------

let overlayRoot;
const openDialogs = [];

export function openDialog({ title, body, actions = [], wide = false, onClose } = {}) {
  overlayRoot ??= document.getElementById('overlay-root');
  const close = () => {
    const i = openDialogs.indexOf(api);
    if (i >= 0) openDialogs.splice(i, 1);
    back.remove();
    onClose?.();
  };
  const head = h('div', { class: 'dlg-head' }, h('h2', null, title || ''), iconBtn('close', 'Fermer', close));
  const content = h('div', { class: 'dlg-body' }, body);
  const foot = actions.length
    ? h('div', { class: 'dlg-foot' }, actions.map((a) => {
        const b = h('button', { type: 'button', class: `btn ${a.primary ? 'primary' : ''} ${a.danger ? 'danger' : ''}`, disabled: a.disabled,
          onClick: async () => { const r = await a.onClick?.(api); if (r !== false && !a.keepOpen) close(); } }, a.label);
        return b;
      }))
    : null;
  const box = h('div', { class: `dlg ${wide ? 'wide' : ''}`, role: 'dialog', 'aria-modal': 'true' }, head, content, foot);
  const back = h('div', { class: 'backdrop', onMousedown: (e) => { if (e.target === back) close(); } }, box);
  overlayRoot.append(back);
  const api = { close, el: box, content, foot };
  openDialogs.push(api);
  setTimeout(() => box.querySelector('[autofocus]')?.focus(), 30);
  return api;
}

export const closeTopDialog = () => openDialogs.at(-1)?.close();
export const hasDialog = () => openDialogs.length > 0;

export function confirmDialog(message, okLabel = 'Confirmer', { danger = true } = {}) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    openDialog({
      title: 'Confirmation',
      body: h('p', { class: 'dlg-msg' }, message),
      actions: [
        { label: 'Annuler', onClick: () => finish(false) },
        { label: okLabel, primary: !danger, danger, onClick: () => finish(true) },
      ],
      onClose: () => finish(false),
    });
  });
}

/** Petit menu contextuel ancré à un élément. items : [{label, onClick, danger, disabled, active}] */
export function popMenu(anchor, items) {
  overlayRoot ??= document.getElementById('overlay-root');
  const close = () => { menu.remove(); document.removeEventListener('pointerdown', outside, true); };
  const outside = (e) => { if (!menu.contains(e.target)) close(); };
  const menu = h('div', { class: 'popmenu', role: 'menu' }, items.filter(Boolean).map((it) =>
    it === '-' ? h('hr') : h('button', { type: 'button', role: 'menuitem', class: `${it.danger ? 'danger' : ''} ${it.active ? 'active' : ''}`, disabled: it.disabled,
      onClick: () => { close(); it.onClick?.(); } }, it.label)));
  overlayRoot.append(menu);
  const r = anchor.getBoundingClientRect();
  const mw = menu.offsetWidth, mh = menu.offsetHeight;
  let left = Math.min(r.left, window.innerWidth - mw - 8);
  let top = r.bottom + 4;
  if (top + mh > window.innerHeight - 8) top = Math.max(8, r.top - mh - 4);
  menu.style.left = Math.max(8, left) + 'px';
  menu.style.top = top + 'px';
  setTimeout(() => document.addEventListener('pointerdown', outside, true), 0);
  return { close };
}

// ---------- Notifications ----------

export function toast(message, { action, onAction, ms = 5000 } = {}) {
  const root = document.getElementById('toasts');
  const t = h('div', { class: 'toast' }, h('span', null, message),
    action ? h('button', { type: 'button', class: 'toast-act', onClick: () => { onAction?.(); t.remove(); } }, action) : null);
  while (root.children.length >= 2) root.firstChild.remove(); // jamais plus de 2 notifications
  root.append(t);
  setTimeout(() => t.remove(), ms);
  return t;
}

export function download(filename, text, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = h('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Pictogramme d'une évaluation, à la couleur de la classe. */
export function classBadge(color, size = 44) {
  const w = h('div', { class: 'badge', style: { background: color, width: size + 'px', height: size + 'px' } });
  w.append(icon('clip', Math.round(size * 0.55)));
  return w;
}
