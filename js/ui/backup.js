// Sauvegarde : « Partager la sauvegarde » (menu de partage de la tablette → Google Drive, Mes fichiers, mail…)
// et rappel de la dernière sauvegarde. Aucune connexion à un compte, aucun identifiant à créer.
import { app } from '../app.js';
import { download, toast } from './dom.js';
import { DATA_STORES } from '../data/repo.js';

const DAY = 86400000;

export const lastBackup = () => app.repo.getMeta('lastBackup', null);

/** Nombre d'enregistrements modifiés depuis la dernière sauvegarde. */
export function changesSinceBackup() {
  const t = lastBackup() || 0;
  let n = 0;
  for (const s of DATA_STORES) for (const r of app.repo.all(s)) if ((r.updatedAt || 0) > t) n++;
  return n;
}

export function backupAge() {
  const t = lastBackup();
  if (!t) return { never: true, days: null };
  return { never: false, days: Math.floor((Date.now() - t) / DAY) };
}

export function backupText() {
  const { never, days } = backupAge();
  if (never) return 'Aucune sauvegarde pour l\'instant';
  if (days === 0) return 'Dernière sauvegarde : aujourd\'hui';
  return `Dernière sauvegarde : il y a ${days} jour${days > 1 ? 's' : ''}`;
}

/** Orange si jamais sauvegardé, ou si plus de 7 jours avec des modifications depuis. */
export function backupNeedsAttention() {
  const { never, days } = backupAge();
  if (never) return app.repo.list('evaluations').length + app.repo.list('classes').length > 0;
  return days >= 7 && changesSinceBackup() > 0;
}

const stamp = () => new Date().toISOString().slice(0, 10);

/**
 * Ouvre le menu de partage de la tablette (Drive, Mes fichiers, mail…).
 * Chrome n'autorise le partage que de certains types de fichiers (les fichiers « texte » en font partie) :
 * on essaie donc le fichier .txt (même contenu que le .json), puis le .json, puis le téléchargement.
 */
export async function shareBackup() {
  const json = JSON.stringify(app.repo.exportAll(), null, 1);
  const candidates = [
    { name: `eval-eps-sauvegarde-${stamp()}.txt`, type: 'text/plain' },
    { name: `eval-eps-sauvegarde-${stamp()}.json`, type: 'application/json' },
  ];
  for (const c of candidates) {
    try {
      const file = new File([json], c.name, { type: c.type });
      if (!navigator.canShare?.({ files: [file] })) continue;
      await navigator.share({ files: [file], title: 'Sauvegarde EPS' });
      await app.repo.setMeta('lastBackup', Date.now());
      toast('Sauvegarde partagée.');
      return true;
    } catch (e) {
      if (e?.name === 'AbortError') return false; // fenêtre de partage fermée : rien n'est enregistré
      console.warn('Partage impossible avec', c.type, e);
    }
  }
  // Plan B : téléchargement, puis envoi vers Drive depuis l'application Drive (+ › Importer)
  download(`eval-eps-sauvegarde-${stamp()}.txt`, json, 'text/plain');
  await app.repo.setMeta('lastBackup', Date.now());
  toast('Partage indisponible : fichier téléchargé (dossier Téléchargements). Dans Drive : « + » puis « Importer ».', {
    ms: 12000, action: 'Ouvrir Drive', onAction: () => window.open('https://drive.google.com/drive/my-drive', '_blank', 'noopener'),
  });
  return true;
}

/** Téléchargement simple (dossier Téléchargements de la tablette). */
export async function downloadBackup() {
  download(`eval-eps-sauvegarde-${stamp()}.json`, JSON.stringify(app.repo.exportAll(), null, 1));
  await app.repo.setMeta('lastBackup', Date.now());
  toast('Sauvegarde téléchargée.');
}

// ---------- Copie de sécurité interne (avant une mise à jour ou un « Remplacer tout ») ----------

export async function makeSafetyCopy(reason) {
  await app.repo.setMeta('safetyBackup', { at: Date.now(), reason, data: app.repo.exportAll() });
}
export const safetyInfo = () => { const b = app.repo.getMeta('safetyBackup'); return b ? { at: b.at, reason: b.reason } : null; };
export async function restoreSafetyCopy() {
  const b = app.repo.getMeta('safetyBackup');
  if (!b?.data) throw new Error('Aucune copie de sécurité.');
  return app.repo.importAll(b.data, { mode: 'replace' });
}
