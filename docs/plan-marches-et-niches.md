# Marchés et niches : plan

12 novembre 2026. Demande de l'opératrice : renforcer l'étude concurrentielle,
détecter les tendances des marchés et l'évolution des niches (apparition,
modification, régression, disparition), et mesurer un potentiel de marché, par
niche et de façon globale. Pilote sur Konica Minolta France.

## 1. Constat de départ

Lecture du code et des données de production (L'Hermitage, Konica) le
12 novembre 2026.

- **Une niche** existait déjà : `fiches_de_veille.contenu.niches`, douze lignes
  au plus, un énoncé et un signal de 120 caractères, écrites par la revue
  mensuelle et montrées sur `/[slug]/veille/calendrier`. Aucun fait n'y était
  rattaché : le signal restait du texte, jamais compté ni daté.
- **Un marché** n'était pas un objet. Le mot couvrait la rubrique « Le marché »
  (concurrents, Mendelow, forces), `grilles.offres` et la matrice GE (un cran
  d'attractivité posé par le modèle, au seul T4), l'indice de cycle (BODACC) et
  le benchmark (comptes publiés). Aucune mesure de taille, de croissance ni de
  demande.
- Les faits étiquetés portent déjà la famille, l'axe, l'entité et l'impact.
  Les registres publics (Recherche d'entreprises, BODACC) sont déjà branchés
  dans `lib/registres/`, sans clé.

## 2. L'idée : un seul objet, le segment

Un marché, une offre et une niche sont la même chose à trois échelles : un
groupe d'acheteurs, délimité par un périmètre. L'organisation déclare un
**arbre de segments** : le marché à la racine, ses offres en dessous, les
niches en feuilles ; trois niveaux, jamais plus.

Un segment porte :

| Champ | Rôle |
|---|---|
| `clé`, `libellé` (40 caractères), `parent` | l'identité et la place dans l'arbre |
| `cibles` | qui achète : un périmètre compté au registre (codes NAF, tranches d'effectif, départements, collectivités), ou un nombre déclaré avec sa source |
| `offre` | qui vend : codes NAF des offreurs, texte d'activité et départements pour le BODACC |
| `dépense` | hypothèse de dépense annuelle par cible, en fourchette, avec sa source |
| `présents` | les concurrents de la grille présents sur le segment ; absent = non renseigné, liste vide = segment ouvert |
| `entités`, `familles` | les entités et familles de la grille dont les faits comptent pour l'activité du segment |

Tout le reste en découle.

- **Mêmes mesures à chaque échelle**, calculées par le portail chaque
  trimestre : cibles, potentiel (cibles × dépense, en fourchette), offre en
  place (offreurs au registre, concurrents présents et leurs comptes publiés),
  dynamique (créations et procédures collectives au BODACC), activité (faits de
  la veille). Le potentiel global se lit à la racine : la somme des offres
  chiffrées.
- **Cycle de vie calculé, jamais déclaré ni stocké** (comme l'étape du parcours
  d'essai) : `apparu` à la première mesure ; `en_croissance` sur une hausse ;
  `en_regression` sur deux baisses de suite ; `eteint` sans fait ni cible sur
  deux trimestres ; `stable` sinon. Une **modification** est un changement de
  périmètre sous la même clé : la série repart et rien n'est comparé. Une
  **disparition** est un segment mesuré au trimestre précédent et retiré de
  l'arbre : l'écran le dit.
- **L'étude concurrentielle devient « qui occupe quel segment »** : concurrents
  présents par segment, chiffre d'affaires cumulé lu par le benchmark, segments
  ouverts.
- **Aucun chiffre ne vient d'un modèle.** La route ne reçoit que des segments et
  un geste. Un registre muet vaut n.d. ; un compte au plafond du registre
  (10 000) ne donne pas de potentiel ; chaque limite est écrite avec la mesure.

Seuils (`lib/domaine/marches.ts`) : un écart de taille compte à partir de 5 % ;
à taille égale ou absente, l'activité départage à partir d'un quart et de deux
faits d'écart.

## 3. Ce qui est livré (étapes 1 et 2)

| Pièce | Fichier |
|---|---|
| Types, porte, assemblage d'une mesure, état calculé, vue | `lib/domaine/marches.ts` |
| Tables `segments_de_marche`, `mesures_de_marche` (migration 0026) | `lib/base/schema.ts`, `lib/base/marches.ts` (seul écrivain) |
| Comptage d'un périmètre au registre | `compterLesEntreprises`, `lib/registres/index.ts` |
| Orchestration : recevoir, mesurer, publier, lire pour l'écran | `lib/portail/marches.ts` |
| Route des tâches | `app/api/veille/marches/route.ts` (`docs/api-veille.md`) |
| Écran « Marchés et niches », rubrique « Le marché » | `app/(portail)/[slug]/marches/page.tsx` |

Écart au plan annoncé dans le fil : les segments ne sont pas un champ de la
grille mais leur propre table versionnée. Reposter la grille de Konica, validée
le 10 novembre, aurait créé une version et remis sa validation en jeu ; les
mesures, elles, ne sont pas rangées dans `elements_synthese`, parce qu'une ligne
proposée dans un trimestre publié aurait caché toute la synthèse au client
(`dernièreSynthèsePubliée` exige une période entièrement publiée). Deux tables
donc, au lieu d'une, et rien de l'existant n'est touché.

Rattachement des faits : par règle, sans modèle. Un fait compte pour un segment
si son axe est une des familles du segment (même veille), ou s'il nomme une de
ses entités. Les faits déjà étiquetés comptent donc dès le premier calcul, sans
ré-étiquetage.

Publication : les mesures d'un trimestre naissent `propose` ; l'opératrice les
publie (`PATCH`, `etat: publie`) ; une période publiée ne se recalcule pas, la
retirer d'abord. L'écran ne lit que le publié, dans une lecture bornée, par le
registre de la session (règle 2), et répond 404 hors de l'espace réorganisé.

Frontières tenues par `tests/architecture.test.ts` : un écrivain par table, la
porte avant l'écriture, `compterLesEntreprises` appelé par la seule
orchestration, aucune mesure acceptée de l'appelant, l'écran sans appel aux
registres.

## 4. Pilote Konica Minolta France

Dix-sept segments préparés (fichier `marches-et-niches/konica-segments.json`
des fichiers du projet, hors dépôt) : le marché, les cinq offres de la grille,
onze des douze niches de la fiche publiée (« Se situer dans les baromètres »
est un besoin d'avant-vente, pas un segment d'acheteurs).

Calcul à blanc du 12 novembre 2026 sur les registres réels et les 81 faits du
quatrième trimestre : la porte accepte les dix-sept segments ; sept périmètres
se comptent (de 850 imprimeurs de dix salariés et plus à 8 680 établissements
de santé) ; trois dépassent le plafond du registre (les entreprises de 200
salariés et plus, les PME de 50 à 249 salariés) et demandent un nombre déclaré
avec sa source ; aucun potentiel en euros tant qu'aucune hypothèse de dépense
n'est posée.

Mise en service, après fusion et déploiement (la migration s'applique au
build) :

1. `POST /api/veille/marches` avec les segments de Konica.
2. `PATCH` `{ periode: "2026-T4", action: "mesurer" }`.
3. Relecture par l'opératrice (`GET`), puis `PATCH` `{ etat: "publie" }`.

Restent à l'opératrice ou à la revue : les hypothèses de dépense par cible, avec
leur source ; les nombres déclarés pour les trois périmètres plafonnés ; la
présence des concurrents sur les niches où elle n'est pas renseignée.

## 5. Suite

- **Étape 3, demande révélée** : commande publique (DECP, BOAMP), montants par
  segment et marchés gagnés par concurrent. Seule source nouvelle prévue.
- Le calcul trimestriel dans la revue (appel de `mesurer` avec la synthèse du
  trimestre), et la consigne correspondante dans la page Notion de la revue.
- Le bouton « Publier » des mesures sur `/espaces/syntheses`.
- Un rattachement explicite d'un fait à un segment par l'étiquetage, pour les
  niches qu'aucune famille ni entité ne délimite.
- La matrice GE calculée (attractivité depuis le potentiel et la dynamique),
  une fois deux trimestres mesurés.
- URSSAF, France Travail, INPI : seulement si un besoin précis les justifie.

## 6. Limites connues

- Le potentiel est un ordre de grandeur : sa valeur tient aux hypothèses
  affichées et à son évolution d'un trimestre à l'autre.
- Le registre compte des entreprises, pas des établissements ni des budgets ;
  il plafonne à 10 000 résultats.
- Le chiffre d'affaires cumulé des présents est celui de leurs comptes publiés,
  toutes activités confondues, pas leur chiffre sur le segment.
- Le stock du registre est lu au jour du calcul : la mesure d'un trimestre passé
  ne se reconstitue pas après coup.
- Toutes les niches ne se délimitent pas par des codes : pour elles, l'écran
  montre l'activité et la présence, et « n.d. » pour le potentiel.
