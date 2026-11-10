---
name: onboarding-ouvrir-espace
description: Ouverture manuelle de l'espace du portail, après la publication de la première lettre, quand l'activation n'a pas pu l'ouvrir faute de lettre publiée ou quand « Invitation manuelle » est cochée — contrôle la ligne Accès, coche Actif, importe et fait partir le lien, en appliquant les points (d) et (e) du §1.3 du balayage Notion. À lancer par /onboarding-ouvrir-espace <organisation>, jamais de soi-même.
argument-hint: "<nom de l'organisation, tel qu'au registre>"
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
Tu écris en français. Ce lancement est l'**ouverture manuelle de l'espace**, dans
deux cas : l'activation a trouvé la veille prête mais aucune lettre publiée, et
l'espace attend ; ou l'opératrice a coché « Invitation manuelle » pour choisir
elle-même le jour où le client reçoit son lien. Lancer cette commande vaut sa
décision. Le lien part du portail, dans les minutes qui suivent, et **jamais
avant la publication de la première lettre** (décision du 20 octobre 2026).

Organisation visée : $ARGUMENTS

1. **Lis la règle.** Ouvre la page Notion « Tâche — Onboarding d'une
   organisation (prompts A et B) » (`3d5fe829ce718112a40cfcaf55d3fd76`) : le
   §1.3 du « Prompt — Balayage », points (a) à (f), et dans le « Prompt —
   Première lettre » le passage « ENTRÉE DANS L'ESSAI » (e1 à e3). Ces pages
   font foi ; cette commande ne fait que cibler une organisation et lever, pour
   elle seule, l'attente de l'espace ou la retenue que pose « Invitation
   manuelle ». Si la page est
   inaccessible, n'écris rien et arrête-toi.

2. **Un nom est obligatoire.** Argument vide : ne fais rien et demande le nom.
   Trouve la ligne du registre
   (`collection://4ae154b9-0bca-42f3-9e2e-e546a40dd77f`) dont « Organisation »
   est ce nom, accents et casse ignorés ; aucune ou plusieurs : n'écris rien,
   dis-le, arrête-toi.

