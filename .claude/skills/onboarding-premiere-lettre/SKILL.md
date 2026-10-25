---
name: onboarding-premiere-lettre
description: Lancement B de l'onboarding — produit la première édition de chaque veille en brouillon Gmail, fait entrer l'organisation en essai dans le portail, sans envoyer le lien d'accès (il part après la première publication), en appliquant le « Prompt — Première lettre » Notion. À lancer par /onboarding-premiere-lettre <organisation>.
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
  - "Bash(pnpm -s collecte:lire *)"
  - "Bash(pnpm -s collecte:synthese *)"
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

**Ce que coûte ce lancement, et pourquoi la méthode ci-dessous** (23 octobre
2026). La première lettre Heritech a coûté 63 $ au tarif de l'API : 34 $ de
collecte sur Opus, 23,50 $ de rédaction (un seul rédacteur pour les deux lettres,
contexte monté à 722 000 jetons, HTML des courriels recopié par le modèle, cache
expiré pendant une attente de 58 minutes), 5,50 $ d'orchestration dans une
conversation déjà longue. D'où cinq règles : **lance cette commande dans une
session neuve** (ou par la tâche « Onboarding : première lettre »), jamais à la
suite d'un autre travail ; la collecte va aux agents `collecteur-veille`, sur
Sonnet ; les sources nommées sont lues en code ; **un** rédacteur
`redacteur-veille` par lettre, qui ne lit que sa synthèse ; le brouillon est
déposé par le portail, et le HTML ne passe jamais par un modèle.

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

   **Garde d'exécuteur** (25 octobre 2026, règle « PARTAGE DES ONBOARDINGS » de la
   page) : cette commande est l'exécuteur **Cowork**. Elle ne vaut que pour une
   ligne d'Origine « Demande » ; une ligne « Prospection » passe sans garde.
   - « Exécuteur » = API : ne fais rien. Dis que la ligne se lance par l'API
     (GitHub, workflow « Tâches planifiées (API Claude) », tâche `premiere-lettre`,
     organisation = le slug ou le nom) et arrête-toi.
   - « Exécuteur » = Cowork : poursuis.
   - « Exécuteur » vide (ligne équipée avant le 25/10/2026, ou posée sans choix) :
     la lancer ici est le choix de Cowork, sous quota.
     Compte les lignes d'Origine « Demande », « Exécuteur » = Cowork, dont
     « Exécuteur fixé le » tombe dans la semaine ISO en cours (vue « Créneaux
     Cowork de la semaine », `view://404fe829-ce71-8181-9c61-000cc70e4977`).
     Moins de deux : pose « Exécuteur » = Cowork et « Exécuteur fixé le » = la
     date du jour, puis poursuis. Deux ou plus : n'écris rien, dis que le quota
     de la semaine est atteint et donne la commande API, arrête-toi.
   Le créneau se compte une fois par onboarding, à la première commande qui le
   pose : une ligne déjà « Cowork » ne le consomme pas une seconde fois ici.

