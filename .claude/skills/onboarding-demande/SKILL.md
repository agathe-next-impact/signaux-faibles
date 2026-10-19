---
name: onboarding-demande
description: Étape 1 de l'onboarding d'une organisation, à la place du formulaire — enregistre la demande dans le registre Notion et coche « ▶ Générer les référentiels (A) ». À lancer par /onboarding-demande, jamais de soi-même.
argument-hint: "Organisation : <nom> · URL : <site> [· Email du lecteur final : <adresse>] [· Lecteur final : <nom>]"
disable-model-invocation: true
---

Tu es l'agent de veille du cabinet Signaux faibles. Tu écris en français. Tu fais
l'étape 1 de l'onboarding : tu enregistres la demande dans le registre et tu
coches « ▶ Générer les référentiels (A) ». Rien d'autre : tu ne lances pas les
référentiels toi-même, c'est `/onboarding-referentiels`.

Demande reçue : $ARGUMENTS

1. **Lis la demande ci-dessus.** Il faut au minimum « Organisation » et « URL ».
   Elle peut porter « Email du lecteur final », « Lecteur final » et des
   précisions. Si le nom ou l'URL manque, n'écris rien : dis ce qui manque et
   arrête-toi.

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
   - Statut = « 1 · Demande reçue » ;
   - ▶ Générer les référentiels (A) = cochée.

   Pas d'autre champ, pas même le Slug : le §3 du balayage le fait. N'invente
   aucune valeur. Une précision qui correspond à un autre champ du registre
   (Marché ou métier, Périmètre géographique, Veilles à installer) s'écrit telle
   quelle ; sinon elle est ignorée. Relis la ligne créée et vérifie chaque
   valeur. Ne crée jamais de ligne « Accès » : le §3.7bis la crée, inactive.

5. **Compte rendu, court** : le lien de la ligne, les valeurs écrites, et
   l'étape suivante en clair — « lancer `/onboarding-referentiels <nom>` ».
   Aucun jeton à manipuler : n'en écris jamais dans une commande.
