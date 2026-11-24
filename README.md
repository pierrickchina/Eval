# Évaluation EPS — application tablette (PWA)

Application web (HTML / CSS / JavaScript pur, sans build ni dépendance) pour évaluer les élèves en EPS depuis une tablette Android, **hors connexion**, avec sauvegarde locale (IndexedDB), export JSON et synchronisation Google Drive.

## 1. Démarrer

### Essayer sur un ordinateur
```bash
cd eps-eval
python3 -m http.server 8765        # ou : npx serve .
# ouvrir http://localhost:8765
```
`localhost` est accepté par les navigateurs pour le mode hors connexion et l'installation. Ouvrir `index.html` directement par double-clic (`file://`) ne fonctionne pas (modules JS bloqués).

### Mettre en ligne (nécessaire pour la tablette et Google Drive)
L'installation en PWA, le mode hors connexion et la connexion Google exigent une adresse **HTTPS**. Solution gratuite proposée : **GitHub Pages**.

1. Créer un dépôt GitHub (privé ou public), y envoyer le contenu du dossier `eps-eval/` à la racine.
2. *Settings › Pages* → Source : branche `main`, dossier `/ (root)`.
3. L'adresse sera `https://<votre-compte>.github.io/<depot>/`.
4. Sur la tablette, ouvrir cette adresse dans **Chrome**, puis menu ⋮ › **Installer l'application** (ou *Ajouter à l'écran d'accueil*). Elle s'ouvre ensuite en plein écran, sans barre d'adresse.
5. Ouvrir l'application **une première fois avec du réseau** : elle se met en cache, puis fonctionne sans connexion.

Netlify, Cloudflare Pages ou tout hébergement statique HTTPS conviennent aussi.

### Mettre à jour l'application sans perdre les données
Les données sont dans IndexedDB, séparées du code : une mise à jour n'y touche jamais.
1. Modifier le code, puis **incrémenter `VERSION` dans `sw.js`** (ex. `eps-eval-v1.0.1`).
2. Republier. À la prochaine ouverture avec réseau, un message « Une nouvelle version est disponible » propose *Mettre à jour* (jamais de rechargement imposé en pleine séance).
3. Si vous ajoutez un fichier, l'ajouter aussi à la liste `ASSETS` de `sw.js`.

## 2. Google Drive (sauvegarde et synchronisation)

Les données vont dans un **dossier caché de l'application** de votre Drive (`drive.appdata`) : invisible dans « Mon Drive », limité à cette application. Il faut créer un identifiant gratuit une seule fois :

1. <https://console.cloud.google.com> › créer un projet (ex. « Eval EPS »).
2. *API et services › Bibliothèque* › activer **Google Drive API**.
3. *Écran de consentement OAuth* › type **Externe**, renseigner le nom de l'application et votre e-mail. Laisser en mode **Test** et ajouter **votre adresse Google** comme utilisateur test.
4. *Identifiants › Créer des identifiants › ID client OAuth* › type **Application Web**. Dans **Origines JavaScript autorisées**, mettre l'adresse de l'application **sans chemin** (ex. `https://votre-compte.github.io`). Pour des essais : `http://localhost:8765`.
5. Copier l'**ID client** (`xxxx.apps.googleusercontent.com`) dans *Réglages › Données et synchronisation*, puis **Se connecter à Google Drive**.

Sur chaque nouvel appareil : mêmes réglages (adresse + ID client), puis connexion ; les données sont restaurées depuis Drive.