3. **Vérifie le portail avant tout travail.** La collecte prend une heure ; un
   appel refusé ne doit pas se découvrir après. Sans en-tête `Authorization` :
   - `GET https://www.signauxfaibles.io/api/acces/ouvrir` doit répondre 200
     `{"état":"prêt"}`. Ce lancement n'envoie plus de lien (20 octobre 2026) :
     un 401 ou un 405 n'est pas bloquant ici. Dis-le en tête du compte rendu,
     car l'ouverture de l'espace, après la première publication, en aura
     besoin (un 401 veut dire que l'environnement ne porte pas le secret sur
     `/api/acces/`) ;
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
   client** — jamais envoyées, mises en forme **et déposées** par le portail
   (`POST /api/veille/courriel`, `sorte: "lettre"`, après le lint, avec
   `"brouillon": { "à": [<destinataires>] }` : la réponse `"état": "brouillon"`
   porte `idBrouillon` et pas le HTML ; toute réponse `"état": "composé"`
   (boîte non configurée, Gmail en échec, ou portail antérieur à cette option),
   repli : `html` et `texte` de la même réponse vont tels quels dans `htmlBody`
   et `body` de `create_draft`) —, puis
   `POST /api/veille/organisations` (entrée en essai) et le contrôle (d) du
   §1.3 de la ligne « Accès », **laissée inactive**.

   **Le courriel d'accès part après la publication de la première lettre,
   jamais avant** (décision du 20 octobre 2026) : n'appelle ni
   `POST /api/veille/importer-acces` ni `POST /api/acces/ouvrir`, et ne coche
   pas « Actif ». Le portail n'affiche que les éditions au statut « Envoyé » :
   un lien envoyé maintenant ferait entrer le client dans un espace vide. Écris
   « espace prêt le JJ/MM, lien après la première publication » dans « Dernier
   lancement manuel ». L'espace s'ouvre à l'activation, si une édition est au
   statut « Envoyé », sinon par `/onboarding-ouvrir-espace`.

   **Si « Invitation manuelle » est cochée** sur la ligne du registre, le geste
   est le même. Écris alors « espace prêt le JJ/MM, invitation manuelle : à
   ouvrir par `/onboarding-ouvrir-espace` » dans « Dernier lancement manuel ».

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

   **Garde ton propre contexte court.** Tu orchestres : tu ne lis ni les pages des
   sources, ni les grilles, ni les faits. Les pages de règles longues, lis-les par
   tranches ciblées ; si un résultat d'outil est sauvegardé dans un fichier,
   recopie-le dans le dossier de travail pour que les agents le lisent, au lieu de
   le faire entrer dans ton contexte. Toute commande `curl` porte `-m 60`.

   **La collecte, sans raccourci** (étapes 1 et 1bis de « Tâche — Lettres de
   veille »), dans un dossier de travail du répertoire temporaire de la session :
   - **découpe les deux référentiels en lots** de une ou deux familles du §1 (une
     seule pour une famille lourde), plus un lot par moitié du corpus §2 avec ses
     dossiers et le calendrier, plus un lot « canaux » pour la base « Extraits
     fournis » et les deux recherches Gmail de l'étape 1.b. Huit à dix lots en tout ;
   - confie chaque lot à un agent **`collecteur-veille`** (`Agent`,
     `subagent_type: "collecteur-veille"`, sur Sonnet), tous en parallèle, avec :
     le référentiel et son identifiant, le lot, la fenêtre nominale (la semaine
     jusqu'à hier soir), le dossier de travail, et le chemin d'une copie des étapes
     1 et 1bis de « Tâche — Lettres de veille ». Il lit d'abord les sources nommées
     **en code** (`pnpm -s collecte:lire`), puis lance chaque requête type et
     requête chaque entité une par une, et écrit `grille/<lot>.md` et
     `faits/<lot>.md`. Le lot « canaux » se confie à un agent généraliste, parce
     qu'il lit Gmail ; lecture seule ;
   - une source qui ne répond pas est rouverte au navigateur avant d'être classée
     « non ouverte » : la commande en code le fait seule, la raison écrite est
     celle du second essai ;
   - **une famille vide dans la fenêtre nominale fait élargir la fenêtre**, famille
     par famille : les faits antérieurs entrent comme « élément de contexte, non
     nouveau », datés, la case « Fenêtre élargie » est cochée et la note de
     méthode le dit. Le volume minimal du §6 (six faits datés hors encadrés) se
     tient par l'élargissement, jamais par du remplissage ;
   - puis **`pnpm -s collecte:synthese <dossier>`** : il compte les grilles, rend
     les sources non ouvertes et les élargissements, et écrit une synthèse par
     lettre (`synthese-concurrentiel.md`, `synthese-ecosysteme.md`). Il sort en
     erreur si une ligne de grille n'a pas d'état : **aucune rédaction tant
     qu'une ligne est vide** ; relance alors le lot concerné.

   **La rédaction, une lettre par agent.** Confie chaque édition à un agent
   **`redacteur-veille`** (`subagent_type: "redacteur-veille"`), les deux en
   parallèle, avec : l'organisation (ligne du registre, slug, nom), la veille et
   son référentiel, la date d'édition, la période, le numéro (1), les
   destinataires du brouillon, le dossier de travail, sa synthèse, et le chemin
   d'une copie des étapes 2 à 6 de « Tâche — Lettres de veille » et du « Prompt —
   Première lettre ». Il écrit la lettre une fois, la publie en Brouillon, la fait
   passer au lint, fait déposer le brouillon par le portail et rend son rapport.
   Les deux rédacteurs sont les seuls à écrire une édition ; **toi seul** écris
   dans le registre, la ligne « Accès » et la notification.

   **Avant d'accepter une lettre**, vérifie dans le rapport du rédacteur : chaque
   rubrique du §6 présente (dont « Analyse de la période »), six faits datés hors
   encadrés au moins ou fenêtre élargie dite, lint conforme, brouillon présent une
   seule fois. Une lettre qui manque l'un de ces points n'est pas prête.

6. **Consomme la case** en fin de run, lettre produite ou non, et écris le
   résultat dans « Dernier lancement manuel ».

7. **Notification `[Relecture]` et compte rendu** prévus par le prompt.
   L'étape suivante appartient au relecteur : relire, envoyer les brouillons,
   puis, le lendemain, une fois la lettre passée au statut « Envoyé » par la
   réconciliation du soir, `/onboarding-activation <nom>`, qui ouvre l'espace
   et fait partir le lien. En invitation manuelle, l'opératrice lance
   `/onboarding-ouvrir-espace <nom>` le jour qu'elle choisit, après la
   publication.
