---
name: onboarding-repercussion
description: Lancement A-bis de l'onboarding — répercute les réponses aux points de validation dans la fiche et les référentiels, et passe au statut 3 si la porte passe, en appliquant le §2 du balayage Notion. À lancer par /onboarding-repercussion <organisation>.
argument-hint: "<nom de l'organisation> [partiel | contexte]"
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
Tu écris en français. Ce lancement est le **A-bis** : répercuter les validations
d'une organisation.

Organisation visée : $ARGUMENTS

1. **Lis la règle.** Ouvre la page Notion « Tâche — Onboarding d'une
   organisation (prompts A et B) » (`3d5fe829ce718112a40cfcaf55d3fd76`) :
   « Le cycle », le préambule du « Prompt — Balayage » et son **§2** (2.1 à
   2.5). C'est ce §2 que tu exécutes, tel qu'il est écrit dans Notion
   aujourd'hui. Si la page est inaccessible, n'écris rien et arrête-toi.

2. **Trouve la ligne** du registre
   (`collection://4ae154b9-0bca-42f3-9e2e-e546a40dd77f`) dont « Organisation »
   est ce nom, accents et casse ignorés. Aucune ou plusieurs : n'écris rien,
   dis-le, arrête-toi. Argument vide : traite la vue « Réponses client à
   répercuter » (`view://3d6fe829-ce71-81a5-b11c-000c8a76aea5`) entière, comme
   le balayage.

3. **Garde de statut.** Statuts 2, 3, 4 ou 5 seulement. Au statut 6, la
   répercussion des validations appartient à la revue mensuelle : dis-le et
   arrête-toi, sauf si l'argument dit explicitement de forcer, ou s'il porte
   « contexte » (voir 4 bis). Au statut 1 : renvoie à `/onboarding-referentiels`.

4. **La porte de la priorité 1.** Le §2 ne traite l'organisation que si tous
   ses points « 1 · Scoring » ont une « Valeur corrigée » ; les points
   « 2 · Fiche » ne bloquent pas, ils sont répercutés s'ils ont une réponse.
   Si l'argument porte « partiel », coche « ▶ Répercuter les validations
   (A-bis) » : le §2 force alors une répercussion partielle. Sinon, et si des
   points de priorité 1 manquent, ne répercute rien et liste ce qui manque.

4 bis. **Contexte client.** Si l'argument porte « contexte », ou si
   « ▶ Mettre à jour le contexte » est déjà cochée, exécute la file
   « CONTEXTE À RÉPERCUTER » du §2 pour cette organisation, statuts 2 à 6
   compris : les champs déclarés du registre (« Objectifs de veille »,
   « Offre déclarée », « Acteurs déclarés », « Contexte client », Q1 à Q3)
   sont appliqués à la fiche et aux deux référentiels selon la hiérarchie des
   sources écrite en tête du balayage. Une déclaration « non publiée » cadre le
   scoring et n'est jamais présentée comme publique. Tu n'écris jamais dans
   « Valeur corrigée » ; un point déjà répondu que la déclaration touche est
   signalé « à reconfirmer ». Le statut ne change pas. Coche la case avant,
   décoche-la après.

5. **Exécute le §2** : lis les deux champs (« Valeur corrigée », « Répercuté
   dans »), jamais le statut formule ; la réponse du client est prise telle
   quelle ; le statut de la ligne ne recule jamais ; passage au statut 3
   seulement depuis le statut 2.

   Une réponse qui fait réécrire un référentiel ne touche jamais à la structure
   de son §6 : le §6 garde le bloc du prompt de génération (« Référentiel de
   veille », `3d2fe829ce71801eae49fa7fc4a0e76c`), « STRUCTURE, INVARIABLE » et
   « Ce que cela change pour vous » compris. Si tu trouves un §6 réduit à un renvoi
   au contrat de forme, remplace-le par ce bloc et note-le au journal.

6. **Consomme la case** si elle était cochée, et écris le résultat dans
   « Dernier lancement manuel ».

7. **Notification 2.5 et compte rendu.** Si la porte vient de passer, l'étape
   suivante est `/onboarding-premiere-lettre <nom>` — tu ne la lances pas toi-même.

Aucun jeton à manipuler : n'en écris jamais dans une commande.
