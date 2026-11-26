// Moteur de synchronisation (indépendant de Google) : plan, conflits, fusion.
// Règle d'or : on n'écrase JAMAIS silencieusement une donnée plus récente.
import { now, clone } from '../util.js';
import { DATA_STORES, keyOf } from '../data/repo.js';

export class RemoteChangedError extends Error {}

const stable = (rec) => {
  const { updatedAt, deviceId, ...rest } = rec;
  return JSON.stringify(rest);
};

/** Compare deux jeux d'enregistrements (Map clé→{store,rec}) à partir de la base de dernière synchro. */
export function planSync(local, remote, base) {
  const plan = { toLocal: [], toRemote: [], conflicts: [], same: [] };
  for (const key of new Set([...local.keys(), ...remote.keys()])) {
    const L = local.get(key), R = remote.get(key);
    if (L && !R) { plan.toRemote.push(L); continue; }
    if (R && !L) { plan.toLocal.push(R); continue; }
    // « Identiques » = même contenu, ou même version produite par le même appareil.
    // (Deux appareils différents avec le même horodatage mais un contenu différent ne sont PAS identiques.)
    if (stable(L.rec) === stable(R.rec) || (L.rec.updatedAt === R.rec.updatedAt && L.rec.deviceId === R.rec.deviceId)) { plan.same.push(L); continue; }
    if (L.rec.deleted && R.rec.deleted) { plan.same.push(L); continue; }
    const b = base[key];
    if (b === L.rec.updatedAt) plan.toLocal.push(R);        // seul le distant a changé
    else if (b === R.rec.updatedAt) plan.toRemote.push(L);  // seul le local a changé
    else plan.conflicts.push({ key, store: L.store, local: L.rec, remote: R.rec });
  }
  return plan;
}

/** Fusion fine de deux versions d'une évaluation : cellule par cellule (la plus récente gagne). */
export function mergeEvaluations(a, b, deviceId = a.deviceId) {
  const [newer, older] = a.updatedAt >= b.updatedAt ? [a, b] : [b, a];
  const out = clone(newer);
  // élèves : ceux de la version récente d'abord, puis ceux seulement présents dans l'autre
  const ids = new Set(out.students.map((s) => s.id));
  for (const s of older.students) if (!ids.has(s.id)) out.students.push(clone(s));
  // résultats
  out.results = {};
  const sids = new Set([...Object.keys(a.results || {}), ...Object.keys(b.results || {})]);
  for (const sid of sids) {
    const ra = a.results?.[sid] || {}, rb = b.results?.[sid] || {};
    const cids = new Set([...Object.keys(ra), ...Object.keys(rb)]);
    for (const cid of cids) {
      const ca = ra[cid], cb = rb[cid];
      const win = !ca ? cb : !cb ? ca : (ca.u || 0) >= (cb.u || 0) ? ca : cb;
      (out.results[sid] ??= {})[cid] = clone(win);
    }
  }
  // statuts
  out.status = {};
  out.statusU = {};
  const all = new Set([...Object.keys(a.statusU || {}), ...Object.keys(b.statusU || {}), ...Object.keys(a.status || {}), ...Object.keys(b.status || {})]);
  for (const sid of all) {
    const ua = a.statusU?.[sid] || 0, ub = b.statusU?.[sid] || 0;
    const from = ua >= ub ? a : b;
    if (from.status?.[sid]) out.status[sid] = from.status[sid];
    out.statusU[sid] = Math.max(ua, ub);
  }
  // remarques par élève : la plus récente gagne
  out.notes = {};
  for (const sid of new Set([...Object.keys(a.notes || {}), ...Object.keys(b.notes || {})])) {
    const na = a.notes?.[sid], nb = b.notes?.[sid];
    out.notes[sid] = clone(!na ? nb : !nb ? na : (na.u || 0) >= (nb.u || 0) ? na : nb);
  }
  // auto-évaluations : par élève, la plus récente gagne
  out.selfEval = {};
  for (const sid of new Set([...Object.keys(a.selfEval || {}), ...Object.keys(b.selfEval || {})])) {
    const sa = a.selfEval?.[sid], sb = b.selfEval?.[sid];
    out.selfEval[sid] = clone(!sa ? sb : !sb ? sa : (sa.u || 0) >= (sb.u || 0) ? sa : sb);
  }
  // strictement plus récent que les deux versions fusionnées (même à la même milliseconde)
  out.updatedAt = Math.max(now(), a.updatedAt || 0, b.updatedAt || 0) + 1;
  out.deviceId = deviceId;
  return out;
}

