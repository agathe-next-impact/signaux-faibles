# Proposition : réorganiser l'espace client pour la lecture rapide

30 octobre 2026. Proposition acceptée par l'opératrice le même jour, avec
l'**option A** pour les écrans « Votre veille » (§6) ; rien n'est encore codé.
Elle tient lieu de la discussion que demande la règle « pas d'autre écran sans
discussion » de `CLAUDE.md`. Reste ouvert le périmètre (§8, point 4).

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
| 5 | Graphiques, dont l'écran Indicateurs | lot 3 |
| 6 | Écrans « Votre veille » | votre choix au §6, puis la revue |

Chaque lot passe par la recette Playwright (`pnpm recette`), qui recevra un
contrôle par nouvel écran et le contrôle de cloisonnement sur chacun.

## 8. Ce qu'il faut trancher

Décidé le 30/10/2026 : accord sur la proposition, option A pour la source des
écrans « Votre veille ». L'extension de l'exception de données qu'elle suppose
sera écrite dans `CLAUDE.md` avec le lot 6, bornes du §6 comprises.

1. Admettre les **positions déclaratives** (§2), pour que la carte et
   Mendelow montrent tout le corpus.
2. La **source des écrans « Votre veille »** : option A, B ou C (§6), et, pour
   A, l'extension de l'exception de données.
3. Le **nombre d'écrans** : dix-huit entrées au lieu de sept, regroupées en
   cinq rubriques dans le rail.
4. Le **périmètre** : pilote des outils stratégiques seulement, ou tous les
   clients (les écrans « Votre veille » et le tableau de bord en cases valent
   pour tous ; les écrans Stratégie, Concurrents et Forces supposent la grille).
