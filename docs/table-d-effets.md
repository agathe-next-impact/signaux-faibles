# La table d'effets de la simulation

16 novembre 2026, lot 3b des simulations de scénarios. Ce document fait foi pour
qui écrit une table d'effets : la revue trimestrielle, puis l'opératrice qui la
relit. Le format des routes est dans `docs/api-veille.md`, section « La
simulation ».

## Ce que c'est

L'écran « Simulation » de l'espace (`/[slug]/simulation`, rubrique « Stratégie »)
fait jouer au dirigeant une année en quatre trimestres. Trois sources, trois
natures :

| Ce que le jeu utilise | D'où cela vient | Qui l'écrit |
| --- | --- | --- |
| L'état de départ des piliers, le verdict et la concurrence de chaque segment | Mesures publiées de « Marchés et niches », forces du dernier trimestre publié, faits étiquetés | Le portail, par calcul |
| La fréquence de chaque événement et son dernier fait | Faits étiquetés des 26 dernières semaines | Le portail, par comptage |
| Ce qu'une action ou un événement fait bouger | **La table d'effets** | La revue trimestrielle, relue par l'opératrice |

La table d'effets ne porte donc **que des hypothèses**. Aucun chiffre mesuré n'y
figure : ni fréquence, ni probabilité, ni état de départ des piliers. La route
les refuserait de toute façon, elle ne les lit pas.

## Les quatre piliers

`marche`, `concurrence`, `environnement`, `alliances`. Des repères de 0 à 100,
sans unité. Aucun ne représente la trésorerie ou les équipes du client : la
veille ne les connaît pas, la table n'a pas à les inventer.

Leur point de départ est calculé :

- **Marché** : la part des crans d'engagement portés sur des segments « à
  pousser » ou « à disputer ».
- **Concurrence** : 100 moins l'intensité moyenne de la rivalité et des nouveaux
  entrants (cran 1 = 0, cran 2 = 50, cran 3 = 100) ; 50 sans force publiée.
- **Environnement** : la part des six dimensions PESTEL sans fait FORT sur
  l'historique.
- **Alliances** : 50, point neutre. La veille ne dit pas qui est du côté du
  client.

## Les trois parties de la table

### 1. Les engagements de départ

Un par segment de l'arbre des marchés où le client est, ou pourrait être,
présent. `cran` de 0 à 3 : absent, en test, offre établie, offre de référence.

Le cran est **déduit**, jamais demandé au client (décision du 16 novembre 2026).
`reference` cite la ligne dont il est déduit : la fiche de veille (niches,
thèmes), le §2 du référentiel, une position déclarative de la carte. Un segment
dont rien n'établit l'engagement **s'omet** : il reste hors du jeu, et l'écran
le dit.

### 2. Les actions

Ce que le dirigeant peut décider. Cinq gestes :

| Geste | Porte sur | Effet sur l'engagement |
| --- | --- | --- |
| `investir` | un segment déjà engagé (cran 1 ou 2) | un cran de plus |
| `tester` | un segment au cran 0 | passe au cran 1 |
| `retirer` | un segment engagé | retombe à 0 |
| `allier` | une partie prenante de la grille | alliance nouée, une fois |
| `option` | rien : une option de la matrice TOWS, une action transverse | aucun |

Chaque action porte un `cout` de 1 à 3 (le budget d'un trimestre est de 6, quatre
actions au plus), ses `effets` (un entier de −10 à +10 par pilier touché) et sa
`reference`. Le déplacement de l'engagement fait bouger de lui-même le pilier
Marché (la part de l'effort est recalculée) : l'effet écrit dans la table est ce
que l'action apporte **en plus**.

### 3. Les cartes d'événement

Une carte est une **catégorie de faits de la veille** :

- une famille de la grille (`famille`, et `veille` quand le numéro existe dans
  les deux veilles), au besoin restreinte à un `cadre` (une dimension PESTEL ou
  une force de Porter) ;
- ou `rupture: true`, la carte rare : tous les faits marqués en rupture.

Le portail compte le nombre de semaines où la veille a relevé un fait de la
catégorie. C'est le poids de la carte au tirage. Une carte jamais observée reste
hors du tirage ; sous douze semaines d'historique, aucune carte n'est tirée.
Une carte ne décrit donc jamais un événement que la veille ne suit pas.

## Une condition au plus par ligne

Une ligne peut porter une `condition` et des `effets_sous_condition`, qui
remplacent `effets` quand la condition est vraie. Trois états seulement :

- `engagement` d'un segment (0 à 3) ;
- `concurrents` présents sur un segment, tels que mesurés (une concurrence non
  mesurée ne rend jamais la condition vraie) ;
- `pilier` (0 à 100).

Comparaison `au-moins` ou `au-plus`. Exemple : un appel à projets rapporte
davantage quand le pilier Alliances est à 55 au moins.

## Les bornes, tenues par la porte

`contrôlerLaTableDEffets` (`lib/domaine/simulation.ts`) refuse la table entière
à la première ligne mal formée, et nomme chaque refus :

- 1 à 40 actions, 1 à 20 cartes, 30 engagements au plus ;
- clé en minuscules, chiffres et tirets, unique ; libellé de 60 caractères ;
  référence obligatoire, 120 caractères ;
- effets entiers de −10 à +10, sur les quatre piliers seulement ; une ligne bouge
  au moins un pilier ;
- un segment absent de l'arbre, une partie prenante ou une famille absente de la
  grille, une famille ambiguë sans veille : refusés.

La porte ne juge pas la justesse d'un effet. C'est le rôle de la relecture.

## Écrire une bonne table

1. Partir de l'arbre des marchés et de la matrice « Où porter l'effort » : une
   action `investir` ou `tester` par segment qui compte, un `retirer` pour un
   segment « à écarter » où le client est engagé.
2. Partir de la matrice TOWS du mois et de Mendelow : les `option` et les
   `allier`.
3. Partir des familles de la grille les plus actives : une carte par famille qui
   produit des faits, la carte `rupture` en plus.
4. Donner des effets modestes (1 à 4 pour le courant, 5 à 8 pour le rare). Un
   effet de 10 doit rester une exception.
5. Citer pour chaque ligne le fait daté ou la ligne du référentiel qui fonde
   l'hypothèse. Une ligne que rien ne fonde s'omet.
6. Ne rien écrire qui ressemble à une prévision : ni probabilité, ni échéance.

## Le circuit

1. La revue trimestrielle poste la table (`POST /api/veille/simulation`). Elle
   est **proposée**. La publication automatique ne s'y applique jamais.
2. L'opératrice la joue dans l'espace du client : sa session la voit sous un
   bandeau « aperçu ».
3. Elle publie sur `/espaces/syntheses`, section « Simulation ». Publier ouvre
   l'écran aux lecteurs du client et ajoute « Simulation » à leur rail ; c'est
   aussi ce qui tient lieu d'ouverture organisation par organisation
   (L'Hermitage et Konica Minolta France d'abord, décision du 16 novembre 2026).
4. « Retirer » referme l'écran aussitôt.

Si l'arbre des marchés ou la grille changent ensuite au point que la table nomme
un segment ou une famille disparus, elle n'est plus jouée : l'écran le dit, et
la revue la reposte.

## Ce qui n'est pas stocké

Les parties. La graine et les actions jouées tiennent dans l'adresse
(`?p=4821;0.3;1;;2`), la stratégie gardée pour la comparaison aussi (`?a=`). La
même adresse rejoue la même partie.
