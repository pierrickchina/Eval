// Annuler / rétablir pour une évaluation ouverte (instantanés de la partie modifiable).
import { clone, now } from '../util.js';

const MUTABLE = ['date', 'students', 'groups', 'membership', 'status', 'statusU', 'results', 'notes'];

const snap = (ev) => {
  const o = {};
  for (const k of MUTABLE) o[k] = clone(ev[k] ?? (k === 'date' ? '' : {}));
  return o;
};

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export class EvalSession {
  /** onChange(ev) est appelé après chaque modification (sauvegarde automatique). */
  constructor(ev, { onChange = () => {}, limit = 50 } = {}) {
    this.ev = ev;
    this.onChange = onChange;
    this.limit = limit;
    this.undoStack = [];
    this.redoStack = [];
  }

  /** Exécute une modification annulable. Renvoie false si rien n'a changé. */
  do(label, fn) {
    const before = snap(this.ev);
    fn(this.ev);
    const after = snap(this.ev);
    if (same(before, after)) return false;
    this.undoStack.push({ label, before, after });
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack = [];
    this.ev.updatedAt = now();
    this.onChange(this.ev);
    return true;
  }

  get canUndo() { return this.undoStack.length > 0; }
  get canRedo() { return this.redoStack.length > 0; }
  get undoLabel() { return this.undoStack.at(-1)?.label ?? null; }
  get redoLabel() { return this.redoStack.at(-1)?.label ?? null; }

  undo() {
    const e = this.undoStack.pop();
    if (!e) return null;
    Object.assign(this.ev, clone(e.before));
    this.redoStack.push(e);
    this.onChange(this.ev);
    return e.label;
  }

  redo() {
    const e = this.redoStack.pop();
    if (!e) return null;
    Object.assign(this.ev, clone(e.after));
    this.undoStack.push(e);
    this.onChange(this.ev);
    return e.label;
  }
}
