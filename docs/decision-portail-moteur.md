# Décision d'architecture : le portail devient le moteur du dispositif

*Proposée le 15 octobre 2026 (action 8 du plan de travail du 14 octobre), **validée par la propriétaire du dispositif le 16 octobre 2026**. Les amendements de `CLAUDE.md` indiqués en fin de document sont appliqués avec le palier 1a (base Postgres, migration de la base Accès en double lecture).*

## Ce qui est décidé

1. **Le portail a une base de données** (Postgres sur Vercel, ou Neon, via Drizzle). Elle porte l'**état** du dispositif : organisations, veilles, lecteurs, demandes, travaux, envois, abonnements, sources, runs. Le schéma est dans `docs/schema-donnees.md`.
2. **Notion reste l'éditeur des documents** : pages de référentiel, pages de lettre, base Validations. Le portail continue de les lire en cache, et **n'écrit toujours jamais dans Notion**. Les écritures Notion (page Édition, journal du référentiel, points de validation) restent faites par les tâches Claude, après que le portail a validé et accepté le résultat.
3. **Le portail est le seul endroit où l'état existe.** Le registre Notion « Organisations, pipeline et activation » et la base « Accès, portail » sont migrés, puis gelés, puis supprimés. Les statuts, cases ▶, « Veille automatique », « Activée le », « Dernier lancement manuel » n'ont plus de pendant Notion.
4. **Le moteur cognitif reste sur l'abonnement Max** (décision du 14 octobre au soir). Les runs lourds (référentiel, lettres, revue) sont exécutés par une tâche Claude planifiée unique, « Runs de veille », qui lit une **file de travaux** servie par le portail (`GET /api/veille/travaux`) et poste des **résultats structurés** (`POST /api/veille/resultat`). Le portail assemble le contexte, sert le prompt, applique les portes (lint, vocabulaire, citations), écrit le journal, déclenche les envois. Le modèle ne calcule plus de date, ne filtre plus de file, ne décide plus d'un statut, ne copie plus un identifiant.
5. **Les prompts métier sont versionnés dans le dépôt** (`prompts/`), servis à la tâche avec chaque travail. Les pages de prompt Notion sont archivées à la fin du palier 3.
6. **Stripe est la seule source de vérité de l'abonnement**, lue en cache et invalidée par son webhook ; le portail la recopie dans `abonnements` pour ses propres décisions, jamais ailleurs.
7. **Les portes de qualité sont mécaniques et bloquantes** ; l'alerte admin remplace la validation humaine, elle ne l'imite pas. La liste des ruptures bloquantes est une décision à part (avant le 4 décembre).

## Pourquoi

L'audit du 14 octobre montre que la vingtaine d'incidents silencieux de septembre a une seule forme : un état représenté plusieurs fois, calculé par le modèle au lieu d'être lu, dans un outil (Notion) dont l'API n'expose ni les formules, ni l'unicité, ni les transactions. Le palier 1 du 17 septembre a mis en code la sélection, les numéros et le lint, mais à périmètre constant : le portail ne pouvait ni tenir un état ni déclencher quoi que ce soit, et il est resté injoignable des tâches pendant 23 jours sans que rien ne casse visiblement.

Le parcours client cible (demande par URL, génération sans validation, lettres J+7, J+14, J+21, abonnement Stripe, envoi hebdomadaire sans relecture) exige cinq choses que ni Notion ni le portail actuel ne tiennent : un état par organisation lisible par le code, un chemin d'écriture, des portes mécaniques, un déclenchement par événement, une capacité de production indépendante d'une session interactive. Une base de données au portail répond aux cinq. L'alternative (garder les tâches comme moteur, écrire l'état dans de nouvelles propriétés Notion) laisse en place la cause des incidents.

## Ce que cela ne change pas

- Le cloisonnement par organisation (règle 2 de `CLAUDE.md`) : il se fait toujours dans le code, avant tout appel caché, sur un identifiant qui vient de la ligne de la personne connectée. Postgres remplace la base Accès comme source de cet identifiant, et la contrainte d'unicité remplace le contrôle « exactement une ligne ».
- La lecture Notion exclusivement en cache (règle 1), le filtre `Statut = Envoyé` (règle 3), le mode dégradé (règle 4), le proxy des médias (règle 5), les trois niveaux d'impact (règle 6), l'étanchéité du HTML (règle 7), le lien magique (règle 8), la charte (règle 9).
- L'interdiction d'écrire dans Notion depuis le portail.
- Le partage des secrets : le secret HMAC et les clés Stripe ne quittent jamais le portail ; les tâches n'ont que le jeton des routes `/api/veille/*`.