3. **Gardes, avant tout geste.**
   - Statut 4, 5 ou 6 : la première lettre existe. Au statut 3 ou avant,
     renvoie à `/onboarding-premiere-lettre` et arrête-toi.
   - Au moins une édition trouvée par la **relation** Organisation avec l'URL
     de cette ligne ; retiens cet identifiant, c'est le seul qui serve ici.
   - **Garde de publication** : au moins une édition de cette organisation au
     statut « Envoyé ». Aucune : n'ouvre rien, dis que le lien part après la
     publication de la première lettre (envoi du brouillon par la relectrice,
     puis réconciliation du soir), et arrête-toi.
   - Si une ligne « Accès » de ce slug est déjà active et que le compte rendu
     d'un lancement précédent (ou de l'activation) dit le lien parti, n'en
     envoie pas un second : le lecteur peut le redemander sur `https://www.signauxfaibles.io/recevoir-mon-lien`.
   - **Écrans alimentés** (10 novembre 2026, décision de l'opératrice : tous les
     écrans de l'espace sont alimentés pour tout utilisateur créé).
     `GET /api/veille/grille?slug=<slug>`, `GET /api/veille/fiche?slug=<slug>` et
     `GET /api/veille/syntheses?slug=<slug>&periode=<mois de la première lettre,
     AAAA-MM>` : si l'un répond `hors-pilote` ou `aucune`, ou si la grille n'a pas
     `validéeLe`, n'ouvre rien, dis ce qui manque et renvoie à `/onboarding-outils
     <nom>`. Une synthèse ou une fiche « proposée » ne retient pas l'ouverture :
     dis seulement qu'il reste à l'opératrice de les publier.
     L'**amorçage trimestriel** (`GET /api/veille/syntheses?slug=<slug>&periode=<AAAA-Tn>`
     du trimestre de la première lettre) ne retient pas l'ouverture non plus :
     s'il répond `aucune`, dis que les écrans « Forces du marché », « Scénarios »
     et « Indicateurs » sont vides et que `/onboarding-outils <nom>` le poste.

4. **Vérifie le portail.** Sans en-tête `Authorization` :
   - `GET https://www.signauxfaibles.io/api/acces/ouvrir` doit répondre 200
     `{"état":"prêt"}` ; un 405 veut dire que la vérification n'est pas encore
     déployée, poursuis ;
   - `GET https://www.signauxfaibles.io/api/veille/contexte?organisation=<page_id>`
     doit répondre 200.
   Un 401 sur `/api/acces/` seul : le chemin n'est pas autorisé dans
   l'environnement. Un 401 partout : le secret de l'environnement n'est plus
   celui du portail. Dans les deux cas, n'ouvre rien et dis-le en tête du
   compte rendu : cocher « Actif » sans pouvoir envoyer le lien ouvrirait un
   espace que le client ne sait pas atteindre.

5. **Ouvre, dans cet ordre strict**, aucun en-tête `Authorization` (le secret
   réseau l'ajoute), toujours sur `https://www.signauxfaibles.io` :
   - **(e1)** `POST /api/veille/organisations` avec le slug, le nom et le
     page_id de la ligne du registre. L'étape B l'a normalement déjà fait : 200
     « déjà-en-essai » est la réponse attendue. 409 « registre-pris » : n'ouvre
     rien, signale la collision.
   - **(d)** contrôle de la ligne « Accès » : identifiant d'organisation égal à
     celui du point 3, identifiant d'accès présent sur aucune autre ligne, slug
     identique au registre, email renseigné. Corrige ce qui doit l'être et
     dis-le ; email vide : n'ouvre rien. Alors seulement, **coche « Actif »**.
   - **(e2)** `POST /api/veille/importer-acces`. Un échec n'empêche pas l'envoi :
     signale-le.
   - **(e3)** `POST /api/acces/ouvrir` avec `{ "email": "<Email de la ligne>" }`,
     jamais l'identifiant d'accès. 404 : réessaie une fois après quelques
     secondes (cache d'une minute). **409 `apercu-avant-envoi`** (1er novembre
     2026) : l'aperçu avant envoi de l'organisation est actif (défaut), le
     portail retient le lien ; ce n'est pas un échec. Ne réessaie pas : dis que
     la ligne est active et importée, et que le lien part de la fiche de
     l'organisation (`/espaces/abonnements/<slug>`, « Renvoyer le lien »), après
     que l'opératrice a vu l'espace.

6. **Rapporte au portail** (1er novembre 2026, lot 4 de
   `docs/proposition-onboarding-admin.md`), en fin de run, réussi ou non, **sans
   que son échec arrête quoi que ce soit** : il ne sert qu'au suivi de
   l'opératrice sur `/espaces/onboardings`. Aucun en-tête `Authorization` (le
   secret réseau l'ajoute) :

   ```
   curl -sS -m 60 -X POST https://www.signauxfaibles.io/api/veille/onboardings -H 'content-type: application/json' -d '<corps>'
   ```

   Corps : `{ "evenement": "rapport", "executeur": "cowork", "slug": "<Slug de la ligne>", "nom": "<Organisation>", "site": "<URL du site>", "registre": "<identifiant de la ligne du registre>", "statut": 6 }`.
   Le statut que porte la ligne après l'ouverture (6 si l'activation est faite, sinon celui d'avant) ; l'ouverture elle-même, le portail la constate par le lien parti. Si tu t'es arrêté sur une garde, mets à la place de `statut` un `motif`
   d'une phrase (300 caractères au plus). Jamais d'adresse ni de jeton dans le
   corps. Une réponse autre que 200 ou 201 se signale dans le compte rendu, sans
   rien refaire.

7. **Ne décoche pas « Invitation manuelle »** si elle est cochée : elle garde la
   trace du choix, et l'activation saura que l'espace a été ouvert à la main. Écris dans « Dernier
   lancement manuel » : « espace ouvert à la main le JJ/MM, lien envoyé à
   <empreinte ou prénom du lecteur>, lettres publiées : N ».

8. **Compte rendu** : les gestes faits, la réponse de chaque appel, le nombre de
   lettres publiées que rend `/api/acces/ouvrir`. Il doit être d'au moins un,
   puisque la garde de publication est passée : s'il vaut zéro, signale l'écart
   entre Notion et le portail.

Aucun jeton à manipuler : n'en écris jamais dans une commande.
