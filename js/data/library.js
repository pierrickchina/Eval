// Bibliothèque « Projet EPS » (collège Jean-Jacques Rousseau, Le Pré-Saint-Gervais) : grilles d'évaluation livrées avec PEPS.
// Source : Projet EPS « finito » (01/09/2026) et tableurs d'évaluation de l'équipe, corrigés et complétés en novembre 2026.
// Les 6e sont évalués en compétences : quand le projet ne donne pas de barème, une répartition indicative est proposée (modifiable).
// Format compact : c(nom, attendus/AFC, barème, [non acquis, en cours, acquis, dépassé], points proposés par niveau (facultatif), perf (facultatif)).

export const LIBRARY_VERSION = 1;
export const LIBRARY_TAG = 'projet-eps-jjr';

const c = (name, afc, max, texts, pts = null, perf = null) => ({ name, afc, max, texts, pts, perf });

// Note calculée à partir d'une performance (Duathlon)
const TIME_G = { na: 11 * 60, ec: 8 * 60, ac: 6 * 60 };          // garçons : > 11 min NA, 8-11 EC, 6-8 A, < 6 D
const TIME_F = { na: 12 * 60, ec: 8.5 * 60, ac: 6.5 * 60 };      // filles : > 12 min NA, 8'30-12 EC, 6'30-8'30 A, < 6'30 D
const ZONE_G = [0, 0, 1, 2, 2, 3];                                // zone 0..5 → indice de niveau (0 NA … 3 D)
const ZONE_F = [0, 1, 2, 2, 3, 3];
export const PERF = { TIME_G, TIME_F, ZONE_G, ZONE_F };

const ROLE_ARB_TT = ['Les règles du jeu sont partiellement connues. L\'arbitre a quelques difficultés à identifier les vainqueurs des points, se réfère aux joueurs, ou les laisse s\'auto-arbitrer.', 'L\'élève reconnaît et annonce les fautes principales. Il sait également identifier les vainqueurs des points. En cas de litige, il change parfois d\'avis ou fait appel à l\'enseignant.', 'L\'élève dirige pleinement le match et sait justifier ses choix en cas de litige. Il annonce le score à voix haute en permanence.', 'L\'élève assure la gestion optimale des matchs en utilisant la gestuelle et le vocabulaire spécifique.'];
const FAIR_TT = ['L\'élève a un comportement déplacé vis-à-vis de son adversaire et conteste très souvent les décisions de l\'arbitre.', 'L\'élève montre des signes d\'agacement, de frustration ou manifeste sa supériorité. Les décisions de l\'arbitre sont globalement acceptées.', 'L\'élève reste respectueux de son adversaire et de son coéquipier durant la rencontre mais a parfois des difficultés à canaliser ses émotions à l\'issue du match. Les décisions de l\'arbitre sont respectées.', 'L\'élève est humble et accepte le résultat de la rencontre quel qu\'il soit. Il encourage et conseille son coéquipier quel que soit le résultat de la rencontre. Les décisions de l\'arbitre ne sont jamais contestées.'];
const COMPLET_TT = ['L\'élève montre des techniques restreintes, maîtrisant peu de coups, ce qui ne lui permet pas de mettre en place une réelle tactique. Joue sur la continuité.', 'L\'élève maîtrise un ou deux coups spécifiques, et base sa tactique autour de ceux-ci. La technique ne varie pas, mais peut être efficace dans certaines rencontres.', 'L\'élève maîtrise un panel de techniques variées, est capable de les utiliser en match et d\'utiliser des tactiques différentes (placé / accéléré / effet), mais ne s\'adapte pas en match au jeu de son adversaire.', 'L\'élève maîtrise un panel de techniques variées, utilise des tactiques différentes (placé / accéléré / effet) et les adapte en match en fonction du jeu de son adversaire.'];
const ARB_TT6 = ['Élève qui n\'assume pas son rôle d\'arbitre, ne reste pas auprès de ses sportif·ves, ne tient pas à jour la fiche de tournoi.', 'Les règles sont partiellement maîtrisées. L\'arbitre est influençable. L\'élève peut gêner le match en posant la fiche tournoi sur la table.', 'Les règles sont maîtrisées. L\'élève peine à trancher lorsqu\'une décision de jeu est à prendre.', 'La fiche de tournoi est rendue lisible et juste. Les points sont comptés à voix haute. Les règles sont maîtrisées. Chaque décision est prise avec assurance, et expliquée si besoin aux joueurs.'];
const IMPL_TT = ['L\'élève n\'est investi que partiellement, de façon irrégulière. Cherche à éviter la pratique de l\'activité. S\'énerve ou boude en cas de défaite, chambre en cas de victoire.', 'L\'élève n\'est investi que partiellement, de façon irrégulière. Cherche à éviter de se mettre en question sur sa pratique, ne propose que des matchs. Perd en râlant ou chambre en cas de victoire.', 'L\'élève s\'implique dans la majorité des séances avec un bon investissement. Maîtrise ses émotions dans la victoire et la défaite.', 'Investi à toutes les séances. Capable de s\'adapter à chacune des situations retenues. Maîtrise ses émotions, bienveillant avec ses camarades.'];
const FAIRPLAY_COLL = ['J\'insulte et crie sur mes coéquipiers, mes adversaires, l\'arbitre. Je nargue quand je gagne ; quand je perds, je pleure, crie et je suis agressif. Je ne serre pas la main en fin de confrontation.', 'Je râle pour mon équipe mais je joue correctement, je fais des réflexions négatives. Je remets en cause l\'arbitre sans l\'insulter. Je nargue parfois mes adversaires. Je serre la main à une partie des adversaires.', 'Je ne râle pas, je ne fais pas de réflexion négative. Je ne dis rien sur l\'arbitre ni à l\'adversaire quand je gagne ou que je perds. Je serre la main de tout le monde et tout le temps.', 'Idem A. J\'ai des réflexions positives, encourageantes et motivantes pour mes coéquipiers.'];
const BASKET_TECH = ['Beaucoup de fautes et de violations. Je dribble trop haut, je frappe le ballon. Mes passes sont imprécises et irrattrapables. Mon shoot est rectiligne et à deux mains, je n\'ai pas la motricité du double pas.', 'Des fautes et violations encore régulières. Je dribble avec du rythme sans protéger mon ballon. Plus de passes directes, encore des pertes de balle. J\'ai la motricité du double pas, mais peu de réussite, mon shoot reste rectiligne.', 'Quelques fautes et violations ponctuelles. Je dribble avec du rythme, loin de mon défenseur. Passes efficaces, directes ou à rebond. Je réussis très souvent mon double pas et mes shoots sont en cloche.', 'De rares fautes et violations. Dribbles variés et quelques skills. Très peu de pertes de balle sur des passes variées. Double pas très efficace, shoot en cloche et une réussite correcte.'];
const BASKET_TACT = ['Je joue à l\'envers : mauvais choix (dribbles, passes, shoot). Je ne sais pas ce qu\'est une situation favorable de marque. Je joue en grappe proche du ballon.', 'Choix hésitants et quelques erreurs. Je prends très peu ou beaucoup trop de shoots. J\'ai du mal à identifier la situation favorable de marque. Je reste attiré par le ballon.', 'La plupart du temps, je fais le bon choix entre passer, dribbler, shooter. J\'utilise la situation favorable de marque à bon escient. Je m\'écarte quand il le faut, j\'utilise la profondeur.', 'Idem A. Je suis capable de faire des différences (dribble, passe de déséquilibre). Je suis moteur dans les attaques placées et je me déplace dans les espaces libres.'];
const DUA_OBS = ['Élève désinvesti, ne regarde pas le coureur, ne remplit pas la fiche, ne va pas chercher les vortex.', 'Élève qui remplit la fiche avec l\'aide du coureur. En retard pour aller chercher les vortex.', 'L\'élève remplit la fiche d\'observation, récupère le vortex après le lancer.', 'L\'élève remplit la fiche d\'observation, récupère le vortex après le lancer. Donne un temps de passage au coureur, et annonce à voix haute la zone de lancer.'];
const DANSE_SPEC = (critique) => critique
  ? ['L\'élève parle et fait du bruit en tant que spectateur, il ne regarde pas la chorégraphie de ses camarades. Il ne peut faire aucun retour.', 'Il ne discute pas, il respecte le travail des autres mais il ne peut pas exprimer d\'avis sur ce qu\'il vient de voir, même s\'il est outillé pour.', 'Il est concentré sur ce qu\'il doit regarder, il arrive à faire des retours constructifs et bienveillants en se basant sur les outils donnés et ses ressentis.', 'Les outils mis à disposition sont dépassés et les retours, bienveillants et pertinents, sont personnels.']
  : ['Je parle et fais du bruit quand je suis spectateur, je ne regarde pas la chorégraphie de mes camarades. Je ne peux faire aucun retour.', 'Je ne discute pas, je respecte le travail des autres. Je ne peux pas exprimer d\'avis sur ce que je viens de voir, même si je suis outillé pour.', 'Je suis concentré sur ce que je dois regarder, j\'arrive à faire des retours constructifs en me basant sur les outils donnés.', 'Idem + je donne un retour bienveillant et pertinent en me basant sur mes impressions, mon expérience et en allant plus loin que les limites des outils à ma disposition.'];

