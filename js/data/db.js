// Stockage local : IndexedDB dans le navigateur, mémoire pour les tests Node.
import { clone } from '../util.js';

export const STORES = ['models', 'classes', 'evaluations', 'freetools', 'meta'];
const DB_VERSION = 2; // v2 (EPS 1.6) : ajout du stockage des outils libres (équipes, tournois…)

export class MemStore {
  constructor() {
    this.d = Object.fromEntries(STORES.map((s) => [s, new Map()]));
  }
  async open() {}
  async getAll(s) { return [...this.d[s].values()].map(clone); }
  async put(s, rec) { this.d[s].set(rec.id, clone(rec)); }
  async delete(s, id) { this.d[s].delete(id); }
  async clear(s) { this.d[s].clear(); }
}

export class IDBStore {
  constructor(name = 'eps-eval') {
    this.name = name;
    this.db = null;
  }

  open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.name, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = req.result;
        // Migrations futures : tester e.oldVersion et ajouter des cases ici sans jamais supprimer de données.
        for (const s of STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' }); // ne touche jamais aux cases existantes
      };
      req.onsuccess = () => {
        this.db = req.result;
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  }

  tx(store, mode, fn) {
    return new Promise((resolve, reject) => {
      const t = this.db.transaction(store, mode);
      const out = fn(t.objectStore(store));
      t.oncomplete = () => resolve(out?.result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  }

  getAll(s) { return this.tx(s, 'readonly', (o) => o.getAll()); }
  put(s, rec) { return this.tx(s, 'readwrite', (o) => o.put(clone(rec))); }
  delete(s, id) { return this.tx(s, 'readwrite', (o) => o.delete(id)); }
  clear(s) { return this.tx(s, 'readwrite', (o) => o.clear()); }
}

export const createStore = (name) => (typeof indexedDB !== 'undefined' ? new IDBStore(name) : new MemStore());
