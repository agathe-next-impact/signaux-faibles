# Plan de sessions du portail

Écrit le 9 septembre 2026, après les vérifications d'API et le pivot Notion
headless. Les sessions sont ordonnées : **ne pas anticiper une session
suivante**. Chaque session se termine par `pnpm lint && pnpm typecheck &&
pnpm test`, un commit, et la mise à jour de ce fichier.

Ce plan couvre le portail seul. Les tâches Cowork (intake, génération,
relecture, tenue de la base « Accès ») vivent hors de ce dépôt et ne sont
jamais modifiées depuis ici.

## Ce qui bloque, et ce qui ne bloque pas

Trois fichiers déclarés par le CLAUDE.md n'existent pas au dépôt :
`docs/charte-design.md` (et son PDF), `docs/maquette-edition.html`. Ils font
foi respectivement pour les tokens et pour la hiérarchie visuelle, et le
CLAUDE.md interdit de réinventer les uns comme l'autre.

Conséquence sur l'ordre des sessions : **tout le moteur se construit sans
eux**. Seule l'apparence en dépend. Les sessions 1 à 6 sont donc entièrement
réalisables ; la session 7 est bloquée jusqu'à la livraison de la charte et
de la maquette.

En attendant, `app/globals.css` porte un jeu de tokens **provisoires**,
explicitement marqués comme tels : une échelle de gris neutre et une seule
teinte d'accent. Ils ne prétendent pas être la charte, ils lui réservent sa
place. Le fichier est le point de bascule unique : quand la charte arrive,
seules ses valeurs changent, aucun composant.

## Session 1 — socle et garde de schéma ✅

- Squelette Next.js 16 : App Router, TypeScript strict, `cacheComponents`,
  Tailwind v4, les trois polices en `next/font/google`.
- `lib/env.ts` : validation des variables d'environnement au démarrage,
  message explicite sur ce qui manque.
- `lib/notion/client.ts` : SDK v5, résolution des `data_source_id` à partir
  des identifiants de base, au démarrage et une seule fois.
- `lib/notion/schema.ts` : la liste des propriétés attendues, confrontée au
  schéma réel ; **refus de démarrer** si une propriété manque ou a changé de
  type. C'est le contrat des bases, et il n'existe qu'ici.
- Profil de cache `notion` dans `next.config.ts`.

Fait quand : `pnpm build` passe et la garde de schéma est testée sur des
schémas factices, complets et amputés.

## Session 2 — domaine, sans réseau ✅

Fonctions pures, testées unitairement, sans aucun appel Notion :

- `lib/domaine/impact.ts` : suffixe d'un titre H2 → `FORT`, `MOYEN`, `RAS`
  ou « inconnu ». `FAIBLE` n'est pas un niveau : il tombe en « inconnu »,
  s'affiche sans badge, et n'est jamais converti.
- `lib/domaine/semaines.ts` : lundi de la semaine ISO d'une date, clé de
  semaine, regroupement d'éditions en semaines, tri.
- `lib/domaine/dossiers.ts` : analyse de `nom (compteur, précision)`
  séparés par ` · `, tolérante aux écarts de format.
- `lib/domaine/document.ts` : blocs Notion → arbre de rendu, familles
  repliables, aucune URL de fichier Notion conservée.

Fait quand : la couverture des cas tordus est écrite avant le code.

## Session 3 — lectures Notion cachées ✅

- `lib/notion/acces.ts` : lecture de la base « Accès — portail » par
  identifiant d'accès, en `'use cache: remote'`, tag
  `liste:<data_source_id>`.
- `lib/notion/editions.ts` : requêtes filtrées `Statut = Envoyé` **et**
  `Organisation contains <page_id>`, en `'use cache: remote'`, tags
  `liste:` et `page:`.
- Aucune fonction cachée ne reçoit l'identité d'une personne ; les
  fonctions de contenu ne reçoivent que l'identifiant d'organisation.

Fait quand : chaque lecture est dans une fonction cachée, et un test le
vérifie en lisant le code source des modules.