/** Grilles : [activité, niveau, compétences]. */
const GRIDS = [
  ['Mario Kart', '5e', [
    c('L\'observateur attentif et bienveillant', 'Savoir tenir un rôle pour favoriser la performance de mes camarades. AFC 4 : Assumer les rôles de chronométreur et d\'observateur.', 4,
      ['Je ne suis pas au bon endroit, je discute avec mes amis. J\'insulte, crie ou déconcentre les athlètes. Je n\'investis pas le rôle attribué.', 'Je suis au bon endroit, mais je n\'ai pas totalement compris mon rôle. J\'investis le rôle, mais je ne me mets pas au service des athlètes.', 'J\'ai compris tous les rôles, je suis attentif et pertinent sur le rôle attribué. Je suis neutre et au service des athlètes. Je fluidifie l\'organisation de la course et du cours.', 'Idem A. J\'encourage les athlètes sans rancune, pour les aider et les motiver.']),
    c('L\'athlète discipliné', 'Savoir respecter les règles dans un jeu, une course. D3 : Comprendre, respecter et faire respecter règles et règlements.', 4,
      ['Je ne suis pas le parcours, je coupe. Je n\'écoute pas mon équipe, je reste au stand quand je veux. Je ne suis pas les règles établies.', 'Je cours autour du terrain sans couper. Je cours seul sans attendre mon groupe ou sans faire d\'effort. Je ne sais pas comment utiliser un bonus.', 'Je suis le parcours. Je cours avec mon groupe. Je vais au bon endroit pour utiliser mon bonus.', 'Idem A. J\'encourage, motive et soutiens mes camarades.']),
    c('Le groupe performant', 'Faire la meilleure performance possible. AFC 1 : Réaliser des efforts pour aller plus vite, plus longtemps.', 4,
      ['Moins de 6 tours.', '6 ou 7 tours.', '8 ou 9 tours.', 'Plus de 9 tours.']),
    c('Le groupe organisé et solidaire', 'Savoir communiquer et s\'organiser avec et pour ses camarades. AFC 3 : Mesurer, enregistrer, comparer, classer les performances.', 4,
      ['Les élèves du groupe se crient dessus, ne s\'écoutent pas. Aucun consensus. Chacun en fait qu\'à sa tête. Le groupe enfonce les athlètes en difficulté.', 'Les élèves s\'écoutent mais sont négatifs, la performance prend le dessus sur la solidarité. Pas de stratégie. Les règles sont parfois enfreintes.', 'Les élèves s\'écoutent et parlent calmement. Les règles du jeu sont toujours respectées. Le groupe soutient et aide toutes les personnes du groupe.', 'Idem. Les rôles sont répartis selon les forces et faiblesses de chacun·e (repos, courses, bonus…) : stratégie d\'équipe.']),
    c('L\'élève investi et persévérant', 'Utiliser pleinement ses capacités en fournissant un effort soutenu. AFC 1.', 4,
      ['Je ne fais rien, aucun effort, je marche et ne suis pas fatigué.', 'J\'alterne entre la marche et la course, je ne suis pas persévérant, je m\'arrête quand je me crois fatigué.', 'Je cours tout le long, je fournis des efforts soutenus, je sais que transpirer, respirer fort et avoir la gorge qui brûle est normal.', 'Idem. Je connais mon corps et je gère mon allure pour accélérer et ralentir aux bons moments.']),
  ]],
  ['Duathlon', '4e', [
    c('Athlète compétent (course)', 'Réaliser une performance optimale en course lors d\'une épreuve de duathlon (4 tours, lancer, 2 tours, lancer, 1 tour).', 8,
      ['Garçons : plus de 11 min. Filles : plus de 12 min.', 'Garçons : entre 8 et 11 min. Filles : entre 8\'30 et 12 min.', 'Garçons : entre 6 et 8 min. Filles : entre 6\'30 et 8\'30.', 'Garçons : moins de 6 min. Filles : moins de 6\'30.'], null, { type: 'time' }),
    c('Athlète compétent (lancer)', 'Réaliser une performance optimale en lancer lors d\'une épreuve de duathlon.', 4,
      ['G : zone 0-1. F : zone 0.', 'G : zone 2. F : zone 1.', 'G : zone 3-4. F : zone 2-3.', 'G : zone 5. F : zone 4-5.'], null, { type: 'zone' }),
    c('Élève investi', 'S\'investir dans un effort physique, se dépasser.', 4,
      ['Aucun investissement physique, l\'élève se préserve en marchant.', 'Faible investissement physique, alternance entre course et marche, dominance de marche.', 'Investissement physique satisfaisant : court la plupart du temps, accélère dans le dernier tour.', 'Course continue, l\'élève gère son effort, accélère dans le dernier tour ; arrive sans pouvoir réaliser un tour de plus.']),
    c('Élève observateur', 'Participer à l\'observation et au bon déroulement d\'une épreuve pour un élève donné.', 4, DUA_OBS, [0.5, 1.5, 3, 4]),
  ]],
  ['Duathlon', '3e', [
    c('Athlète compétent', 'Réaliser une performance optimale en course et en lancer lors d\'une épreuve de duathlon.', 8,
      ['G : plus de 11 min. F : plus de 12 min. Zone 1.', 'G : entre 8 et 11 min. F : entre 8\'30 et 12 min. Zone 2.', 'G : entre 6 et 8 min. F : entre 6\'30 et 8\'30. Zone 3-4.', 'G : moins de 6 min. F : moins de 6\'30. Zone 5.'], null, { type: 'timezone' }),
    c('Athlète lucide', 'Mettre en place et respecter un projet de performance pertinent.', 4,
      ['Plus d\'une minute d\'écart au projet et/ou zones de lancer prévues non respectées (plus d\'une zone d\'écart).', 'Entre 30 s et 1 min d\'écart au projet, une des deux zones de lancer respectée.', 'Entre 10 s et 30 s d\'écart au projet, les deux zones de lancer sont respectées.', 'Moins de 10 s d\'écart au projet, les deux zones de lancer sont respectées.'], null, { type: 'gap' }),
    c('Élève observateur', 'Participer à la mise en œuvre et au bon déroulement d\'une épreuve pour un élève donné.', 4, DUA_OBS),
    c('Élève réfléchi', 'Conseiller et assister de manière pertinente un élève avant, pendant et après sa course.', 4,
      ['Élève désinvesti, aucune interaction avec le coureur concernant son épreuve.', 'Quelques interactions sur le nombre de tours à effectuer et la zone du lancer.', 'Des interactions à chaque tour : le coach donne le temps de passage, la zone de lancer, et encourage.', 'Idem A. Connaît son coureur, est capable de lui prodiguer des conseils sur l\'allure à tenir.']),
  ]],
  ['Circuit training', '3e', [
    c('Élève sportif et lucide', 'Être capable de s\'entraîner en autonomie et en sécurité. AFC 1 : Gérer son effort, faire des choix pour réaliser la meilleure performance.', 5,
      ['L\'élève ne va pas au bout des exercices. Le mouvement pourrait être précisé pour répondre aux problématiques sécuritaires.', 'L\'élève peine à alterner repos et pratique, raccourcit les temps de pratique. Le mouvement respecte la sécurité mais pas tous les critères de la fiche.', 'L\'élève respecte le rythme de l\'entraînement. Le mouvement respecte la fiche outils travaillée au niveau 1.', 'L\'élève optimise sa pratique suivant l\'entraînement proposé. Le mouvement respecte la fiche outils au niveau 2 (ou 1 s\'il n\'a pas de niveau 2).'], [0, 2, 3, 5]),
    c('Élève érudit', 'Conception et réalisation d\'un programme cohérent et adapté. AFC 2 : S\'engager dans un programme de préparation. AFC 3 : Planifier et réaliser une épreuve.', 5,
      ['Sportif : séance générique, sans axe de travail, qui ne respecte pas les règles de conception. Coach : exercices non liés à l\'axe retenu.', 'Sportif : la séance ne cible pas, ou mal, un projet. Coach : exercices pas tous liés à l\'axe retenu.', 'Sportif : la séance cible un projet et un axe de travail. Coach : exercices liés à l\'axe retenu.', 'Idem A, et l\'élève justifie ses choix. Coach : exercices issus de l\'expérience personnelle possibles.'], [0, 2, 4, 5]),
    c('Coach', 'Responsabilisation et observation pour ses pairs. AFC 5 : Aider ses camarades et assumer différents rôles sociaux.', 5,
      ['Élève qui regarde son sportif sans savoir quoi lui dire ou corriger. Coach peu concentré, voire qui le dérange.', 'Élève capable d\'encourager son camarade sans le corriger, ou partiellement attentif.', 'Élève capable de corriger son sportif selon les fiches fournies, pleinement concentré sur son sportif.', 'Élève capable de corriger pertinemment son sportif, l\'encourage à aller au bout de son effort : une réelle ressource.'], [0, 2, 4, 5]),
    c('Élève organisé et impliqué', 'Connaissances théoriques et pratiques sur le corps et l\'entraînement. AFC 4 : S\'échauffer avant un effort.', 5,
      ['Investi partiellement, de façon irrégulière. Carnet insuffisamment rempli ou mal tenu. Échauffement réalisé sans être pris au sérieux.', 'Investi partiellement. Carnet tenu avec des ressentis peu détaillés. Échauffement à préciser (temps, diversité, intensité).', 'Bon investissement dans la majorité des séances. Carnet tenu à chaque séance. Échauffement pertinent.', 'Investi à toutes les séances. Carnet étayé et tenu au propre. Échauffement pertinent et diversifié.'], [0, 2.5, 4, 5]),
  ]],
  ['Acrosport', '5e', [
    c('Gymnaste / Acrobate', 'Interpréter une séquence artistique et acrobatique équilibrée entre maîtrise et performance ; adapter sa motricité au travail de représentation en groupe.', 8,
      ['Niveau de difficulté surestimé. Niveau de maîtrise faible (chutes, déséquilibres). Temps d\'arrêt individuels ou collectifs.', 'Difficulté moyenne, le groupe ne cherche pas à se dépasser. Maîtrise moyenne : déséquilibres, hésitations. Enchaînement peu fluide.', 'Difficulté cohérente avec le potentiel de chacun. Bonne maîtrise des figures, rares manquements au FIT. Enchaînement fluide.', 'Difficulté élevée, effet « waouh ». Très bonne maîtrise, FIT / ART respectés du début à la fin. Enchaînement fluide et dynamique.']),
    c('Chorégraphe', 'Participer activement au sein d\'un groupe à l\'élaboration d\'un projet artistique. Travailler en groupe de façon sereine.', 4,
      ['Non-respect des contraintes de création. Travail de groupe compliqué, conflits.', 'Respect d\'environ la moitié des règles de création. Le groupe travaille sous l\'impulsion d\'un élève.', 'Respect des règles de création. Le groupe travaille ensemble, certains élèves en retrait.', 'Respect des règles de création. Tous les élèves sont force de proposition et à l\'écoute.']),
    c('Gymnaste en groupe', 'Prendre des risques raisonnés en maintenant son intégrité physique et celle de ses camarades.', 4,
      ['Non-respect des règles de sécurité. Aucune connaissance des zones à saisir, aucune parade.', 'Connaissance des principales règles de sécurité, quelques manquements. Parade hésitante.', 'Connaissance des principales règles de sécurité. Pare les élèves de son groupe.', 'Se porte volontaire pour aider les autres groupes. Corrige les postures, veille à la sécurité des autres.']),
    c('Spectateur', 'Savoir apprécier, observer et respecter une prestation artistique.', 4,
      ['Discussion, inattention pendant toute la représentation. Jugement par affinité.', 'Des moments de déconcentration. Applaudit à la fin. Donne un avis superficiel.', 'Concentré du début à la fin. Donne son avis en se basant sur le FIT / ART.', 'Concentré du début à la fin. Donne son avis sur le FIT / ART et suggère des pistes d\'amélioration avec bienveillance.']),
  ]],
  ['Danse', '5e', [
    c('Danseur en projet', 'Avoir une attitude et une motricité de danseur. AFC 1 : Mobiliser les capacités expressives du corps pour imaginer, composer et interpréter une séquence artistique.', 6,
      ['L\'élève n\'est pas en attitude de danseur / état de danse lors de la prestation.', 'Mouvements partiels, incomplets. La mémoire est un élément limitant. Concentré, mais des gestes parasites et/ou des erreurs visibles le déstabilisent.', 'L\'élève propose des mouvements fluides et artistiques. Concentré, il ne se laisse pas déstabiliser par des erreurs (ou elles sont invisibles).', 'L\'élève va au bout de ses mouvements, dans un souci d\'esthétique. Indépendant et concentré. Le regard est réfléchi et investi.'], [0, 2.5, 5, 6]),
    c('Danseur membre d\'un groupe', 'Travailler en groupe de façon sereine. AFC 2 : Participer activement au sein d\'un groupe à l\'élaboration et à la formalisation d\'un projet artistique.', 5,
      ['Le groupe n\'est pas au point lors de l\'évaluation (discussions, incompréhensions, longueurs). L\'élève est un élément limitant pour son groupe.', 'Le groupe se met au travail dans des conditions strictes et contrôlées. L\'élève s\'adapte aux décisions de son groupe et assure son rôle sur scène.', 'Le groupe est autonome et s\'adapte aux consignes de l\'enseignant. L\'élève est un membre actif du groupe.', 'Le groupe est autonome, s\'imprègne des consignes, répète dès que possible. L\'élève propose des idées adaptées au cadre et à son groupe.'], [0, 2, 4, 5]),
    c('Spectateur respectueux', 'Savoir apprécier et respecter une prestation dansée. AFC 3 : Apprécier des prestations en utilisant différents supports d\'observation et d\'analyse.', 4, DANSE_SPEC(false), [0, 1, 3, 4]),
    c('Chorégraphe en continuité', 'S\'inspirer du travail de classe et se l\'approprier pour créer. AFC 2 et AFC 1.', 5,
      ['La chorégraphie ne respecte pas la consigne de temps. C\'est une liste de mouvements juxtaposés, sans rapport avec le thème ni apports personnels.', 'La chorégraphie peine à être liée au thème imposé. Elle présente partiellement les axes de travail retenus (unisson, cascade, contrepoint… ; espace, temps, relation, énergie).', 'La chorégraphie est visiblement liée au thème imposé et a évolué de séance en séance selon les axes de travail retenus.', 'La chorégraphie est ancrée dans le thème imposé et prend un parti engagé. Elle résulte d\'un travail inspiré par la classe, le thème et l\'expérience personnelle.'], [0, 2, 4, 5]),
  ]],
  ['Danse', '4e', [
    c('Danseur créatif', 'Avoir une attitude et une motricité incarnée au regard du thème. AFC 1.', 6,
      ['L\'élève n\'est pas en attitude de danseur / état de danse lors de la prestation.', 'Mouvements partiels, incomplets et/ou qui ne reflètent pas le thème choisi. La mémoire est limitante. Gestes parasites ou erreurs visibles.', 'Mouvements fluides, artistiques et originaux pour répondre au thème choisi. Concentré, il ne se laisse pas déstabiliser.', 'L\'élève va au bout de ses mouvements, propose une esthétique incarnant le thème. Indépendant, regard réfléchi et investi.'], [0, 2.5, 5, 6]),
    c('Danseur membre d\'une troupe', 'S\'organiser en groupe en profitant des qualités individuelles. AFC 2.', 5,
      ['Le groupe n\'est pas au point lors de l\'évaluation. L\'élève est un élément limitant pour son groupe.', 'Le groupe se met au travail dans des conditions strictes et contrôlées. L\'élève s\'adapte aux décisions de son groupe.', 'Le groupe est autonome et répète en autonomie pour stabiliser. L\'élève propose des idées adaptées au cadre et à son groupe.', 'Le groupe est autonome, s\'imprègne des consignes comme vectrices de travail, répète dès que possible pour stabiliser la représentation.'], [0, 2, 4, 5]),
    c('Spectateur critique', 'Savoir analyser et argumenter une prestation dansée, en toute bienveillance. AFC 3.', 4, DANSE_SPEC(true), [0, 1, 3, 4]),
    c('Chorégraphe créatif', 'Trouver des inspirations pour incarner un thème. AFC 2 et AFC 1.', 5,
      ['La chorégraphie ne respecte pas la consigne de temps. Liste de mouvements juxtaposés sans rapport avec le thème ni apports personnels.', 'La chorégraphie peine à être liée au thème choisi et présente partiellement les axes de travail retenus.', 'La chorégraphie est visiblement liée au thème choisi et a évolué de séance en séance selon les axes retenus.', 'La chorégraphie est ancrée dans le thème, prend un parti engagé et prend appui sur différents supports / arts.'], [0, 2, 4, 5]),
  ]],
  ['Gymnastique', '6e', [
    c('Gymnaste lucide : tourner en avant', 'Savoir tourner en avant.', 4, ['Aucune rotation, l\'élève ne s\'engage pas.', 'Roulade avant avec plan incliné ; tourner en avant sur la petite barre.', 'Roulade avant maîtrisée. Rotation avant sur grande barre.', 'Roulade avant sautée, dans un enchaînement. Rotation avant sur grande barre dans un enchaînement.']),
    c('Gymnaste lucide : tourner en arrière', 'Savoir tourner en arrière.', 4, ['Aucune rotation, l\'élève ne s\'engage pas.', 'Roulade arrière avec plan incliné.', 'Roulade arrière maîtrisée. Rotation arrière sur barres asymétriques.', 'Roulade arrière élevée, dans un enchaînement. Rotation arrière aux barres asymétriques dans un enchaînement.']),
    c('Gymnaste lucide : appui tendu renversé', 'Utiliser l\'appui tendu renversé.', 4, ['Aucun renversement.', 'L\'élève se renverse avec une ou plusieurs étapes intermédiaires (mur, élève qui monte les jambes).', 'L\'élève se renverse contre un support (mur ou pareur).', 'L\'élève tient en ATR sans support.']),
    c('Gymnaste qui répète', 'Répéter pour maîtriser un élément gymnique.', 4, ['Aucune répétition, l\'élève fait autre chose.', 'Quelques répétitions, puis l\'élève se disperse ou se décourage.', 'L\'élève répète de manière continue au cours des séances. Quelques interruptions.', 'L\'élève répète de manière continue et aide son groupe à aller vers plus de répétition.']),
    c('Élève sécuritaire', 'Assurer sa sécurité et celle de ses camarades.', 4, ['Non-respect des règles de sécurité.', 'Respect des règles de sécurité. Pare de manière peu efficace sur demande du professeur.', 'Respect des règles. Pare de manière efficace sur demande du professeur.', 'Respect des règles de sécurité + parade instinctive et sécuritaire.']),
  ]],
  ['Basket', '5e', [
    c('Le joueur tactique', 'Faire les bons choix au bon moment pour créer une situation favorable de marque. AFC 1.', 2, BASKET_TACT),
    c('Le joueur technique et réglementaire', 'Maîtriser les techniques (passes, dribble, shoot), connaître et respecter les règles. D1.', 8, BASKET_TECH),
    c('L\'arbitre spécialisé', 'Identifier, reconnaître et siffler quelques règles simples et isolées. AFC 4.', 4,
      ['Je suis assis·e, ne regarde pas le jeu, je n\'investis pas le rôle. Je m\'amuse avec le sifflet.', 'Je suis présent·e, immobile, et j\'ai du mal à identifier la règle confiée. Je ne siffle jamais, ou je siffle pour tout et rien.', 'Je suis présent·e et actif, j\'identifie bien la règle confiée. Je siffle avec assurance et je viens expliquer.', 'Idem A. Je suis l\'action, j\'identifie et je siffle 2 ou 3 règles en même temps.']),
    c('L\'élève fair-play', 'Respecter adversaires, partenaires et arbitre ; savoir gagner et perdre. AFC 5.', 4, FAIRPLAY_COLL),
    c('L\'élève autonome', 'Connaître les étapes d\'un échauffement et le réaliser seul ou en groupe. D4.', 2,
      ['Je ne m\'échauffe pas, j\'attends que l\'enseignant me reprenne. Je ne suis ni essoufflé, ni rouge.', 'Je mets du temps à commencer (quand l\'enseignant me regarde). Je ne fais pas les étapes qui me déplaisent. À peine essoufflé.', 'Je vais rapidement à l\'échauffement en autonomie. Je fais toutes les étapes. Je suis essoufflé, je transpire.', 'Idem A. Je prends un ballon à la fin pour travailler ma technique. Je suis moteur pour mes camarades.']),
  ]],
  ['Basket', '3e', [
    c('Le joueur tactique', 'Faire les bons choix ; prendre des informations sur son équipe et l\'adversaire pour s\'adapter. AFC 1.', 8, BASKET_TACT),
    c('Le joueur technique et réglementaire', 'Maîtriser les techniques (passes, dribble, shoot), connaître et respecter les règles. D1.', 2, BASKET_TECH),
    c('Co-arbitre polyvalent', 'Observer et co-arbitrer. AFC 4.', 4,
      ['Je suis assis·e, ne regarde pas le jeu, je n\'investis pas le rôle. Je m\'amuse avec le sifflet.', 'Je suis présent·e, peu mobile. Je siffle peu ou pour tout et rien. Très peu de communication avec mon coéquipier arbitre.', 'Je suis présent·e et actif, j\'identifie bien la règle confiée et siffle avec assurance. Je me mets d\'accord avec mes coéquipiers arbitres.', 'Idem A. J\'identifie et siffle 2 ou 3 règles en même temps. Je peux arbitrer un match à 2.']),
    c('L\'élève fair-play', 'Accepter le résultat de la rencontre et savoir l\'analyser avec objectivité. AFC 5.', 2, FAIRPLAY_COLL),
    c('Le club organisé et performant', 'S\'engager dans un collectif pour progresser et gagner. AFC 3.', 4,
      ['Pas d\'investissement. Directif, je n\'écoute pas. Je m\'énerve contre mon club. Je n\'investis pas le rôle de coach.', 'Investi dans le club. J\'écoute sans prendre en compte les points de vue. Réflexions parfois négatives. Exercices réalisés sans leur donner de sens.', 'Investi et actif. J\'écoute et prends en compte les points de vue. Positif. Choix cohérents d\'exercices. Retours calmes à la mi-temps.', 'Idem A. Moteur dans le club, je désamorce les conflits. Retours motivants et pertinents à la mi-temps.']),
  ]],
  ['Ultimate', '6e', [
    c('Joueur technique', 'Acquérir des techniques et une motricité propres à l\'ultimate. AFC 1 et AFC 2.', 7,
      ['Sur le terrain l\'élève ne fait rien, est passif, ne se rend pas disponible ou ne défend pas.', 'Maîtrise partielle de la passe, du démarquage, de la réception, du changement de statut, de la défense ; et/ou ne maintient pas l\'effort sur la durée du match.', 'Maîtrise ces techniques et sait les réinvestir en match.', 'Idem, avec un impact positif sur l\'équipe : passe au mieux placé, démarquage vers l\'avant, réaction rapide, défense qui intercepte.']),
    c('Joueur conciliant', 'Savoir gagner et perdre en contrôlant ses émotions. AFC 5 et AFC 3.', 7,
      ['En jeu : ne reconnaît pas ses fautes, appelle souvent l\'enseignant. Hors jeu : ne se remet pas en question, impose ses émotions.', 'En jeu : saccade le jeu en discutant des fautes. Hors jeu : peine à accepter certains résultats mais gère ses émotions.', 'En jeu : connaît les règles et les applique. Hors jeu : accepte le résultat et gère ses émotions dans le respect.', 'Idem, avec un impact positif sur la réaction de ses camarades ; tire un bilan positif de la rencontre.']),
    c('Joueur impliqué et modéré', 'Comprendre et appliquer les règles fondamentales. AFC 4 : Assurer différents rôles sociaux.', 6,
      ['L\'élève n\'est pas à son poste, se déconcentre, profite des responsabilités pour dévier de l\'activité.', 'L\'élève investit un rôle simple de manière partielle : déconcentration, favoritisme, se fait influencer.', 'L\'élève investit un rôle (observateur, juge) et répond aux consignes : impact positif sur la situation.', 'L\'élève investit et personnalise tous les rôles confiés, avec aplomb, prend des initiatives : moteur pour la situation.']),
  ]],
  ['Ultimate', '4e', [
    c('Joueur technique et tactique', 'Approfondir et réinvestir les techniques dans une réflexion tactique. AFC 1 et AFC 2.', 8,
      ['Passif, ne se rend pas disponible ou ne défend pas. Maîtrise partielle des techniques (passe, démarquage, réception, changement de statut, défense).', 'Maîtrise ces techniques mais peine à les réinvestir pertinemment en match ; et/ou peine à maintenir l\'effort.', 'Maîtrise et réinvestit en match avec des décisions rapides : passe à un élève bien placé, démarquage vers l\'avant, défense qui gêne.', 'Idem avec un impact positif sur l\'équipe ; investit des notions avancées (pied de pivot, compté…).'], [0, 4, 6, 8]),
    c('Joueur-arbitre-juge', 'Comprendre, appliquer et veiller à l\'application des règles fondamentales. AFC 4 : Observer et co-arbitrer.', 4,
      ['Ne reconnaît pas ses fautes, appelle souvent l\'enseignant. Ne maîtrise pas les règles.', 'Saccade le jeu en discutant des fautes. Peine à avoir un regard pertinent sur les actions.', 'Connaît les règles et les applique. En cas de désaccord, discute calmement et trouve un compromis.', 'Idem. Reconnaît seul sa faute et relance le jeu rapidement. Impact positif sur la gestion des fautes.'], [0, 1.5, 3, 4]),
    c('Joueur fair-play', 'Savoir gagner et perdre avec fair-play. AFC 3 et AFC 5.', 4,
      ['Ne se remet pas en question, impose ses émotions dans la victoire et la défaite. Rapport conflictuel selon les résultats.', 'Peine à accepter certains résultats mais gère ses émotions de manière personnelle ; rapport parfois conflictuel.', 'Accepte sans mal le résultat et gère ses émotions dans le respect. Compréhensif avec ses camarades.', 'Idem. Impact positif sur la gestion des émotions de ses camarades, bilan positif dans la victoire et la défaite.'], [0, 1, 3, 4]),
    c('Coach', 'Participer à l\'organisation basique d\'un club sur la séquence. AFC 3 et AFC 5.', 4,
      ['Le club a du mal à fonctionner, les consignes ne sont pas appliquées ; impact négatif sur le club.', 'Pas de conflits, mais des interactions limitées, rôles et situations peinent à être mis en place ; impact neutre.', 'Pas de conflits, les joueurs interagissent et mettent en place les situations et rôles ; impact positif.', 'Idem. Moteur dans le club, prend des initiatives, adopte avec aplomb les rôles confiés.'], [0, 1.5, 3, 4]),
  ]],
  ['Tennis de table', '6e', [
    c('Joueur technique', 'D1.4 - Acquérir des techniques spécifiques pour améliorer son efficience.', 7,
      ['L\'élève ne maîtrise pas les techniques de service, d\'accélération ou d\'orientation de la balle.', 'Un seul coup utilisé (CD ou RV). Maîtrise 1 technique, ou partiellement : renvoyer dans la direction souhaitée, varier les services.', 'Maîtrise 2 techniques : renvoyer dans la direction souhaitée, accélérer en situation favorable, varier les services.', 'Maîtrise 3 techniques parmi celles-ci et sait donner des effets à la balle.']),
    c('Arbitre compteur et concentré', 'D3 - Assumer les rôles sociaux spécifiques aux APSA et à la classe.', 7, ARB_TT6),
    c('Joueur impliqué et modéré', 'D3 - Proposer une implication physique régulière et durable pour l\'APSA étudiée.', 6, IMPL_TT),
  ]],
  ['Tennis de table', '5e', [
    c('Joueur spécialiste (technique)', 'Maîtrise technique du coup droit.', 6,
      ['Peu voire aucune maîtrise du coup droit. Coups non contrôlés en force, direction et trajectoire.', 'Coup droit maîtrisé sur des balles faciles. L\'élève joue longtemps en continuité sur des balles simples.', 'Coup droit maîtrisé sur différentes trajectoires. Fait varier force, direction et trajectoire.', 'Idem A, et l\'élève sait utiliser des effets.']),
    c('Joueur spécialiste (tactique)', 'Utilisation tactique adaptée à la forme de pratique (coup droit sur coup droit).', 6,
      ['Aucun sens associé à l\'échange, à sa rupture ou à l\'activité.', 'Attend la faute adverse en renvoyant toutes les balles. Pas de smash, peu de balles placées. Sait identifier sa stratégie de continuité.', 'Vraie stratégie liée à la forme de pratique, en faisant varier un paramètre : placement, accélération (smash) ou effets.', 'Vraie stratégie en faisant varier chacun des paramètres : placement, accélération (smash), effets.']),
    c('Arbitre polyvalent et concentré', 'D3 - Assumer les rôles sociaux spécifiques aux APSA et à la classe.', 4, ARB_TT6),
    c('Joueur impliqué et modéré', 'D3 - Proposer une implication physique régulière et durable pour l\'APSA étudiée.', 4, IMPL_TT),
  ]],
  ['Tennis de table', '4e', [
    c('Joueur complet', 'Savoir utiliser des techniques variées au service de la tactique.', 8, COMPLET_TT),
    c('Joueur-coach', 'Entraîner, aider et encourager son partenaire, en séance comme en rencontre.', 4,
      ['Coéquipier peu concerné, données parcellaires voire erronées. Concertation sans conseil adapté. Aucun temps mort utilisé.', 'Concertation davantage utilisée par le joueur que par le coach. De rares temps morts utilisés.', 'Le coach apporte des conseils génériques, pas toujours évidents à appliquer. Temps morts utilisés à bon escient.', 'Les conseils confortent ou régulent efficacement le projet de jeu du partenaire. Temps morts pertinents et efficaces.']),
    c('Arbitre organisateur et concentré', 'Connaître le règlement et savoir justifier ses choix pour arbitrer avec fermeté et diplomatie.', 4, ROLE_ARB_TT),
    c('Joueur fair-play', 'D2 - Être solidaire de ses partenaires et respectueux de son (ses) adversaire(s) et de l\'arbitre.', 4, FAIR_TT),
  ]],
  ['Tennis de table', '3e', [
    c('Joueur réflexif', 'D3 - Exploiter au mieux les caractéristiques de chacun pour élaborer un projet tactique.', 8,
      ['Peu de recul sur sa pratique, difficultés à faire émerger points forts et faibles. Stratégie basique, qui ne s\'adapte pas à l\'adversaire.', 'Fait émerger ses points forts et faibles et élabore une stratégie, mais peine à l\'adapter à son adversaire.', 'Élabore une stratégie pertinente et l\'adapte en amont du match aux points forts et faibles de l\'adversaire.', 'Idem A, et s\'adapte aussi en cours de match selon son déroulé.']),
    c('Joueur complet', 'Exploiter une situation favorable de marque pour rompre l\'échange (vitesse ou direction) et gagner le point.', 6, COMPLET_TT),
    c('Arbitre organisateur et concentré', 'Connaître le règlement et savoir justifier ses choix pour arbitrer avec fermeté et diplomatie.', 4, ROLE_ARB_TT),
    c('Joueur fair-play', 'D2 - Être solidaire de ses partenaires et respectueux de son (ses) adversaire(s) et de l\'arbitre.', 2, FAIR_TT),
  ]],
  ['Boxe française', '3e', [
    c('Technique et tactique de boxeur·euse', 'D1.4 - Acquérir des techniques spécifiques pour améliorer son efficience.', 5,
      ['Ne maîtrise pas le fouetté ni le direct, utilise des techniques non réglementaires, met du poids (« taper »). Fuit l\'affrontement.', 'Maîtrise 2 de ces techniques, ou partiellement : direct réglementaire, fouetté réglementaire, garde efficace, distance adaptée.', 'Maîtrise ces techniques : direct et fouetté réglementaires, garde efficace, distance de combat adaptée.', 'Maîtrise ces techniques et les enchaîne selon les enchaînements travaillés en amont.']),
    c('Rôle de sparring', 'D2 - Répéter un geste sportif pour le stabiliser et le rendre plus efficace.', 4,
      ['Les règles du sparring ne sont pas maîtrisées, l\'entraînement proposé n\'est pas pertinent.', 'Sparring avec déplacement, mais cibles pas toujours pertinentes ou claires ; rythme trop lent ou trop rapide.', 'Sparring adapté au boxeur, en mouvement, avec riposte si le niveau le permet.', 'Prend en compte les spécificités du boxeur : déplacements variés, bon rythme, ripostes pertinentes incluant ses enchaînements.']),
    c('Rôle d\'arbitre et de juge', 'D3 - Respecter, construire et faire respecter règles et règlements.', 4,
      ['N\'assume pas son rôle, ne reste pas auprès des tireurs ou n\'est pas concentré, ne tient pas la fiche de tournoi.', 'Règles partiellement maîtrisées. Arbitre influençable. Placement problématique (gêne ou immobile).', 'Règles maîtrisées. Arbitre bien placé et en mouvement. Le juge compte les points correctement.', 'Chaque décision est prise avec assurance. Salut demandé, signes d\'arbitrage effectués, placement pertinent et dynamique. Le juge compte à voix haute.']),
    c('Engagement', 'D3 - Proposer une implication physique régulière et durable pour l\'APSA étudiée.', 4,
      ['Investi partiellement, de façon irrégulière. Cherche à éviter la pratique. Circule dans la salle sans se soucier des autres.', 'Investi partiellement. Ne se remet pas en question, ne propose que des assauts. Règles de sécurité partiellement appliquées.', 'Bon investissement dans la majorité des séances.', 'Investi à toutes les séances, s\'adapte à chacune des situations. Échauffement fait en autonomie.']),
    c('Performance', 'D3 - Accepter la défaite et gagner avec modestie. D1.4 - Acquérir des techniques spécifiques.', 3,
      ['Séquence : derniers rings. Évaluation : défaites ou abandons. Mauvais·e joueur·euse.', 'Séquence : rings intermédiaires. Évaluation : défaites majoritaires. Difficulté à accepter le résultat.', 'Séquence : rings hauts. Évaluation : victoires majoritaires (et/ou défaites serrées).', 'Séquence : rings hauts. Évaluation : victoires.'], null, { type: 'ladder' }),
  ]],
  ['Lutte', '6e', [
    c('Lutteur technique', 'Découvrir et stabiliser des techniques spécifiques à la lutte. AFC 1.', 8,
      ['L\'élève se préserve en s\'éloignant de l\'adversaire ou agit en force dans un seul sens, sans peser ; met peu en danger son adversaire.', 'Actions offensives opportunes sans varier contrôles ou formes de corps. Marque une majorité de 1 point (sortie ou mise en danger).', 'Exploite au moins 2 contrôles et/ou formes de corps, tente d\'enchaîner avec des finales. Marque une majorité de 3 points.', 'Exploite au moins 2 contrôles et formes de corps, enchaîne avec des finales. Gagne une majorité de combats par tombé.'], [0, 3, 6, 8]),
    c('Lutteur sécuritaire', 'Appréhender le contact en assurant sa sécurité et celle des autres. AFC 2 et AFC 3.', 4,
      ['Veut ne pas faire mal mais ne s\'en donne pas les moyens : techniques non réglementaires, engagement inadapté et/ou plus d\'une faute par combat.', 'S\'implique sans faire mal mais respecte partiellement les consignes (signifier qu\'il a mal, s\'engager suffisamment) ; fautes fréquentes.', 'Respecte les consignes de sécurité : combat sans faire mal, signifie quand il a mal, s\'engage suffisamment.', 'Idem, et veille à ce qu\'elles soient respectées dans ses groupes.'], [0, 1.5, 3, 4]),
    c('Arbitre / Juge', 'Arbitrer et juger un combat, en binôme, en veillant à son bon déroulement. AFC 4.', 4,
      ['Assis en tant qu\'arbitre, observe passivement, juge selon son affect ou n\'est pas concentré.', 'Décisions peu pertinentes : arrête trop ou trop peu, influençable.', 'Arrête le combat pour la sécurité et la logistique (fin, tombé, points). Co-assure le décompte et tient la fiche de match en tant que juge.', 'Idem, maîtrise les commandements, objectif et assuré. Participe activement au bon déroulement du tournoi.'], [0, 1.5, 3, 4]),
    c('Lutteur impliqué et modéré', 'Savoir gagner et perdre en contrôlant ses émotions. AFC 3 et AFC 5.', 4,
      ['Négocie auprès de l\'arbitre, utilise sa victoire pour dévaloriser ses adversaires ou se laisse emporter en cas de défaite.', 'Discute certaines décisions de l\'arbitre. S\'implique de façon variable dans les situations de répétition.', 'Accepte le résultat des combats quels qu\'ils soient et ne discute jamais les décisions de l\'arbitre.', 'Idem, respecte et optimise les consignes et réalise les exercices avec répétition.'], [0, 1.5, 3, 4]),
  ]],
  ['Vélo', '5e', [
    c('Le cycliste responsable', 'Respecter les règles de sécurité du déplacement à vélo en groupe et participer à leur transmission. AFC 4 et AFC 3.', 10,
      ['L\'élève met sa sécurité et celle des autres au second plan, suit ses envies. Rentre dans d\'autres vélos et/ou peine à contrôler sa vitesse et ses freinages.', 'Respecte les règles de sécurité en imitant l\'enseignant ou le groupe. Ne respecte pas toujours le dispositif annoncé et/ou peine à plusieurs reprises.', 'Respecte les règles de sécurité et le code de la route, toujours le dispositif annoncé. Contrôle sa vitesse, sa position et son freinage.', 'Idem, et signale une mise en danger potentielle autour de lui. Relaie les informations clés.'], [0, 4, 8, 10]),
    c('Le rouleur assuré', 'Assurer un effort continu en s\'adaptant au profil de la sortie et du terrain. AFC 1.', 10,
      ['Peine à s\'adapter à son environnement (anticipation, observation, maîtrise de l\'engin). Ne gère pas ses vitesses, une pente est une difficulté.', 'Observation limitée à l\'espace proche. Ne gère pas ses vitesses ; est en réaction.', 'Observe son environnement et essaie de s\'y adapter. Gère son effort et sa vitesse selon la pente. Maîtrise sa trajectoire.', 'Observe et parvient à s\'adapter à son environnement. Gère vitesses et effort, trajectoire et vitesse maîtrisées.'], [0, 4, 8, 10]),
  ]],
];

