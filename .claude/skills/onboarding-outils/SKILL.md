---
name: onboarding-outils
description: Rattrapage des écrans stratégiques d'une organisation dont la première lettre existe déjà — coche « Outils stratégiques », pose le drapeau du pilote et l'espace réorganisé, écrit et poste la grille, étiquette les lettres, poste la synthèse initiale, l'amorçage trimestriel et la fiche de veille, sans rien publier. À lancer par /onboarding-outils <organisation>.
argument-hint: "<nom de l'organisation, au statut 4, 5 ou 6>"
disable-model-invocation: true
allowed-tools:
  - "mcp__Notion__notion-fetch"
  - "mcp__Notion__notion-search"
  - "mcp__Notion__notion-query-data-sources"
  - "mcp__Notion__notion-update-page"
  - "mcp__Notion__notion-get-async-task"
  - "mcp__Gmail__send_message"
  - "Bash(curl *https://www.signauxfaibles.io/api/veille/*)"
  - "Agent"
---

**Aucune confirmation en cours d'exécution.** Lancer cette commande vaut ordre pour
toutes ses étapes : enchaîne-les sans demander de validation intermédiaire. Tu ne
t'arrêtes que sur les gardes écrites ci-dessous, et tu le dis dans le compte rendu.

Tu tiens le pipeline d'équipement des organisations du cabinet Signaux faibles.
Tu écris en français. Ce lancement est le **rattrapage des outils stratégiques** :
depuis le 10 novembre 2026, tous les écrans de l'espace sont alimentés pour tout
utilisateur créé (décision de l'opératrice), et il n'y a plus d'organisation hors
du pilote. Une organisation dont le portail répond `hors-pilote`, ou à qui il
manque la grille, les étiquettes, la synthèse ou la fiche de veille, se rattrape
ici. La première lettre fait normalement ces pas elle-même (point 5bis de
`/onboarding-premiere-lettre`) ; cette commande sert quand elle ne les a pas
faits, ou pour une organisation équipée avant cette règle.

Organisation visée : $ARGUMENTS

1. **Lis la règle.** Dans Notion : le « Prompt — Première lettre » de « Tâche —
   Onboarding d'une organisation (prompts A et B) »
   (`3d5fe829ce718112a40cfcaf55d3fd76`), passage « OUTILS STRATÉGIQUES » (pas s1 à
   s8) ; l'étape 4ter de « Tâche — Lettres de veille »
   (`3d5fe829ce718107af65f4fccf8089ab`) ; la section « SYNTHÈSE STRATÉGIQUE » (S.0 à
   S.8, dont S.7 pour l'amorçage trimestriel) de « Tâche — Revue mensuelle des référentiels »
   (`3d5fe829ce71819ba0d0ce67d742d652`) ; la « GRILLE STRATÉGIQUE » du prompt
   « Référentiel de veille » (`3d2fe829ce71801eae49fa7fc4a0e76c`). Les formats des
   routes sont dans `docs/api-veille.md` (« Outils stratégiques »). Si une page est
   inaccessible, n'écris rien et arrête-toi.

2. **Un nom est obligatoire.** Trouve la ligne du registre
   (`collection://4ae154b9-0bca-42f3-9e2e-e546a40dd77f`), accents et casse
   ignorés ; aucune ou plusieurs : n'écris rien, dis-le, arrête-toi. Statut 4, 5
   ou 6, et au moins une édition trouvée par la **relation** Organisation : avant
   la première lettre, renvoie à `/onboarding-premiere-lettre`.

3. **État des lieux**, sans en-tête `Authorization`, toujours sur
   `https://www.signauxfaibles.io`, `curl -sS -m 60` :
   `GET /api/veille/grille?slug=<slug>`, `GET /api/veille/faits?slug=<slug>&debut=<J-99>&fin=<J>`,
   `GET /api/veille/syntheses?slug=<slug>&periode=<mois courant, AAAA-MM>`,
   `GET /api/veille/syntheses?slug=<slug>&periode=<trimestre civil courant, AAAA-Tn>`
   et `GET /api/veille/fiche?slug=<slug>`. Ne refais que ce qui manque : une grille
   « lue » et validée, des faits déjà étiquetés, une synthèse ou une fiche « lue »
   ne se repostent pas.

4. **Rattrape, dans cet ordre.** Aucun de ces pas ne touche aux lettres ni
   n'envoie quoi que ce soit au client.
   - **Case et drapeaux** : coche « Outils stratégiques » au registre ;
     `PATCH /api/veille/organisations` `{ "slug", "action": "outils", "actif": true }`
     puis `{ "slug", "action": "espace", "actif": true }`.
   - **Grille** : si le référentiel concurrentiel n'a pas de section « Grille
     stratégique », écris-la après le §2 (deux axes tirés des variables du §2,
     chaque famille des deux référentiels rattachée à une lettre PESTEL ou à une
     force avec son nom court, toutes les entités des deux §2 et celles que les
     lettres nomment, 8 à 15 parties prenantes, offres en liste de noms), pose un
     renvoi d'un paragraphe dans le référentiel écosystème, et note-le au journal
     des deux (« décidé par l'onboarding »). La veille « concurrentiel » d'une
     entité est réservée aux concurrents ou aux entreprises suivies ; un grand
     compte, un client, un donneur d'ordre, un opérateur public ou une
     institution se déclare en « ecosysteme » : l'écran « Concurrents » et le
     benchmark des indicateurs ne montrent que la veille « concurrentiel »
     (10 novembre 2026). `POST /api/veille/grille`, puis
     **valide toi-même** la version (`PATCH /api/veille/grille`) : aucun point de
     validation pour la grille (décision du 2 novembre 2026).
   - **Étiquettes** : pour chaque édition non étiquetée, l'étape 4ter telle
     qu'elle est écrite. La `source` d'un fait est l'adresse telle que le portail
     la lit : Notion réencode certaines adresses (un « + » devient un espace) ;
     `POST /api/veille/courriel` avec `sorte: "lettre"` et **sans** `brouillon`
     rend le HTML où la lire, sans rien déposer. Pour une organisation aux
     nombreuses éditions, lance plutôt le workflow `taches.yml` (`tache:
     etiquetage`, `organisation: <slug>`).
   - **Synthèse initiale** : S.4, période = le mois courant, fenêtre = les cent
     jours qui finissent aujourd'hui, mode « initial » si aucune synthèse
     n'existe. Positions déclaratives seulement pour les organisations que S.4
     nomme.
   - **Amorçage trimestriel** (10 novembre 2026, décision de l'opératrice : les
     écrans « Forces du marché », « Scénarios » et « Indicateurs » portent de
     l'information dès les premières lettres). Seulement si le `GET` du trimestre
     courant répond `aucune` : jamais par-dessus la synthèse d'une revue
     trimestrielle. Une seconde synthèse, `"periode": "AAAA-Tn"`, `"mode":
     "trimestriel"`, même fenêtre que la synthèse du mois. Elle reprend tels quels
     le PESTEL, la SWOT, le TOWS, la carte et Mendelow de la synthèse du mois (tout
     « nouveau », sans filiation) et y ajoute, selon S.7 : les cinq forces (cran
     et tendance lus dans les faits étiquetés à la force, `nonSuivi` pour une
     force de `forcesNonSuivies`), trois scénarios sur Q3 (2 à 4 indicateurs
     datables chacun, aucune probabilité), et les deux interprétations des
     chiffres que rend `GET /api/veille/calculs?slug=<slug>&fin=<J>&departements=…&texte=…`
     (départements et premier texte d'activité de la famille « Nouveaux
     entrants », repris dans `"cycle"` ; sans cette famille, ni `cycle` ni
     interprétation de l'indice). Aucun chiffre qui n'y figure pas. Pas de matrice
     GE : l'avertissement `ge-absente` est attendu au quatrième trimestre. Une
     force portée par une famille mais sans fait étiqueté dans la fenêtre cite le
     fait de la fenêtre qui la documente le mieux, au cran 1 « contenue »,
     tendance « stable » ; s'il n'en existe aucun, ne poste pas l'amorçage et
     dis-le. La revue trimestrielle ordinaire postera la même période et le
     remplacera.
   - **Fiche de veille** : S.8, `POST /api/veille/fiche` avec la version de la
     grille. Une présentation par nom de la grille, l'organisation exceptée.
   Un refus 422 se corrige point par point et se renvoie complet, deux reprises
   au plus ; au-delà, consigne-le et passe au pas suivant.

5. **Contrôle** : les cinq `GET` du point 3 rendent « lue » (grille avec
   `validéeLe`) et un nombre de faits non nul. Écris dans « Dernier lancement
   manuel » : « outils stratégiques rattrapés le JJ/MM : grille vN, N faits,
   synthèses AAAA-MM et AAAA-Tn (amorçage) et fiche vN proposées ».

6. **Notification `[Relecture]`** à agathe@signauxfaibles.io : ce qui a été
   posté, le « texte » de chaque synthèse tel que le rend le `GET` (celle du
   trimestre présentée comme un **amorçage** : bâtie sur les premières lettres,
   ses scénarios sont des hypothèses de départ), et ce qui reste à l'opératrice
   sur `/espaces/abonnements/<slug>` : publier les deux synthèses et la fiche de
   veille. Tu ne publies rien toi-même.

Aucun jeton à manipuler : n'en écris jamais dans une commande. 401 ou 403 : la
session n'a pas le secret réseau pour ce chemin, dis-le en tête du compte rendu.
