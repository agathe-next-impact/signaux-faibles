# Proposition : réorganiser l'espace client pour la lecture rapide

30 octobre 2026. Proposition acceptée par l'opératrice le même jour, avec
l'**option A** pour les écrans « Votre veille » (§6), et un périmètre tranché
le même jour : **le pilote se fait sur L'Hermitage** (§8, point 4). Elle tient
lieu de la discussion que demande la règle « pas d'autre écran sans
discussion » de `CLAUDE.md`. Lot 1 (positions déclaratives) codé le
30 octobre 2026, lot 2 (Concurrents, fiche concurrent, Acteurs recentré) le
même jour, derrière l'interrupteur `organisations.espace_reorganise`, et lot 3
(un écran par outil, rail en rubriques) et lot 4 (tableau de bord en cases,
bandeaux « En bref », listes repliées, liens internes) dans la foulée.

## 1. Le constat

**L'espace mélange deux lectures.** Les sept écrans ont été pensés pour la
lettre : ce qui s'est passé cette semaine. Les outils stratégiques (carte,
Mendelow, SWOT, TOWS, cinq forces, scénarios, PESTEL) s'y sont ajoutés en
sections, sous des écrans qui avaient un autre objet : « Acteurs » porte la
carte, Mendelow et le suivi des dossiers ; « Recommandations » porte l'option
retenue, la TOWS, la SWOT, les forces et les scénarios. Mesuré sur la
recette du 30 octobre, en 1280 × 900 : « Recommandations » fait 5 629 pixels
de haut, plus de six hauteurs d'écran ; « Acteurs » 3 978, la vue d'ensemble
3 172. Le suivi des dossiers commence sous la carte et Mendelow.

**Les concurrents et les autres acteurs sont confondus.** « Acteurs » liste
les dossiers ouverts, qu'ils soient concurrents (Château du Feÿ,
Châteauform') ou institutions et réseaux (ANCT, Budget de l'État 2027). La
grille, elle, les sépare déjà : chaque entité porte sa veille
(`concurrentiel` ou `ecosysteme`).

**Le référentiel est invisible pour le lecteur.** Ce que la veille surveille
(thèmes, critères d'un impact FORT, sources, corpus, niches, calendrier) ne se
voit que par l'écran « Périmètre », qui lit des rubriques de lettres. Le
lecteur ne sait pas ce que sa veille regarde, ni pourquoi.

**Les chiffres calculés ne sont montrés nulle part.** L'indice de cycle de vie
et le benchmark du trimestre sont calculés par le portail, puis ne servent
qu'au texte de la synthèse.

## 2. Pourquoi la carte de L'Hermitage ne place qu'un concurrent

La carte de septembre place deux entités : L'Hermitage (« vous ») et Château
du Feÿ. La grille en compte 37 côté concurrence. Trois causes s'additionnent.

1. **Une position exige un fait cité.** La porte de la synthèse refuse une
   position sans fait étiqueté de l'organisation (`vérifierFaits` dans
   `contrôlerLaSynthèse`). Or les axes de la carte (capacité en lits en dur,
   place du récit de transition) se lisent dans le **§2 du référentiel**, pas
   dans les lettres : ce sont des variables du corpus, déclaratives, qu'aucun
   fait daté ne porte.
