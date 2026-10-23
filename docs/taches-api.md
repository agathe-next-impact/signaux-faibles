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
| `revue` | Opus 5.5 | 10 $ | `0 16 * * *` (week-end compris) |
| `reconciliation` | Sonnet 5.5 | 5 $ | `0 17 * * 1-5` |

Effort `high` partout. La lecture des sources est confiée au sous-agent
`lecteur`, sur Haiku 5.5 : l'agent principal ne reçoit que des extraits recopiés
mot pour mot, et ne rouvre une page que pour vérifier une citation.

Outils, tous derrière la garde (`scripts/taches/garde.ts`, tout le reste est
refusé et journalisé) :

- **Notion** : le serveur MCP hébergé (`https://mcp.notion.com/mcp`), jeton
  `NOTION_MCP_TOKEN` en `Authorization: Bearer`. Lire, chercher, interroger une
  base ou une vue, créer et modifier des pages, créer une vue liée ; supprimer,
  déplacer, dupliquer ou changer un schéma est refusé.
- **Gmail** (`scripts/taches/outils.ts`, boîte `GMAIL_BOITE_OPERATRICE`) :
  `create_draft` et `list_drafts` (portée `gmail.compose`), `list_sent_messages`
  (en-têtes des messages envoyés, portée `gmail.metadata`, sans recherche `q`) et
  `send_message`, qui n'envoie qu'à `agathe@signauxfaibles.io`. Aucun outil
  n'envoie à un client ; un test le vérifie.
- **Portail** : `appeler_portail`, limité à `/api/veille/*` et
  `/api/acces/ouvrir`. Il ajoute `ACTIVATION_SECRET` lui-même : le jeton n'entre
  jamais dans le contexte du modèle.
- **Web** : recherche, lecture de page, et le navigateur
  (`node scripts/lire-page.mjs <url>`, seule commande Bash permise).
- **Identifiant d'accès** : `tirer_identifiant` (32 caractères hexadécimaux),
  pour la ligne « Accès » de l'onboarding, que la tâche tirait avec Bash.

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
   envoyer), et une courte session Sonnet qui liste les outils du serveur Notion,
   lit la page « Pointeurs » et celle de la tâche Lettres, et interroge la vue
   « Veilles actives ». Le résultat est dans le résumé du job.

En local : `pnpm tache controle`, avec les mêmes variables dans l'environnement.

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
