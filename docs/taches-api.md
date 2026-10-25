# Tâches planifiées sur l'API Claude

*23 octobre 2026. Branche `claude/taches-api`.*

Les cinq tâches du dispositif (lettres de veille, réconciliation des envois, revue
mensuelle, balayage, première lettre) tournent sur l'API Claude, lancées par
GitHub Actions (`.github/workflows/taches.yml`), au lieu de l'abonnement. Rien
d'autre ne change : le prompt métier reste dans les pages Notion, le format des
lettres, le portail, Postgres, Vercel et la relecture par brouillon Gmail sont
ceux d'avant.

## Ce qui tourne

`pnpm tache <tâche> [--organisation <slug>]` (`scripts/taches/executer.ts`) ouvre
une session du SDK Agent avec, pour prompt, le texte de la tâche planifiée en
service le 23 octobre (`scripts/taches/pointeurs.ts`, recopié mot pour mot) : il
dit d'ouvrir la page Notion de la tâche, qui fait foi. `--organisation` n'ajoute
qu'une phrase : « Limite-toi à l'organisation <slug>. »

| Tâche | Modèle | Plafond | Récurrence prévue (UTC) |
|---|---|---:|---|
| `lettres` | Opus 5.5 | 60 $ | `0 4 * * 1-5` |
| `premiere-lettre` | Opus 5.5 | 40 $ | à la main |
| `balayage` | Opus 5.5 | 30 $ | à la main |
| `revue` | Opus 5.5 | 10 $ | `0 16 * * *` (week-end compris), **active depuis le 25 octobre 2026** |
| `reconciliation` | Sonnet 5.5 | 5 $ | `0 17 * * 1-5`, **active depuis le 25 octobre 2026** |

Effort `high` partout. La lecture des sources est confiée au sous-agent
`lecteur`, sur Haiku 5.5 : l'agent principal ne reçoit que des extraits recopiés
mot pour mot, et ne rouvre une page que pour vérifier une citation.

Depuis le 23 octobre 2026 (`docs/cout-premiere-lettre.md`), un second sous-agent,
`collecteur`, sur **Sonnet 5.5**, collecte un lot de familles quand une page
demande de confier la collecte à des agents (première lettre) : il lit les
sources nommées en code (`lire_sources`), lance les requêtes et écrit
`grille/<lot>.md` et `faits/<lot>.md` dans `collecte/` du dossier de travail ;
`synthese_de_collecte` en tire une synthèse par lettre, seule lecture du
rédacteur. Les consignes du harnais disent aussi d'économiser le contexte : une
lettre à la fois, corps écrit une fois, remplacements ciblés, aucun appel de plus
de quatre minutes (au-delà, le cache de cinq minutes expire et tout le contexte
est réécrit). Le cache d'une heure n'est **pas** retenu : il coûte deux fois le
prix d'entrée à l'écriture au lieu de 1,25 fois, soit 11 $ de plus que les 7 $
qu'il aurait évités sur la première lettre Heritech.

Outils, tous derrière la garde (`scripts/taches/garde.ts`, tout le reste est
refusé et journalisé) :

- **Notion** : le serveur MCP hébergé (`https://mcp.notion.com/mcp`), jeton
  `NOTION_MCP_TOKEN` en `Authorization: Bearer`. Lire, chercher, interroger une
  base ou une vue, créer et modifier des pages, créer une vue liée ; supprimer,
  déplacer, dupliquer ou changer un schéma est refusé. Le jeton n'existe que
  sur les plans Business et Enterprise : un propriétaire de l'espace le crée
  dans le portail développeur de Notion (« New MCP token »). **Ce n'est pas le
  secret d'intégration interne du portail** (`NOTION_TOKEN`, `ntn_…`) : celui-ci
  est reconnu par Notion mais refusé par le serveur MCP (`403
  restricted_resource`), voir « Quand le serveur Notion refuse le jeton ».
  L'espace est sur Business avec Notion AI depuis le 23 octobre ; un retour au
  plan gratuit couperait les tâches (`docs/etat-des-api.md` §2.5).
- **Gmail** (`scripts/taches/outils.ts`, boîte `GMAIL_BOITE_OPERATRICE`) :
  `create_draft` et `list_drafts` (portée `gmail.compose`), `list_sent_messages`
  (en-têtes des messages envoyés, portée `gmail.metadata`, sans recherche `q`) et
  `send_message`, qui n'envoie qu'à `agathe@signauxfaibles.io`. Aucun outil
  n'envoie à un client ; un test le vérifie. `deposer_courriel` (23 octobre
  2026) compose un courriel par `POST /api/veille/courriel` et le dépose en
  brouillon dans le même appel, sans rendre le HTML au modèle ; la réponse du
  portail lue par cet outil n'est pas tronquée, celle d'`appeler_portail` l'est à
  100 000 caractères (une lettre de 68 Ko, HTML et texte, la dépassait).
