# Pivot : Notion headless alimenté par des tâches Cowork

Date : 9 septembre 2026. Statut : **proposition à valider**, rien n'est codé.
S'appuie sur les vérifications de `docs/etat-des-api.md` (mêmes sources,
même date).

## Décision annoncée

Le projet est **uniquement un Notion headless** : Notion est le back-office
et la source de vérité, des **tâches Cowork** (Claude Cowork, planifiées,
via le connecteur Notion) produisent et déposent la veille dans la base
« Éditions », et le portail Next.js **lit Notion**. Il n'y a plus de tâche de
synchronisation vers une base Postgres.

## Ce que ce pivot supprime

| Élément du CLAUDE.md actuel | Sort | Motif |
|---|---|---|
| Supabase Postgres, tables `editions`, `items`, `dossiers`, `dossier_evenements`, `sync_runs`, `notion_page_map` | **supprimé** | Notion porte les données ; plus de copie. |
| RLS multi-tenant sur `memberships` (règle 1) | **remplacé** | Le cloisonnement se fait dans le code du portail, sur une appartenance lue dans Notion (voir « Cloisonnement »). |
| Trigger.dev (webhook + cron de rattrapage) | **supprimé** | Plus de tâche longue : le webhook Notion sert seulement à invalider le cache Next.js ; le rattrapage est la revalidation temporelle. Trigger.dev v3 était de toute façon arrêtée. |
| Règle 2 « le portail n'appelle jamais l'API Notion à la requête » | **inversée, avec garde-fou** | Le portail appelle Notion, mais **jamais sans cache** : toute lecture passe par `use cache` avec revalidation par tag. |
| Règle 3 « resynchronisation idempotente par `page_id` » | **sans objet** | Plus de resynchronisation. Le `page_id` reste l'identifiant stable des URL du portail. |
| Tâche d'intake / génération de l'outil opérateur | **déplacée hors dépôt** | Ce sont les tâches Cowork. Le dépôt ne contient que le portail. |

## Ce qui reste vrai

- Le mode dégradé (règle 4) devient natif : Next.js sert la version en cache
  tant que Notion ne répond pas. Il faut le **vérifier** sur `cacheLife`
  (profils `stale` / `revalidate` / `expire`, non lus dans les sources ce
  matin) : au-delà de `expire`, la page tombe en erreur au lieu de rester
  périmée. Le profil doit être choisi long (`expire` de plusieurs jours).
- Impact à trois niveaux (règle 5), sentence case (règle 7), charte, polices,
  maquette : inchangés.
