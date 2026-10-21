# Évaluer les modèles sur de vraies lettres, sans toucher aux comptes

*Créé le 22 octobre 2026. Décision du même jour : les lettres de test sont
produites par l'API (Opus 5.5 et Sonnet 5.5), deux par organisation pour
Konica Minolta et Infralliance (périmètre réduit le même jour ; L'Hermitage et
La petite vitrine restent exportées et se lancent par `--organisation`), sans
aucune trace dans Notion, et envoyées une par une à agathe@signauxfaibles.io avec un
sujet préfixé « [TEST] ». L'objectif derrière la mesure : savoir ce qui manque
pour évacuer la relecture.*

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

## Deux conceptions mesurées

| Conception | Ce que fait le modèle | Ce que fait le code | Mesure d'hallucination |
|---|---|---|---|
| `agentique` (défaut) | cherche et lit le web avec les outils serveur de recherche et de lecture, 60 recherches et 90 lectures au plus | donne le dossier, relance les tours (`pause_turn`), relève les URL réellement lues | une URL citée dans la lettre qui n'a pas été lue par l'outil pendant le run |
| `pipeline` | rédige en un appel, sans outil, à partir d'extraits gelés | ouvre les URL nommées par le référentiel (60 au plus, 20 s, 6 000 caractères), les gèle dans `evaluation/sources/` | une URL citée absente des extraits ouverts |

Les repli automatiques en cas de refus (`fallbacks`) ne sont pas activés : un
refus est une donnée de l'évaluation, enregistrée dans `reponse.json`
(`stopReason`, `modèleServi`).

## Lancer

```bash
# Konica Minolta et Infralliance (défaut), les deux veilles, Opus 5.5 et Sonnet 5.5, agentique : huit lettres
# (dans une session cloud, la clé est la variable d'environnement EVALUATION_API_KEY)
EVALUATION_API_KEY=… pnpm evaluation:lettres generer

# un sous-ensemble
pnpm evaluation:lettres generer --organisation petite-vitrine --veille ecosysteme --modele sonnet
pnpm evaluation:lettres generer --conception pipeline --parallele 2 --effort medium

# vérifier l'assemblage des prompts sans appel ni clé
pnpm evaluation:lettres generer --a-blanc

# rejouer validation, rendu et rapport sur une sortie existante
pnpm evaluation:lettres valider --sortie evaluation/sorties/<horodatage>
```

Dans une session Claude Code (sortie réseau par mandataire), le script règle
lui-même le mandataire pour `fetch` et pour le SDK quand `HTTPS_PROXY` est
posée. La clé se pose dans la section « Variables d'environnement » de
l'environnement cloud, sous le nom `EVALUATION_API_KEY`, jamais dans une
commande ni dans un fichier commité ; une session nouvelle la reçoit. Poser un plafond de dépense sur
l'espace de travail de la console avant le premier run : huit lettres
agentiques coûtent de l'ordre de 20 à 35 $ (Opus 5 $ et Sonnet 2,50 $ la
lettre, avec la lecture de pages longues), à confirmer par la colonne coût du
rapport.

## Ce qui sort

Par lettre, sous `evaluation/sorties/<horodatage>/<organisation>/<veille>/<modèle>-<conception>/` :
`prompt-systeme.txt`, `prompt-utilisateur.txt`, `reponse-brute.md`,
`reponse.json` (usage, coût, durée, tours, URL ouvertes et demandées, modèle
servi, raison d'arrêt), `lettre.md`, `proprietes.json` (titre, période,
dossiers ouverts, action, amendements), `validation.json`, `courriel.html`,
`courriel.txt`, `courriel.json` (objet, destinataire).

À la racine de la sortie : `rapport.md` (tableau des mesures et grille de
relecture à l'aveugle) et `recapitulatif.html` (le même, à envoyer en courriel
de synthèse).

## Comment lire les résultats

1. **URL citées non ouvertes.** Zéro est la cible. Une lettre qui cite une
   source qu'elle n'a pas lue n'est pas publiable, quel que soit le reste.
2. **Ruptures du validateur.** Une lettre non conforme donnerait un tableau de
   bord vide ou faux dans l'espace client.
3. **Faits, dossiers nommés, avertissements.** Le volume et la continuité du
   suivi : `lettre-maigre`, `dossier-non-nommé`, `absence-en-prose`.
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
| `editions-publiees.json` | SQL sur `collection://f3e703c8-3178-4f70-946b-72be0c2f6db1` : `Statut = 'Envoyé'`, tri par `date:Date d'édition:start` décroissant, limite 100 ; le résultat brut (objet `results`) |
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
