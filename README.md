# EPS — application tablette (PWA)

> Anciennement « Évaluation EPS ». Le module **Évaluations** est le premier ; d'autres outils (oublis de matériel, tournois, tennis de table…) pourront s'y ajouter. Les identifiants techniques internes (`eps-eval`, format des sauvegardes) restent inchangés pour ne rien casser.

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

### Nouveautés de la version 1.6.2
- Écran Équipes : « non placés / dispensés / absents » forment une bande compacte au-dessus ; la zone « à répartir » d'un club tient toujours sur une seule ligne (défilement latéral), pour laisser toute la place aux équipes.

### Nouveautés de la version 1.6.1
- Évaluation ↔ Équipes : dans « Équipes et groupes de niveau », les équipes viennent de l'outil Équipes de l'activité (choix de la composition) et suivent ses modifications.
- Aide dans les menus ⋮ ; « Générer » dans le ⋮ de l'écran Équipes ; rôles en pastilles colorées (capitaine rouge, officiel jaune, matériel bleu, préparateur vert, manager orange).
- Réglages : onglets Modèles | Classes | Général (trimestres, notation, auto-évaluation, affichage, application) | Sauvegarde (sauvegarde, Drive).
- Accueil : pastille « Sauvegarder » discrète avant Réglages, cartes de classe plus grandes avec raccourci vers la dernière tâche, « Reprendre » à droite du filtre, tri supprimé.
- Liste des compositions : « Leçon 1 – Clubs », date et détail, maillots colorés. Icônes raquette et chrono simplifiées.

