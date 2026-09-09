# Portail Signaux Faibles — contexte pour Claude Code

## Ce que c'est

Un portail web où les clients d'une veille hebdomadaire consultent leurs
éditions archivées : la note de la semaine, l'historique, les dossiers
ouverts suivis d'édition en édition.

**Notion est le back-office unique (CMS headless).** Le contenu est produit
par des tâches Cowork planifiées (intake, génération, relecture) qui écrivent
dans les bases Notion ; ces tâches vivent hors de ce dépôt. Le portail
**lit Notion**, exclusivement à travers le cache de Next.js, invalidé par
webhook Notion et par revalidation périodique. Le portail n'a **pas de base
de données** et n'écrit jamais dans Notion.

Domaine : signal-faible.fr (ou équivalent retenu — voir `docs/domaine.md`
si présent). Marque : « signauxfaibles » — voir `docs/charte-design.pdf` et
sa transcription `docs/charte-design.md`. Maquette de référence de la page
d'édition et du panneau des dossiers : `docs/maquette-edition.html` — à
ouvrir dans un navigateur avant de coder l'écran, c'est elle qui fait foi
pour la hiérarchie visuelle, pas une reformulation de ce fichier.

Décisions d'architecture et faits vérifiés : `docs/etat-des-api.md`
(état des API au 9 septembre 2026) et `docs/architecture-notion-headless.md`
(pivot Notion headless, lien magique persistant). Les lire avant toute
session.

## Stack (ne pas changer sans discussion)

- Next.js 16, App Router, TypeScript strict, `cacheComponents` activé,
  Tailwind v4 — tokens dans `app/globals.css` via `@theme`, générés depuis
  `docs/charte-design.md` (couleurs, échelle typographique, rayons), jamais
  réinventés ; polices raccordées avec `@theme inline`
- API Notion version `2025-09-03` minimum, SDK `@notionhq/client` v5
  (`dataSources.query`, `data_source_id` résolu au démarrage). Intégration
  interne partagée UNIQUEMENT sur les bases « Éditions de veille » et
  « Accès » — jamais sur le registre des organisations, les validations,
  les référentiels ni les pages de travail des tâches Cowork
