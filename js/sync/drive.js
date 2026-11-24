// Google Drive : authentification (Google Identity Services) et accès au fichier de synchro.
// Les données vont dans le dossier caché de l'application (scope drive.appdata) :
// invisibles dans « Mon Drive », limitées à cette application.
import { RemoteChangedError } from './engine.js';

const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const FILE_NAME = 'eps-eval-sync.json';
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';

function loadGis() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve();
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Impossible de joindre Google (hors connexion ?).'));
    document.head.append(s);
  });
}

export class GoogleAuth {
  constructor(getClientId) {
    this.getClientId = getClientId;
    this.accessToken = null;
    this.expiresAt = 0;
    this.client = null;
    this.clientIdUsed = null;
  }

  hasValidToken() { return !!this.accessToken && Date.now() < this.expiresAt - 30000; }
  invalidate() { this.accessToken = null; this.expiresAt = 0; }

  /** interactive=true : affiche la fenêtre de consentement (geste de l'utilisateur requis). */
  async token({ interactive = false } = {}) {
    if (this.hasValidToken()) return this.accessToken;
    const clientId = this.getClientId();
    if (!clientId) throw new Error('Identifiant client Google manquant (Réglages › Données).');
    await loadGis();
    if (!this.client || this.clientIdUsed !== clientId) {
      this.clientIdUsed = clientId;
      this.client = google.accounts.oauth2.initTokenClient({ client_id: clientId, scope: SCOPE, callback: () => {} });
    }
    return new Promise((resolve, reject) => {
      this.client.callback = (resp) => {
        if (resp.error) return reject(new Error(resp.error_description || resp.error));
        this.accessToken = resp.access_token;
        this.expiresAt = Date.now() + (Number(resp.expires_in) || 3600) * 1000;
        resolve(this.accessToken);
      };
      this.client.error_callback = (err) => reject(new Error(err.type === 'popup_closed' ? 'Connexion annulée.' : `Connexion Google impossible (${err.type || 'erreur'}).`));
      this.client.requestAccessToken({ prompt: interactive ? 'consent' : '' });
    });
  }
}

/** Implémente l'interface attendue par SyncEngine : getRemote() / putRemote(). */
export class DriveApi {
  constructor(auth) { this.auth = auth; }

  async _fetch(url, opts = {}) {
    const token = await this.auth.token();
    const r = await fetch(url, { ...opts, headers: { Authorization: `Bearer ${token}`, ...(opts.headers || {}) } });
    if (r.status === 401) { this.auth.invalidate(); throw new Error('Session Google expirée : touchez « Se connecter à Google Drive ».'); }
    if (r.status === 403) throw new Error('Accès Google Drive refusé (API Drive non activée ou autorisation manquante).');
    if (!r.ok) throw new Error(`Google Drive : erreur ${r.status}.`);
    return r;
  }

  async _find() {
    const q = encodeURIComponent(`name='${FILE_NAME}' and trashed=false`);
    const r = await this._fetch(`${API}/files?spaces=appDataFolder&q=${q}&fields=files(id,md5Checksum,modifiedTime)&orderBy=createdTime&pageSize=5`);
    const { files } = await r.json();
    return files?.[0] || null;
  }

  async getRemote() {
    const f = await this._find();
    if (!f) return { version: null, data: null };
    const r = await this._fetch(`${API}/files/${f.id}?alt=media`);
    const data = await r.json();
    return { version: f.md5Checksum || f.modifiedTime, data };
  }

  async putRemote(data, expectedVersion) {
    const f = await this._find();
    const current = f ? f.md5Checksum || f.modifiedTime : null;
    if (current !== expectedVersion) throw new RemoteChangedError(); // quelqu'un a écrit entre-temps
    const body = JSON.stringify(data);
    if (!f) {
      const b = 'epsboundary' + Math.random().toString(36).slice(2);
      const multipart = `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: FILE_NAME, parents: ['appDataFolder'] })}\r\n--${b}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${b}--`;
      await this._fetch(`${UPLOAD}/files?uploadType=multipart`, { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${b}` }, body: multipart });
    } else {
      await this._fetch(`${UPLOAD}/files/${f.id}?uploadType=media`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body });
    }
  }
}
