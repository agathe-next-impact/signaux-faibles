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
5. **Obtenir ou retrouver son lien** : page « recevoir mon lien » où la
   personne saisit son email ; si l'email figure dans « Accès » et est
   actif, le portail lui envoie le lien par Resend. Réponse identique que
   l'email existe ou non.

Décisions prises le 9 septembre 2026 :

- **Un lien par personne**, pas par client : révocable individuellement
  quand une personne quitte l'entreprise cliente.
- **Notion sur le plan gratuit** (voir « Contraintes du plan gratuit »).
- **Lien perdu : email automatisé**, sans intervention de l'opérateur.

Répartition recommandée entre Cowork et le portail, qui découle du secret
HMAC :

- **Cowork tient la base « Accès »** : création de la ligne (email, client,
  identifiant aléatoire, actif), révocation, régénération. Cowork ne
  connaît pas le secret et ne fabrique jamais de lien.
- **Le portail est le seul émetteur d'emails**, via Resend (plan gratuit :
  3 000 emails par mois, 100 par jour). Il détient le secret, lit « Accès »
  en cache et recompose le lien à la demande. Premier envoi et renvoi
  passent par le même flux : la page « recevoir mon lien ». L'opérateur dit
  simplement à la personne « saisissez votre email sur signal-faible.fr ».
- Ce choix évite deux écueils : faire sortir le secret vers Cowork, et
  envoyer un email depuis le handler de webhook (huit tentatives Notion
  possibles, donc doublons).

Garde-fous de la page « recevoir mon lien » : réponse identique que
l'email soit connu ou non ; un envoi au plus par email toutes les dix
minutes et par adresse IP ; journal côté Vercel ; pas de lien dans les
journaux.

Risques assumés et parades :

| Risque | Parade |
|---|---|
| Lien transféré à un tiers | révocation individuelle dans Notion ; journal des accès côté Vercel |
| Jeton deviné | identifiant de 256 bits + signature HMAC ; comparaison en temps constant |
| Jeton dans les journaux ou l'historique | redirection immédiate ; `Referrer-Policy` ; pas de jeton dans les URL après connexion |
| Cookie volé | `httpOnly`, `Secure` ; durée 12 mois ; révocation par Notion effective à la requête suivante |
| Secret HMAC compromis | rotation du secret invalide tous les liens ; renvoi automatique des nouveaux liens |

### Contraintes du plan gratuit Notion

Décision : pas d'utilisation payante de Notion. Faits vérifiés (détail et
sources dans `docs/etat-des-api.md`, §2.5) :

- **L'espace de travail doit rester à un seul membre.** Un espace gratuit à
  plusieurs membres est plafonné à 1 000 blocs à vie, et l'API refuse toute
  création trois jours après le dépassement (HTTP 403 `restricted_resource`).
  Un espace à un seul membre n'a pas de limite. Les clients ne sont jamais
  membres ni invités : le portail est leur seule interface, ce qui est
  précisément le sens du pivot.
- **Fichiers limités à 5 Mio** ; sans objet si les médias sont des liens
  externes, à surveiller si les tâches Cowork téléversent des images.
- **Le connecteur Notion de Cowork fonctionne sans plan payant** pour créer,
  lire et mettre à jour pages et bases. Les tâches Cowork ne doivent pas
  dépendre de la recherche IA ni du mode SQL de `query_data_sources`
  (payants) ; la lecture en mode « vue » est gratuite.
- **Webhooks d'intégration** : aucune restriction de plan documentée. Ne pas
  confondre avec les « webhook actions » des automatisations Notion, qui
  sont payantes et que le projet n'utilise pas.
- **Limite de débit par workspace** « scaled to the workspace's plan » :
  valeur non publiée pour le plan gratuit ; le cache Next.js la rend
  indolore pour le portail, mais les tâches Cowork doivent écrire par
  petits lots.
- Historique de page limité à 7 jours sur le plan gratuit : sans incidence
  pour le portail, mais l'opérateur n'a pas de filet long en cas de
  suppression accidentelle dans Notion.

### Profil de cache recommandé

