---
name: onboarding-referentiels
description: Lancement A de l'onboarding — génère page organisation, fiche, référentiels, points de validation et ligne Accès inactive pour une organisation au statut 1, en appliquant le §3 du balayage Notion. À lancer par /onboarding-referentiels <organisation>.
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
Tu écris en français. Ce lancement est le **A** : générer les référentiels d'une
seule organisation.

Organisation visée : $ARGUMENTS

1. **Lis la règle.** Ouvre la page Notion « Tâche — Onboarding d'une
   organisation (prompts A et B) » (`3d5fe829ce718112a40cfcaf55d3fd76`) en
   entier : « Le cycle », le préambule du « Prompt — Balayage » et son **§3**
   (3.0 à 3.8, dont 3.7bis). C'est ce §3 que tu exécutes, **tel qu'il est écrit
   dans Notion aujourd'hui** ; cette commande ne fait que le cibler. Ouvre aussi,
   **en entier**, le prompt de génération que le §3.6 applique : page « Référentiel
   de veille » (`3d2fe829ce71801eae49fa7fc4a0e76c`), section « 2. Le prompt ». Si
   l'une des deux pages est inaccessible, n'écris rien et arrête-toi.

2. **Trouve la ligne.** Dans le registre
   (`collection://4ae154b9-0bca-42f3-9e2e-e546a40dd77f`), la ligne dont
   « Organisation » est ce nom, accents et casse ignorés. Aucune ligne, ou
   plusieurs : n'écris rien, dis-le et arrête-toi. Si l'argument est vide,
   prends les lignes de la vue « Nouvelles demandes »
   (`view://3d6fe829-ce71-8142-beb2-000ca64b710b`), comme le balayage.

3. **Garde de statut.** La ligne doit être au statut « 1 · Demande reçue ».
   Sinon, ne fais rien, dis où elle en est et quelle commande la fait avancer.
   Si « ▶ Générer les référentiels (A) » n'est pas cochée, coche-la : lancer
   cette commande est l'ordre, la case en est la trace.

4. **Exécute le §3** sur cette ligne, de la garde 3.0 au 3.8, sans en sauter.
   La garde 3.0 et la recherche d'un dispositif existant passent avant toute
   création. La ligne « Accès » du 3.7bis est créée **inactive**, avec
   l'identifiant de la **ligne du registre**, jamais celui de la page
   organisation.

   **Le §6 de chaque référentiel recopie le bloc §6 du prompt de génération,
   verbatim**, variables substituées : la structure en treize rubriques, les faits
   de 1 à 3 paragraphes avec « Ce que cela change pour vous », l'analyse, le volume
   minimal. Il ne se réduit jamais à un renvoi au contrat de forme, qui ne dit que
   la forme. Avant de livrer, relis chaque §6 : s'il ne contient pas « STRUCTURE,
   INVARIABLE » et « Ce que cela change pour vous », il est à refaire. Les deux §6
   réduits à un renvoi, en octobre 2026, ont donné des lettres trois fois plus
   maigres que les autres.

5. **Consomme la case.** En fin de run, réussi ou non, décoche « ▶ Générer les
   référentiels (A) » et écris le résultat dans « Dernier lancement manuel ».

6. **Notification et compte rendu** : ceux que prévoit le §3.8, puis l'étape
   suivante en clair — réponses du relecteur et du client attendues, puis
   `/onboarding-repercussion <nom>`.

Tu ne lances ni le §1, ni le §2, ni la première lettre. Aucun jeton à
manipuler : n'en écris jamais dans une commande.