## Session 4 — accès par lien magique persistant ✅

- `lib/auth/jeton.ts` : signature HMAC-SHA256, encodage base64url,
  comparaison en temps constant.
- `app/acces/[jeton]/route.ts` : vérifie, pose le cookie, **redirige
  immédiatement**. Le jeton n'apparaît nulle part ailleurs.
- `proxy.ts` : cookie → identifiant → organisation, à chaque requête.
  Révocation effective à la requête suivante.
- Page « recevoir mon lien » et envoi par l'API Gmail de Workspace.

Fait quand : un jeton falsifié, un jeton révoqué et un cookie absent
mènent tous les trois où il faut, et sont testés.

## Session 5 — écrans, structure avant apparence ✅

Cinq écrans, derrière un rail latéral, structure reprise de la maquette de
tableau de bord du 10 septembre 2026 :

| Écran | Ce qu'il montre | Coût Notion |
|---|---|---|
| `/[slug]` — vue d'ensemble | chiffres de la semaine, action, familles en cartes | liste + 4 lectures de blocs |
| `/[slug]/signaux` | les notes de la semaine, en entier | liste + 2 lectures de blocs |
| `/[slug]/tendances` | l'évolution des dossiers, semaine après semaine | liste seule |
| `/[slug]/recommandations` | l'action de la semaine, et celles d'avant | liste seule |
| `/[slug]/archives` et `/archives/[semaine]` | une entrée par semaine | liste seule |

La structure vient de la maquette ; l'apparence n'en retient rien. Couleurs,
typographie, rayons et badges restent ceux de la charte, et le rail est blanc
bordé de gris ligne, non foncé.

Aucun écran ne lit le corps des notes sur toute l'archive : ce serait une
requête par édition, et le débit Notion ne le permet pas. Les écrans qui
parlent de profondeur se contentent des propriétés de la liste.

La structure et la sémantique sont définitives à l'issue de cette session ;
l'apparence ne l'est pas.

## Session 6 — webhook, médias, mode dégradé ◐

- `app/api/webhooks/notion/route.ts` : signature vérifiée avec
  `verifyWebhookSignature`, réponse 2xx immédiate, puis `revalidateTag`.
  Le handler ne relit jamais Notion et n'envoie jamais d'email.
- `app/api/media/[block_id]/route.ts` : proxy d'images, parce que les URL
  de fichiers Notion expirent en une heure.
- Recette du mode dégradé : couper l'accès à Notion et vérifier que la
  dernière version connue est servie. C'est le point noté « non vérifié »
  dans `docs/etat-des-api.md`. **Reste à faire** : il ne se vérifie que sur un
  déploiement réel, le cache distant n'existant pas en local.

## Session 7 — charte ✅, maquette ◐

La charte est arrivée le 9 septembre : `docs/charte-design.pdf`, v1.0, cinq
pages. Le PDF est en images, sans texte extractible ; sa transcription est
dans `docs/charte-design.md`, et c'est elle qui rend les règles citables.

Fait : les tokens provisoires ont été remplacés par ceux de la charte,
couleurs, échelle typographique et rayons ; le mot-symbole et le motif
signature sont devenus des composants ; les badges portent les libellés de
la charte ; les écrans ont été capturés et comparés à ses pages.

**Reste bloqué** : `docs/maquette-edition.html` n'existe toujours pas. La
charte donne les briques, la maquette donnerait la hiérarchie visuelle de la
page d'édition et du panneau des dossiers. La mise en page actuelle découle
des briques et de la structure ; elle n'a été comparée à aucune maquette.

## Session 8 — recette de cloisonnement

Playwright, **un compte par client**. Vérifier qu'aucune donnée d'un client
n'apparaît dans le HTML d'un autre, y compris dans les charges JSON non
affichées. C'est la règle 7, et elle ne se vérifie qu'avec des comptes
réels sur un déploiement réel.

## Journal

