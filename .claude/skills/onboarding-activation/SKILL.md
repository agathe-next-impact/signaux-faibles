---
name: onboarding-activation
description: Activation de la veille d'une organisation dont la première lettre a été jugée bonne — coche Veille automatique, date l'activation, passe au statut 6 et ouvre l'espace du portail si la première lettre est publiée, en appliquant le §1 du balayage Notion. À lancer par /onboarding-activation <organisation>.
argument-hint: "<nom de l'organisation, au statut 4 ou 5>"
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
---

**Aucune confirmation en cours d'exécution.** Lancer cette commande vaut ordre pour
toutes ses étapes : enchaîne-les sans demander de validation intermédiaire. Tu ne
t'arrêtes que sur les gardes écrites ci-dessous ou dans la page Notion, et tu le dis
dans le compte rendu.

Tu tiens le pipeline d'équipement des organisations du cabinet Signaux faibles.
Tu écris en français. Ce lancement est l'**activation** : la relectrice a jugé
la première lettre bonne, et lancer cette commande vaut sa décision.

Organisation visée : $ARGUMENTS

1. **Lis la règle.** Ouvre la page Notion « Tâche — Onboarding d'une
   organisation (prompts A et B) » (`3d5fe829ce718112a40cfcaf55d3fd76`) :
   « Le cycle », « L'activation, en une case », le préambule du « Prompt —
   Balayage » et son **§1** (1.1 à 1.3, points a à f). C'est ce §1 que tu
   exécutes, tel qu'il est écrit dans Notion aujourd'hui. Si la page est
   inaccessible, n'écris rien et arrête-toi.

2. **Un nom est obligatoire.** Activer est une décision par organisation :
   argument vide, ne fais rien et demande le nom. Trouve la ligne du registre
   (`collection://4ae154b9-0bca-42f3-9e2e-e546a40dd77f`), accents et casse
   ignorés ; aucune ou plusieurs : n'écris rien, dis-le, arrête-toi.

3. **Vérifie le portail avant tout travail.** Sans en-tête `Authorization`,
   `GET https://www.signauxfaibles.io/api/acces/ouvrir` doit répondre 200
   `{"état":"prêt"}`. Appelle aussi
   `GET https://www.signauxfaibles.io/api/veille/contexte?organisation=<page_id>`.
   Lis les refus ainsi, et dis-le en tête du compte rendu avant d'activer :
   - 401 sur `/api/acces/` seulement : le chemin n'est pas autorisé dans
     l'environnement ; l'ouverture du §1.3 ne pourrait pas envoyer de lien ;
   - 401 partout : le secret de l'environnement n'est plus celui du portail
     (secret changé sur Vercel sans report). Les tâches planifiées échoueront
     aussi : signale-le comme bloquant pour la première parution ;
   - 405 sur `GET /api/acces/ouvrir` : vérification non déployée, pas un refus.
   L'activation dans Notion se fait quand même. Si le lien ne peut pas partir,
   le repli est la page `https://www.signauxfaibles.io/recevoir-mon-lien`, à
   indiquer avec l'adresse du lecteur.

4. **Coche « ▶ Activer »** si elle ne l'est pas, puis exécute le §1 :
   - 1.1 garde : statut 4 ou 5, au moins une édition trouvée par la
     **relation** Organisation avec l'URL de cette ligne ; retiens cet
     identifiant, c'est le seul qui serve en 1.3 ;
   - 1.2 activation : Veille automatique, Activée le, statut 6, jour et cadence ;
   - 1.3 espace client : **le lien d'accès part après la publication de la
     première lettre, jamais avant** (décision du 20 octobre 2026). Garde de
     publication d'abord : au moins une édition de l'organisation au statut
     « Envoyé », trouvée par la relation avec l'identifiant de 1.1.
     - Aucune : contrôle de la ligne « Accès » sans cocher « Actif », ni import
       ni lien ; écris « espace en attente de la première publication » et
       poursuis l'activation de la veille. L'espace s'ouvrira par
       `/onboarding-ouvrir-espace`, après la réconciliation du soir.
     - Au moins une : **ouverture**, (a) à (f) : contrôle de la ligne
       (identifiant de 1.1, identifiant d'accès unique, slug, email), « Actif »
       coché, `POST /api/veille/importer-acces` (précédé de
       `POST /api/veille/organisations` si l'organisation n'est pas encore en
       essai), puis `POST /api/acces/ouvrir`. Pas de second lien si le premier
       est déjà parti (organisations ouvertes avant le 20 octobre 2026).
     **Si « Invitation manuelle » est cochée**, le 1.3 contrôle sans ouvrir ni
     envoyer, même pour une ligne déjà active : l'espace s'ouvre par
     `/onboarding-ouvrir-espace`, et l'activation de la veille se fait quand
     même.

   Appels au portail : toujours `https://www.signauxfaibles.io`. **Aucun jeton
   à manipuler** : n'ajoute aucun en-tête `Authorization`, n'écris jamais de
   jeton dans une commande. 401 ou 403 : la session n'a pas le secret réseau
   pour ce chemin, dis-le en tête du compte rendu.

5. **Consomme la case** en fin de run, activation faite ou refusée, et écris
   le résultat dans « Dernier lancement manuel » (« activée le JJ/MM —
   première parution le [jour] », puis la trace du 1.3 f).

6. **Compte rendu** : ce qui a été activé, l'état de l'espace du portail
   (ouvert et lien envoyé, ou en attente de la première publication, contrôlé,
   corrigé) et la première parution prévue. Les tâches planifiées prennent le
   relais. Si l'espace attend la publication, dis qu'il reste à lancer
   `/onboarding-ouvrir-espace <nom>` une fois la lettre passée en « Envoyé ».
