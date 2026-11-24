// Contrôleur de synchronisation : état affiché, déclenchement automatique, conflits.
import { app, render, updateSyncChips } from '../app.js';
import { h, openDialog, toast } from '../ui/dom.js';
import { debounce, fmt, fmtDate } from '../util.js';
import { SyncEngine } from './engine.js';
import { GoogleAuth, DriveApi } from './drive.js';

const recLabel = (store, r) =>
  store === 'classes' ? `Classe « ${r.name} » (${r.level})`
    : store === 'models' ? `Modèle « ${r.activity} — ${r.name} »`
      : `Évaluation « ${r.classInfo?.name} · ${r.model?.activity} » du ${fmtDate(r.date)}`;

const when = (r) => `${new Date(r.updatedAt).toLocaleString('fr-FR')}${r.deviceId ? ' (appareil ' + r.deviceId.slice(0, 4) + ')' : ''}`;

export class SyncController {
  constructor(repo) {
    this.repo = repo;
    this.lastError = '';
    this.running = false;
    this.auth = new GoogleAuth(() => (repo.getMeta('settings', {}) || {}).googleClientId || '');
    this.engine = new SyncEngine({ repo, api: new DriveApi(this.auth) });
    this.schedule = debounce(() => this.syncNow(), 4000);

    repo.onChange((info) => {
      updateSyncChips();
      if (info?.sync) return; // fin d'une synchro : ne pas relancer
      if (this.connected && ((repo.getMeta('settings', {}) || {}).autoSync !== false)) {
        this.schedule();
        if (app.syncState === 'synced') this.setState('pending');
      }
    });
    window.addEventListener('online', () => { if (this.connected) this.syncNow(); else this.setState('local'); });
    window.addEventListener('offline', () => { if (this.connected) this.setState('offline'); });
    setInterval(() => { if (this.connected && navigator.onLine && ((repo.getMeta('settings', {}) || {}).autoSync !== false)) this.syncNow(); }, 5 * 60 * 1000);
    this.setState(this.connected ? (navigator.onLine ? (repo.pendingCount() ? 'pending' : 'synced') : 'offline') : 'local');
  }

  get connected() { return !!this.repo.getMeta('driveConnected'); }

  setState(s) {
    app.syncState = s;
    updateSyncChips();
  }

  statusText() {
    return { local: 'Local uniquement (non connecté à Google Drive)', synced: 'Synchronisé', pending: 'Modifications en attente', syncing: 'Synchronisation en cours…', error: 'Erreur de synchronisation', offline: 'Hors connexion — modifications conservées' }[app.syncState];
  }

  async connect() {
    try {
      await this.auth.token({ interactive: true });
      await this.repo.setMeta('driveConnected', true);
      toast('Connecté à Google Drive.');
      await this.syncNow({ manual: true });
    } catch (e) {
      this.lastError = e.message;
      toast(e.message, { ms: 8000 });
      this.setState(this.connected ? 'error' : 'local');
      render();
    }
  }

  async syncNow({ manual = false } = {}) {
    if (this.running || !this.connected) return;
    if (!navigator.onLine) { this.setState('offline'); if (manual) toast('Hors connexion : les modifications sont conservées et partiront au retour du réseau.'); return; }
    this.running = true;
    this.lastError = '';
    this.setState('syncing');
    try {
      if (!this.auth.hasValidToken()) await this.auth.token({ interactive: false }).catch((e) => {
        throw new Error('Reconnexion à Google nécessaire : ouvrez Réglages › Données et touchez « Se connecter à Google Drive ». (' + e.message + ')');
      });
      let res = await this.engine.run();
      while (res.status === 'conflicts') {
        const resolutions = await this.askConflicts(res.conflicts);
        if (!resolutions) { this.setState('pending'); this.running = false; return; }
        res = await this.engine.run({ resolutions });
      }
      this.setState(this.repo.pendingCount() ? 'pending' : 'synced');
      if (res.pulled) render();
      if (manual) toast(`Synchronisation terminée (${res.pushed} envoyé(s), ${res.pulled} reçu(s)).`);
    } catch (e) {
      this.lastError = e.message;
      this.setState('error');
      if (manual) toast(e.message, { ms: 8000 });
    } finally {
      this.running = false;
      if (app.route.name === 'settings') render();
    }
  }

  /** Affiche les conflits et renvoie { clé: 'local' | 'remote' | 'merge' } ou null si annulé. */
  askConflicts(conflicts) {
    return new Promise((resolve) => {
      const choice = {};
      conflicts.forEach((c) => { choice[c.key] = c.store === 'evaluations' ? 'merge' : (c.local.updatedAt >= c.remote.updatedAt ? 'local' : 'remote'); });
      const body = [
        h('p', { class: 'dlg-msg' }, 'Les mêmes éléments ont été modifiés sur cette tablette et sur Google Drive (autre appareil). Rien n\'a été écrasé. Choisissez quoi garder pour chacun :'),
        ...conflicts.map((c) => {
          const name = `r-${c.key}`;
          const opt = (val, label, hint) => h('label', { class: 'row', style: { alignItems: 'flex-start', padding: '4px 0' } },
            h('input', { type: 'radio', name, checked: choice[c.key] === val, style: { width: '22px', height: '22px', marginTop: '2px' }, onChange: () => { choice[c.key] = val; } }),
            h('span', null, label, h('div', { class: 'muted small' }, hint)));
          return h('div', { class: 'panel', style: { boxShadow: 'none', border: '1px solid var(--line)', marginBottom: 0 } },
            h('b', null, recLabel(c.store, c.local.deleted ? c.remote : c.local)),
            opt('local', 'Garder la version de cette tablette' + (c.local.deleted ? ' (supprimée)' : ''), `modifiée le ${when(c.local)}`),
            opt('remote', 'Garder la version Google Drive' + (c.remote.deleted ? ' (supprimée)' : ''), `modifiée le ${when(c.remote)}`),
            c.store === 'evaluations' && !c.local.deleted && !c.remote.deleted ? opt('merge', 'Fusionner (recommandé)', 'garde, cellule par cellule, la saisie la plus récente des deux versions') : null);
        }),
      ];
      let done = false;
      openDialog({
        title: 'Conflit de synchronisation', body, wide: true,
        onClose: () => { if (!done) resolve(null); },
        actions: [{ label: 'Décider plus tard' }, { label: 'Appliquer ces choix', primary: true, onClick: () => { done = true; resolve({ ...choice }); } }],
      });
    });
  }
}