**9 septembre 2026.** Sessions 1 à 5 faites, session 6 faite sauf la recette du
mode dégradé, qui demande un déploiement. 84 tests unitaires, 8 parcours de
recette sur les chemins de refus, `pnpm build` vert avec pré-rendu partiel sur
les trois écrans clients.

Trois choix méritent d'être retenus, parce qu'ils s'écartent de la lettre du
CLAUDE.md ou du plan initial.

**Le contrôle d'appartenance est en deux temps, pas un.** Le proxy ne vérifie
que la signature du cookie : `use cache` n'y est pas disponible, et une lecture
Notion non cachée y serait un bug bloquant. La lecture de la base « Accès » et
le contrôle du slug vivent dans `exigerAccès`, appelé par le layout **et** par
chaque page. Cette redite est voulue : sans RLS derrière, un écran qui
oublierait le contrôle servirait les éditions d'un autre client.

**Le proxy ne garde pas `/api/`.** Chaque route d'API porte un contrôle plus
strict que le sien — le proxy des médias vérifie en plus que le bloc demandé
appartient aux éditions du client. Rediriger une requête d'API vers le
formulaire lui répondrait 200 avec une page HTML, là où 404 est la bonne
réponse. C'est une recette qui l'a montré.

**Un second profil de cache, `media`.** Le profil `notion` régénère à l'heure,
or une URL de fichier Notion expire au bout d'une heure : servir depuis le
cache une URL à la limite donnerait une image cassée. Le profil `media` expire
à cinquante minutes, sous la limite. Il ne s'applique qu'à la résolution des
médias, jamais au contenu.

**Deux versions ont dû être choisies contre le dernier publié.** TypeScript 7
est sorti ; le portail reste sur la ligne 5.9, contre laquelle Next.js 16 est
construit. ESLint 10 casse `eslint-plugin-react`, tiré par la configuration
Next : la ligne 9 est la seule qui fonctionne aujourd'hui. À revoir quand
l'écosystème aura suivi.

**10 septembre 2026.** L'espace client est réorganisé en cinq écrans — vue
d'ensemble, signaux, tendances, recommandations, archives —, et le portail
devient une application installable, lisible hors ligne, avec menu de pied sur
mobile. 126 tests unitaires, 12 parcours de recette.

**La structure du tableau de bord, l'apparence de la charte.** Les maquettes
fournies donnaient une organisation de l'information, pas une identité. Rail
blanc bordé de gris ligne et non foncé, badges d'impact à trois niveaux,
échelle typographique et rayons inchangés : aucun token n'a bougé.

**Le hors-ligne ne se teste pas avec `setOffline`.** Le drapeau de Playwright
n'atteint pas les requêtes du service worker, qui continuent de sortir. Le
premier test concluait que le secours marchait alors qu'il n'avait jamais été
sollicité. La recette démarre maintenant son propre serveur et l'arrête pour de
bon. Le même piège a masqué un second défaut : la purge de révocation se
déclenchait à toute visite du formulaire, y compris volontaire, et vidait le
cache que l'on venait de remplir.

**Ce cache est une donnée client sur un appareil.** C'est le seul endroit du
portail où il en reste une copie. Purge à la révocation, purge sur demande, et
un risque résiduel assumé entre les deux : `docs/pwa-hors-ligne.md`.

**10 septembre 2026, seconde passe.** Vocabulaire, grilles et domaine.

**« Famille » disait deux choses, et c'était une pour de trop.** Le mot
désignait à la fois les sections thématiques du corps d'une note — ce que le
client lit — et la propriété Notion `Famille`, clé de gestion interne à deux
valeurs qui n'est jamais affichée. Les premières s'appellent désormais des
**axes**, partout dans l'UI et dans le code ; la propriété garde son nom, qui
appartient au schéma Notion et donc aux tâches Cowork. Le format des H2 dans
Notion n'a pas bougé, seule la façon d'en parler a changé.