- Règle 6 (aucune donnée d'un autre client dans le HTML) : reste
  **non négociable** et devient plus délicate, car le cache Next.js est
  partagé entre utilisateurs. Voir « Cloisonnement ».
- Le filtrage sur le statut « publiée » se fait désormais **dans la requête
  Notion**, à chaque revalidation (filtre `status.equals`), plus dans une
  synchronisation.

## Architecture cible

```
Cowork (tâches planifiées, connecteur Notion)
   └─ écrit dans Notion : base « Éditions » (items structurés), base « Dossiers »,
      base « Clients » (accès)
Notion
   ├─ webhook page.properties_updated / page.created / page.deleted
   │     → POST /api/notion/webhook (vérif. signature SDK) → revalidateTag(...)
   └─ API 2025-09-03, lue uniquement depuis des fonctions `use cache`
Next.js 16 (Vercel)
   ├─ proxy.ts : session (Supabase Auth, lien magique en invitation seule)
   ├─ /[client]/editions/[page_id] : rendu depuis le cache, contrôle d'accès
   │     AVANT l'appel à la fonction cachée
   └─ /api/media/[block_id] : proxy d'images (URL Notion expirant en 1 h)
```

### Contraintes issues des vérifications

1. **Débit Notion** (3 req/s par intégration, plus une limite par
   workspace) : acceptable seulement parce que les lectures sont cachées.
   Une édition = 1 requête de page + 1 à 3 requêtes de blocs par tranche de
   100. Interdire toute lecture Notion hors `use cache`.
2. **Webhook = signal, pas donnée** : le handler vérifie la signature avec
   `verifyWebhookSignature` du SDK (≥ 5.23.0), répond 2xx immédiatement,
   et appelle `revalidateTag`. Il ne relit pas Notion lui-même. Les 8
   retentatives et l'ordre non garanti ne posent plus de problème : une
   invalidation en trop est sans effet.
3. **Rattrapage** : revalidation temporelle du cache (`cacheLife`, par
   exemple toutes les heures) remplace le cron. Aucune infrastructure
   supplémentaire.
4. **Images** : les URL de fichiers Notion expirent en 1 h. Une page en
   cache plusieurs heures contiendrait des liens morts. Deux solutions :
   route proxy `/api/media/[block_id]` qui relit le bloc et diffuse le
   fichier (cache CDN 50 min), ou consigne rédactionnelle « liens externes
   uniquement » dans Notion. Le proxy est la seule option robuste.
5. **Version d'API** : `2025-09-03` minimum, SDK `@notionhq/client` v5,
   requêtes via `dataSources.query`, `data_source_id` résolu au démarrage.
6. **Intégration Notion** partagée sur les bases « Éditions », « Dossiers »
   et « Clients » seulement, jamais sur le référentiel ni les pages de
   travail Cowork.

### Cloisonnement par client sans RLS

Le cloisonnement était garanti par Postgres. Il repose désormais sur trois
règles de code, à tester explicitement (Playwright, un compte par client) :

1. **Appartenance lue dans Notion** : base « Clients » avec une propriété
   « emails autorisés » (ou une relation vers une base « Accès »). Chaque
   édition et chaque dossier portent une relation « Client ». Lecture
   cachée, invalidée par webhook sur la base « Clients ».
2. **Contrôle d'accès hors du cache** : la vérification « cet utilisateur
   appartient à ce client » se fait dans le layout ou la page, **avant**
   d'appeler la fonction `use cache`. Une fonction cachée ne reçoit jamais
   l'identité de l'utilisateur en argument, seulement l'identifiant du
   client, et son résultat est servi à tous les membres du client.
3. **Requête Notion filtrée par client** : toute requête sur « Éditions »
   ou « Dossiers » porte le filtre `Client = X` ; jamais de requête globale
   puis filtrage en mémoire.

Ce schéma est plus fragile qu'une RLS (une seule ligne oubliée suffit).
C'est le coût du pivot ; il doit être compensé par les tests de recette de
la règle 6 et par une revue systématique de chaque nouvelle requête.

### Authentification : décision à prendre

Le lien magique en invitation seule reste souhaitable. Sans Postgres, deux
options :

| Option | Principe | Pour | Contre |
|---|---|---|---|
| **A. Supabase Auth seul** (recommandée) | Projet Supabase utilisé uniquement pour Auth : inscriptions désactivées, `shouldCreateUser: false`, comptes créés par `inviteUserByEmail` depuis un script opérateur, appartenance lue dans Notion. Aucune table applicative. | Flux vérifié ce matin (lien `token_hash` + `verifyOtp` serveur, SMTP personnalisé). `@supabase/ssr` + `proxy.ts` documentés. | Une dépendance de plus pour un seul usage ; deux listes d'emails à tenir cohérentes (Supabase et Notion « Clients »). |
| **B. Auth.js (next-auth) avec fournisseur email** | Sessions JWT sans base ; emails envoyés par Resend ; liste des emails autorisés lue dans Notion au moment de l'envoi. | Une seule source d'accès (Notion). Pas de Supabase. | Non vérifié dans les docs ce matin ; Auth.js exige normalement un adaptateur pour le fournisseur email (stockage des jetons de vérification), à confirmer. |

Une troisième voie (URL non devinables par client, sans authentification)
est **écartée** : incompatible avec la confidentialité d'une veille payante.

## CLAUDE.md : réécriture proposée des sections touchées

**« Ce que c'est »** : « Le contenu est produit par des tâches Cowork qui
écrivent dans Notion. Le portail lit Notion à travers un cache Next.js
(revalidation par webhook et par durée) ; il n'a pas de base de données. »

**« Stack »** :
- Next.js 16, App Router, TypeScript strict, Tailwind v4, `cacheComponents`
- API Notion `2025-09-03`, SDK `@notionhq/client` v5, intégration interne
  partagée sur « Éditions », « Dossiers », « Clients » uniquement
- Auth : option A ou B ci-dessus (à trancher)
- Polices via `next/font` (inchangé), Vitest, Playwright

**« Règles non négociables »** (remplace 1, 2, 3, 4) :
1. Aucune lecture Notion hors d'une fonction `use cache` ; aucune fonction
   cachée ne reçoit l'identité de l'utilisateur.
2. Contrôle d'appartenance avant tout appel caché ; toute requête Notion
   porte le filtre client.
3. Seules les pages en statut « publiée » sont demandées à Notion ; une
   dépublication ou une mise à la corbeille invalide le cache par webhook.
4. Mode dégradé : profil de cache à `expire` long ; le webhook ne relit
   jamais Notion ; l'opérateur est alerté par le monitoring Vercel.

**« Modèle de données »** : remplacé par le schéma des bases Notion
(« Éditions » avec ses propriétés typées, « Items » ou blocs structurés,
« Dossiers », « Clients »), à figer avec les tâches Cowork qui les
alimentent. Le point clé demeure : **un item = une ligne structurée**, pas
un bloc de texte libre, sinon le tri par impact et le repli par rubrique
sont impossibles.

**« Commandes »** : suppression de `supabase:*` et `trigger:dev`.

## Plan de sessions à réviser

Sessions supprimées : migrations Postgres, RLS, synchronisation Trigger.dev.
Sessions ajoutées : (1) client Notion caché + revalidation par webhook ;
(2) proxy d'images ; (3) auth et cloisonnement, avec la recette de la
règle 6 ; (4) contrat des bases Notion partagé avec les tâches Cowork.

## À vérifier avant la première session

1. Sémantique exacte de `cacheLife` (`stale`, `revalidate`, `expire`) et
   comportement quand l'origine est injoignable après `expire`.
2. Si l'option B est retenue : contrainte d'adaptateur du fournisseur
   email d'Auth.js.
3. Ce que le connecteur Notion de Cowork sait écrire (relations, statut,
   blocs) pour figer le schéma des bases.
