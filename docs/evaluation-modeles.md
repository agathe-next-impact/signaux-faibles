# Évaluer les modèles sur de vraies lettres, sans toucher aux comptes

*Créé le 22 octobre 2026. Décision du même jour : les lettres de test sont
produites par l'API (Opus 5.5 par défaut, Sonnet 5.5 sur demande), deux par organisation pour
Konica Minolta et Infralliance (périmètre réduit le même jour ; L'Hermitage et
La petite vitrine restent exportées et se lancent par `--organisation`), sans
aucune trace dans Notion, et envoyées une par une à agathe@signauxfaibles.io avec un
sujet préfixé « [TEST] ». L'objectif derrière la mesure : savoir ce qui manque
pour évacuer la relecture.*

## Décisions du 22 octobre 2026, après la première série

Quatre lettres de test produites (Opus 5.5 sur Infralliance Écosystème,
Infralliance Positionnement et Konica réglementation, Sonnet 5.5 sur Infralliance
Positionnement), toutes conformes au validateur, aucune source citée sans avoir
été lue, 5 à 7 $ la lettre. La propriétaire a tranché trois choses à la lecture.

1. **Rien du rapport de collecte dans ce que le client lit.** Ni note de
   méthode, ni sources ouvertes ou non ouvertes, ni requêtes non lancées, ni
   réserves, ni rubrique « Ce qui a été vérifié », dans les lettres comme dans
   les référentiels livrés. **Le bloc « Ajustements du cadrage » disparaît
   aussi** de la lettre ; les propositions vont dans la propriété « Amendements
   au référentiel ». Le validateur ne tient plus `cadrage-absent` pour une
   rupture ; il avertit `cadrage-présent` et `collecte-dans-la-lettre` tant que
   la tâche de production n'est pas alignée. Le script d'évaluation demande au
   modèle un troisième bloc, `<collecte>`, écrit dans `collecte.md` pour
   l'opératrice et jamais envoyé. **La page Notion « Tâche Lettres de veille »
   (étape 3, contrat de forme, points 2 et 4, rubriques 2, 12 et 13 du §6) reste
   à amender** ; le portail n'écrit pas dans Notion, cet amendement se fait à la
   main ou par une tâche.
2. **Opus pour les référentiels et les lettres.** Le script ne lance plus Sonnet
   par défaut ; `--modele sonnet` reste possible pour mesurer.
3. **L'écart de qualité avec le dispositif actuel est net**, et il s'explique :
   la tâche de production tourne dans l'agent Claude Code pendant une heure,
   avec un navigateur pour les sources fermées, la boîte Gmail de relecture, la
   base « Extraits fournis », un fichier de grille de collecte et des
   sous-agents ; le script d'évaluation n'a que la recherche et la lecture web
   côté serveur, deux ou trois tours, et des canaux déclarés « non consultés ».
   La lettre Konica (7 faits, 8 pages lues) en est la mesure. La conclusion est
   dans la réponse du 22 octobre : reproduire la qualité demande le même
   harnais (Claude Agent SDK, mêmes outils, mêmes compétences), dont le coût
   par lettre à l'API est à mesurer avant toute décision d'architecture.
4. **Les propositions du 22 octobre sont appliquées** (« Applique ces
   propositions ») : la collecte des sources nommées se fait en code avant le
   modèle (conception `hybride`, navigateur de repli, détection de changement
   d'un gel à l'autre) ; les portes de collecte sont mécaniques (grille rendue en
   JSON, couverture des sources nommées mesurée sur les URL réellement lues,
   nombre minimal de faits datés, relances dans la même conversation) ; le
   système et le dossier sont mis en cache une heure ; et une variante **agent
   complet** (`pnpm evaluation:agent`, Claude Agent SDK) reproduit le poste de
   travail de la tâche Cowork, facturé à l'API. La série suivante compare ces
   variantes sur une seule lettre, voir « Prochaine série » plus bas.

## Ce que le script fait, et ce qu'il ne touche pas

`pnpm evaluation:lettres generer` produit des lettres hors du dispositif :

- il lit `evaluation/entrees/` (dossier ignoré par git) : les référentiels, la
  fiche organisation, les trois dernières éditions publiées et la dernière
  lettre de chaque veille, exportés une fois depuis Notion en lecture seule, et
  la page Notion « Tâche Lettres de veille » ;