**Les grilles passent à l'angle droit, sans gouttière.** Les cases se touchent
et partagent leurs filets. Deux briques, `Grille` et `Case`, portent seules la
règle. Le contour demandait une précaution : une rangée incomplète laissait le
rectangle ouvert à droite, puisqu'aucune case ne venait le fermer. Le contour
appartient donc à l'encadrement, et la grille est décalée d'un pixel pour que la
dernière colonne retombe exactement dessus. Les rayons de la charte restent sur
ce qui n'est pas une boîte : champs, boutons, onglets, badges, bannière.

**Signaux devient Lettres, et change de nature.** L'écran empilait les notes de
la semaine ; c'est maintenant une grille de toutes les lettres publiées, une
case par édition, avec une page de lecture par lettre. La différence avec les
archives est nette : celles-ci listent des semaines, celle-là des lettres — deux
par parution, une par veille. Aucune lecture de corps : la grille de cinquante
lettres coûte autant qu'une grille vide.

**Tendances gagne la grille des axes.** Chaque axe de la semaine avec son niveau
et son mouvement par rapport à la précédente. Le rapprochement se fait sur le
nom, qui vient du référentiel : un axe renommé se lit comme nouveau, ce qui est
préférable à une continuité inventée. Sans semaine précédente, l'écran se tait
au lieu d'annoncer que tout est nouveau. Coût Notion : nul en pratique, ce sont
les deux mêmes semaines que la vue d'ensemble, donc les mêmes entrées de cache.

**Le domaine est tranché : `signauxfaibles.io`**, conforme à la charte. Rien
n'était codé en dur ; `PORTAIL_URL` porte la valeur, et les documents qui
laissaient l'arbitrage ouvert ne le laissent plus.

**10 septembre 2026, troisième passe.** Indices, suivi d'axe, vue concurrents.

**Les chiffres cerclés des référentiels sortent du texte.** Les titres d'axes
arrivent de Notion sous la forme « ② Cadre français — FORT ». Ni Lora ni Public
Sans ne dessinent ①-⑳ : le navigateur allait les chercher dans une police de
secours, et le titre se composait en deux fontes, avec un chiffre trop lourd et
mal aligné. Le rang est désormais détaché à la lecture et recomposé en indice
mono. La reconnaissance est volontairement étroite — chiffres cerclés, ou
chiffre suivi d'un point ou d'une parenthèse — pour qu'un axe nommé « 5G et
réseaux » garde son nom.

**Un axe s'ouvre et se suit sur quatre lettres.** C'est le seul écran qui lit
plusieurs corps d'affilée, et le plafond est explicite (`LETTRES_SUIVIES`) :
remonter toute l'archive serait une requête Notion par édition. L'axe est
retrouvé par un segment dérivé de son nom, jamais de son numéro — un
référentiel réordonné casserait sinon toutes les adresses. Une lettre qui
n'ouvre pas l'axe n'est pas une absence de signal, et l'écran le dit plutôt que
de laisser un trou.

**La vue concurrents ne relit rien.** Elle montre les dossiers ouverts de la
lettre concurrentielle de la semaine — déjà chargée pour les axes. Unité
différente des axes (des dossiers, pas des thèmes), question différente (qui
bouge, et depuis quand), donc pas de doublon avec la grille voisine. Si la
propriété `Veille` est renommée dans Notion, la section disparaît en le disant,
plutôt que de montrer la mauvaise lettre.

**`EntêteÉcran` prend un nœud et non une chaîne.** Sans quoi la page d'un axe
devait répéter son numéro dans une phrase, faute de pouvoir le mettre dans le
titre.

**10 septembre 2026, quatrième passe.** L'accueil en deux angles.

**Les deux lettres sont réunies, pas juxtaposées.** L'accueil lisait déjà les
deux corps de la semaine, mais les présentait à plat. Il porte maintenant deux
sections : « Les acteurs » et « L'écosystème ». La coupure ne se fait pas par
lettre — le lecteur n'a pas à savoir laquelle a relevé quoi — mais par nature de
ce qui est suivi : des entités nommées d'un côté, des thèmes de l'autre.