- Accès par **lien magique persistant** signé HMAC (secret d'environnement),
  **un lien par personne**, cookie de session 12 mois, appartenance lue dans
  la base Notion « Accès ». Pas de fournisseur d'auth tiers, pas de mot de
  passe. Une **tâche Cowork** tient la base « Accès » (création,
  révocation) ; le **portail** recompose et envoie le lien par l'**API
  Gmail de Google Workspace** (compte de service, délégation à l'échelle du
  domaine limitée à la portée `gmail.send`, boîte émettrice dédiée ; pas de
  SMTP, l'authentification basique est arrêtée pour Workspace) depuis la
  page « recevoir mon lien », premier envoi et renvoi confondus. Le secret
  HMAC ne quitte jamais le portail
- Lectures Notion en `'use cache: remote'` (le cache mémoire ne survit pas
  en serverless), profil unique `notion` : `stale` 5 min, `revalidate` 1 h,
  `expire` 30 jours. Tags `page:<page_id>` et `liste:<data_source_id>`
- Webhook Notion reçu par un route handler Next.js, signature vérifiée avec
  `verifyWebhookSignature` du SDK, réponse 2xx immédiate, puis
  `revalidateTag(tag, 'max')`. Le handler ne relit jamais Notion et
  n'envoie jamais d'email
- **Notion sur le plan gratuit** : l'espace de travail reste à **un seul
  membre** (l'opérateur). Un espace gratuit à plusieurs membres est plafonné
  à 1 000 blocs à vie et l'API refuse ensuite toute création. Les clients ne
  sont jamais membres ni invités de Notion. Fichiers limités à 5 Mio. Les
  tâches Cowork n'utilisent ni la recherche IA ni le mode SQL du connecteur
- Polices via `next/font/google` : Lora (titres), Public Sans
  (corps/interface), IBM Plex Mono (dates, sources, métadonnées) — jamais
  interverties. IBM Plex Mono n'a pas de version variable : `weight`
  explicite obligatoire
- Vitest, Playwright, ESLint en direct (`next lint` n'existe plus)

Avant d'utiliser une fonctionnalité de l'API Notion ou de Next.js
(`use cache`, `cacheLife`, `proxy.ts`), vérifier la documentation courante
plutôt que la mémoire : ces API évoluent. Les faits déjà vérifiés sont dans
`docs/etat-des-api.md`, avec leur date.

## Règles non négociables

1. **Aucune lecture Notion hors d'une fonction `use cache`.** Le débit Notion
   est de 3 requêtes par seconde par intégration, plus une limite par
   workspace ; une lecture non cachée est un bug bloquant. Une fonction
   cachée ne reçoit jamais l'identité de l'utilisateur en argument,
   seulement l'identifiant du client, et son résultat est partagé entre les
   membres de ce client.
2. **Cloisonnement par client dans le code, sans filet.** Il n'y a plus de
   RLS. Le contrôle « cette personne appartient à ce client » se fait dans
   `proxy.ts` et dans le layout, AVANT tout appel caché. Toute requête sur
   « Éditions », « Items » ou « Dossiers » porte le filtre `Client = X` ;
   jamais de requête globale puis filtrage en mémoire. Chaque nouvelle
   requête Notion est relue sous cet angle avant commit.
3. **Seules les éditions en statut « Envoyé » sont demandées à Notion**
   (filtre `select.equals` dans la requête, avec le filtre Organisation).
   Un retour en Brouillon ou une mise à la corbeille invalide le cache par
   webhook ; le portail ne conserve aucune copie.
4. **Mode dégradé obligatoire** : profil `cacheLife` à expiration longue,
   pour que Next.js serve la dernière version connue si Notion ne répond
   pas ; aucune page d'erreur côté client ; l'opérateur est alerté par le
   monitoring Vercel.
5. **Les URL de fichiers Notion expirent en une heure.** Aucune URL de
   fichier Notion n'est écrite dans le HTML : les images passent par la
   route proxy `/api/media/[block_id]`, ou sont des liens externes.
6. Impact scoré à trois niveaux seulement (fort / moyen / RAS). Ne pas
   ajouter de niveau ni de couleur d'impact supplémentaire — c'est une
   règle de la charte, pas un choix d'implémentation. Dans Notion, le
   niveau est le suffixe du titre H2 d'une famille (« Famille — FORT »,
   « — MOYEN », « — RAS ») ; **FAIBLE n'existe pas** et doit disparaître des
   référentiels. Un suffixe inconnu s'affiche sans badge, jamais converti
   en un autre niveau.
7. Aucune donnée d'un client n'apparaît dans le HTML envoyé au navigateur
   d'un autre client, y compris dans les payloads JSON non affichés (props
   Next.js sérialisées). Vérifier explicitement à la recette avec un compte
   par client (Playwright).
8. Le jeton d'accès n'apparaît jamais ailleurs que dans l'URL
   `/acces/[jeton]`, qui redirige immédiatement. Révocation = case `actif`
   décochée dans « Accès », effective à la requête suivante. Comparaison de
   signature en temps constant.
9. Sentence case partout dans l'UI, jamais de capitales sauf les labels en
   police mono (charte, §03 Typographie). Ne pas laisser un composant
   shadcn ou un défaut Tailwind réintroduire des majuscules.

## Modèle de données (bases Notion)

Les bases Notion **sont** le contrat ; aucun fichier n'est partagé entre le
portail et les tâches Cowork. Cowork découvre le schéma dans Notion à chaque
exécution. Le portail garde dans son code la liste de ce qu'il attend, la
confronte au schéma réel au démarrage et refuse de démarrer si une propriété
manque. État des lieux et écarts : `docs/base-notion-existante.md`.

Bases partagées avec l'intégration du portail, et elles seules :

- **Éditions de veille** (existe, `collection://f3e703c8-3178-4f70-946b-72be0c2f6db1`) :
  Titre · Organisation (sélection, nom exact) · Veille (Écosystème /
  Concurrentiel) · Date d'édition · Numéro · Statut (Brouillon / Relu /
  **Envoyé** = publié) · Période couverte · Fenêtre élargie · Dossiers
  ouverts suivis (texte « nom (compteur, précision) · … ») · Action de la
  semaine · Amendements au référentiel et Livraison (**internes, jamais
  affichés**).
  Le corps de la page est la note, **rendue comme un document** (décision
  du 9 septembre 2026, pas de base « Items ») : H1 de rubriques, H2
  « Famille — FORT / MOYEN / RAS » repliables avec badge d'impact lu dans
  le suffixe, paragraphes, puces, tableaux. Le tri par impact se fait au
  niveau des familles. Le corps ne contient aucun bloc interne.
- **Accès — portail** (existe, `collection://4d3d7403-35d7-4815-884b-877d17423842`) :
  Nom (titre) · Email · Organisation (texte identique à l'option de
  sélection des éditions) · Slug · Identifiant d'accès · Actif.

Jamais partagés : le registre « Organisations — pipeline et activation »
(intake confidentiel), « Validations », les pages organisation, les
référentiels, les prompts.

Deux lettres par parution et par organisation (une par veille), numérotées
séparément. Le `page_id` Notion est l'identifiant stable des URL du portail.
Ne jamais raisonner sur le titre d'une édition : il est fixé par chaque
référentiel et varie d'une organisation à l'autre.

## Commandes

- `pnpm dev` · `pnpm build`
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