- il applique le prompt de production, étapes 1 à 3 (collecte, autocontrôle,
  tri, rédaction), recopiées telles quelles ; les étapes que le portail ou
  Notion tiennent (sélection du jour, publication, lint, référentiels, envoi)
  sont remplacées par le script, qui donne au modèle le numéro, la période et
  les dernières éditions ;
- il appelle l'API Anthropic avec la clé d'une organisation d'évaluation à part,
  lue dans `EVALUATION_API_KEY` (ou, sur un poste, `ANTHROPIC_API_KEY`), en
  ignorant `ANTHROPIC_BASE_URL` : un run ne part jamais sur le quota d'une
  session Claude Code ni sur l'abonnement Max. Le nom `EVALUATION_API_KEY` n'est
  pas un choix : un environnement cloud de Claude Code refuse une variable
  nommée `ANTHROPIC_API_KEY` (« ne sera pas utilisé pour authentifier les
  requêtes, les sessions sont authentifiées via votre compte »), et un secret
  réseau ne peut pas couvrir api.anthropic.com, hôte que le mandataire des
  sessions ne traite pas (constaté le 22 octobre 2026) ;
- il valide chaque lettre avec le validateur de production
  (`contrôlerLaLettre`), après conversion du Markdown en blocs Notion
  (`lib/domaine/markdown.ts`, le pont dont le moteur de l'étape 1 aura besoin) ;
- il met en forme le courriel au gabarit de la charte (`composerLettre`) et
  écrit tout dans `evaluation/sorties/<horodatage>/`.

Il n'écrit jamais dans Notion, n'appelle pas le portail, n'ouvre pas Postgres
et n'envoie rien : l'envoi des courriels se fait depuis la session Claude Code,
par le connecteur Gmail, une fois les fichiers produits.

`pnpm evaluation:agent` partage tout cela (entrées, prompt, portes, validateur,
gabarit, rapport) et change une seule chose : le modèle ne répond plus à un
appel de l'API Messages, il tourne dans une session Claude Code lancée par le
SDK Agent, avec un espace de travail sur disque où le dossier est posé en
fichiers, la lecture et l'écriture de fichiers, la recherche web, la lecture
d'une page et le navigateur de la session (`scripts/lire-page.mjs`). Le code
lui refuse tout le reste, dans un crochet `PreToolUse` et dans `canUseTool` :
écrire hors de son espace, lancer une autre commande, lire une adresse du
portail. La session enfant reçoit un environnement sans rien de la session qui
la lance (ni compte, ni jeton, ni `ANTHROPIC_BASE_URL`), seulement
`ANTHROPIC_API_KEY` posée depuis `EVALUATION_API_KEY` ; le script vérifie à
l'ouverture que la session s'annonce authentifiée par cette clé et s'arrête
sinon avant tout appel. Un plafond de dépense par lettre (`--budget`, 40 $ par
défaut) arrête l'agent net.

## Quatre conceptions mesurées

| Conception | Ce que fait le modèle | Ce que fait le code | Mesure d'hallucination |
|---|---|---|---|
| `agentique` (défaut) | cherche et lit le web avec les outils serveur de recherche et de lecture, 60 recherches et 90 lectures au plus | donne le dossier, relance les tours (`pause_turn`), relève les URL réellement lues, mesure les portes et relance | une URL citée dans la lettre qui n'a pas été lue par l'outil pendant le run |
| `hybride` (22 octobre 2026) | reçoit les extraits gelés des sources nommées, lit en priorité celles marquées `changee=oui`, garde la recherche et la lecture web (40 et 60 au plus) pour les requêtes types, les dossiers et les nouveautés | ouvre avant le modèle chaque URL nommée par le référentiel (80 au plus, 6 en parallèle, 20 s), avec le navigateur de la session pour celles qui répondent 403, 503 ou vide (`--navigateur`, automatique si le Chromium est présent), gèle 6 000 caractères par source dans `evaluation/sources/<org>/<veille>/<date>/` et marque ce qui a changé depuis le gel précédent | une URL citée ni dans les extraits ouverts ni lue par l'outil |
| `pipeline` | rédige en un appel, sans outil, à partir des mêmes extraits gelés | la même collecte ; aucune relance possible sur les sources, seulement sur la fenêtre | une URL citée absente des extraits ouverts |
| `agent` (`pnpm evaluation:agent`) | travaille comme la tâche Cowork : lit son dossier en fichiers, cherche, lit, ouvre au navigateur, tient `grille.md`, écrit `reponse.md` | pose le dossier dans un espace de travail, borne les outils, lit les URL ouvertes dans la transcription, mesure les portes et relance la même session | une URL citée qui n'apparaît dans aucun appel d'outil réussi de la transcription |

**Les portes de collecte** sont les mêmes pour les quatre. Le modèle rend un
bloc `<grille>` en JSON (type, nom, URL, état, date, raison par source et par
requête). Le script ne le croit pas sur parole : il compte les sources nommées
du référentiel dont l'URL a été réellement ouverte pendant le run (outil,
extrait gelé à l'état ouvert, ou appel d'outil réussi de l'agent), et les faits
datés hors encadrés de la lettre, par le parseur de production. En dessous de
`--couverture` (0,8) ou de `--faits-min` (6), ou sans grille lisible, il renvoie
au modèle la liste précise des sources sans lecture prouvée et lui demande de
reprendre la collecte, fenêtre élargie à quatorze puis vingt et un jours, avant
de rendre une nouvelle réponse complète ; `--relances` (2) borne le nombre de
reprises. Une source qui refuse toujours la lecture reste « non ouverte » avec
sa raison : la porte mesure l'effort, pas le résultat d'un site fermé.

**Le cache d'une heure** porte sur le système (préambule et étapes 1 à 3) et
sur le bloc statique du dossier (fiche, référentiel, dernières éditions,
dernière lettre) : un second run de la même lettre dans l'heure, ou une relance,
relit ces 100 000 à 180 000 caractères au dixième du prix.

Les repli automatiques en cas de refus (`fallbacks`) ne sont pas activés : un
refus est une donnée de l'évaluation, enregistrée dans `reponse.json`
(`stopReason`, `modèleServi`).

## Lancer

```bash
# Konica Minolta et Infralliance (défaut), les deux veilles, Opus 5.5, agentique : quatre lettres
# (dans une session cloud, la clé est la variable d'environnement EVALUATION_API_KEY)
EVALUATION_API_KEY=… pnpm evaluation:lettres generer

# un sous-ensemble, ou une autre conception
pnpm evaluation:lettres generer --organisation petite-vitrine --veille ecosysteme --modele sonnet
pnpm evaluation:lettres generer --conception hybride --navigateur --parallele 2
pnpm evaluation:lettres generer --conception pipeline --effort medium

# les portes de collecte, par défaut 80 % des sources nommées, 6 faits datés, 2 relances
pnpm evaluation:lettres generer --couverture 0.9 --faits-min 8 --relances 3

# l'agent complet (Claude Agent SDK), Konica par défaut, les deux veilles, 40 $ de plafond par lettre
EVALUATION_API_KEY=… pnpm evaluation:agent
pnpm evaluation:agent --veille ecosysteme --budget 30 --max-tours 300

# vérifier l'assemblage des prompts sans appel ni clé
pnpm evaluation:lettres generer --a-blanc
pnpm evaluation:agent --a-blanc

# rejouer validation, rendu et rapport sur une sortie existante
pnpm evaluation:lettres valider --sortie evaluation/sorties/<horodatage>
```

### Prochaine série : une lettre, trois façons

Décidée le 22 octobre 2026 pour mesurer l'écart de qualité et son coût sur une
seule lettre plutôt que sur huit : **Konica Minolta, veille réglementation
(`ecosysteme`)**, produite trois fois la même semaine, à relire à l'aveugle
avec la grille de `rapport.md`.

```bash
# 1. le script corrigé des règles éditoriales, collecte par le modèle
pnpm evaluation:lettres generer --organisation konica --veille ecosysteme --conception agentique

# 2. le script avec collecte en code pour les sources nommées, navigateur de repli
pnpm evaluation:lettres generer --organisation konica --veille ecosysteme --conception hybride --navigateur

# 3. l'agent complet, facturé à l'API
pnpm evaluation:agent --organisation konica --veille ecosysteme
```

Trois sorties horodatées, un `rapport.md` par sortie ; les colonnes à comparer
sont Faits, Couverture, Relances, URL citées non ouvertes, Coût et Durée, puis
la grille de relecture. Le coût attendu est de 5 à 8 $ pour la première, un peu
moins pour la deuxième (les extraits sont en cache), 15 à 30 $ pour l'agent :
c'est ce dernier chiffre qui manque à `docs/analyse-stacks-alternatives.md`.
Les lettres de cette série ne sont pas publiées ; leur envoi à l'adresse de
relecture suit la procédure « Envoi des courriels » plus bas.

Dans une session Claude Code (sortie réseau par mandataire), le script règle
lui-même le mandataire pour `fetch` et pour le SDK quand `HTTPS_PROXY` est
posée. La clé se pose dans la section « Variables d'environnement » de
l'environnement cloud, sous le nom `EVALUATION_API_KEY`, jamais dans une
commande ni dans un fichier commité ; une session nouvelle la reçoit. Poser un
plafond de dépense sur l'espace de travail de la console avant le premier run :
quatre lettres agentiques Opus coûtent de l'ordre de 20 à 30 $ (5 à 7 $ la
lettre mesurés le 22 octobre, avant les relances), à confirmer par la colonne
coût du rapport. La série précédente s'est arrêtée à quatre lettres sur huit,
crédits épuisés : recharger avant de lancer.