- **Portail** : `appeler_portail`, limité à `/api/veille/*` et
  `/api/acces/ouvrir`. Il ajoute `ACTIVATION_SECRET` lui-même : le jeton n'entre
  jamais dans le contexte du modèle.
- **Web** : recherche, lecture de page, et le navigateur
  (`node scripts/lire-page.mjs <url>`, seule commande Bash permise).
- **Identifiant d'accès** : `tirer_identifiant` (32 caractères hexadécimaux),
  pour la ligne « Accès » de l'onboarding, que la tâche tirait avec Bash.
- **Collecte en code** : `lire_sources` (30 URL au plus, quatre minutes au plus,
  un fichier par page dans `sources/<lot>/`, l'index en lignes de grille) et
  `synthese_de_collecte` (les synthèses par lettre d'un dossier de collecte).

Ce qui ne marche pas comme sous l'abonnement, et que l'agent dit dans son compte
rendu : le repli n°1 des pages (calcul du calendrier par `git clone` et `node`)
est refusé par la garde, l'agent passe au repli suivant ; les documents de
projet claude.ai (`project_read`, `project_write`) n'existent pas ici, ils
n'étaient déjà plus lisibles depuis les tâches Claude Code ; les recherches Gmail
dans les messages reçus (alertes Google, `[VEILLE <slug>]`, demandes des
lecteurs) supposent `gmail.readonly`, non demandé (décision du 23 octobre : rien
n'est arrivé dans la boîte depuis 30 à 60 jours).

## Lancer une tâche

1. GitHub, onglet **Actions**, workflow **Tâches planifiées (API Claude)**,
   **Run workflow**.
2. Choisir la tâche et, au besoin, une organisation (son slug).
3. **Avant tout premier essai, lancer `controle`.** Il ne fait que lire : variables
   présentes, `GET /api/veille/etat?notifier=0`, délégation Gmail (un jeton
   demandé pour `gmail.compose`, `gmail.metadata` et `gmail.send` au nom de la
   boîte, puis une lecture pour les deux premières, sans rien écrire ni
   envoyer), la **sonde du serveur Notion MCP** (une requête `initialize` avec
   le jeton, sans modèle ni frais, `scripts/taches/notion-mcp.ts`), puis, si le
   serveur a ouvert, une courte session Sonnet qui liste les outils du serveur
   Notion, lit la page « Pointeurs » et celle de la tâche Lettres, et interroge
   la vue « Veilles actives ». Le résultat est dans le résumé du job.

En local : `pnpm tache controle`, avec les mêmes variables dans l'environnement.

Toute tâche fait la même sonde avant d'ouvrir sa session : un jeton refusé rend
le job rouge tout de suite, sans rien facturer, avec le refus de Notion dans le
résumé.

### Quand le serveur Notion refuse le jeton

Les six premières exécutions du workflow (23 au 25 octobre 2026) ont échoué
ainsi : le code envoyait bien le secret en `Authorization: Bearer`, mais le
serveur hébergé répondait `403 restricted_resource`, « This token cannot access
Notion MCP. ». Le défaut était dans la nature du secret, pas dans le code. La
sonde lit la réponse de Notion et dit laquelle des deux situations se présente :

| Réponse de Notion | Ce que c'est | Ce qu'il faut faire |
|---|---|---|
| `401 unauthorized`, `token_invalid` (même réponse qu'avec un jeton inventé) | La valeur du secret n'est pas un jeton Notion : coquille, troncature au collage, jeton révoqué | Recopier le jeton depuis le portail développeur de Notion dans le secret `NOTION_MCP_TOKEN` |
| `403 restricted_resource`, « This token cannot access Notion MCP. » | Notion reconnaît le jeton, mais ce n'est pas un jeton MCP : c'est ce que rend un secret d'intégration interne (`ntn_…`, celui du portail) | Un **propriétaire de l'espace** crée un jeton « New MCP token » dans le portail développeur (plan Business ou Enterprise), et le pose dans le secret ; le secret d'intégration du portail n'est jamais réutilisé ici |

**Les noms des outils changent avec l'authentification** (constaté le 25 octobre
2026, à la première session ouverte par un jeton MCP). En OAuth, le serveur
expose `notion-fetch`, `notion-create-pages` ; avec un jeton MCP, `fetch`,
`create-pages`, sans préfixe. La garde (`nomDOutilNotion`, `garde.ts`) et le
contrôle comparent les noms sans ce préfixe, et les consignes du harnais disent
à l'agent qu'une page qui écrit `notion-fetch` désigne `fetch`. `ai-search`
(recherche IA) reste hors de la liste permise.

**Les pages longues restent lisibles.** La page de la tâche Lettres (64 571
caractères) et la vue « Veilles actives » (67 126) ont buté deux fois au
contrôle du 25 octobre. D'abord sur le plafond de jetons des réponses MCP : la
session reçoit `MAX_MCP_OUTPUT_TOKENS=80000` (`PLAFOND_SORTIE_MCP`). Puis, au-delà
d'une cinquantaine de kilo-octets, le CLI range la réponse dans
`~/.claude/projects/<dossier de travail>/<session>/tool-results/` et ne rend qu'un
aperçu et le chemin, alors que la garde ne laissait lire que le dossier de
travail. La garde laisse désormais relire, avec Read et Grep seulement, les
fichiers `tool-results/` du dossier de projet de **cette** session
(`dossierDesRéponsesPersistées`), et rien d'autre de la configuration de Claude
Code ; le contrôle reçoit Read et Grep pour cela.

Dans les deux cas, relancer `controle` après avoir changé le secret : la ligne
« Notion : jeton MCP accepté par le serveur » doit passer à `ok` avant tout essai
réel. Le `request_id` de la réponse est dans le résumé, pour le support Notion.

## Lire ce qu'une exécution a coûté

Le résumé du job donne le coût total, le nombre de tours, et pour chaque modèle
(Opus ou Sonnet d'un côté, Haiku de l'autre) les jetons en entrée, en sortie,
relus et écrits en cache, et les recherches web ; puis les organisations
traitées et les pages Notion créées, et le compte rendu de l'agent. L'artefact
de l'exécution (30 jours) porte `mesure.json`, `transcription.jsonl`,
`journal.txt` et `compte-rendu.md`, tous passés au masque des secrets.

Ces chiffres viennent du message `result` du SDK (`total_cost_usd`,
`modelUsage`), jamais d'un calcul refait. La clé API sert aussi aux évaluations :
le total de la console mêle les deux, `mesure.json` est la seule référence du
coût des tâches.

Une exécution qui échoue ou atteint son plafond rend le job rouge, et GitHub
prévient par courriel.

## Basculer, tâche par tâche

Ordre : réconciliation, revue, lettres, puis balayage et première lettre. Le
même jour, l'opératrice désactive la tâche planifiée côté Claude et décommente
la récurrence correspondante dans `taches.yml`. Les deux ne tournent jamais
ensemble : une lettre produite deux fois partirait deux fois en relecture.

| Tâche | Basculée le | Essai réel | Tâche planifiée côté Claude |
|---|---|---|---|
| `reconciliation` | 25 octobre 2026 | [exécution 14](https://github.com/agathe-next-impact/signaux-faibles/actions/runs/40167707335) : succès, 16 tours, 0,33 $, aucune écriture Notion, une notification à l'opératrice | « Réconciliation des envois » (`trig_01BXfAjwQEdmitFkuiUkv6BB`, 19 h 07 à Paris) désactivée |
| `revue` | 25 octobre 2026 | [exécution 15](https://github.com/agathe-next-impact/signaux-faibles/actions/runs/40170531343) : succès, 8 tours, 0,34 $, porte seule (aucune revue due le 26 octobre), aucune écriture ; première vraie revue le 1er novembre (Hermitage, Suneido) | « Revue mensuelle des référentiels » (`trig_01J6j4oBrxa7LsSXY89Qnqu9`, 18 h 06 à Paris) désactivée |

La réconciliation tourne à 17 h UTC, soit 18 h à Paris en hiver et 19 h en été,
un peu avant l'ancienne heure (19 h 07 à Paris). La revue tourne à 16 h UTC, soit
17 h à Paris en hiver et 18 h en été (ancienne heure : 18 h 06) ; sa porte ne
retient que les organisations dont la première parution du mois tombe le
lendemain.

## Revenir en arrière

Recommenter la récurrence dans `taches.yml`, réactiver la tâche planifiée côté
Claude. Rien d'autre à défaire : les pages Notion n'ont pas changé.

## Secrets et variables

Secrets GitHub : `ANTHROPIC_API_KEY` (la clé des évaluations, décision du
23 octobre), `NOTION_MCP_TOKEN`, `ACTIVATION_SECRET`,
`GOOGLE_COMPTE_SERVICE_JSON`, `GMAIL_BOITE_OPERATRICE`. Variable :
`PORTAIL_URL` (par défaut `https://www.signauxfaibles.io` ; l'apex redirige et
la redirection perdrait l'autorisation). Le script ne lit que ces variables, pas
`env()` du portail, et n'en transmet aucune à la session de l'agent, hormis la
clé API ; il s'arrête si la session annonce une autre source
d'authentification.
