---
name: onboarding-premiere-lettre
description: Lancement B de l'onboarding — produit la première édition de chaque veille en brouillon Gmail, fait entrer l'organisation en essai dans le portail et envoie le lien d'accès, en appliquant le « Prompt — Première lettre » Notion. À lancer par /onboarding-premiere-lettre <organisation>.
argument-hint: "<nom de l'organisation, au statut 3>"
disable-model-invocation: true
allowed-tools:
  - "mcp__Notion__notion-fetch"
  - "mcp__Notion__notion-search"
  - "mcp__Notion__notion-query-data-sources"
  - "mcp__Notion__notion-create-pages"
  - "mcp__Notion__notion-update-page"
  - "mcp__Notion__notion-create-view"
  - "mcp__Notion__notion-update-view"
  - "mcp__Notion__notion-get-async-task"
  - "mcp__Gmail__search_threads"
  - "mcp__Gmail__get_thread"
  - "mcp__Gmail__list_drafts"
  - "mcp__Gmail__get_draft"
  - "mcp__Gmail__create_draft"
  - "mcp__Gmail__update_draft"
  - "mcp__Gmail__send_message"
  - "WebFetch"
  - "WebSearch"
  - "Bash(openssl rand *)"
  - "Bash(curl *https://www.signauxfaibles.io/api/acces/*)"
  - "Bash(curl *https://www.signauxfaibles.io/api/veille/*)"
  - "Bash(node scripts/lire-page.mjs *)"
  - "Agent"
---

**Aucune confirmation en cours d'exécution.** Lancer cette commande vaut ordre pour
toutes ses étapes : enchaîne-les sans demander de validation intermédiaire. Tu ne
t'arrêtes que sur les gardes écrites ci-dessous ou dans la page Notion, et tu le dis
dans le compte rendu.

Tu produis la première édition de chaque veille d'une organisation nouvellement
équipée, pour le cabinet Signaux faibles. Tu écris en français. Ce lancement est
le **B**, le plus coûteux du dispositif et le plus lu : il ne se lance que sur
ordre, et cette commande est cet ordre.

Organisation visée : $ARGUMENTS

1. **Lis la règle.** Ouvre la page Notion « Tâche — Onboarding d'une
   organisation (prompts A et B) » (`3d5fe829ce718112a40cfcaf55d3fd76`) :
   « Le cycle », le **« Prompt — Première lettre »** en entier, et le §1.3 du
   balayage auquel il renvoie. Ouvre aussi « Tâche — Lettres de veille », que
   l'étape 1 applique. Ces pages font foi ; cette commande ne fait que cibler
   une organisation. Si l'une est inaccessible, n'écris rien et arrête-toi.

2. **Trouve la ligne** du registre
   (`collection://4ae154b9-0bca-42f3-9e2e-e546a40dd77f`) dont « Organisation »
   est ce nom, accents et casse ignorés. Aucune ou plusieurs : n'écris rien,
   dis-le, arrête-toi. Argument vide : suis l'étape 0 du prompt sur la vue
   « Premières lettres à produire » (`view://3d6fe829-ce71-81e4-b79d-000ced6a49ff`).

3. **Vérifie le portail avant tout travail.** La collecte prend une heure ; un
   appel refusé ne doit pas se découvrir après. Sans en-tête `Authorization` :
   - `GET https://www.signauxfaibles.io/api/acces/ouvrir` doit répondre 200
     `{"état":"prêt"}`. Un 401 veut dire que l'environnement de la session ne
     porte pas le secret sur `/api/acces/` : arrête-toi, n'écris rien, et dis
     qu'il faut autoriser ce chemin dans l'environnement. Un 405 veut dire que
     cette vérification n'est pas encore déployée : ce n'est pas un refus,
     poursuis, et le lien pourra au besoin partir par
     `https://www.signauxfaibles.io/recevoir-mon-lien` ;
   - `GET https://www.signauxfaibles.io/api/veille/contexte?organisation=<page_id
     de la ligne du registre>` doit répondre 200 : il donne aussi la garde
     d'idempotence (aucune édition de cette organisation). Un 401 ici, comme
     partout, veut dire que le secret de l'environnement n'est plus celui du
     portail (secret changé sur Vercel sans report) : arrête-toi, n'écris rien,
     et dis qu'il faut reporter la valeur dans l'environnement.
   Si le portail répond 500 en SQLSTATE 42703 ou 42P01 à un appel du run, une
   migration manque : appelle `POST /api/veille/migrer` une fois, puis rejoue
   l'appel.

4. **Coche « ▶ Produire la première lettre (B) »** sur cette ligne si elle ne
   l'est pas : l'étape 0 ne traite alors que les lignes cochées, donc celle-ci
   seulement.