**Le classement par `Veille` a été abandonné, et c'est un gain.** La vue
concurrents de la passe précédente reconnaissait la lettre concurrentielle à son
libellé. Or ce libellé est choisi par le client — Écosystème, Concurrentiel,
Positionnement, Attractivité — et la clé de gestion `Famille`, elle, n'est pas
accessible au portail. Un renommage dans Notion aurait fait disparaître la
section. Les dossiers ouverts, eux, sont des acteurs par nature, quelle que soit
la lettre qui les porte. `estVeilleConcurrentielle` a été supprimée.

**La fusion des axes est enfin écrite une fois.** Les tendances dédoublonnaient
par nom, l'accueil non : deux lettres ouvrant le même axe y auraient produit
deux cases au même surtitre. `fusionnerLesAxes` sert désormais les deux écrans —
niveau le plus fort retenu, éléments importants réunis sans répéter un fait
relevé deux fois.

**10 septembre 2026, cinquième passe.** Les acteurs ont une page.

**Un acteur n'a pas de contenu dans Notion.** C'est une entrée texte de
« Dossiers ouverts suivis » : un nom, un compteur, une précision. Sa page
l'assemble donc à partir de deux sources de coûts opposés. Le suivi — chaque
semaine où le dossier a été rouvert, et son état alors — ne lit aucun corps de
note et couvre toute l'archive pour la seule requête de liste. Les mentions —
les passages des quatre dernières lettres qui nomment l'acteur — demandent les
mêmes quatre corps que la page d'un axe, donc les mêmes entrées de cache.

**La recherche de mentions est bornée aux mots.** « CADA » ne doit pas se
déclencher sur « cadastre » ; accents et casse sont ignorés, le reste ne l'est
pas. Un nom est aussi échappé avant d'entrer dans le motif : un dossier nommé
« (a) » ne doit pas devenir une expression régulière.

**Les détails des tendances passent sous des segments explicites**,
`axes/[axe]` et `acteurs/[acteur]`. L'axe était directement sous
`tendances/[axe]` ; un axe nommé « Acteurs » aurait masqué la route des acteurs.
Le coût de la correction était nul, la branche n'étant pas déployée.

**`slugDAxe` devient `enSlug`**, dans son propre module : la règle d'adressage
est la même pour un axe et pour un acteur, elle n'a pas à être écrite deux fois.

**10 septembre 2026, sixième passe.** L'accueil ne montre que les acteurs vivants.

Un dossier peut rester ouvert des semaines sans que rien ne bouge ; sur
l'accueil, il occupait une case pour ne rien apprendre. Il n'y figure plus au
bout de trois lettres sans actualité — mais il n'est pas perdu : le suivi entier
reste sur les tendances, et c'est là qu'un dossier qui s'enlise doit se voir.

**La règle a deux portes, et il en fallait deux.** Une des trois dernières
lettres nomme l'acteur, ou son compteur est retombé à zéro. La seconde condition
n'est pas une commodité : la recherche par nom est exacte, et une lettre peut
très bien suivre « CADA » dans ses dossiers en écrivant « la Commission d'accès
aux documents administratifs » dans sa prose. Filtrer sur les seules mentions
aurait fait disparaître l'acteur la semaine même où il bouge. Le compteur, lui,
est tenu par la veille.

**Le nombre d'acteurs écartés est affiché.** Un compte muet laisserait croire
que la veille a cessé de les suivre.

Coût Notion : nul. Les trois dernières lettres sont, à une près, celles que
l'accueil lit déjà pour les axes et la comparaison des tuiles ; le cache sert
le reste.

**10 septembre 2026, septième passe.** Mesurer avant de corriger.

« Certains acteurs n'ont pas d'informations de détails. » Plutôt que de deviner,
la vraie base a été interrogée : la première lettre Infralliance et ses dix
dossiers ouverts. Elle a révélé un **bug**, pas une limite de conception.