2. **Peu de faits nomment une entité.** Sur 215 faits étiquetés de
   L'Hermitage, 24 portent une entité, et 8 concurrents seulement en ont au
   moins un (Chartreuse de Neuville 3, Abbaye de Belval 2, Château du Feÿ 2,
   puis un chacun pour Domaine de Boisbuchet, Coopérative Oasis,
   Châteauform', Montrieux le Hameau, Elegance Garden).
3. **La synthèse rétrospective n'en a placé que deux.** Je l'ai bâtie le 28/10
   en ne plaçant que les entités dont je pouvais citer un fait et lire les deux
   variables ; la revue mensuelle suivrait la même règle et ferait de même.

La même cause explique Mendelow : 6 parties prenantes placées sur 14.

**Correction proposée.** Admettre une **position déclarative**, sourcée par le
référentiel comme un élément SWOT déclaratif l'est par la fiche :
`origine: declaratif`, avec la référence de la ligne du §2, sans fait exigé à
la première pose. Un **mouvement** de cran resterait soumis à un fait daté qui
nomme l'entité (règle actuelle `mouvement-sans-fait`). L'écran marquerait ces
positions comme « déclaratif · votre veille », comme la SWOT le fait déjà. La
revue placerait alors toute entité de la grille dont les deux variables sont
renseignées au §2 : pour L'Hermitage, une trentaine de lieux au lieu de deux.

## 3. Les principes de lecture rapide

1. **Un écran, une question, un outil.** Chaque écran répond à une seule
   question et porte un seul outil ou un seul type de contenu.
2. **En trois secondes, l'essentiel.** Chaque écran s'ouvre sur un bandeau
   « En bref » : trois chiffres et un graphique, puis trois phrases au plus,
   reprises de la synthèse publiée ou calculées, jamais rédigées pour l'écran.
3. **Le détail se déplie.** Listes repliées au-delà de cinq lignes, encadrés et
   constats d'absence hors de la vue par défaut.
4. **Tout ce qui est nommé mène quelque part.** Une entité mène à sa fiche, un
   fait à sa lettre, un axe à sa page, un élément SWOT à ses faits datés, une
   option TOWS aux éléments qu'elle croise, une famille au thème du
   référentiel qui la définit.
5. **Les règles de la charte restent.** Grilles à angle droit, trois niveaux
   d'impact seulement, pastilles de fraîcheur, sentence case, un seul bouton
   primaire. Aucun graphique n'introduit de couleur d'impact.
6. **Le coût Notion ne monte pas.** Les écrans stratégiques lisent Postgres
   seulement ; les fiches qui citent des passages lisent les quatre dernières
   lettres, déjà en cache, comme la page d'un axe aujourd'hui.

## 4. La carte des écrans

Le tableau de bord devient la porte d'entrée : une case par écran, avec son
chiffre clé et un mini graphique, cliquable en entier. Le rail regroupe les
écrans en cinq rubriques.

| Rubrique | Écran | Question | Contenu et graphique | Source |
|---|---|---|---|---|
| Cette semaine | **Tableau de bord** `/[slug]` | Que dois-je savoir ? | Action de la semaine, ruptures, une case par écran avec son chiffre | existant, refondu |
| Cette semaine | **Lettres** `/[slug]/lettres` | Que dit la lettre ? | Grille des lettres, lecture d'une lettre | existant |
| Le marché | **Concurrents** `/[slug]/concurrents` | Qui me dispute mes clients ? | Carte des groupes stratégiques, liste des concurrents de la grille, mouvements du mois | nouveau |
| Le marché | Fiche concurrent `/[slug]/concurrents/[nom]` | Où en est-il ? | Position et historique de cran, faits datés, santé financière (BODACC), passages des lettres | nouveau |
| Le marché | **Acteurs** `/[slug]/acteurs` | Qui pèse sur mon activité ? | Mendelow, dossiers ouverts hors concurrents, réseaux et institutions | existant, recentré |
| Le marché | **Forces du marché** `/[slug]/forces` | Le marché se durcit-il ? | Cinq forces en barres à trois crans, tendance, entités les plus citées par force | nouveau (trimestre) |
| L'environnement | **Les axes** `/[slug]/axes` | De quoi parle ma veille ? | Grille des axes, carte de chaleur axes × semaines (impact) | existant |
| L'environnement | **PESTEL** `/[slug]/pestel` | Quelles dimensions bougent ? | Six barres mensuelles, trous de couverture, faits regroupés par événement | onglet actuel, en écran |
| Stratégie | **Diagnostic** `/[slug]/diagnostic` | Où en suis-je ? | SWOT, éléments datés et déclaratifs, filiation avec le mois précédent | sorti de « Recommandations » |
| Stratégie | **Options** `/[slug]/recommandations` | Que faire ? | Option retenue, TOWS, chaque option reliée aux éléments qu'elle croise | existant, recentré |
| Stratégie | **Scénarios** `/[slug]/scenarios` | Que peut-il arriver ? | Trois scénarios, indicateurs et ce que la lettre en a vu depuis | sorti de « Recommandations » |
| Stratégie | **Indicateurs** `/[slug]/indicateurs` | Le secteur grandit-il ? | Indice de cycle de vie (entrées et sorties sur deux ans), benchmark financier | nouveau, données déjà calculées |
| Votre veille | **Thèmes suivis** `/[slug]/veille/themes` | Que surveillez-vous pour moi ? | Une case par famille : ce qu'elle suit, ce qui la rend FORT, sa cadence | nouveau, référentiel |
| Votre veille | **Sources** `/[slug]/veille/sources` | Où regardez-vous ? | Sources par famille, date de dernière lecture, sources fermées | nouveau, référentiel |
| Votre veille | **Corpus** `/[slug]/veille/corpus` | Qui suivez-vous ? | Entités du §2 par famille, leurs variables, lien vers chaque fiche | nouveau, référentiel |
| Votre veille | **Niches et calendrier** `/[slug]/veille/calendrier` | Qu'attendez-vous ? | Niches et signaux déclencheurs, échéances des douze prochains mois en frise | nouveau, référentiel |
| Votre veille | **Périmètre** `/[slug]/perimetre` | Que proposez-vous de changer ? | Ajustements de cadrage, tant que des lettres en portent | existant |
| Archives | **Archives** `/[slug]/archives` | Que s'est-il passé avant ? | Une entrée par semaine | existant |

Les écrans d'une rubrique se renvoient l'un à l'autre en pied d'écran. Un
écran sans donnée (organisation hors du pilote, synthèse non publiée) n'est
pas dans le rail, et sa case n'est pas sur le tableau de bord.

**Concurrents et acteurs** se séparent par la veille de l'entité dans la
grille : `concurrentiel` va à « Concurrents », `ecosysteme` et les parties
prenantes vont à « Acteurs ». Un dossier ouvert qui ne nomme aucune entité de
la grille (« Budget de l'État pour 2027 ») reste dans « Acteurs ». Hors du
pilote, faute de grille, l'écran « Acteurs » reste celui d'aujourd'hui.

## 5. Les graphiques

Tous en HTML et CSS à la charte, comme ceux de la vitrine
(`components/graphiques-vitrine.tsx`), sans bibliothèque :

- **Barres mensuelles** des six dimensions PESTEL, zéro compris.
- **Carte de chaleur** axes × huit dernières semaines, cases teintées par les
  trois niveaux d'impact seulement, RAS en gris de filet.
- **Barres à trois crans** pour les cinq forces, flèche de tendance.
- **Nuage de la carte des groupes** : la grille actuelle, plus la position du
  mois précédent en contour.
- **Entrées et sorties** au BODACC sur deux périodes de douze mois (indice de
  cycle de vie), et barres du benchmark financier, valeurs absentes en « n.d. ».
- **Frise** des échéances du calendrier sur douze mois.
- **Activité** : faits par semaine sur les treize dernières semaines, en
  barres fines, sur le tableau de bord.

## 6. Les écrans du référentiel : la décision à prendre

**Le portail ne lit pas les référentiels**, et c'est une règle : l'intégration
Notion n'y est jamais partagée, et Postgres ne copie pas leur texte, à
l'exception bornée de la grille. Les quatre écrans « Votre veille » demandent
donc de choisir une source.

| Option | Principe | Pour | Contre |
|---|---|---|---|
| A, recommandée | La revue mensuelle rédige une **fiche de veille pour le lecteur**, structurée par catégorie, qu'elle poste au portail ; elle passe une porte (longueurs, vocabulaire), est relue et publiée par l'opératrice comme une synthèse | texte écrit pour le client, sans note interne ; même circuit que les synthèses ; le portail ne lit toujours pas Notion | nouvelle exception bornée à accorder (textes courts du référentiel en Postgres) ; une étape de plus à la revue |
| B | Partager les référentiels avec l'intégration du portail et les lire en cache | aucune rédaction de plus | contraire à la règle ; les référentiels portent des notes internes, des réserves et des points de validation à ne pas montrer |
| C | Payload, quand la bascule `SOURCE_DOCUMENTS=payload` sera faite | cohérent avec le programme du 22 octobre | dépend d'une bascule non datée |

Avec l'option A, les bornes proposées : 120 caractères par thème et par
critère, nom et adresse de site seulement pour une source (jamais une note
d'accès), les variables du §2 déjà dans la grille, 80 caractères par échéance.

## 7. L'ordre proposé

| Lot | Contenu | Dépend de |
|---|---|---|
| 1 | Positions déclaratives (porte, revue, écran) : la carte et Mendelow se remplissent | votre accord sur le §2 |
| 2 | Concurrents et Acteurs séparés, fiche concurrent | lot 1 pour la carte |
| 3 | Écrans Stratégie et PESTEL sortis de leurs écrans actuels, rail en rubriques | rien |
| 4 | Tableau de bord en cases, liens internes partout, bandeaux « En bref » | lots 2 et 3 |
| 5 | Graphiques, dont l'écran Indicateurs (livré le 30/10/2026) | lot 3 |
| 6 | Écrans « Votre veille » | votre choix au §6, puis la revue |

Chaque lot passe par la recette Playwright (`pnpm recette`), qui recevra un
contrôle par nouvel écran et le contrôle de cloisonnement sur chacun.

**Lot 2, ce qui est livré (30 octobre 2026).** L'interrupteur par organisation
est `organisations.espace_reorganise` (migration 0016), posé par
`PATCH /api/veille/organisations` (`action: espace`), refusé hors du pilote des
outils ; il vaudra pour les lots 3 à 6. Le rail lit le drapeau par
`espaceDeLOrganisation` (mémoïsée par requête, bornée à 400 ms, `null` dans le
doute : le rail garde alors ses sept écrans). « Concurrents » montre la carte de
la dernière synthèse publiée, chaque nom menant à sa fiche, puis une case par
concurrent de la grille (veille `concurrentiel`, l'organisation exclue) : ses
deux crans, déclaratif ou non, le nombre de faits datés qui le nomment, ce qui a
bougé en tête ; puis les dossiers ouverts sur un concurrent. La fiche réunit sa
position et l'historique de ses crans publiés, ses faits étiquetés (phrase-titre
relue dans les quatre dernières lettres, lien vers la lettre), ses chiffres
publiés au registre (benchmark du dernier trimestre publié) et les passages des
quatre dernières lettres qui le nomment. « Acteurs » perd la carte et les
dossiers des concurrents, garde Mendelow et le reste. Aucune lecture Notion de
plus que la liste des éditions, hormis les quatre corps de la fiche, déjà en
cache. La santé financière au BODACC, entité par entité, n'est pas encore lue :
le benchmark donne les comptes publiés, pas les procédures.

**Lot 3, ce qui est livré (30 octobre 2026).** Pour un espace réorganisé, le
rail passe à douze écrans groupés en rubriques (`Onglet.rubrique`, rendu par
`NavLatérale` et par la liste « Plus » du menu de pied) : Cette semaine (vue
d'ensemble, lettres), Le marché (concurrents, acteurs, forces du marché),
L'environnement (les axes, PESTEL), Stratégie (diagnostic, options, scénarios),
Votre veille (périmètre, archives ; la rubrique « Archives » seule aurait répété
son unique écran). Quatre écrans sortent de leurs écrans d'origine, sans lecture
nouvelle : « Forces du marché » et « Scénarios » (le trimestre publié),
« Diagnostic » (la SWOT du mois, chaque élément en ancre), « PESTEL » (l'onglet
de « Les axes », qui ne le lit plus). « Recommandations » devient « Options » :
l'option retenue et la TOWS, dont les codes mènent à l'élément du diagnostic,
puis les actions des lettres. Un écran sans donnée publiée reste dans le rail et
le dit ; le cacher demanderait au rail de lire les synthèses à chaque page. Les
barres et graphiques sont pour le lot 5.

**Lot 4, ce qui est livré (30 octobre 2026).** La vue d'ensemble d'un espace
réorganisé porte, sous l'action de la semaine, la section « Votre espace » : une
case par écran (onze, dans l'ordre du rail), avec sa rubrique, son chiffre clé
et une mention, cliquable en entier (`casesDuTableauDeBord`). Les chiffres
viennent de ce que l'écran lit déjà (lettres, axes de la semaine, dossiers,
étiquettes des trois dernières lettres) et de la synthèse publiée, lue en même
temps que les étiquettes ; un chiffre absent s'écrit « n.d. » ou « pas encore
publié ». Les écrans Concurrents, Acteurs, Forces du marché, PESTEL, Diagnostic
et Scénarios s'ouvrent sur un bandeau « En bref » de trois chiffres, sans
phrase : les phrases reprises de la synthèse sont déjà sur l'écran, et en écrire
pour lui serait rédiger. Au-delà de six concurrents, cinq dossiers ou quatre
semaines d'actions, le reste se replie (`details` natif, sans script, la liste
entière reste dans le HTML). Liens internes : la source d'un élément SWOT daté
mène à sa lettre (parmi celles listées pour l'organisation), un dossier de
l'accueil qui nomme un concurrent mène à sa fiche.

**Lot 5, ce qui est livré (30 octobre 2026).** Les graphiques du §5, en HTML et
CSS à la charte (`components/graphiques-strategie.tsx`), pour l'espace
réorganisé seulement : ailleurs, les écrans des autres organisations du pilote
ne changent pas. « Forces du marché » montre chaque force en trois crans pleins
ou vides, avec la flèche de sa tendance ; « PESTEL » donne à chaque dimension
ses barres mensuelles, zéro compris, sur une même échelle pour les six ; « Les
axes » gagne la carte de chaleur des axes sur huit semaines, chaque case au
niveau du fait le plus fort de l'axe cette semaine-là (la porte des étiquettes
tient que c'est le niveau de l'axe), F sur fond rose, M sur fond ardoise, vide
pour un axe RAS ou une semaine où son thème n'a pas paru ; la vue d'ensemble
porte l'activité, les faits relevés par semaine sur treize semaines. Ces deux
derniers lisent les faits étiquetés dans Postgres (`faitsRécentsDeLEspace`, une
requête sur treize semaines et la grille) : la carte de chaleur ne lit **aucun
corps de lettre**, quand l'avoir tirée des corps aurait demandé seize lettres
pour huit semaines. Nouvel écran **« Indicateurs »** (`/[slug]/indicateurs`,
rubrique Stratégie, treize écrans au rail, douze cases au tableau de bord) :
l'indice de cycle de vie en barres, entrées et procédures collectives sur deux
périodes de douze mois, et le benchmark, chiffre d'affaires publié par entité,
l'organisation en encre, « n.d. » sans barre ; l'un et l'autre lus dans les
éléments du dernier trimestre publié (`indicateursDeLEspace`), tels que le
portail les a calculés à la synthèse, avec l'interprétation relue et les
limites ; l'écran n'appelle ni le BODACC ni le registre. La carte des groupes
avait déjà la position du mois précédent en pointillé ; la frise du calendrier
attend les écrans « Votre veille » (lot 6), et les cases du tableau de bord
gardent leur chiffre sans mini graphique, l'activité tenant ce rôle en tête de
section.

## 8. Ce qu'il faut trancher

Décidé le 30/10/2026 : accord sur la proposition, option A pour la source des
écrans « Votre veille ». L'extension de l'exception de données qu'elle suppose
sera écrite dans `CLAUDE.md` avec le lot 6, bornes du §6 comprises.

Décidé le 30/10/2026, point 4 : **pilote sur L'Hermitage**. Les nouveaux
écrans ne s'ouvrent d'abord que pour elle ; les autres organisations, pilote
des outils stratégiques compris, gardent les sept écrans jusqu'à la fin de la
recette. Pour le lot 1, la porte admet les positions déclaratives pour toute
organisation du pilote (c'est une règle de contrat, pas un écran), et c'est la
revue mensuelle qui ne les pose que pour L'Hermitage. Les lots 2 à 6 auront
leur propre interrupteur par organisation.

1. Admettre les **positions déclaratives** (§2), pour que la carte et
   Mendelow montrent tout le corpus.
2. La **source des écrans « Votre veille »** : option A, B ou C (§6), et, pour
   A, l'extension de l'exception de données.
3. Le **nombre d'écrans** : dix-huit entrées au lieu de sept, regroupées en
   cinq rubriques dans le rail.
4. Le **périmètre** : pilote des outils stratégiques seulement, ou tous les
   clients (les écrans « Votre veille » et le tableau de bord en cases valent
   pour tous ; les écrans Stratégie, Concurrents et Forces supposent la grille).
