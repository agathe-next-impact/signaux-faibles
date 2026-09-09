# Portail Signaux Faibles — contexte pour Claude Code

## Ce que c'est

Un portail web où les clients d'une veille hebdomadaire (produite par le
dispositif décrit dans `docs/cahier-des-charges.md` et
`docs/prompt-referentiel.md`) consultent leurs éditions archivées : la note
de la semaine, l'historique, les dossiers ouverts suivis d'édition en
édition. Le contenu est rédigé et relu dans Notion ; le portail n'est
JAMAIS un client Notion à l'exécution — une tâche de synchronisation copie
le contenu publié dans Postgres, et le portail ne lit que Postgres.

Domaine : signal-faible.fr (ou équivalent retenu — voir `docs/domaine.md`
si présent). Marque : « signauxfaibles » — voir `docs/charte-design.pdf` et
sa transcription `docs/charte-design.md`. Maquette de référence de la page
d'édition et du panneau des dossiers : `docs/maquette-edition.html` — à
ouvrir dans un navigateur avant la session 4, c'est elle qui fait foi pour
la hiérarchie visuelle, pas une reformulation de ce fichier.

Ce portail est un produit séparé de l'outil interne de l'opérateur (intake,
génération, relecture) décrit dans le cahier des charges principal. Il ne
partage que la base Postgres, en lecture, via RLS. Aucune route du portail
n'écrit dans les tables `editions`, `items` ou `dossiers` — ces tables sont
alimentées uniquement par la tâche de synchronisation Notion.

## Stack (ne pas changer sans discussion)

- Next.js 15, App Router, TypeScript strict, Tailwind v4 — tokens dans
  `app/globals.css`, à générer depuis `docs/charte-design.md` (couleurs,
  échelle typographique, rayons) et non réinventés
- Supabase Postgres avec RLS, Auth par lien magique (pas de mot de passe)
- Trigger.dev v3 pour la tâche de synchronisation Notion (webhook + filet
  de rattrapage cron), reprenable et idempotente
- API Notion officielle (intégration interne, partagée UNIQUEMENT sur la
  base « Éditions », jamais sur le référentiel ni les pages internes)
- Polices via `next/font` : Lora (titres), Public Sans (corps/interface),
  IBM Plex Mono (dates, sources, métadonnées) — jamais interverties
- Vitest, Playwright

Avant d'utiliser une fonctionnalité de l'API Notion, du SDK Supabase ou de
Trigger.dev, vérifier la documentation courante plutôt que la mémoire : ces
API évoluent, et le webhook Notion notamment est récent.

## Règles non négociables

1. Cloisonnement par tenant en RLS sur `auth.uid()` → `memberships` →
   `tenant_id`. Aucune requête ne filtre par tenant côté application
   seulement : si RLS est désactivée sur une table, c'est un bug bloquant,
   pas un détail à corriger plus tard.
2. Le portail n'appelle jamais l'API Notion à la requête. Toute lecture
   passe par les tables Postgres alimentées par la synchronisation.
3. La synchronisation n'importe que les pages Notion en statut « publiée ».
   Un item resynchronisé garde son identifiant stable (Notion `page_id` en
   clé d'idempotence) : une resynchronisation ne duplique jamais une ligne.
4. Mode dégradé obligatoire : si la synchronisation échoue, le portail sert
   la dernière version connue en base et le rendu du statut se dégrade
   silencieusement pour le client (pas de page d'erreur) ; l'opérateur est
   alerté par email.
5. Impact scoré à trois niveaux seulement (fort / moyen / RAS). Ne pas
   ajouter de niveau ni de couleur d'impact supplémentaire — c'est une
   règle de la charte, pas un choix d'implémentation.
6. Aucune donnée d'un tenant n'apparaît dans le HTML envoyé au navigateur
   d'un autre tenant, y compris dans les payloads JSON non affichés
   (props Next.js sérialisées). Vérifier explicitement à la recette.
7. Sentence case partout dans l'UI, jamais de capitales sauf les labels en
   police mono (charte, §03 Typographie). Ne pas laisser un composant
   shadcn ou un défaut Tailwind réintroduire des majuscules.

## Modèle de données (portail)

`tenants` (id, nom, slug) · `memberships` (user_id, tenant_id, rôle) ·
`editions` (id, tenant_id, date, titre, statut) · `items` (id, edition_id,
rubrique, impact fort|moyen|ras, changement, fait, source_url, source_date,
declaratif bool, meta) · `dossiers` (id, tenant_id, nom, compteur,
derniere_maj) · `dossier_evenements` (dossier_id, edition_id, resume,
date) · `sync_runs` (id, statut, demarre_a, termine_a, erreur) ·
`notion_page_map` (notion_page_id unique, table_cible, ligne_id) — table
d'idempotence de la synchronisation.

Le point clé : les items sont stockés structurés (une ligne par item,
colonnes typées), jamais un bloc HTML unique par édition. C'est ce qui
permet le repli/dépli par rubrique, le tri par impact et le lien vers un
dossier depuis la maquette.

## Commandes

- `pnpm dev` · `pnpm supabase:start` / `pnpm supabase:migrate`
- `pnpm trigger:dev`
- `pnpm test` · `pnpm e2e` · `pnpm lint && pnpm typecheck` avant tout commit

## Méthode de travail attendue

- Lire `docs/plan-sessions-portail.md` : sessions ordonnées, ne pas
  anticiper une session suivante.
- Avant de coder un écran, ouvrir `docs/maquette-edition.html` dans un
  navigateur à côté de l'éditeur.
- Après chaque écran, capturer une capture et la comparer à la maquette ;
  corriger les écarts avant de passer à la session suivante.
- Si une règle de la charte semble en tension avec une contrainte technique
  (ex. police non disponible en next/font), s'arrêter et demander plutôt
  que d'improviser une équivalence.
