# L'arbre des marchés : la règle d'écriture

12 novembre 2026, décision de l'opératrice : l'écran « Marchés et niches » est
alimenté pour tout client, sans rien lui demander. Ce document est la règle que
suivent l'onboarding (point 5bis de `/onboarding-premiere-lettre`), le
rattrapage (`/onboarding-outils`) et la revue. Le format de la route est dans
`docs/api-veille.md` (« Marchés et niches »), le dessein dans
`docs/plan-marches-et-niches.md`.

## Ce que fait la tâche, ce que fait le portail

La tâche **écrit l'arbre** et le poste (`POST /api/veille/marches`). Elle ne
fournit **aucun chiffre de marché** : ni nombre de cibles, ni potentiel, ni
présence comptée. Le portail contrôle l'arbre, puis **mesure lui-même** :

- un arbre créé mesure à la suite le trimestre civil en cours ;
- la synthèse d'un trimestre (`POST /api/veille/syntheses`, `AAAA-Tn`, amorçage
  compris) mesure ce trimestre ;
- les mesures restent **proposées** : l'opératrice les relit dans l'espace et
  les publie sur `/espaces/syntheses`, section « Marchés et niches ».

La tâche n'appelle donc ni `mesurer` ni `etat`.

## Quand

Après la grille validée, les étiquettes et la synthèse initiale. Seulement si
`GET /api/veille/marches?slug=<slug>` répond `aucun` : un arbre existant ne se
réécrit pas à l'onboarding. La revue trimestrielle le reposte seulement quand
le référentiel a changé d'offres ou de concurrents (une liste identique répond
`inchangée`).

## D'où vient l'arbre

Des deux référentiels (présentation de l'organisation, §2, familles, liste des
offres de la grille), de la grille validée (entités, familles) et des lettres
publiées. **Rien n'est demandé au client**, rien n'est supposé de son chiffre
d'affaires ni de ses clients.

## Sa forme

Trois niveaux, six à vingt segments (quarante au plus) :

1. **une racine**, le marché de l'organisation (`parent: null`) ;
2. **trois à six offres** (`parent` : la racine) : les lignes d'offre de
   l'organisation, telles que la grille les liste ;
3. **zéro à trois niches par offre** (`parent` : l'offre) : un sous-segment que
   le référentiel ou une lettre nomme et que l'on peut délimiter (un type de
   client, une obligation réglementaire datée, un territoire, un canal).

`cle` : minuscules, chiffres et tirets bas. `libelle` : 40 caractères au plus,
sentence case, jamais les mots « fort » ni « faible ».

## Chaque champ, et quand le laisser vide

Un champ que rien n'établit **s'omet** : l'écran écrit alors « n.d. », ce qui
est exact. Un champ inventé donne un chiffre faux.

- `cibles`, `sorte: "registre"` : le périmètre des clients visés, que le
  portail compte au registre des entreprises. `naf` (codes au format
  `62.01Z`, vingt au plus), `tranches` (codes d'effectif de l'INSEE : `NN` non
  employeuse, `00` 0, `01` 1 à 2, `02` 3 à 5, `03` 6 à 9, `11` 10 à 19, `12` 20
  à 49, `21` 50 à 99, `22` 100 à 199, `31` 200 à 249, `32` 250 à 499, `41` 500
  à 999, `42` 1 000 à 1 999, `51` 2 000 à 4 999, `52` 5 000 à 9 999, `53`
  10 000 et plus), `departements` (treize au plus, seulement pour une
  organisation à zone de chalandise), `collectivites: true` pour les
  collectivités territoriales. Au moins un critère. À poser seulement quand le
  type de client se délimite par ces codes ; sinon omettre `cibles`.
- `cibles.libelle` (60 caractères, au pluriel, sans majuscule initiale) :
  **obligatoire dès que `cibles` est posé**. Il dit ce que l'on compte, dans les
  mots du client : « établissements hospitaliers », « entreprises de 50 à 499
  salariés ». Il doit décrire exactement les codes posés.
- `cibles`, `sorte: "declare"` : un nombre publié, avec sa `source` en
  `https://`. Jamais une estimation de la tâche.
- `offre` : le secteur de ceux qui vendent sur le segment. `naf` des
  concurrents, `departements`, et `texte` (un mot d'activité, pour les entrées
  et procédures du BODACC ; demande des départements).
- `depense` : dépense annuelle par cible, en euros hors taxes, `basse` et
  `haute`, avec la `source` publique en `https://` qui la porte. **Sans source
  publique, omettre** : pas de potentiel vaut mieux qu'un potentiel supposé.
- `marches_publics.cpv` : pour un segment qu'achètent des acheteurs publics, les
  codes CPV ou leur début, quatre à huit chiffres, dix au plus, les plus
  étroits possible (un code large ramène des marchés sans rapport).
- `presents` : les concurrents de la grille que le référentiel ou une lettre
  établit sur ce segment. Non établi : **omettre**, le portail le déduit des
  marchés publics puis des faits. `[]` seulement si une source établit qu'aucun
  concurrent suivi n'y est.
- `entites` et `familles` : les entités et les familles de la grille dont les
  faits comptent pour l'activité du segment, noms et numéros exacts de la
  grille. Toute offre en porte ; une niche porte ce qui la distingue de son
  offre, sinon rien.

## Poster et contrôler

`POST /api/veille/marches` `{ "slug", "segments" }`. Un refus 422 se corrige
point par point, d'après `refus` et `message`, et se renvoie complet, deux
reprises au plus ; au-delà, le dire dans la notification et passer à la suite.
`grille-absente` : la grille d'abord. `créée` : attendre une minute, puis
`GET /api/veille/marches?slug=<slug>` doit rendre le trimestre en cours dans
`périodes`, à l'état `propose`. S'il manque, le dire : l'opératrice relance la
mesure (`PATCH`, `action: mesurer`).

La notification « [Relecture] » dit : l'arbre posté (nombre de segments, les
offres), les segments laissés sans cibles ou sans dépense et pourquoi, et que
la publication se fait sur `/espaces/syntheses`. Rien n'est publié par la tâche.