## Ce qui change dans `CLAUDE.md` une fois la décision validée

- « Le portail n'a **pas de base de données** » est retiré ; remplacé par : « Le portail a une base Postgres qui porte l'état du dispositif (`docs/schema-donnees.md`) ; Notion porte les documents. Toute lecture ou écriture Postgres passe par `lib/base/`, jamais depuis un composant ; `tests/architecture.test.ts` le vérifie. »
- La section « Modèle de données (bases Notion) » ne décrit plus la base Accès comme contrat ; elle renvoie au schéma Postgres pour l'état, et garde Éditions comme seule base Notion lue par le portail.
- La règle « les routes `/api/veille/*` servent le dispositif » s'étend : elles servent aussi la file de travaux et reçoivent les résultats ; chaque route d'écriture a sa propre portée de jeton.
- « Deux lettres par parution et par organisation » devient « N lettres, une par veille » ; la propriété `Famille` à deux valeurs disparaît au profit de la table `veilles`.

## Ce qui reste à décider séparément

| Décision | Avant le |
|---|---|
| Prix, période d'essai, contenu de la lettre tronquée | **décidé le 17 octobre 2026**, voir « L'offre » ci-dessous |
| Premier client en envoi par le portail | 20 novembre |
| Liste des ruptures bloquantes | 4 décembre |
| Premier client sans relecture | 18 janvier |

## L'offre (décidée par Agathe le 17 octobre 2026)

| Point | Décision |
|---|---|
| Prix | **149 € HT par mois** ou **1 490 € HT par an** (deux mois offerts), par organisation, depuis le **23 octobre 2026** ; 89 € et 890 € HT auparavant. TVA applicable (20 %) : 178,80 € TTC par mois, 1 788 € TTC par an. Le montant facturé est celui des prix Stripe (`STRIPE_PRIX_MENSUEL`, `STRIPE_PRIX_ANNUEL`) : un prix Stripe ne se modifie pas, il faut en créer deux nouveaux et changer les deux variables ; les abonnés existants gardent leur prix tant qu'on ne les migre pas |
| Ce que couvre l'abonnement | une organisation, **deux veilles**, **trois lecteurs actifs au plus** |
| Quatrième lecteur | **refusé par le portail** : `POST /api/veille/lecteurs` répond `plafond-atteint` (409), à la création comme à la réactivation. Pour ajouter quelqu'un, on en révoque un autre. L'opérateur global n'entre dans le plafond d'aucun client |
| Période d'essai | **deux parutions complètes**, à J0 et J+7, depuis le **24 octobre 2026** ; trois auparavant (J0, J+7, J+14). Défaut de `organisations.parutions_d_essai` (migration 0011) et `PARUTIONS_D_ESSAI` ; les organisations créées avant gardent le nombre qu'elles portent, réglable une par une par l'opératrice |
| Après l'essai, sans abonnement | la semaine suivante (J+14 depuis le 24 octobre 2026, J+21 auparavant), la parution est **réduite à « L'essentiel »** de chaque lettre, avec une invitation à s'abonner ; au-delà, l'espace est suspendu |
| Compte Stripe | créé par Agathe avec Claude au moment de construire le palier 1c, en mode test d'abord |

Les clients historiques (L'Hermitage, Dalious, Konica Minolta, Infralliance) restent hors Stripe : ils sont `abonnee` sans ligne `abonnements`, et le parcours d'essai ne s'applique pas à eux. L'Hermitage compte aujourd'hui deux lecteurs actifs, les trois autres un seul : aucun ne dépasse le plafond.

« L'essentiel » est la rubrique que le contrat de forme borne à huit lignes de 140 caractères (étape 3, point 5, de « Tâche — Lettres de veille »), et que le validateur contrôle déjà (`essentiel-absent`, `essentiel-trop-long`). La lettre tronquée ne demande donc aucune écriture nouvelle : le portail n'en rend que cette rubrique.

## Risque principal et parade

Si l'autorisation de sortie réseau vers `www.signauxfaibles.io` n'est pas accordée aux sessions planifiées, la tâche « Runs de veille » ne peut pas lire la file ni poster ses résultats : cette architecture ne démarre pas. C'est le prérequis absolu du palier 2, à lever au palier 0. Sans lui, la seule alternative est d'appeler le modèle depuis le code (API), ce qui change le modèle de coût, pas le modèle de données : la file de travaux et `POST /api/veille/resultat` sont conçues pour servir indifféremment l'un ou l'autre exécuteur.