**`mentionsDe` ne parcourait que les axes.** Or une lettre porte son essentiel,
son analyse, son agenda et son récapitulatif de dossiers hors de toute section
thématique — et c'est là que les dossiers sont nommés en clair. La moitié du
texte était ignorée. La recherche parcourt maintenant le préambule, les
introductions de rubriques et les axes, chaque passage gardant sa provenance.

**Les noms de dossiers sont des syntagmes, pas des noms propres.** « règlement
marchés publics », « raccordement Telehouse Magny », « colloque Cnam ». La prose
les reprend avec ses articles. La recherche tolère donc entre les mots du nom
jusqu'à deux mots d'au plus quatre lettres, et rien de plus : au-delà, ce ne
serait plus le même syntagme.

**Neuf dossiers sur dix, mesurés.** `tests/mentions.lettre-reelle.test.ts` tient
la vraie lettre en fixture et vérifie le résultat. Le dixième,
« SecNumCloud 3.2 », est irréductible : la lettre écrit « SecNumCloud » d'un côté
et « référentiel 3.2 » de l'autre. Les rapprocher demanderait d'abandonner un
qualificatif, ce qui confondrait deux versions du même référentiel. Le cas est
documenté plutôt que forcé — et c'est lui qui justifie la seconde porte du
filtre d'actualité.

**La moitié des dossiers réels n'ont pas de précision.** Leur case n'affichait
qu'un nom et un état. Elle porte maintenant, à défaut de précision, la phrase de
la lettre qui les nomme — calculée par le filtre d'actualité, qui la jetait.

**Une page d'acteur sans citation n'est plus un cul-de-sac** : elle ouvre les
lettres de la période.

**10 septembre 2026, huitième passe.** Le cadrage sort des lettres.

Les ajustements de cadrage — « deux dates à corriger », « trois sources à
ajouter » — appellent une décision du client. Mêlés aux faits de la semaine, ils
se lisaient comme de l'information de veille. Ils ont désormais leur écran, et
ne figurent plus dans aucune lettre.

**Détachés à la construction, pas masqués à l'affichage.**
`construireDocument` les sort de `rubriques` et les pose dans
`document.cadrage`. Aucun écran ne peut donc les faire réapparaître par
mégarde ; c'est une propriété du document, pas une discipline de rendu.

**Le trait horizontal a failli coûter cher.** Dans la vraie lettre, la rubrique
de cadrage est suivie d'un `---` puis du pied — dossiers ouverts, sources
vérifiées, prochaine parution. Retirer la rubrique entière l'aurait emporté, or
c'est lui qui nomme la plupart des dossiers suivis : les mentions d'acteurs
seraient tombées de neuf sur dix à presque rien. La fixture de la vraie lettre a
été complétée pour porter cette structure, et un test vérifie qu'aucune mention
n'est perdue au passage. Sans elle, la régression serait passée.

**Six écrans, et le menu de pied tient.** Vérifié à 360 px : pas de débordement,
les six libellés lisibles.

**10 septembre 2026, neuvième passe.** Un espace vide, et pourquoi.

L'Hermitage se connectait normalement et ne voyait rien. Le diagnostic s'est
fait sur les données, pas par déduction : la ligne « Accès » portait
`3d5fe829ce718130b48bd6b171ac7a28`, or les quatorze éditions du client portent
`3d5fe829ce71810da651f3783a725bd8`. Le premier est la **page organisation** sous
« Veilles clients » ; le second la **ligne du registre**. La page organisation le
dit elle-même, dans sa ligne « Fiche au registre ».

**Le code s'est comporté exactement comme il devait.** La règle 2 veut qu'un
identifiant qui ne correspond à rien ne montre rien, plutôt que d'élargir la
requête pour « trouver quand même ». Un espace vide est le bon échec.

**Mais il était muet, et c'est le vrai défaut.** Trois fois aujourd'hui, un
silence a coûté du temps : l'envoi de lien qui échouait sans trace, le webhook
qui n'annonce pas ce qu'il invalide, et maintenant un espace vide qui ne
distingue pas le client neuf du client mal relié. Le layout journalise désormais
« accès valide, aucune édition » avec le slug et l'identifiant, en nommant la
cause probable. Un client réellement neuf produit la même ligne : c'est un
signal à lever, pas une preuve d'erreur.

