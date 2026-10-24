# Le coût de la première lettre, et ce qui le réduit

*23 octobre 2026.* Mesure de la première lettre Heritech (deux éditions n°1,
Concurrentiel et Écosystème), puis les modifications retenues pour la suivante.
Tous les montants sont au tarif de l'API Claude pour Opus 5.5 : 4 $ le million de
jetons en entrée, 5 $ à l'écriture en cache (cinq minutes), 0,20 $ à la relecture,
20 $ en sortie. Sous l'abonnement, ces jetons consomment le quota au lieu d'être
facturés.

## Ce qu'a coûté la première lettre Heritech : 63,41 $

Calculé appel par appel sur les transcriptions des dix agents et de la session qui
les orchestrait.

| Poste | Coût | Détail |
|---|---:|---|
| Collecte, 9 agents sur Opus | 34,45 $ | écriture 13,84 $, relecture 12,73 $, sortie 7,88 $ ; 368 appels |
| Rédaction, un agent pour les deux lettres | 23,50 $ | écriture 9,70 $, relecture 6,75 $, sortie 7,05 $ ; 98 appels, contexte monté à 722 000 jetons |
| Orchestration, dans une conversation déjà longue | 5,46 $ | 52 appels qui relisaient chacun environ 300 000 jetons |

Trois causes traversent ces postes :

- **le contexte fixe de chaque agent**, environ 90 000 jetons (instructions de
  Claude Code, outils, CLAUDE.md), relu à chacun des 466 appels : 12,47 $ (20 %) ;
- **le cache expiré** : 7 réécritures complètes après une attente de plus de cinq
  minutes, 7,07 $ (11 %). La plus longue, 58 minutes, sur une écriture Notion du
  rédacteur (`notion-update-page`) : une demande d'autorisation restée sans
  réponse, vérifiée dans la transcription (voir « Ce qui reste à faire ») ;
- **ce que le rédacteur faisait transiter par le modèle** : le HTML des deux
  courriels recopié dans `create_draft` (210 000 caractères), chaque lettre écrite
  plusieurs fois (285 000 caractères en fichiers, puis 86 000 à la création des
  pages). Tout cela compte en sortie, puis se relit à chaque appel suivant.

## Les pistes, et ce qui en est fait