/** Construit les niveaux d'une compétence : textes + points (ceux du projet s'ils sont donnés, sinon la règle de l'appli). */
function buildLevels(comp, defaultLevels, step) {
  if (!comp.pts) return defaultLevels(comp.max, step).map((l, i) => ({ ...l, text: comp.texts[i] || '' }));
  const v = comp.pts;
  const snap = (x) => Math.round(x / step) * step;
  // seuils entre deux niveaux : milieu des valeurs proposées (arrondi au pas)
  const cut = [1, 2, 3].map((i) => Math.max(v[i - 1] + step, Math.min(v[i], snap((v[i - 1] + v[i]) / 2))));
  return ['na', 'ec', 'ac', 'de'].map((key, i) => ({
    key, text: comp.texts[i] || '',
    min: i === 0 ? 0 : cut[i - 1],
    max: i === 3 ? comp.max : cut[i] - step,
    value: v[i],
  }));
}

const slug = (t) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-');

/** Modèles de la bibliothèque, au format de l'appli (un modèle par activité, un tableau par niveau). */
export function libraryModels({ uid, defaultLevels, step = 0.5 }) {
  const byAct = new Map();
  for (const [activity, level, comps] of GRIDS) {
    // identifiants fixes : deux tablettes synchronisées n'installent pas deux fois la même grille
    if (!byAct.has(activity)) byAct.set(activity, { id: `lib-${slug(activity)}`, name: 'Projet EPS', activity, levels: {}, library: LIBRARY_TAG, libraryVersion: LIBRARY_VERSION, createdAt: Date.now() });
    byAct.get(activity).levels[level] = {
      competences: comps.map((x, i) => ({ id: `lib-${slug(activity)}-${level}-${i + 1}`, name: x.name, afc: x.afc, max: x.max, coef: 1, levels: buildLevels(x, defaultLevels, step), ...(x.perf ? { perf: x.perf } : {}) })),
    };
  }
  return [...byAct.values()];
}
export const LIBRARY_SUMMARY = GRIDS.map(([a, l, comps]) => ({ activity: a, level: l, total: comps.reduce((s, x) => s + x.max, 0) }));

/** Installe la bibliothèque au premier lancement (une seule fois). Renvoie le nombre de modèles ajoutés. */
export async function installLibrary(repo, { uid, defaultLevels, step = 0.5, force = false } = {}) {
  if (!force && (repo.getMeta('libraryVersion', 0) || 0) >= LIBRARY_VERSION) return 0;
  const have = new Set(repo.list('models').filter((m) => m.library === LIBRARY_TAG && !m.deleted).map((m) => m.activity));
  let n = 0;
  for (const m of libraryModels({ uid, defaultLevels, step })) {
    if (have.has(m.activity)) continue; // déjà là (éventuellement corrigé par l'enseignant) : on n'y touche pas
    await repo.save('models', m); n++;
  }
  await repo.setMeta('libraryVersion', LIBRARY_VERSION);
  return n;
}

/** Remet un modèle de la bibliothèque dans sa version d'origine (garde son identifiant). */
export function originalOf(model, { uid, defaultLevels, step = 0.5 }) {
  const o = libraryModels({ uid, defaultLevels, step }).find((m) => m.activity === model.activity);
  return o ? { ...o, id: model.id, createdAt: model.createdAt } : null;
}
