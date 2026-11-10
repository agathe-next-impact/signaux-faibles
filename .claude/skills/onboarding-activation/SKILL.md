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
       **409 `apercu-avant-envoi`** (1er novembre 2026) : l'aperçu avant envoi
       de l'organisation est actif (défaut) ; le lien est retenu par le portail
       et part de la fiche de l'organisation (`/espaces/abonnements/<slug>`,
       « Renvoyer le lien »). Ce n'est pas un échec : l'activation de la veille
       se fait quand même, et le compte rendu le dit.
     **Si « Invitation manuelle » est cochée**, le 1.3 contrôle sans ouvrir ni
     envoyer, même pour une ligne déjà active : l'espace s'ouvre par
     `/onboarding-ouvrir-espace`, et l'activation de la veille se fait quand
     même.
   - **Écrans alimentés, avant que le lien parte** (10 novembre 2026, décision
     de l'opératrice : tous les écrans de l'espace sont alimentés pour tout
     utilisateur créé). Avant le point (e) du 1.3, appelle
     `GET /api/veille/grille?slug=<slug>`, `GET /api/veille/fiche?slug=<slug>` et
     `GET /api/veille/syntheses?slug=<slug>&periode=<mois de la première lettre,
     AAAA-MM>`. Si l'un répond `hors-pilote` ou `aucune`, ou si la grille n'a pas
     `validéeLe` : **n'envoie pas le lien**, coche « Outils stratégiques » au
     registre si elle ne l'est pas, écris « espace en attente : écrans
     stratégiques à alimenter » et dis qu'il faut lancer `/onboarding-outils
     <nom>` puis `/onboarding-ouvrir-espace <nom>`. L'activation de la veille se
     fait quand même. Une synthèse ou une fiche « proposée » ne retient pas le
     lien : dis seulement qu'il reste à l'opératrice de les publier.
     L'**amorçage trimestriel** (`GET /api/veille/syntheses?slug=<slug>&periode=<AAAA-Tn>`
     du trimestre de la première lettre) ne retient pas le lien non plus : s'il
     répond `aucune`, dis que les écrans « Forces du marché », « Scénarios » et
     « Indicateurs » sont vides et que `/onboarding-outils <nom>` le poste.

   Appels au portail : toujours `https://www.signauxfaibles.io`. **Aucun jeton
   à manipuler** : n'ajoute aucun en-tête `Authorization`, n'écris jamais de
   jeton dans une commande. 401 ou 403 : la session n'a pas le secret réseau
   pour ce chemin, dis-le en tête du compte rendu.

5. **Rapporte au portail** (1er novembre 2026, lot 4 de
   `docs/proposition-onboarding-admin.md`), en fin de run, réussi ou non, **sans
   que son échec arrête quoi que ce soit** : il ne sert qu'au suivi de
   l'opératrice sur `/espaces/onboardings`. Aucun en-tête `Authorization` (le
   secret réseau l'ajoute) :

   ```
   curl -sS -m 60 -X POST https://www.signauxfaibles.io/api/veille/onboardings -H 'content-type: application/json' -d '<corps>'
   ```

   Corps : `{ "evenement": "rapport", "executeur": "cowork", "slug": "<Slug de la ligne>", "nom": "<Organisation>", "site": "<URL du site>", "registre": "<identifiant de la ligne du registre>", "statut": 6 }`.
   Statut 6 si l'activation est faite. Si tu t'es arrêté sur une garde, mets à la place de `statut` un `motif`
   d'une phrase (300 caractères au plus). Jamais d'adresse ni de jeton dans le
   corps. Une réponse autre que 200 ou 201 se signale dans le compte rendu, sans
   rien refaire.

6. **Consomme la case** en fin de run, activation faite ou refusée, et écris
   le résultat dans « Dernier lancement manuel » (« activée le JJ/MM —
   première parution le [jour] », puis la trace du 1.3 f).

7. **Compte rendu** : ce qui a été activé, l'état de l'espace du portail
   (ouvert et lien envoyé, ou en attente de la première publication, contrôlé,
   corrigé) et la première parution prévue. Les tâches planifiées prennent le
   relais. Si l'espace attend la publication, dis qu'il reste à lancer
   `/onboarding-ouvrir-espace <nom>` une fois la lettre passée en « Envoyé ».