Sémantique de `cacheLife` (vérifiée, voir `docs/etat-des-api.md` §5.5) :
`stale` = durée pendant laquelle le navigateur réutilise sans demander au
serveur ; `revalidate` = au-delà, la requête suivante est servie depuis le
cache et déclenche une régénération en arrière-plan ; `expire` = au-delà,
la requête suivante attend Notion.

Recommandation, un seul profil nommé `notion` dans `next.config.ts` :

| Durée | Valeur | Pourquoi |
|---|---|---|
| `stale` | 5 min | navigation instantanée entre éditions ; une publication n'attend jamais plus de 5 min côté navigateur |
| `revalidate` | 1 h | filet de rattrapage si un webhook est perdu : au pire, une heure de retard, sans cron ni infrastructure |
| `expire` | 30 jours | mode dégradé : Notion peut être injoignable un mois avant qu'une page tombe en erreur |

Avec le webhook, le contenu est en pratique à jour dans la minute. Le
profil `revalidate` ne sert qu'en secours.

Trois règles d'accompagnement :

1. **`'use cache: remote'`** pour toutes les lectures Notion, pas
   `'use cache'` seul : en serverless le cache mémoire ne survit pas entre
   requêtes, et il est vidé à chaque déploiement. La doc Next.js cite
   précisément « rate-limited APIs » et « flaky or unreliable services ».
   Vérifier à la première session que Vercel fournit bien le gestionnaire
   distant sans configuration.
2. **Tags** posés dans les fonctions cachées et invalidés par le webhook
   sans relire Notion : `page:<page_id>` (la page modifiée) et
   `liste:<data_source_id>` (la base parente, fournie dans
   `data.parent` du webhook). Un client n'a donc jamais à connaître le
   client d'une page pour l'invalider.
3. **`revalidateTag(tag, 'max')`** dans le handler, jamais `{ expire: 0 }` :
   le lecteur est servi depuis le cache pendant que Notion est relu. Une
   édition publiée apparaît au deuxième chargement, ce qui est acceptable
   pour une veille hebdomadaire.

À tester en recette : couper Notion et vérifier que le portail continue de
servir la dernière version (la doc ne l'affirme pas explicitement).

### Le contrat des bases Notion, expliqué simplement

Le portail et les tâches Cowork ne se parlent jamais directement. Ils ne
partagent qu'une chose : les bases Notion. Cowork y écrit, le portail y
lit. Pour que ça marche, les deux doivent être d'accord, à la lettre, sur :

- **quelles bases existent** (« Éditions », « Items », « Dossiers »,
  « Événements de dossier », « Clients », « Accès ») ;
- **quelles propriétés chaque base contient**, avec leur type Notion exact
  (titre, date, sélection, statut, relation, case à cocher, URL) ;
- **quelles valeurs sont permises** là où c'est une liste fermée : l'impact
  est `fort`, `moyen` ou `RAS`, rien d'autre ; le statut d'une édition est
  `brouillon`, `relue` ou `publiée` ;
- **qui remplit quoi** : Cowork remplit tout ; le portail ne remplit rien.

C'est un formulaire dont les deux côtés ont la même copie. Si Cowork écrit
« Fort » avec une majuscule et que le portail attend `fort`, l'item
disparaît du tri par impact. Si Cowork oublie la relation « Client » sur
une édition, elle n'apparaît chez personne. Si l'opérateur renomme une
propriété dans Notion, le portail ne la trouve plus.

Concrètement, le contrat est un fichier `docs/contrat-bases-notion.md`
avec, pour chaque base, un tableau « propriété, type, valeurs permises,
obligatoire, qui la remplit ». Il est écrit une fois, avant la première
session de code, et toute modification passe par lui. Les tâches Cowork le
citent dans leurs instructions ; le portail le vérifie au démarrage en
comparant le schéma réel de chaque base (lu via l'API) au contrat, et
refuse de démarrer si une propriété manque.

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

1. Que Vercel fournit le gestionnaire de cache distant pour
   `'use cache: remote'` sans configuration, et que l'ancienne valeur est
   servie quand la régénération échoue (test « Notion coupé »).
2. Écrire `docs/contrat-bases-notion.md` et le faire relire par les tâches
   Cowork.
3. Ce que le connecteur Notion de Cowork sait écrire (relations, statut,
   blocs) pour figer le schéma des bases.