## Ce qui sort

Par lettre, sous `evaluation/sorties/<horodatage>/<organisation>/<veille>/<modèle>-<conception>/` :
`prompt-systeme.txt`, `prompt-utilisateur.txt`, `reponse-brute.md`,
`reponse.json` (usage, coût, durée, tours, relances, mesure des portes, URL
ouvertes et demandées, modèle servi, raison d'arrêt), `lettre.md`,
`collecte.md` (le rapport de collecte, pour l'opératrice, jamais envoyé),
`grille.json`, `proprietes.json` (titre, période, dossiers ouverts, action,
amendements), `validation.json`, `courriel.html`, `courriel.txt`,
`courriel.json` (objet, destinataire).

Pour l'agent, en plus : `espace/` (le dossier posé en fichiers, `grille.md` et
`reponse.md` écrits par l'agent), `journal.txt` (chaque appel d'outil, chaque
refus, les relances) et `transcription.jsonl` (la session entière, message par
message).

Les extraits gelés des conceptions `hybride` et `pipeline` sont sous
`evaluation/sources/<organisation>/<veille>/<date>/` (`manifeste.json` et un
fichier par source) ; ils servent de référence au gel suivant pour le drapeau
`changee`.

À la racine de la sortie : `rapport.md` (tableau des mesures, avec Couverture et
Relances, et grille de relecture à l'aveugle) et `recapitulatif.html` (le même,
à envoyer en courriel de synthèse).

## Comment lire les résultats

1. **URL citées non ouvertes.** Zéro est la cible. Une lettre qui cite une
   source qu'elle n'a pas lue n'est pas publiable, quel que soit le reste.
2. **Ruptures du validateur.** Une lettre non conforme donnerait un tableau de
   bord vide ou faux dans l'espace client.
3. **Faits, dossiers nommés, avertissements.** Le volume et la continuité du
   suivi : `lettre-maigre`, `dossier-non-nommé`, `absence-en-prose`.
   **Couverture et relances** disent si la collecte a été faite ou seulement
   déclarée : une couverture sous 80 % après deux relances désigne des sources
   fermées (à lire dans `collecte.md` et `grille.json`), pas une lettre à
   relancer ; des relances à chaque run désignent un prompt qui laisse le modèle
   rendre trop tôt.
4. **La grille.** Lire chaque `courriel.html` sans regarder le nom du modèle et
   répondre : publiable telle quelle, oui ou non, et sinon ce qui manque (fait
   faux, source inventée, forme, ton, volume). C'est la seule mesure qui compte
   pour évacuer la relecture ; les trois précédentes disent seulement ce que des
   portes mécaniques attraperaient déjà.
5. **Coût et durée**, par lettre et par modèle : ce sont les chiffres qui
   remplaceront les hypothèses de `docs/analyse-stacks-alternatives.md`.

## Exporter les entrées

Les entrées viennent de Notion, lues par le connecteur de l'opératrice, jamais
par l'intégration du portail (qui n'a pas accès aux référentiels, et ne doit pas
l'avoir). Arborescence attendue :

```
evaluation/entrees/
  tache-lettres-de-veille.md          page Notion « Tâche Lettres de veille »
  organisations.json                  [{ slug, nom, registreNotion }] (base Accès, sans adresse)
  editions-publiees.json              lignes Statut = Envoyé de la base Éditions
  <organisation>/fiche.md             page organisation
  <organisation>/<veille>/referentiel.md
  <organisation>/<veille>/dernieres-editions.json   [{ titre, date, numero, periode, dossiers, action, url }]
  <organisation>/<veille>/derniere-lettre.md
```

`<organisation>` : `infralliance`, `hermitage`, `konica`, `petite-vitrine` ;
`<veille>` : `ecosysteme`, `concurrentielle`. Rien de ce dossier n'entre dans un
commit ; une session nouvelle le reconstitue en quelques minutes.

### Procédure d'export, depuis une session Claude Code avec le connecteur Notion

Lecture seule : aucune page n'est créée ni modifiée. Chaque fetch Notion rend un
JSON dont le champ `text` est le Markdown de la page ; c'est ce champ, tel quel,
qui va dans le fichier `.md`.

| Fichier | Page ou requête Notion |
|---|---|
| `tache-lettres-de-veille.md` | page `3d5fe829ce718107af65f4fccf8089ab` |
| `infralliance/fiche.md` | page `3d5fe829ce7181c6a50de68f5f43d301` |
| `infralliance/ecosysteme/referentiel.md` | page `3d5fe829ce71814a9239ede2fd55f614` |
| `infralliance/concurrentielle/referentiel.md` | page `3d5fe829ce7181ac8d7cf383c9817fd5` (veille « Positionnement », pas l'archive `…549223e9ac83da906d`) |
| `konica/fiche.md` | page `3d8fe829ce718129a9e6d073de3f78c0` |
| `konica/ecosysteme/referentiel.md` | page `3d8fe829ce7181099fa0d6300301cb60` |
| `konica/concurrentielle/referentiel.md` | page `3d8fe829ce718180a9d9c1d2a0b84ffd` |
| `hermitage/fiche.md` | page `3d5fe829ce718130b48bd6b171ac7a28` |
| `hermitage/ecosysteme/referentiel.md` | page `3d5fe829ce7181a8a12ff7907942a9c4` |
| `hermitage/concurrentielle/referentiel.md` | page `3d5fe829ce718129abe7dcb1b789d411` |
| `petite-vitrine/fiche.md` | page `3fffe829ce718198bb68fc67d389c886` |
| `petite-vitrine/ecosysteme/referentiel.md` | page `3fffe829ce7181e89cabe20212d3ae3e` |
| `petite-vitrine/concurrentielle/referentiel.md` | page `3fffe829ce718106bd43f8d7abfd49f5` |
| `editions-publiees.json` | SQL sur `collection://f3e703c8-3178-4f70-946b-72be0c2f6db1` : colonnes `url`, `Titre`, `Veille`, `Famille`, `Statut`, `Numéro`, `date:Date d'édition:start`, `Période couverte`, `Dossiers ouverts suivis`, `Action de la semaine`, `Organisation` (jamais `Livraison`, qui porte des adresses), `Statut = 'Envoyé'`, tri par `date:Date d'édition:start` décroissant, limite 100 ; le résultat brut (objet `results`) |
| `<organisation>/<veille>/dernieres-editions.json` | les trois lignes les plus récentes de `editions-publiees.json` dont la colonne `Organisation` porte l'identifiant de registre de l'organisation et dont `Famille` vaut `Écosystème` (ecosysteme) ou `Concurrentiel` (concurrentielle), réécrites en `{ titre, date, numero, periode, dossiers, action, url }` |
| `<organisation>/<veille>/derniere-lettre.md` | fetch de l'`url` de la plus récente de ces lignes |
| `organisations.json` | SQL sur `collection://4d3d7403-35d7-4815-884b-877d17423842`, colonnes `Slug`, `Organisation (libellé)`, `Identifiant Notion de l'organisation` seulement (jamais `Email` ni `Identifiant d'accès`), une entrée `{ slug, nom, registreNotion }` par organisation |

Identifiants de registre au 22 octobre 2026 : Infralliance
`3d5fe829ce718145a186fc32423a922b`, L'Hermitage `3d5fe829ce71810da651f3783a725bd8`,
Konica Minolta France `3d8fe829ce7181368bd3e1b0d109b9fe`, La petite vitrine
`3fffe829ce718195ac8be14bbee84c6e`. Slugs de la base Accès : `infralliance`,
`hermitage`, `konica-minolta-france`, `la-petite-vitrine`. Les titres des
éditions de L'Hermitage ne commencent pas par le nom de l'organisation
(« Veille Tiers-Lieux », « Veille hebdo, Séjours B2B/B2C ») : rattacher par
l'identifiant de registre, jamais par le titre.

### Envoi des courriels

Une fois `evaluation/sorties/<horodatage>/` produit, chaque `courriel.html` part
à agathe@signauxfaibles.io depuis le connecteur Gmail de la session, avec l'objet
de `courriel.json` et le texte de `courriel.txt` en version brute ; puis
`recapitulatif.html` en un dernier courriel, sujet « [TEST] Récapitulatif des
lettres de test ». Le script n'envoie rien lui-même.