### Nouveautés de la version 1.6 (fondations, Chronomètre, Équipes)
- **Chronomètre** : 1 à 4 panneaux (chronomètre ou minuteur), très grand affichage, mode affichage sans boutons (appui long 1 s pour en sortir), écran maintenu allumé, rien n'est enregistré.
- **Équipes** : compositions par leçon (dupliquer, garder l'historique), glisser-déposer au doigt ou au stylet, tirage au hasard / équipes équilibrées / groupes de niveau / duos de tutorat, contraintes ensemble-séparés, rôles, élèves dispensés ou absents, couleurs de chasubles, **mode Clubs** (clubs durables divisés en 2 équipes), plein écran coloré, PDF. Outil libre (classes ou prénoms saisis) ou dans le carnet de bord d'une activité ; « Reprendre les équipes » depuis le menu ⋮ d'une évaluation.
- **Fondations** : « Reprendre : … » sur l'accueil, outils libres épinglables (☆), icônes pastel par outil, « ? » d'aide en 3 lignes, visite guidée (installation vide uniquement), écrans vides qui expliquent quoi faire, bouton « Annuler » après les actions importantes, classe de démonstration, partage d'un modèle d'évaluation par petit fichier (sans données d'élèves), taille du texte et contraste renforcé (Réglages › Données).
- Prévu en 1.7 : tournois (libre et en activité), suivi des résultats, onglet « Résultats » de la classe.

### Nouveautés de la version 1.5 (restructuration)
- **Accueil** : deux onglets **Classes | Outils**. L'onglet Classes montre directement les tuiles des classes (tri par niveau 6e → 3e ou par nom, filtre par niveau). Plus de bouton « Nouvelle évaluation » ni « Classes » : classes et modèles se créent dans Réglages. L'onglet Outils accueillera les outils libres (aucun pour l'instant ; le « + » montre ceux qui sont prévus).
- **Page d'une classe** : **Carnet de bord** · **Oublis de matériel** · **Notes**, avec les actions de chaque onglet à la suite sur la même ligne (Nouvelle activité ; filtre, tri des élèves et PDF ; filtre des oublis). L'onglet est mémorisé dans la classe. L'onglet « Infos élèves » est supprimé (et le champ effacé des données).
- **Carnet de bord** : un cadre par **activité** (« Handball · 3e B ») contenant des tuiles d'outils. La tuile **Évaluation** : aucune évaluation → elle propose d'en créer une ; une seule → elle l'ouvre directement ; plusieurs → la liste se déplie pour choisir (renommer, dupliquer, supprimer). Le « + » du cadre ajoute un outil (dont une nouvelle évaluation) ; le ⋮ permet de renommer l'activité, gérer les outils ou la supprimer. Le cadre d'une activité a une **couleur pastel** au choix (menu ⋮ › Nom et couleur) ; **chaque outil a sa propre couleur fixe** (Évaluation = rouge pastel, suivi de tournoi = bleu, suivi des tables = vert…) pour les repérer d'un coup d'œil. Chaque évaluation peut recevoir un nom (aussi dans le menu ⋮ de l'évaluation, qui permet aussi de la supprimer). Les outils peu utilisés depuis plus de 60 jours passent derrière un « + n de plus » (6 tuiles visibles au maximum).
- **Évaluations existantes** : rangées automatiquement, au premier lancement, dans l'activité du même nom de leur classe. Rien n'est perdu.
- **Suppression** : retirer un outil ou supprimer une activité supprime ses données, après une fenêtre « Attention, vous allez supprimer des données » qui liste précisément les évaluations (dates, résultats, observations, remarques, auto-évaluations) concernées.
- Structure prête pour les prochains outils (suivi de tournoi, suivi des tables de tennis de table… signalés « bientôt »). Les activités sont stockées dans l'enregistrement de la classe (`activities`) et les évaluations portent `activityId`.

### Nouveautés de la version 1.4
- **Page d'une classe** (depuis la 1.5 : tuile de classe sur l'accueil), onglets :
  - **Notes** : une colonne par évaluation (autant d'activités que l'on veut), notes finales uniquement, moyenne par élève et de classe ; filtre par trimestre ; toucher une colonne ouvre l'évaluation, toucher un élève ouvre son résumé de l'année ; impression / PDF.
  - **Oublis de matériel** : − / + par élève, croix 1-2 jaunes, 3 orange, 4 et + rouges, comptage **à l'année** (une date par croix), filtre « 3 croix et + ».
  - *(Infos élèves : supprimé en 1.5.)*
- **Trimestres** modifiables dans Réglages › Classes (dates proposées par défaut, à vérifier avec le collège).
- Les oublis sont dans l'enregistrement de la classe : ils partent donc dans les sauvegardes (JSON/Drive). « Passer à l'année suivante » ne les recopie pas.

### Nouveautés de la version 1.3
- **Auto-évaluation** : le bouton « Valider » n'apparaît que lorsque toutes les compétences sont choisies, en grand, dans une barre verte fixe en bas, avec la **note estimée** et la note de chaque compétence (« Tu as tout choisi ! »). La confirmation rappelle la note.
- **Fiche élève** : statut (présent/absent/dispensé/non évalué) et remarque déplacés dans le menu ⋮ ; le nom de l'élève reste bien visible.
- **Nom de l'application : « EPS »** (manifeste, titre, accueil), pour accueillir d'autres outils. Les identifiants internes ne changent pas : aucune donnée perdue.

### Nouveautés de la version 1.2
- **Bouton Précédent de la tablette** : remonte d'un niveau (fiche élève → tableau → accueil ; réglages → accueil ; éditeurs → réglages ; ferme d'abord une fenêtre ouverte). À l'accueil : un 1er appui prévient, le 2e quitte.
- **En-tête d'évaluation épuré** : titre complet, annuler/rétablir, et un seul menu ⋮ (date, groupes, + élève, dupliquer, imprimer, auto-évaluation). Dans la fiche élève, Résumé/Historique/Remarque sont dans un menu ⋮.
- **Fiche élève compacte** : titre du degré en gras en haut, texte pleine largeur en plus petit, boutons brouillon réduits.
- **Auto-évaluation** : menu ⋮ › « Auto-évaluation des élèves… ». Mode élève verrouillé (aucune donnée de l'enseignant visible), chaque élève choisit un degré par compétence → note, puis valide (non modifiable ensuite, rouvrable par l'enseignant). Sortie par code (0007 par défaut, modifiable dans Réglages). Le verrou survit à un rechargement. Dans le tableau : symbole en italique grisé en haut à gauche de la case ; rappel dans la saisie rapide et la fiche. Elle n'entre jamais dans les notes. Conseil : « Épingler l'écran » sur la tablette.
- **Partage de la sauvegarde** : essai en .txt (type autorisé par Chrome), puis .json, puis téléchargement avec bouton « Ouvrir Drive ». L'import accepte .json et .txt.
- **Copie de sécurité interne** au 1er lancement d'une nouvelle version et avant « Remplacer tout » (Réglages › Données › Restaurer).

