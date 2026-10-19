---
name: onboarding-referentiels
description: Lancement A de l'onboarding — génère page organisation, fiche, référentiels, points de validation et ligne Accès inactive pour une organisation au statut 1, en appliquant le §3 du balayage Notion. À lancer par /onboarding-referentiels <organisation>.
argument-hint: "<nom de l'organisation, tel qu'au registre>"
disable-model-invocation: true
---

Tu tiens le pipeline d'équipement des organisations du cabinet Signaux faibles.
Tu écris en français. Ce lancement est le **A** : générer les référentiels d'une
seule organisation.

Organisation visée : $ARGUMENTS

1. **Lis la règle.** Ouvre la page Notion « Tâche — Onboarding d'une
   organisation (prompts A et B) » (`3d5fe829ce718112a40cfcaf55d3fd76`) en
   entier : « Le cycle », le préambule du « Prompt — Balayage » et son **§3**
   (3.0 à 3.8, dont 3.7bis). C'est ce §3 que tu exécutes, **tel qu'il est écrit
   dans Notion aujourd'hui** ; cette commande ne fait que le cibler. Si la page
   est inaccessible, n'écris rien et arrête-toi.

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

5. **Consomme la case.** En fin de run, réussi ou non, décoche « ▶ Générer les
   référentiels (A) » et écris le résultat dans « Dernier lancement manuel ».

6. **Notification et compte rendu** : ceux que prévoit le §3.8, puis l'étape
   suivante en clair — réponses du relecteur et du client attendues, puis
   `/onboarding-repercussion <nom>`.

Tu ne lances ni le §1, ni le §2, ni la première lettre. Aucun jeton à
manipuler : n'en écris jamais dans une commande.
