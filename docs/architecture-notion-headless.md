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
| Supabase (Postgres, Auth), tables `editions`, `items`, `dossiers`, `dossier_evenements`, `sync_runs`, `notion_page_map` | **supprimé** | Notion porte les données ; l'accès se fait par lien persistant maison (voir « Authentification »). |
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
   ├─ /acces/[jeton] : lien magique persistant → cookie de session 12 mois
   ├─ proxy.ts : cookie → identifiant d'accès → client (base « Accès », cachée)
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

### Authentification : lien magique persistant (décision prise)

Décision : chaque personne autorisée reçoit un **lien d'accès persistant**,
qu'elle peut mettre en favori et rouvrir sans limite. Pas de mot de passe,
pas de lien à usage unique.

Ce que les vérifications imposent :

- **Supabase Auth ne convient pas.** Ses liens magiques sont « one-time use
  only », expirent après 1 h par défaut, et la doc déconseille fortement
  toute expiration au-delà de 24 h. Un lien persistant est donc un
  mécanisme propre au portail. **Supabase sort de la stack.**
- **Le lien est une capacité** : qui le détient entre. C'est accepté par
  conception (comme un lien de partage), et compensé par la révocation
  individuelle et par une hygiène d'URL stricte.

Conception proposée :

1. **Base Notion « Accès »** : une ligne par personne, avec `email`,
   relation `Client`, `identifiant d'accès` (aléatoire, généré par la tâche
   Cowork ou l'opérateur), case `actif`. Le portail la lit en cache,
   invalidée par webhook. Aucune écriture du portail dans Notion.
2. **Jeton** : `identifiant d'accès` signé HMAC-SHA256 avec un secret
   d'environnement, encodé en base64url. Le lien est
   `https://signal-faible.fr/acces/<jeton>`. Notion ne stocke jamais le
   secret ; révoquer = décocher `actif` ou régénérer l'identifiant.
3. **Route `/acces/[jeton]`** : vérifie la signature en temps constant,
   cherche l'identifiant dans « Accès » (cache), pose un cookie de session
   `httpOnly`, `Secure`, `SameSite=Lax`, durée 12 mois, contenant le seul
   identifiant d'accès signé, puis **redirige immédiatement** vers
   `/[client]` : le jeton ne reste ni dans l'historique de navigation ni
   dans un `Referer`. `Referrer-Policy: same-origin` sur tout le portail.
4. **`proxy.ts`** : lit le cookie, revalide l'identifiant contre « Accès »
   à chaque requête (lecture cachée, donc gratuite) ; un accès désactivé
   dans Notion coupe la session à la requête suivante, même avec un cookie
   valide.
5. **Perte du lien** : page « recevoir mon lien » où la personne saisit son
   email ; si l'email figure dans « Accès », le lien lui est renvoyé (via
   Resend, ou par une tâche Cowork déclenchée par l'opérateur). Réponse
   identique que l'email existe ou non.

Choix par défaut, à confirmer : **un lien par personne**, pas par client.
Un lien par client est plus simple à distribuer mais impossible à révoquer
pour une seule personne qui quitte l'entreprise cliente.

Risques assumés et parades :

| Risque | Parade |
|---|---|
| Lien transféré à un tiers | révocation individuelle dans Notion ; journal des accès côté Vercel |
| Jeton deviné | identifiant de 256 bits + signature HMAC ; comparaison en temps constant |
| Jeton dans les journaux ou l'historique | redirection immédiate ; `Referrer-Policy` ; pas de jeton dans les URL après connexion |
| Cookie volé | `httpOnly`, `Secure` ; durée 12 mois ; révocation par Notion effective à la requête suivante |
| Secret HMAC compromis | rotation du secret invalide tous les liens ; renvoi automatique des nouveaux liens |

## CLAUDE.md : réécriture proposée des sections touchées

**« Ce que c'est »** : « Le contenu est produit par des tâches Cowork qui
écrivent dans Notion. Le portail lit Notion à travers un cache Next.js
(revalidation par webhook et par durée) ; il n'a pas de base de données. »

**« Stack »** :
- Next.js 16, App Router, TypeScript strict, Tailwind v4, `cacheComponents`
- API Notion `2025-09-03`, SDK `@notionhq/client` v5, intégration interne
  partagée sur « Éditions », « Dossiers », « Clients » uniquement
- Accès par lien magique persistant signé (pas de Supabase), appartenance lue dans Notion « Accès »
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
2. Choix du canal d'envoi des liens (Resend depuis le portail, ou tâche
   Cowork) et « un lien par personne » vs « un lien par client ».
3. Ce que le connecteur Notion de Cowork sait écrire (relations, statut,
   blocs) pour figer le schéma des bases.