5. **Exécute le prompt, étape par étape**, sans en sauter : garde
   d'idempotence (aucune édition existante pour cette organisation), porte
   (Q1–Q3 sans « [hypothèse] », veilles déterminées, priorité 1 répercutée),
   collecte refaite intégralement, éditions n°1 en **brouillon Gmail adressé au
   client** — jamais envoyées par toi, et mises en forme par le portail
   (`POST /api/veille/courriel`, `sorte: "lettre"`, après le lint : `html` et
   `texte` de la réponse vont tels quels dans `htmlBody` et `body`) —, puis,
   dans cet ordre,
   `POST /api/veille/organisations`, « Actif » coché selon le §1.3 (d),
   `POST /api/veille/importer-acces`, `POST /api/acces/ouvrir`.

   **Si « Invitation manuelle » est cochée** sur la ligne du registre, fais
   `POST /api/veille/organisations` **seulement** : l'organisation entre en
   essai, mais tu ne coches pas « Actif », tu n'importes pas et tu n'envoies
   aucun lien. Écris « espace prêt le JJ/MM, invitation manuelle : à ouvrir par
   `/onboarding-ouvrir-espace` » dans « Dernier lancement manuel ». Dans ce cas,
   la vérification `GET /api/acces/ouvrir` du point 3 n'est pas bloquante.

   **Si « Origine » vaut « Prospection »** (19 octobre 2026, lettre 1 envoyée
   par lemlist sans sollicitation, `docs/prospection-lemlist.md`), le cas
   prime sur « Invitation manuelle » :
   - `POST /api/veille/organisations` avec `"origine": "prospection"` : l'essai
     n'ouvrira qu'à la première visite du prospect, J0 à la première lettre
     publiée à partir de cette semaine ;
   - **le lecteur doit exister** : crée la ligne « Accès » (« Actif » coché,
     identifiant neuf, `openssl rand -hex 16`) et fais `POST /api/veille/importer-acces`,
     sinon le webhook lemlist ne rattachera rien et « recevoir mon lien » ne
     répondra pas au prospect ;
   - **n'appelle pas** `POST /api/acces/ouvrir` : le lien ne part que si le
     prospect le demande sur « recevoir mon lien » ;
   - **aucun brouillon Gmail au prospect** : la lettre 1 est publiée dans
     « Éditions de veille » (statut Envoyé, pour le portail) et c'est lemlist qui
     l'annonce ; le brouillon de contrôle va à l'adresse de relecture seulement ;
   - ne coche pas « ▶ Activer » et laisse « Veille automatique » décochée : les
     lettres suivantes attendent l'activation, que la tâche « Prospection ·
     synchronisation » constate et applique ;
   - écris dans « Dernier lancement manuel » : « lettre 1 publiée le JJ/MM,
     prospection : en attente d'activation ».

   Appels au portail : toujours `https://www.signauxfaibles.io` (l'apex perd
   l'en-tête). **Aucun jeton à manipuler** : l'environnement ajoute
   l'autorisation ; n'ajoute aucun en-tête `Authorization` et n'écris jamais de
   jeton dans une commande. Une réponse 401 ou 403 veut dire que la session ne
   tourne pas sur l'environnement « signaux-faibles-io » ou que le chemin n'y
   est pas autorisé : dis-le en tête du compte rendu, sans chercher le jeton
   ailleurs.

   **Avant la collecte, contrôle le §6 des deux référentiels.** S'il ne contient
   pas « STRUCTURE, INVARIABLE » et « Ce que cela change pour vous », il a été
   réduit à un renvoi au contrat de forme : remplace-le par le bloc §6 du prompt
   de génération (« Référentiel de veille », `3d2fe829ce71801eae49fa7fc4a0e76c`),
   note-le au journal du référentiel et dans « Amendements au référentiel ». C'est
   ce §6 qui fixe les rubriques et la profondeur de la lettre ; le contrat de forme
   ne dit que la forme.

   **La collecte, sans raccourci** (étapes 1 et 1bis de « Tâche — Lettres de
   veille ») :
   - tiens la **grille de collecte dans un fichier** du répertoire de travail
     temporaire de la session, une ligne par source nommée, dossier, entité du
     corpus, requête type, échéance, extrait fourni et alerte, avec son état
     (OUVERTE, REQUÊTÉE, FOURNIE, NON OUVERTE et sa raison). Aucune rédaction tant
     qu'une ligne est vide. La note de méthode et le pied de la lettre se tirent
     de ce fichier, jamais de mémoire : une lettre n'affirme pas qu'une requête a
     été lancée si la grille ne le porte pas ;
   - lance **chaque requête type** des deux référentiels, une par une, et requête
     **chaque entité du corpus** une par une ;
   - une source qui ne répond pas, ou dont le contenu n'est pas lisible, est
     rouverte avec le navigateur, `node scripts/lire-page.mjs <url>`, avant
     d'être classée « non ouverte » ; la raison écrite est celle du second essai ;
   - **une famille vide dans la fenêtre nominale fait élargir la fenêtre**, famille
     par famille, comme le prévoit l'étape 1 du prompt : les faits antérieurs
     entrent comme « élément de contexte, non nouveau », datés, la case « Fenêtre
     élargie » est cochée et la note de méthode le dit. Le volume minimal du §6
     (six faits datés hors encadrés) se tient par l'élargissement, jamais par du
     remplissage ;
   - la collecte est longue : confie-la, famille par famille, à des agents
     (`Agent`) qui rendent leurs lignes de grille et leurs faits sourcés, pour que
     la rédaction ne se fasse pas dans un contexte saturé. Tu restes seul à écrire
     dans Notion et dans Gmail.

   **Avant le lint**, compte les paragraphes de faits hors encadrés et vérifie la
   présence de chaque rubrique du §6 (dont « Analyse de la période »). Une rubrique
   absente ou un volume sous le minimal sans fenêtre élargie : la lettre n'est pas
   prête. Le lint du portail le signale aussi, en avertissement.

6. **Consomme la case** en fin de run, lettre produite ou non, et écris le
   résultat dans « Dernier lancement manuel ».

7. **Notification `[Relecture]` et compte rendu** prévus par le prompt.
   L'étape suivante appartient au relecteur : relire, envoyer le brouillon,
   puis `/onboarding-activation <nom>`. En invitation manuelle, l'opératrice
   lance aussi `/onboarding-ouvrir-espace <nom>` le jour qu'elle choisit.
