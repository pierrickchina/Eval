# PEPS — fiche de reprise (état : version 1.13, 28/11/2026)

À lire en premier dans une nouvelle conversation. Elle remplace l'historique.

## 1. Le projet en bref
- **PEPS** : application web hors connexion (PWA) pour l'EPS au collège Jean-Jacques Rousseau, Le Pré-Saint-Gervais. Elle sert pour l'évaluation et les outils de cours.
- **Appareil cible** : tablette Samsung en paysage (1280 × 800), au doigt. Pas d'ordinateur devant les élèves.
- **Code source** : dépôt GitHub `pierrickchina/Eval`, publié sur GitHub Pages (https://pierrickchina.github.io/Eval/).
  - L'espace de travail de Claude est temporaire. Pour reprendre, rattacher le dépôt (`add_repo`) ou se faire envoyer le zip du site.
  - Les tests sont dans le dossier `tests/`, qui doit aussi être dans le dépôt.
- **Technique** : JS vanilla (modules ES), sans framework ni build. Stockage IndexedDB, service worker `sw.js`.
- **Tests** : `node --test tests/*.test.mjs` (144 tests), et les tests e2e Playwright `node tests/e2eN.mjs`. Il faut lancer `python3 -m http.server 8765` à la racine. Playwright est déjà installé.

## 2. Façon de travailler (préférences de l'enseignant)
- **Échanges** : réponses en français, directes et concrètes.
- **Élèves** : jamais de nom complet, seulement prénom + initiale. Le vrai fichier d'évaluation Vélo contient des noms complets : ne jamais les reproduire.
- **Google Drive** :
  - lecture libre, en priorité dans ses dossiers « EPS 2025-2026 JJR » et « EPS » ;
  - jamais de modification sans demande explicite et sans validation ;
  - toujours citer les documents Drive utilisés.
- **Priorité** : l'ergonomie. Simple, instinctif, rapide en direct, esthétique. Les collègues doivent pouvoir s'en servir vite. Personnalisation par ⋮, peu de préparation.
- **Cycle de travail** :
  - Nouvelles idées : on discute, puis bilan, puis « go », puis code.
  - Petites modifications évidentes : faire directement.
  - Par défaut : test ciblé + livraison rapide. Suite complète + captures seulement en fin de lot ou sur demande.
- **Livraison** :
  - un zip des seuls fichiers modifiés, sous la limite de 100 fichiers de l'envoi web GitHub ;
  - plus le site complet si besoin ;
  - mettre à jour `VERSION` dans `sw.js` et `__APP_VERSION` (dans `js/main.js` et en secours dans `settings.js`) ;
  - ajouter tout nouveau fichier à la liste `ASSETS` de `sw.js`.
- **Personnages protégés** : jamais de dessin de personnage protégé (Mario…). Les images MK viennent de ses fiches.

## 3. Architecture (js/)
- **`app.js`** : navigation.
  - `registerView(name, fn)` déclare un écran, `go(name, params)` y va, `render()` redessine.
  - Historique unique `app.stack`. `back(fallback)` est importé partout sous le nom `navBack`.
  - Ne sont jamais empilés : les écrans de passage (classEdit, modelEdit, import, selfEval, routes avec `setup`), un simple changement d'onglet ou de fiche sœur, et le retour au parent.
  - L'écran est mémorisé dans localStorage `eps-route` et rouvert seulement si la page est **actualisée** (type de navigation « reload »).
  - `closeAllOverlays()` est appelé à chaque changement d'écran. `app.decorate` colore l'en-tête des outils d'une classe.
- **`data/repo.js`** : cache mémoire + IndexedDB, avec `save / remove / get / list / getMeta / setMeta / removeMeta`.
  - Les écritures démarrent tout de suite.
  - Les meta « partagées » sont recopiées dans `freetools` `{type:'meta'}`, donc sauvegardées et synchronisées. Les clés propres à l'appareil sont dans `LOCAL_META`.
- **`ui/dom.js`** :
  - `h()`, `btn`, `iconBtn`, `openDialog`, `popMenu`, `toast`, `confirmDialog`, `download` ;
  - les icônes SVG sont dans `ICONS`, `ICON_FILL` et `ICON_TEXT` ;
  - `tintVars(color)` renvoie les couleurs d'un outil : `--tc` (fond), `--ti` (titre), `--ts` (sous-texte).
  - Piège : `replaceChildren(null)` affiche « null ». Toujours passer par `.filter(Boolean)`.
- **`logic/activities.js`** :
  - `TOOLS` : le registre des outils (label, icon, color, family, free, freeOnly, route, hint, help) ;
  - `toolsForActivity` : outils cochés à la création d'une activité ;
  - `toolFits(type, nomActivité)`, `GENERAL_TOOLS`, `TOOL_GROUPS` (« Par activité ») et `TOOL_SECTIONS`.
- **Où vivent les données d'activité** (`cls.activities[]`) :
  - `act.tools`, `act.equipes.sets`, `act.tournois`, `act.ladders[kind]`, `act.kivaou`, `act.montee`, `act.forbidden` ;
  - `act.arbitre` (certificat de rôle) et `act.vma.results`.
- **Séance du jour** : `cls.today = {date, status{sid:'absent'|'dispense'|'inapte'}}` (`logic/today.js`). Fonctions : `practices()`, `statusToday()`, `draw()`.
- **États des outils (meta)** :
  - `mk:`, `kab:`, `bx:` et `rot:` suivis de `<actId|free>` ;
  - `toolPresets` : un préréglage par outil pour toute l'équipe ;
  - `ctCircuits`, `ctMaterial`, `pinnedTools`, `seenTools`, `settings` ;
  - en localStorage : `eps-circuit2` (chrono CT) et `eps-display` (thème, taille du texte).
- **Styles** : `css/style.css`, avec des sections ajoutées par version (« 1.12 », « 1.13 » en fin de fichier).

## 4. Outils existants (v1.13)
- **Pour toutes les activités** : Évaluation, Chronomètre, Équipes, Tournoi, Interclasses, Rotation d'ateliers, Certificat de rôle.
  - Interclasses est un outil libre seulement, classes A–E.
  - Le Certificat de rôle remplace la Certification d'arbitre. Ses rôles (arbitre, juge-spectateur, coach) et niveaux viennent des grilles du Projet EPS. Il a une auto-évaluation et une validation par l'enseignant, sans avis des pairs. Le badge bronze / argent / or s'affiche à côté du prénom.
- **Par activité** :

| Activités | Outils |
|---|---|
| Jeux athlétiques et Duathlon | Mario Kart (V1 / V2 / V3), Test VMA (Léger navette 20 m), Fiches Duathlon (images seulement) |
| Circuit training (et Boxe) | Circuit training : exercices, circuits, chrono avec préréglages 5 min WO, 8 min WO, 30/30 et Défi de classe (relais 5 × 30 s, 4 exercices × 2 blocs, 2 min 30 entre les blocs) |
| Boxe et lutte | Rotation boxe (ateliers fixes, onglet Fiche), Rings, Kabaddi (équipes reprises de l'outil Équipes) |
| Tennis de table | Tables, Montée de niveau |
| Course d'orientation | Kivaou |

- **Page d'une classe** : Carnet de bord (seule l'activité récente est dépliée), Séance du jour, Oublis, Notes, Résultats (tableaux triables). ⋮ › Exporter les notes (CSV).

## 5. Suite prévue
- **Prévu dans la 2.0** :
  - sons et vibrations identiques dans tous les outils (top, fin, erreur) ;
  - thème sombre « gymnase », plus contrasté.
- **En attente** (à rediscuter) :
  - pack d'activité à partager entre collègues : il faut d'abord l'expliquer en détail à l'enseignant ;
  - Acrosport : fiche de figures et juge FIT / ART.
- **Plus tard** : évaluation de course d'orientation reliée aux résultats de Kivaou. Ce sera une évaluation (grille), pas un nouvel outil.
- **Refusées** (ne pas reproposer) :
  - séance du jour automatique selon l'emploi du temps ;
  - appréciations proposées à partir des niveaux ;
  - musique hors connexion (il utilise Spotify) ;
  - outil AS handball, inventaire, échauffement guidé, relevés jeux athlétiques ;
  - mode « tablette prêtée », copie entre classes, préparer une séquence en une fois, projection.