### Nouveautés de la version 1.1
- **Sauvegarde en deux touches** : bouton « Sauvegarder » (accueil) / « Partager la sauvegarde » (Réglages) → menu de partage de la tablette → Google Drive, Mes fichiers, mail. Rappel « dernière sauvegarde il y a X jours » (orange après 7 jours avec des modifications).
- **Règle des niveaux** : non acquis 0–30 % (proposé 0) · en cours 30–50 % (proposé = **exactement la moitié du barème**) · acquis 55–90 % (proposé 80 %) · dépassé 90–100 % (proposé 100 %). Appliquée aux nouveaux barèmes et, une seule fois, aux modèles existants ; les évaluations déjà créées ne changent pas.
- **Observations brouillon** : boutons discrets « + ✕ ≈ ✓ ★ » au-dessus de chaque degré ; elles ne fixent pas le degré, restent visibles (discrètes) dans le tableau, se retirent d'une touche, et sont conservées comme trace après placement. Filtre **« À placer »**.
- **Textes des critères en entier** dans la fiche élève.
- **Remarque libre par élève** (stylet ou clavier), **résumé de l'année** (copiable, imprimable), **export PDF** d'une évaluation (impression → « Enregistrer au format PDF »).

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
| 2 | **Niveau → note** | (v1.1) Non acquis 0–30 % (proposé 0), En cours 30–50 % (proposé = moitié du barème, non modifiable), Acquis 55–90 % (proposé 80 %), Dépassé 90–100 % (proposé 100 %). Arrondi au pas. Une note saisie à la main recalcule le niveau. |
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
node --test tests/*.test.mjs                               # 82 tests : calculs, historique, annulation, duplication, synchro, import, v1.1
python3 -m http.server 8765 &                              # puis, avec Playwright installé :
node tests/e2e.mjs        # parcours complet dans Chromium, y compris rechargement HORS CONNEXION
node tests/e2e2.mjs       # import xlsx/csv, élèves arrivés/partis, conflit Drive, restauration JSON
node tests/e2e4.mjs       # v1.2 : Précédent, en-tête, fiche compacte, auto-évaluation + code, partage
node tests/e2e5.mjs       # v1.4 : notes, oublis, trimestres, sauvegarde
node tests/e2e6.mjs       # v1.5 : accueil, carnet de bord, activités, avertissements de suppression
node tests/e2e3.mjs       # v1.1 : brouillons, « à placer », textes longs, remarque, partage, migration, PDF
```

## 6. Organisation du code

```
index.html · manifest.webmanifest · sw.js          PWA, cache hors connexion
css/style.css                                       thème pastel, tablette
js/main.js · app.js                                 démarrage, routeur, rendu
js/data/   schema.js  db.js  repo.js                modèle de données, IndexedDB, dépôt (autosauvegarde, export/import JSON)
js/logic/  model.js scoring.js evaluation.js history.js activities.js classes.js   règles métier (sans DOM, testées)
js/sync/   engine.js drive.js controller.js         moteur de synchro (plan, conflits, fusion) · Google · état et dialogues
js/import/ csv.js xlsx.js mapper.js                 lecture de fichiers et correspondance des colonnes
js/ui/     home carnet classesView evalView selfEval historyView summaryView printView backup settings modelEditor classEditor importWizard dom
tests/                                              tests Node + parcours Chromium
```
Chaque enregistrement porte `id` (UUID), `updatedAt`, `deviceId`. Une évaluation embarque une **copie figée** du modèle, de la classe et de la liste d'élèves : modifier un modèle ou une classe ne change jamais une évaluation existante.

## 7. Limites connues

- La synchronisation Google Drive est testée avec un Drive **simulé** (moteur, conflits, reprise après coupure) mais **pas contre le vrai service Google** : la première connexion réelle est à valider par vous.
- Testé dans Chromium (paysage, portrait, hors connexion) ; pas encore sur une vraie tablette Android.
- L'identifiant client OAuth et l'hébergement HTTPS sont à votre charge (voir §1 et §2).