| # | Piste | Économie estimée | Où |
|---|---|---:|---|
| 1 | Lancer dans une session neuve, jamais à la suite d'un autre travail | ~4 $ | consigne en tête de `/onboarding-premiere-lettre` ; l'exécuteur API ouvre toujours une session neuve |
| 2a | Le portail dépose le brouillon : le HTML ne passe plus par un modèle | compris dans 2 | option `brouillon` de `POST /api/veille/courriel` (`docs/api-veille.md`) ; outil `deposer_courriel` de l'exécuteur |
| 2b–2d | Une lettre par rédacteur, écrite une fois, depuis sa seule synthèse | ~15 $ avec 2a | agent `redacteur-veille` ; `pnpm collecte:synthese` et l'outil `synthese_de_collecte` |
| 3 | Collecte sur Sonnet 5.5 | ~10,90 $ | agent `collecteur-veille` (`model: sonnet`) ; sous-agent `collecteur` de l'exécuteur |
| 4 | Contexte fixe réduit | ~7-8 $ si 90 000 jetons passent à ~30 000 | outils restreints des deux agents ; voir « Ce qui reste » |
| 5 | Éviter l'expiration du cache | jusqu'à ~6,50 $ | lots de sources bornés à quatre minutes, `curl -m 60`, consigne « aucun appel de plus de quatre minutes » ; voir « Ce qui reste » |
| 6 | Lecteur Haiku pour toute lecture de page | non retenu | (décision de l'opératrice, 23 octobre) |
| 7 | Collecte des sources nommées en code | ~15 $ et plus | `pnpm collecte:lire` (`scripts/collecte/lire-sources.ts`, sur `collecterLesUrls` de `lib/moteur/collecte.ts`) ; outil `lire_sources` de l'exécuteur |

Le **cache d'une heure** n'est pas retenu : il coûte deux fois le prix d'entrée à
l'écriture, contre 1,25 fois pour celui de cinq minutes. Sur les 3,7 millions de
jetons écrits sans expiration, le surcoût aurait été de 11,10 $, pour 7,07 $
évités. Éviter les attentes longues est moins cher.

Les économies ne s'additionnent pas exactement : estimation d'ensemble, de 63 $ à
**15 à 25 $** pour une première lettre de la taille de celle de Heritech. À
confirmer à la prochaine, par le même calcul.

## Ce que fait chaque pièce

- **`pnpm collecte:lire <fichier d'URL> <dossier>`** lit chaque adresse du fichier
  (requête simple, puis Chromium), six à la fois, en quatre minutes au plus ; écrit
  un fichier texte par page ouverte et `index.md`, une ligne de grille par source :
  OUVERTE avec la dernière date visible (`datesVues`, jamais une date future),
  NON OUVERTE avec la raison des deux essais, À RELANCER si l'échéance du lot est
  atteinte. Il ne juge rien.
- **`pnpm collecte:synthese <dossier>`** lit `grille/*.md` et `faits/*.md`, compte
  les états, relève les non ouvertes et les élargissements, range les faits par
  lettre et par famille (un RAS sans référentiel prend celui de sa grille ; ceux
  des canaux d'entrée sont communs), et ne donne de l'autre lettre que les titres.
  Il sort en erreur si une ligne de grille n'a pas d'état. Sur la collecte
  Heritech : 310 000 caractères de grilles et de faits, 101 000 et 87 000 pour les
  deux synthèses.
- **`collecteur-veille`** et **`redacteur-veille`** (`.claude/agents/`) : les deux
  agents de la commande, chacun avec ses seuls outils. Le collecteur ne peut
  écrire ni dans Notion ni dans Gmail.

## Ce qui reste à faire, après la fusion

1. *Fait le 23 octobre.* **Poser `GMAIL_BOITE_OPERATRICE` sur Vercel** (production), avec l'adresse de la
   boîte où les lettres attendent : `agathe@next-impact.digital`. La délégation
   du compte de service porte déjà `gmail.compose` (contrôle du 23 octobre). Sans
   la variable, la route rend le HTML comme avant et la commande se replie sur
   `create_draft` : rien ne casse.
2. *Fait le 23 octobre.* **Mettre à jour deux pages Notion**, après le déploiement et pas avant (avant,
   la route ignorerait `brouillon` et la page décrirait un geste impossible) :
   - « Tâche — Lettres de veille », étape 6, paragraphe « MISE EN FORME PAR LE
     PORTAIL » : remplacer « Réponse 200 : passe « html » dans htmlBody et
     « texte » dans body de mcp__Gmail__create_draft, TELS QUELS » par : « Ajoute
     au corps "brouillon": { "à": [<destinataires>] }. Réponse 200 « brouillon » :
     le portail a déposé le brouillon, note « idBrouillon » dans Livraison.
     Réponse 200 « composé » (boîte non configurée ou Gmail en échec, le champ
     « brouillon » le dit) : passe « html » dans htmlBody et « texte » dans body de
     mcp__Gmail__create_draft, TELS QUELS, comme repli. » ;
   - « Tâche — Onboarding d'une organisation », « Prompt — Première lettre »,
     étape 2, même remplacement dans « CHAQUE LETTRE DEVIENT UN BROUILLON GMAIL ».
3. **Piste 4 : ne garder que les connecteurs utiles.** Les tâches planifiées et
   les sessions de la commande ne devraient porter que Notion et Gmail : chaque
   serveur MCP de plus (Google Calendar, Google Drive, Vercel, visualize, Claude
   Docs) allonge le contexte fixe de chaque agent, à chacun de ses appels.
4. **Piste 5 : lever les demandes d'autorisation de la commande.**

   *Ce qui a causé les 58 minutes, vérifié le 23 octobre.* L'appel bloqué est un
   `mcp__Notion__notion-update-page` du rédacteur, à 12 h 58 UTC. La décision
   enregistrée dans sa transcription est `ruleSource: mcpServerPolicy`,
   `source: user_temporary`, `grantScope: once` : la demande venait de la
   **politique d'outils du connecteur Notion**, réglée dans claude.ai, et elle a été
   accordée à la main, une fois, au bout de 58 minutes. Ce n'était pas une règle
   manquante du dépôt : `.claude/settings.json` autorisait déjà
   `notion-update-page` depuis le 19 octobre, et cela n'a pas suffi.

   *Ce qui est autorisé dans `.claude/settings.json`* (règles `permissions.allow`,
   lues par toute session ouverte sur ce seul dépôt, sous-agents compris) :
   - Notion : `notion-fetch`, `notion-search`, `notion-query-data-sources`,
     `notion-create-pages`, `notion-update-page` (et, déjà présents,
     `notion-create-view`, `notion-update-view`, `notion-get-async-task`) ;
   - Gmail : `create_draft`, `list_drafts` (et, déjà présents, `search_threads`,
     `get_thread`, `get_draft`, `update_draft`, `send_message`) ;
   - Bash : `pnpm -s collecte:lire *` et `pnpm -s collecte:synthese *` (ajoutés le
     23 octobre), `node scripts/lire-page.mjs *`, `openssl rand *`, et `curl`
     vers `https://www.signauxfaibles.io/api/acces/` et `/api/veille/` seulement
     (`Bash(curl *https://www.signauxfaibles.io/api/veille/*)` couvre déjà la forme
     `curl -sS -m 60 … https://www.signauxfaibles.io/api/veille/lint` des agents).

   *Ce qui ne l'est pas, et ne doit pas l'être* : aucun outil Notion de suppression,
   de déplacement, de duplication ou de schéma (`notion-delete-pages`,
   `notion-move-pages`, `notion-duplicate-page`, `notion-update-data-source`,
   `notion-create-database`…), aucun outil Vercel, Stripe ou lemlist, et pas Bash
   en général : une commande hors de la liste redemande la permission. Une
   commande composée (`curl … | jq`) est vérifiée morceau par morceau, et redemande
   donc la permission pour le morceau qui n'est pas listé.

   *Un point à trancher par l'opératrice* : `mcp__Gmail__send_message` est autorisé
   depuis le 19 octobre, alors qu'aucune lettre ne doit partir d'un agent. Les
   pages Notion s'en servent pour les notifications internes (`[Relecture]`, à
   agathe@signauxfaibles.io) ; le retirer ferait redemander la permission à chaque
   notification, le garder laisse à un agent le moyen d'envoyer. La règle n'a pas
   été retirée.

   *Ce que seule l'opératrice peut faire, et qui lève vraiment l'attente* : dans
   claude.ai, Réglages, Connecteurs (https://claude.ai/customize/connectors),
   ouvrir Notion, puis ses permissions d'outils, et passer `notion-fetch`,
   `notion-search`, `notion-query-data-sources`, `notion-create-pages` et
   `notion-update-page` à « toujours autoriser » ; même geste pour Gmail sur
   `create_draft` et `list_drafts`. Laisser les autres outils, et ceux de
   suppression en particulier, sur « demander ». Un administrateur d'organisation
   peut avoir plafonné ce réglage ; il faut alors le lui demander. Le réglage vaut
   pour le compte, donc pour toutes les sessions et toutes les tâches planifiées.

   *Pour revenir en arrière* : retirer les lignes voulues de `permissions.allow`
   dans `.claude/settings.json` par un commit sur `main` (la session suivante les
   relit), et repasser les outils du connecteur à « demander » dans claude.ai.
   Aucun autre fichier ne porte ces autorisations, hormis `allowed-tools` dans
   chaque `.claude/skills/*/SKILL.md`, qui vaut pour le seul tour qui lance la
   commande.
5. **Mesurer la prochaine première lettre** par le même calcul, et corriger ce
   document.