export class SyncEngine {
  /**
   * api : { getRemote() -> {version, data|null}, putRemote(data, expectedVersion) -> newVersion }
   *       putRemote lève RemoteChangedError si le fichier distant a changé entre-temps.
   */
  constructor({ repo, api }) {
    this.repo = repo;
    this.api = api;
  }

  localMap() {
    const m = new Map();
    for (const s of DATA_STORES) for (const rec of this.repo.all(s)) m.set(keyOf(s, rec.id), { store: s, rec });
    return m;
  }

  static remoteMap(data) {
    const m = new Map();
    for (const s of DATA_STORES) for (const rec of data?.records?.[s] || []) m.set(keyOf(s, rec.id), { store: s, rec });
    return m;
  }

  /**
   * Étape 1 : calcule le plan. Si des conflits existent et qu'aucune décision n'est fournie,
   * renvoie { status:'conflicts', conflicts } sans rien modifier.
   * resolutions : { [clé]: 'local' | 'remote' | 'merge' }
   */
  async run({ resolutions = null, attempt = 0 } = {}) {
    const { version, data } = await this.api.getRemote();
    const remote = SyncEngine.remoteMap(data);
    const local = this.localMap();
    const base = this.repo.getMeta('syncBase', {});
    const plan = planSync(local, remote, base);

    const needDecision = plan.conflicts.filter((c) => !resolutions?.[c.key]);
    if (needDecision.length) return { status: 'conflicts', conflicts: needDecision, plan };

    const finalStamp = new Map(); // clé -> updatedAt synchronisé
    const toLocal = [...plan.toLocal];
    const toRemote = [...plan.toRemote];
    for (const c of plan.conflicts) {
      const choice = resolutions[c.key];
      if (choice === 'remote') toLocal.push({ store: c.store, rec: c.remote });
      else if (choice === 'merge' && c.store === 'evaluations') {
        const merged = mergeEvaluations(c.local, c.remote, this.repo.deviceId);
        toLocal.push({ store: c.store, rec: merged });
        toRemote.push({ store: c.store, rec: merged });
      } else {
        // « local » : on garde la version locale, qui devient la version commune.
        // Son tampon est avancé pour être strictement plus récent que celui du distant.
        const rec = clone(c.local);
        rec.updatedAt = Math.max(c.local.updatedAt, c.remote.updatedAt) + 1;
        rec.deviceId = this.repo.deviceId;
        toLocal.push({ store: c.store, rec });
        toRemote.push({ store: c.store, rec });
      }
    }

    // Écriture locale (tampons conservés)
    for (const { store, rec } of toLocal) await this.repo.save(store, clone(rec), { keepStamp: true, silent: true });

    // Construction du nouveau fichier distant
    const out = data ? clone(data) : { app: 'eps-eval', schema: 1, records: {} };
    for (const s of DATA_STORES) out.records[s] = out.records[s] || [];
    for (const { store, rec } of toRemote) {
      const arr = out.records[store];
      const i = arr.findIndex((r) => r.id === rec.id);
      if (i >= 0) arr[i] = clone(rec);
      else arr.push(clone(rec));
    }
    out.savedAt = new Date().toISOString();
    out.deviceId = this.repo.deviceId;

    if (toRemote.length || !data) {
      try {
        await this.api.putRemote(out, version);
      } catch (e) {
        if (e instanceof RemoteChangedError && attempt < 2) return this.run({ resolutions, attempt: attempt + 1 });
        throw e;
      }
    }

    // Nouvelle base : ce qui est identique des deux côtés après la synchro
    const newBase = {};
    for (const s of DATA_STORES) {
      for (const rec of out.records[s]) {
        const loc = this.repo.get(s, rec.id);
        if (loc && loc.updatedAt === rec.updatedAt) newBase[keyOf(s, rec.id)] = rec.updatedAt;
      }
    }
    await this.repo.setMeta('syncBase', newBase);
    await this.repo.setMeta('lastSync', Date.now());
    this.repo._emit({ store: '*', sync: true });
    return { status: 'ok', pulled: toLocal.length, pushed: toRemote.length };
  }
}
