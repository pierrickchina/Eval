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

const fileName = () => `eval-eps-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;

/** Ouvre le menu de partage de la tablette avec le fichier de sauvegarde (Drive, Mes fichiers, mail…). */
export async function shareBackup() {
  const json = JSON.stringify(app.repo.exportAll(), null, 1);
  const name = fileName();
  try {
    const file = new File([json], name, { type: 'application/json' });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Sauvegarde Évaluation EPS', text: 'Sauvegarde de mes évaluations EPS' });
      await app.repo.setMeta('lastBackup', Date.now());
      toast('Sauvegarde partagée.');
      return true;
    }
  } catch (e) {
    if (e?.name === 'AbortError') return false; // fenêtre de partage fermée : rien n'est enregistré
    console.warn('Partage impossible, téléchargement à la place :', e);
  }
  // Repli (navigateur sans partage de fichiers) : téléchargement classique
  download(name, json);
  await app.repo.setMeta('lastBackup', Date.now());
  toast('Partage indisponible ici : la sauvegarde a été téléchargée dans le dossier Téléchargements.', { ms: 7000 });
  return true;
}

/** Téléchargement simple (dossier Téléchargements de la tablette). */
export async function downloadBackup() {
  download(fileName(), JSON.stringify(app.repo.exportAll(), null, 1));
  await app.repo.setMeta('lastBackup', Date.now());
  toast('Sauvegarde téléchargée.');
}
