---
name: onboarding-demande
description: Étape 1 de l'onboarding d'une organisation, à la place du formulaire — enregistre la demande dans le registre Notion et coche « ▶ Générer les référentiels (A) ». À lancer par /onboarding-demande, jamais de soi-même.
argument-hint: "Organisation : <nom> · URL : <site> · Objectifs de veille : <ce que la veille doit permettre, ou « à proposer »> [· Email du lecteur final : <adresse>] [· Lecteur final : <nom>] [· Offre déclarée : …] [· Acteurs déclarés : …] [· Contexte client : …]"
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

**Aucune confirmation en cours d'exécution, une seule question.** Lancer cette
commande vaut ordre pour toutes ses étapes : enchaîne-les sans demander de
validation intermédiaire. La seule question admise est celle des objectifs de
veille (étape 1 bis). Tu ne t'arrêtes que sur les gardes écrites ci-dessous ou
dans la page Notion, et tu le dis dans le compte rendu.

Tu es l'agent de veille du cabinet Signaux faibles. Tu écris en français. Tu fais
l'étape 1 de l'onboarding : tu enregistres la demande dans le registre et tu
coches « ▶ Générer les référentiels (A) ». Rien d'autre : tu ne lances pas les
référentiels toi-même, c'est `/onboarding-referentiels`.

Demande reçue : $ARGUMENTS

1. **Lis la demande ci-dessus.** Il faut au minimum « Organisation » et « URL ».
   Elle peut porter « Email du lecteur final », « Lecteur final » et des
   précisions. Si le nom ou l'URL manque, n'écris rien : dis ce qui manque et
   arrête-toi.

1 bis. **La question des objectifs de veille.** Si la demande ne porte pas
   « Objectifs de veille », pose une seule question avant d'écrire quoi que ce
   soit : « Que doit permettre cette veille au client : quelles décisions
   éclairer, quels sujets ne pas manquer ? Répondez « à proposer » pour que
   l'agent formule une hypothèse, soumise en point de validation. » Sans
   personne pour répondre (lancement par une tâche planifiée), laisse le champ
   vide : l'étape A formulera l'hypothèse et le point de validation. « À
   proposer » laisse aussi le champ vide. N'invente jamais d'objectif.

2. **Lis la règle avant d'écrire.** Ouvre dans Notion la page « Tâche —
   Onboarding d'une organisation (prompts A et B) »
   (`3d5fe829ce718112a40cfcaf55d3fd76`), au moins « Le cycle » et la garde 3.0
   du « Prompt — Balayage ». Elle fait foi : si cette commande et elle
   divergent, c'est elle qui l'emporte, et tu le dis. Si elle est
   inaccessible, n'écris rien et arrête-toi.

3. **Anti-doublon.** Interroge le registre « Organisations — pipeline et
   activation » (`collection://4ae154b9-0bca-42f3-9e2e-e546a40dd77f`) : une
   ligne dont « URL du site » désigne le même domaine, ou dont « Organisation »
   porte le même nom, accents et casse ignorés. Lis **toutes** les lignes, pas
   seulement celles qu'un filtre `contains` remonte. Si une ligne existe, ne
   crée rien et ne coche rien : donne son lien et son statut, et arrête-toi.

4. **Crée la ligne, et seulement ces champs :**
   - Organisation (titre) = le nom donné, tel quel ;
   - URL du site = l'adresse donnée, complétée en `https://` si le schéma manque ;
   - Email du lecteur final = l'adresse donnée, sinon vide ;
   - Lecteur final = le nom donné, sinon vide ;
   - Objectifs de veille = la réponse à l'étape 1 bis, telle quelle, sinon vide ;
   - Statut = « 1 · Demande reçue » ;
   - ▶ Générer les référentiels (A) = cochée.

   Pas d'autre champ, pas même le Slug : le §3 du balayage le fait. N'invente
   aucune valeur. Une précision qui correspond à un autre champ du registre
   (Marché ou métier, Périmètre géographique, Veilles à installer, Offre
   déclarée, Acteurs déclarés, Contexte client, Q1 à Q3) s'écrit telle quelle ;
   sinon elle est ignorée. Une offre donnée sans « publiée » ou « non publiée »
   s'écrit avec « publication : à préciser » et la date du jour. Ces champs
   déclarés priment sur le site à l'étape A (hiérarchie des sources du
   balayage). Relis la ligne créée et vérifie chaque
   valeur. Ne crée jamais de ligne « Accès » : le §3.7bis la crée, inactive.

5. **Compte rendu, court** : le lien de la ligne, les valeurs écrites, et
   l'étape suivante en clair — « lancer `/onboarding-referentiels <nom>` ».
   Aucun jeton à manipuler : n'en écris jamais dans une commande.