**Les états vides le disent au client aussi** : « si vous en avez déjà reçu,
dites-le nous ». Un lecteur qui a quatorze lettres dans sa boîte et un espace
vide doit pouvoir le signaler, pas conclure que le service ne marche pas.

**Le piège est nommé dans l'onboarding**, avec la vérification en dix secondes :
comparer la propriété `Organisation` d'une édition à la ligne « Accès ».

**10 septembre 2026, dixième passe.** Plusieurs lecteurs, et un silence de plus.

**Plusieurs adresses pour un espace : c'était déjà le modèle.** Les deux lectures
d'accès sont clefées par personne — identifiant, ou email —, jamais par espace.
Autant de lignes que de lecteurs, partageant l'identifiant d'organisation et le
slug, chacune avec son lien et sa révocation. Rien à changer dans le code.

**Mais un piège s'y cache, et il était muet.** Dupliquer une ligne dans Notion
pour ajouter un lecteur recopie « Identifiant d'accès ». Le portail trouve alors
deux lignes pour un même identifiant et refuse — à raison, un choix arbitraire
rattacherait peut-être la personne au mauvais client — mais il refusait sans
rien dire, et les deux liens cessaient de fonctionner d'un coup. Le cas est
désormais journalisé, et l'onboarding dit de créer une ligne vierge plutôt que
de dupliquer.

**Une adresse reste liée à un seul espace** : la page « recevoir mon lien » exige
exactement une ligne active par email, sans quoi elle ne saurait pas quel lien
renvoyer. C'est une limite, elle est écrite.

**Les acteurs vides de l'Hermitage ne sont pas un bug.** Les quatorze éditions du
client sont des archives importées d'un dispositif antérieur à Notion, et leur
propriété « Dossiers ouverts suivis » est vide — vérifié sur les six dernières.
Le corps des lettres, lui, nomme abondamment des concurrents, jusqu'à porter une
rubrique « Actualité acteurs ». Le portail ne peut pas en déduire une liste
d'entités sans inventer un second contrat, à rebours du modèle. La section vide
renvoie donc désormais vers les lettres, où ces organisations restent lisibles.

**11 septembre 2026.** Un jeton refusé, et un accès opérateur.

**Le mail partait, le jeton était rejeté.** Agathe et Jean, tous deux sur
l'espace hermitage, portaient le **même `Identifiant d'accès`** : la ligne avait
été dupliquée. La recherche par email trouve bien une ligne unique — le lien est
donc composé et envoyé —, mais `/acces/<jeton>` en trouve deux et refuse, pour
les deux personnes à la fois. C'est exactement le piège journalisé la veille.
Identifiant régénéré pour Jean.

**L'accès opérateur est une exception assumée à la règle 2**, et elle est tenue
étroite. `organisationDuSlug` compare un slug exact aux slugs de la base
« Accès » — celle que le portail lit déjà. Le registre reste fermé, aucun nom
n'est résolu, les fonctions cachées ne voient toujours qu'un identifiant
d'organisation, un slug inconnu reste `notFound`, et `Actif` révoque le
privilège comme le reste. Un test d'architecture vérifie que cette fonction
n'est appelée que depuis le contrôle d'appartenance : un écran qui l'appellerait
contournerait le seul endroit qui vérifie le privilège.

**Le bandeau n'est pas décoratif.** Sans marque visible, une capture d'écran de
l'espace d'un client serait indiscernable d'une fuite, et l'opérateur lui-même
pourrait croire lire son propre espace.

**Trois mesures ont été nécessaires pour le poser correctement.** Fixé, il
laissait le contenu passer dessous ; collant, il laissait le rail glisser sous
lui et couper le logo ; et sa hauteur écrite deux fois aurait dérivé. La
solution tient en une variable CSS : le bandeau la pose, le rail s'y colle et en
déduit sa propre hauteur. Vérifié à trois positions de défilement.
