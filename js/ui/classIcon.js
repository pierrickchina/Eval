// Icônes de classe (1.12) : 5 symboles tirés du logo PEPS × 5 palettes, choisis séparément.
// cls.icon = { shape: 'duo'|'left'|'right'|'round'|'bare', palette: 'sable'|'menthe'|'lavande'|'corail'|'ocean' }

export const ICON_SHAPES = [
  ['duo', 'Deux montagnes'], ['left', 'Montagne de gauche'], ['right', 'Montagne de droite'], ['round', 'En cercle'], ['bare', 'Sans fond'],
];
/** Palettes : [ciel, montagne claire, montagne foncée, face intermédiaire]. */
export const ICON_PALETTES = {
  sable: ['#D4EBF2', '#F6E3A0', '#DE8E6C', '#EDAA88'],
  menthe: ['#DDF0E4', '#C3E6B5', '#4E9A72', '#7DBE96'],
  lavande: ['#E7E1F7', '#D6CBF3', '#7A62C4', '#A592E0'],
  corail: ['#FBE3DF', '#F8D49A', '#C9564A', '#E58B7E'],
  ocean: ['#DCEAF7', '#C4E1EE', '#3E77B3', '#79A6D6'],
};
export const PALETTE_NAMES = { sable: 'Sable', menthe: 'Menthe', lavande: 'Lavande', corail: 'Corail', ocean: 'Océan' };
export const DEFAULT_ICON = { shape: 'duo', palette: 'sable' };

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; };
let n = 0;

/** SVG de l'icône (carré 512, mêmes formes que le logo). */
export function classIconSvg(spec = DEFAULT_ICON, size = 56) {
  const shape = ICON_SHAPES.some(([k]) => k === spec?.shape) ? spec.shape : 'duo';
  const [sky, m1, m2, mid] = ICON_PALETTES[spec?.palette] || ICON_PALETTES.sable;
  const svg = el('svg', { viewBox: '0 0 512 512', width: size, height: size, 'aria-hidden': 'true', class: 'clsicon' });
  const id = `ci${++n}`;
  const defs = el('defs', {});
  const clip = el('clipPath', { id });
  clip.append(shape === 'round' ? el('circle', { cx: 256, cy: 256, r: 250 }) : shape === 'bare' ? el('rect', { x: 0, y: 0, width: 512, height: 452 }) : el('rect', { width: 512, height: 512, rx: 116 }));
  defs.append(clip); svg.append(defs);
  if (shape !== 'bare') svg.append(shape === 'round' ? el('circle', { cx: 256, cy: 256, r: 250, fill: sky }) : el('rect', { width: 512, height: 512, rx: 116, fill: sky }));
  const g = el('g', { 'clip-path': `url(#${id})`, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' });
  const poly = (pts, fill) => g.append(el('polygon', { points: pts, fill, stroke: fill, 'stroke-width': 24 }));
  const line = (d) => g.append(el('path', { d, fill: 'none', stroke: mid, 'stroke-width': 34 }));
  if (shape === 'left') {
    poly('256,120 520,560 -8,560', m1); poly('256,120 520,560 330,560', m2); line('M-8 560 L256 120 L520 560');
  } else if (shape === 'right') {
    poly('256,120 520,560 -8,560', m2); poly('256,120 -8,560 182,560', m1); line('M-8 560 L256 120 L520 560');
  } else {
    // deux montagnes (logo) — légèrement remontées pour « sans fond » afin de rester lisibles
    const dy = shape === 'bare' ? -60 : 0;
    const P = (pts) => pts.split(' ').map((p) => { const [x, y] = p.split(',').map(Number); return `${x},${y + dy}`; }).join(' ');
    poly(P('196,150 283.9,287.4 109.4,560 -66.4,560'), m1);
    poly(P('336,206 562.6,560 458.4,560 283.9,287.4'), m2);
    poly(P('283.9,287.4 458.4,560 109.4,560'), mid);
    line(`M109.4 ${560 + dy} L336 ${206 + dy} L562.6 ${560 + dy}`);
    line(`M-66.4 ${560 + dy} L196 ${150 + dy} L458.4 ${560 + dy}`);
  }
  svg.append(g);
  return svg;
}

const PAL_KEYS = Object.keys(ICON_PALETTES);
/** Icône d'une classe ; par défaut : deux montagnes, palette choisie d'après la couleur de la classe (stable). */
export function classIconOf(cls) {
  if (cls?.icon?.shape) return cls.icon;
  const k = [...String(cls?.color || cls?.id || '')].reduce((a, ch) => a + ch.charCodeAt(0), 0);
  return { shape: 'duo', palette: PAL_KEYS[k % PAL_KEYS.length] };
}
