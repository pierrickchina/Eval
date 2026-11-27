// Glisser-déposer tactile commun (Équipes, Tables, Rings) : un appui court = menu, un glissé = déplacement vers une zone [data-zone].
export function attachDrag(root, onDrop, onTap, { chip = '.schip', key = 'sid' } = {}) {
  root.addEventListener('pointerdown', (e) => {
    const chipEl = e.target.closest(chip);
    if (!chipEl || e.button > 0) return;
    const sid = chipEl.dataset[key], sx = e.clientX, sy = e.clientY;
    let ghost = null, moved = false, over = null;
    try { chipEl.setPointerCapture(e.pointerId); } catch { /* ok */ }
    const zoneAt = (x, y) => { if (ghost) ghost.style.display = 'none'; const z = document.elementFromPoint(x, y)?.closest('[data-zone]'); if (ghost) ghost.style.display = ''; return z; };
    const onMove = (ev) => {
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 8) {
        moved = true;
        document.body.classList.add('dragchip'); ghost = chipEl.cloneNode(true); ghost.classList.add('ghost'); document.body.append(ghost); chipEl.classList.add('dragging');
      }
      if (!moved) return;
      ghost.style.left = ev.clientX + 'px'; ghost.style.top = ev.clientY + 'px';
      const z = zoneAt(ev.clientX, ev.clientY);
      if (z !== over) { over?.classList.remove('over'); over = z; over?.classList.add('over'); }
      if (z && z.scrollWidth > z.clientWidth) { const zb = z.getBoundingClientRect(); if (ev.clientX < zb.left + 40) z.scrollLeft -= 14; else if (ev.clientX > zb.right - 40) z.scrollLeft += 14; } // zones à une seule ligne : défilement latéral
      const sc = z?.closest('.scroll'); // défilement automatique près des bords
      if (sc) { const b = sc.getBoundingClientRect(); if (ev.clientY < b.top + 50) sc.scrollTop -= 14; else if (ev.clientY > b.bottom - 50) sc.scrollTop += 14; }
    };
    const end = (ev) => {
      chipEl.removeEventListener('pointermove', onMove); chipEl.removeEventListener('pointerup', end); chipEl.removeEventListener('pointercancel', cancel);
      if (!moved) { onTap(sid, chipEl); return; }
      const z = zoneAt(ev.clientX, ev.clientY);
      document.body.classList.remove('dragchip'); over?.classList.remove('over'); ghost.remove(); chipEl.classList.remove('dragging');
      if (z) onDrop(sid, z.dataset.zone);
    };
    const cancel = () => { chipEl.removeEventListener('pointermove', onMove); chipEl.removeEventListener('pointerup', end); chipEl.removeEventListener('pointercancel', cancel); document.body.classList.remove('dragchip'); over?.classList.remove('over'); ghost?.remove(); chipEl.classList.remove('dragging'); };
    chipEl.addEventListener('pointermove', onMove); chipEl.addEventListener('pointerup', end); chipEl.addEventListener('pointercancel', cancel);
  });
}