**Comportement :**
- Les modifications sont toujours enregistrées en local d'abord ; la synchro part automatiquement (4 s après une modification, au retour du réseau, et toutes les 5 min).
- État affiché en permanence : *Synchronisé · Modifications en attente · Synchronisation en cours · Erreur · Hors connexion*.
- **Aucune donnée plus récente n'est jamais écrasée en silence.** Si le même élément a changé sur deux appareils, un dialogue propose : garder cette tablette, garder Drive, ou (évaluations) **fusionner cellule par cellule** en gardant la saisie la plus récente.
- Mode « Test » de Google : la connexion doit être renouvelée de temps en temps (message explicite dans l'application) ; l'application continue de fonctionner normalement entre-temps.

## 3. Décisions de conception retenues

Le cahier des charges demandait de ne pas trancher en silence. Voici ce qui a été retenu faute de réponse sur les points ouverts ; chacun se change facilement.

| # | Sujet | Décision |
|---|---|---|
| 1 | **Coefficients** | Le barème *est* la pondération (somme = 20). Le champ « coef. » est conservé comme aide : le bouton *Répartir selon les coefficients* redistribue les 20 points (multiples du pas, somme exacte). |
| 2 | **Niveau → note** | Plages par défaut en % du barème : Non acquis 0–40 %, En cours 40–70 %, Acquis 70–90 %, Dépassé = barème. Note proposée au milieu de la plage. Modifiable par compétence. Une note saisie à la main recalcule le niveau. |
| 3 | **Pas des notes** | Demi-point par défaut ; 0,25 ou 1 dans *Réglages › Notation* (s'applique aux nouvelles évaluations). |
| 4 | **Cellules** | Couleur = niveau (avec symbole ✕ ≈ ✓ ★). Vide / grisé (non validé) / noir (validé). |
| 5 | **Note provisoire** | Pas d'extrapolation par défaut : « 9/15 · 1 restante », note sur 20 seulement quand tout est renseigné. Estimation « prov. » activable dans les réglages. Les notes non validées comptent dans les totaux (la note s'affiche grisée tant que tout n'est pas validé). |
| 6 | **Moyennes** | En points, avec l'effectif : « 3,4/5 · n = 24 ». Seuls les élèves *présents* ayant des données comptent. |
| 7 | **Statuts** | Un statut par élève et par évaluation (Présent / Absent / Dispensé / Non évalué). Les résultats saisis sont conservés si on repasse en « Présent ». |
| 8 | **Équipes / niveaux** | Deux types de groupes intraclasse propres à l'évaluation ; un élève peut avoir une équipe *et* un niveau. |
| 9 | **Prénom modifié** | L'évaluation garde le prénom figé à sa création ; l'historique individuel affiche le prénom actuel. |
| 10 | **Années scolaires** | Champ « année scolaire » sur la classe + *Passer à l'année suivante* (copie avec les **mêmes identifiants d'élèves** : l'historique suit). |
| 11 | **Annuler / rétablir** | 50 actions par évaluation ouverte (note, niveau, validation, statut, équipes, ajout/retrait d'élève, date). Vidé à la fermeture ; les données, elles, sont enregistrées en continu. Ctrl+Z / Ctrl+Y sur clavier. |
| 14 | **Emplacement Drive** | Dossier caché de l'application (`drive.appdata`). |
| 15 | **Conflits** | Par enregistrement (classe, modèle, évaluation), avec fusion fine pour les évaluations. |
| — | **Élève qui part** | Marqué « ancien élève » s'il a des résultats (sinon supprimé) ; son historique est conservé. |
| — | **Élève arrivé en cours d'année** | Ajouté à la classe → présent dans les **nouvelles** évaluations seulement. |
| — | **Duplication** | Reprend modèle, classe, équipes ; élèves resynchronisés avec la classe ; **sans résultats** (option pour les copier). |

## 4. Importer vos tableaux de compétences

*Réglages › Modèles › Importer un tableau* : fichier **.xlsx** ou **.csv** exporté de Google Sheets (*Fichier › Télécharger*). Étapes : fichier → correspondance des colonnes (proposée automatiquement) → aperçu **modifiable** avec signalement des données manquantes/invalides → vérification de la somme = 20 (avec mise à l'échelle automatique possible). Le lecteur .xlsx est intégré (aucune bibliothèque) ; l'ancien format `.xls` n'est pas lu : l'enregistrer en .xlsx ou .csv.

## 5. Tests

```bash
node --test tests/core.test.mjs tests/import.test.mjs     # 54 tests : calculs, historique, annulation, duplication, synchro, import
python3 -m http.server 8765 &                              # puis, avec Playwright installé :
node tests/e2e.mjs        # parcours complet dans Chromium, y compris rechargement HORS CONNEXION
node tests/e2e2.mjs       # import xlsx/csv, élèves arrivés/partis, conflit Drive, restauration JSON
```

## 6. Organisation du code

```
index.html · manifest.webmanifest · sw.js          PWA, cache hors connexion
css/style.css                                       thème pastel, tablette
js/main.js · app.js                                 démarrage, routeur, rendu
js/data/   schema.js  db.js  repo.js                modèle de données, IndexedDB, dépôt (autosauvegarde, export/import JSON)
js/logic/  model.js scoring.js evaluation.js history.js   règles métier (sans DOM, testées)
js/sync/   engine.js drive.js controller.js         moteur de synchro (plan, conflits, fusion) · Google · état et dialogues
js/import/ csv.js xlsx.js mapper.js                 lecture de fichiers et correspondance des colonnes
js/ui/     home evalView historyView settings modelEditor classEditor importWizard dom
tests/                                              tests Node + parcours Chromium
```
Chaque enregistrement porte `id` (UUID), `updatedAt`, `deviceId`. Une évaluation embarque une **copie figée** du modèle, de la classe et de la liste d'élèves : modifier un modèle ou une classe ne change jamais une évaluation existante.

## 7. Limites connues

- La synchronisation Google Drive est testée avec un Drive **simulé** (moteur, conflits, reprise après coupure) mais **pas contre le vrai service Google** : la première connexion réelle est à valider par vous.
- Testé dans Chromium (paysage, portrait, hors connexion) ; pas encore sur une vraie tablette Android.
- L'identifiant client OAuth et l'hébergement HTTPS sont à votre charge (voir §1 et §2).
