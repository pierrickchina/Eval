// Dépôt de données : cache mémoire + écriture immédiate dans le stockage local.
// Chaque enregistrement porte updatedAt + deviceId (utilisés pour la synchronisation).
import { uid, now, clone } from '../util.js';
import { SCHEMA_VERSION } from './schema.js';

export const DATA_STORES = ['models', 'classes', 'evaluations'];
export const keyOf = (store, id) => `${store}:${id}`;

export class Repo {
  constructor(store) {
    this.store = store;
    this.data = Object.fromEntries(DATA_STORES.map((s) => [s, new Map()]));
    this.meta = new Map();
    this.listeners = new Set();
    this._queue = Promise.resolve();
    this.deviceId = null;
  }

  async init() {
    await this.store.open();
    for (const s of DATA_STORES) for (const r of await this.store.getAll(s)) this.data[s].set(r.id, r);
    for (const r of await this.store.getAll('meta')) this.meta.set(r.id, r.value);
    if (!this.meta.has('deviceId')) await this.setMeta('deviceId', uid());
    this.deviceId = this.meta.get('deviceId');
    return this;
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  _emit(info) {
    for (const fn of this.listeners) fn(info);
  }

  // Les écritures sont sérialisées pour conserver l'ordre.
  _write(fn) {
    this._queue = this._queue.then(fn, fn);
    return this._queue;
  }
  flush() { return this._queue; }

  all(name) { return [...this.data[name].values()]; }
  list(name) { return this.all(name).filter((r) => !r.deleted); }
  get(name, id) { return this.data[name].get(id) || null; }

  /** Enregistre (met à jour updatedAt/deviceId sauf keepStamp). */
  save(name, rec, { keepStamp = false, silent = false } = {}) {
    if (!keepStamp) {
      rec.updatedAt = now();
      rec.deviceId = this.deviceId;
    }
    this.data[name].set(rec.id, rec);
    if (!silent) this._emit({ store: name, id: rec.id });
    return this._write(() => this.store.put(name, rec));
  }

  remove(name, id) {
    const rec = this.get(name, id);
    if (!rec) return Promise.resolve();
    rec.deleted = true;
    return this.save(name, rec);
  }

  restore(name, id) {
    const rec = this.get(name, id);
    if (!rec) return Promise.resolve();
    delete rec.deleted;
    return this.save(name, rec);
  }

  getMeta(key, def = null) { return this.meta.has(key) ? this.meta.get(key) : def; }
  setMeta(key, value) {
    this.meta.set(key, value);
    return this._write(() => this.store.put('meta', { id: key, value }));
  }

  /** Nombre d'enregistrements modifiés depuis la dernière synchronisation. */
  pendingCount() {
    const base = this.getMeta('syncBase', {});
    let n = 0;
    for (const s of DATA_STORES) for (const r of this.data[s].values()) if (base[keyOf(s, r.id)] !== r.updatedAt) n++;
    return n;
  }

  // ---- Sauvegarde JSON complète ----

  exportAll() {
    return {
      app: 'eps-eval',
      schema: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      deviceId: this.deviceId,
      models: this.all('models').map(clone),
      classes: this.all('classes').map(clone),
      evaluations: this.all('evaluations').map(clone),
    };
  }

  /**
   * mode 'merge'  : ajoute ce qui manque ; remplace seulement par une version PLUS RÉCENTE ;
   *                 ne remplace jamais une donnée locale plus récente.
   * mode 'replace': efface tout puis restaure la sauvegarde (action explicite de l'utilisateur).
   */
  async importAll(obj, { mode = 'merge' } = {}) {
    if (!obj || obj.app !== 'eps-eval') throw new Error("Ce fichier n'est pas une sauvegarde de l'application.");
    if (obj.schema > SCHEMA_VERSION) throw new Error('Sauvegarde créée par une version plus récente de l\'application.');
    const report = { added: 0, updated: 0, keptLocal: 0, total: 0 };
    if (mode === 'replace') {
      for (const s of DATA_STORES) {
        this.data[s].clear();
        await this._write(() => this.store.clear(s));
      }
    }
    for (const s of DATA_STORES) {
      for (const rec of obj[s] || []) {
        report.total++;
        const loc = this.get(s, rec.id);
        if (!loc) {
          await this.save(s, clone(rec), { keepStamp: true, silent: true });
          report.added++;
        } else if ((rec.updatedAt || 0) > (loc.updatedAt || 0)) {
          await this.save(s, clone(rec), { keepStamp: true, silent: true });
          report.updated++;
        } else if (rec.updatedAt !== loc.updatedAt) report.keptLocal++;
      }
    }
    this._emit({ store: '*' });
    return report;
  }
}
