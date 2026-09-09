# État des API et dépendances — vérification avant codage

Date de vérification : **9 septembre 2026**. Toutes les sources ci-dessous ont
été consultées ce jour-là.

## Méthode et fiabilité des sources

Les sites officiels `developers.notion.com`, `trigger.dev`, `supabase.com`,
`tailwindcss.com` et `nextjs.org` étaient inaccessibles depuis
l'environnement de travail (proxy de sortie). Les vérifications ont donc été
faites sur les **sources primaires équivalentes** :

| Sujet | Source consultée | Nature |
|---|---|---|
| Trigger.dev | dépôt `triggerdotdev/trigger.dev`, dossier `docs/`, branche `main` | source des docs officielles |
| Supabase | dépôt `supabase/supabase`, `apps/docs/content/guides/`, branche `master` ; dépôts `supabase/supabase-js` (auth-js) et `supabase/auth` (serveur) | source des docs officielles + code |
| Tailwind v4 | dépôt `tailwindlabs/tailwindcss.com`, `src/docs/`, commit du 8 septembre 2026 ; `preflight.css` de `tailwindlabs/tailwindcss` | source des docs officielles + code |
| Next.js | dépôt `vercel/next.js`, `docs/01-app/`, branche `canary` (commit du 9 septembre 2026) ; `packages/font/src/google/font-data.json` | source des docs officielles + code |
| Notion | miroir Mintlify des pages `developers.notion.com` (dépôt GitHub `Eyre921/ofiicial-developer-docs`, chaque page porte l'URL d'origine, changelog à jour au 2 septembre 2026) ; SDK `makenotion/notion-sdk-js` branche `main` | miroir tiers de la doc officielle + SDK officiel |
| Versions | registre npm (`registry.npmjs.org`) | primaire |

Échelle de confiance utilisée dans ce document :

- **[officiel]** : texte d'une doc officielle (source du site ou miroir verbatim), ou code du SDK officiel.
- **[secondaire]** : source tierce fiable, non recoupée avec l'officiel.
- **[non vérifié]** : point qu'aucune source accessible ne tranche.

Les URL citées sont celles des pages officielles, même quand elles ont été
lues via leur source GitHub ou un miroir.

## Versions courantes au 9 septembre 2026 (npm, tag `latest`)

| Paquet | Version | Remarque |
|---|---|---|
| `next` | 16.3.4 | tag `backport` : 15.5.25 (publié le même jour, 31 août 2026) |
| `react` | 19.2.8 | |
| `tailwindcss` / `@tailwindcss/postcss` | 4.3.3 | |
| `@trigger.dev/sdk` | 4.5.16 | v3 arrêtée, voir §3 |
| `@notionhq/client` | 5.26.0 | version d'API par défaut `2025-09-03` |
| `@supabase/supabase-js` | 2.116.0 | |
| `@supabase/ssr` | 0.12.7 | |

---

## 1. Webhooks Notion et repli par polling

### 1.1 Disponibilité

- Les webhooks d'intégration sont une fonctionnalité **en production, sans mention « beta »** dans la référence courante. Le changelog du 26 août 2025 les traite comme existants (« We're introducing the concept of API versioning to integration webhooks as well »), et les exemples de charge utile officiels sont datés de décembre 2024. **[officiel]**
- Aucune date de passage beta → GA n'a pu être établie. **[non vérifié]** Sans conséquence : la fonctionnalité est stable et versionnée.
- Source : https://developers.notion.com/reference/webhooks et https://developers.notion.com/page/changelog.

### 1.2 Création d'un abonnement

- Uniquement dans l'interface : paramètres de l'intégration → onglet **Webhooks** → **Create a subscription** → URL HTTPS publique → choix des événements. Il n'existe **pas d'API** pour créer un abonnement. **[officiel]**
- Handshake : Notion envoie un POST `{"verification_token": "secret_…"}` à l'URL ; ce jeton doit être collé dans l'interface (« Verify subscription »). Bouton « Resend token » si perdu. **[officiel]**
- « You can only change the webhook URL before verification. After verification, if you need to change the URL, you must delete and recreate the subscription. You can change the subscribed events at any time. » **[officiel]**
- L'abonnement est lui-même **versionné** (choix de la version d'API dans l'interface). Le guide de migration 2025-09-03 demande de « handle the new shape and bump your subscription version ». **[officiel]**
- Un abonnement ne s'étend pas seul aux nouveaux types d'événements ajoutés par Notion. **[officiel]**
- Source : https://developers.notion.com/reference/webhooks.

### 1.3 Vérification de signature

- Chaque livraison porte l'en-tête `X-Notion-Signature` : « an HMAC-SHA256 hash of the request body, signed with your verification_token », au format `sha256=<hex>`. Comparer en temps constant, sur le **corps brut** (une re-sérialisation JSON fait échouer la comparaison). **[officiel]**
- Le SDK expose `verifyWebhookSignature({ body, signature, verificationToken })` depuis `@notionhq/client` **5.23.0** (8 juillet 2026). **[officiel]**
- Le POST de handshake ne porte pas de signature. **[secondaire]**
- Source : https://developers.notion.com/reference/webhooks ; `src/webhooks.ts` du SDK.

### 1.4 Format de la charge utile

Champs de base : `id` (identifiant de livraison, stable entre les tentatives), `timestamp` (ISO 8601, « can be used to order events on your side »), `workspace_id`, `workspace_name`, `subscription_id`, `integration_id`, `type`, `authors` (tableau de `{id, type}`, type `person` / `bot` / `agent`), `attempt_number` (1 à 8), `entity` (`{id, type}`), `data` (spécifique à l'événement). **[officiel]**

Exemple officiel pour l'événement qui nous intéresse :

```json
{
  "type": "page.properties_updated",
  "entity": { "id": "…", "type": "page" },
  "data": {
    "parent": { "id": "…", "type": "space" },
    "updated_properties": ["XGe%40", "bDf%5B", "DbAu"]
  }
}
```

Point structurant : **`updated_properties` contient des identifiants de propriété, pas des noms, et pas les nouvelles valeurs.** Pour savoir si le statut est passé à « publiée », il faut relire la page (`GET /v1/pages/{id}`) et comparer `properties[*].id`. **[officiel]**

Principe de « charge utile creuse » : « The events themselves do not contain the full content that changed. Instead, the webhook acts as a signal that something changed, and it's up to your connection to follow up with a call to the Notion API to retrieve the latest content. » Et : « webhook events may not show the most current state of the data. We strongly recommend fetching the latest data from the API. » **[officiel]**

Source : https://developers.notion.com/reference/webhooks-events-delivery.

### 1.5 Types d'événements (noms courants)

| Événement | Agrégé | Note |
|---|---|---|
| `page.created`, `page.deleted`, `page.undeleted`, `page.moved`, `page.content_updated`, `page.properties_updated` | oui | |
| `page.locked`, `page.unlocked` | non | |
| `data_source.content_updated`, `data_source.schema_updated`, `data_source.created/deleted/moved/undeleted` | oui | **nouveaux en 2025-09-03**, remplacent `database.content_updated` / `database.schema_updated` (dépréciés) |
| `database.created/deleted/moved/undeleted` | oui | |
| `comment.created/updated/deleted` | non | |
| `view.created/updated/deleted` | | ajoutés le 19 mars 2026, version ≥ 2025-09-03 |

**[officiel]** Source : https://developers.notion.com/reference/webhooks-events-delivery.

Pour notre cas (page passée en statut « publiée »), l'événement pertinent est **`page.properties_updated`**, plus `page.created` (page créée directement en statut publié, rare) et `page.deleted` / `page.undeleted` (dépublication par mise à la corbeille).

### 1.6 Latence et agrégation

- « For high-frequency events like page.content_updated, Notion batches changes that occur within a short time window into a single webhook event. » Des événements successifs peuvent être fusionnés, voire **annulés** « if the state returns to its original one ». **[officiel]**
- « Aggregated events may have a slight delivery delay (typically under one minute). » « Events should be delivered within 5 minutes of their occurrences. Most should be delivered within a minute. » **[officiel]**
- La taille exacte de la fenêtre d'agrégation n'est pas publiée. **[non vérifié]** Les retours de terrain concordent : moins d'une minute en général, jusqu'à 2 à 5 minutes au pire. **[secondaire]**
- **Ordre non garanti** : « Events may arrive in a different order than they occurred. If event ordering is critical for your workflows, use the event's timestamp field to reorder them. » **[officiel]**

### 1.7 Livraison, retentatives, limites

- « We aim for at-most-once event delivery. If your webhook endpoint fails to acknowledge receipt of an event, we will retry delivery up to 8 times using an exponential backoff schedule. The final retry attempt occurs approximately 24 hours after the initial event trigger. » **[officiel]**
- Délai maximal de réponse 2xx avant échec : non documenté (une source tierce dit 5 s). **[non vérifié]** Conséquence pratique : le handler doit **accuser réception immédiatement** et déléguer le travail à une tâche asynchrone.
- Nombre maximal d'abonnements par intégration, quota d'événements : **aucune limite documentée trouvée**. **[non vérifié]**
- Journal ou rejeu des livraisons échouées dans l'interface : non mentionné. **[non vérifié]**
- L'intégration doit avoir accès à l'objet : « if a new page is created inside a private page your connection doesn't have access to, the event won't be triggered ». Compatible avec notre règle de partage limité à la base « Éditions ». **[officiel]**

### 1.8 Conclusion sur notre cas et repli par polling

Les webhooks **couvrent** le cas « page passée en statut publiée », avec deux réserves : la charge utile ne dit ni quelle propriété (en clair) ni sa valeur, et la livraison est au mieux « at-most-once » avec fenêtre d'agrégation. Le webhook est donc un **déclencheur**, jamais la source de vérité ; la tâche déclenchée relit la page et décide.

Le **filet de rattrapage par polling** reste indispensable (perte d'événement après 8 tentatives, abonnement en pause, déploiement). Requête recommandée (API ≥ 2025-09-03) :

```json
POST /v1/data_sources/{data_source_id}/query
{
  "filter": { "and": [
    { "property": "Statut", "status": { "equals": "Publiée" } },
    { "timestamp": "last_edited_time",
      "last_edited_time": { "on_or_after": "2026-09-09T06:00:00.000Z" } }
  ] },
  "sorts": [ { "timestamp": "last_edited_time", "direction": "ascending" } ],
  "page_size": 100
}
```

- Le filtre `timestamp` ne prend pas de nom de propriété (« The API throws an error if you provide one »). Le filtre `status` accepte `equals`, `does_not_equal`, `is_empty`, `is_not_empty`. **[officiel]**
- **Granularité minute** : depuis le 1er juillet 2021, « the last_edited_time and created_time properties will be rounded down to the closest minute for page, database, and block objects ». Les objets courants affichent bien des `:00.000Z`. Conséquence : borne de reprise = dernier horodatage vu **moins une minute**, et déduplication par `page_id` (clé d'idempotence déjà prévue). **[officiel]**
- Une requête plafonne à 10 000 résultats (`incomplete_reason: query_result_limit_reached`) ; sans objet à notre échelle. **[officiel]**
- Les recalculs de rollups et formules ne mettent pas à jour `last_edited_time` de la page. **[secondaire]** Sans objet si le statut est une propriété saisie.

Sources : https://developers.notion.com/reference/query-a-data-source, https://developers.notion.com/reference/filter-data-source-entries, https://developers.notion.com/guides/resources/historical-changelog.

---

## 2. Limites de l'API Notion et URL de fichiers

### 2.1 Limites de débit

- Texte courant : « The Notion API enforces two rate limits: Per connection — an average of three requests per second, with some bursts beyond the average allowed. Per workspace — shared across all of the workspace's connections and scaled to the workspace's plan. » La limite par espace de travail a été ajoutée le 16 juin 2026. **[officiel]**
- Dépassement : HTTP **429**, code `rate_limited`, `additional_data.rate_limit_reason` = `public_api_request_rate_limit` ou `public_api_space_request_rate_limit`. HTTP **529** = `service_overload`. « Connections should handle HTTP 429 and 529 responses and respect the Retry-After response header. The header value is an integer number of seconds. » **[officiel]**
- Le SDK réessaie automatiquement sur 429/529 (toutes méthodes) et 500/503 (GET/DELETE) en respectant `Retry-After`, délai initial 1 s, maximum 60 s, timeout de requête 60 s. **[officiel, code du SDK]**
- Le chiffre « 3 req/s » du CLAUDE.md reste exact, mais il est désormais **doublé d'une limite par workspace** dépendant du plan Notion du client.
- Source : https://developers.notion.com/reference/request-limits.

### 2.2 Limites de taille (par requête)

Erreur `validation_error` (400) au-delà : 1 000 blocs et 500 Ko par charge utile ; `text.content` 2 000 caractères ; tout tableau de blocs ou de rich text 100 éléments ; URL 2 000 caractères ; multi-select, relations, personnes 100 éléments. `page_size` par défaut et maximum : 100. **[officiel]**

Conséquence pour la synchronisation : un item Notion long est découpé par Notion en plusieurs rich text de 2 000 caractères ; la lecture doit les concaténer. Les pages de plus de 100 blocs se lisent par curseur (`start_cursor` opaque, ne pas parser).

### 2.3 URL de fichiers et d'images

- Fichiers hébergés par Notion (`type: "file"`) : « Each time you fetch a Notion-hosted file, it includes a temporary public url valid for 1 hour. Don't cache or statically reference these URLs. To refresh access, re-fetch the file object. » Champ `expiry_time` ISO 8601. S'applique aux blocs `image`, `file`, `pdf`, `video`, aux icônes et couvertures. **[officiel]**
- Fichiers externes (`type: "external"`) : « These links never expire and will always be returned as-is in API responses. » **[officiel]**
- Fichiers envoyés via l'API File Upload (`type: "file_upload"`, 2025) : une fois attachés, servis comme des fichiers hébergés, URL de téléchargement expirant après 1 h. **[officiel]**
- Source : https://developers.notion.com/reference/file-object, https://developers.notion.com/reference/file-upload.

**Conséquence de conception** : le portail ne lit que Postgres et ne rappelle jamais Notion à la requête (règle 2). Une URL signée stockée en base serait morte au bout d'une heure. Deux options, à trancher au plan :

1. la synchronisation **télécharge les fichiers dans l'heure** et les copie dans Supabase Storage (bucket privé par tenant, URL signée générée à la requête par le portail) ;
2. le référentiel éditorial **n'utilise que des liens externes** (images hébergées ailleurs, pas d'upload dans Notion).

L'option 1 est la seule robuste ; l'option 2 est une contrainte rédactionnelle fragile. Ce point n'est pas couvert par le modèle de données actuel (pas de table ni de colonne pour les médias).

### 2.4 Versions d'API

- Deux versions vivantes : **`2025-09-03`** et **`2026-03-11`**. Aucune version plus récente dans le changelog au 2 septembre 2026. **[officiel]**
- `2025-09-03` : une base de données devient un conteneur avec un tableau `data_sources` ; la requête passe à `POST /v1/data_sources/{data_source_id}/query` ; le `parent` d'une page en base devient `{type: "data_source_id", …}` ; `search` retourne des objets `data_source` ; les événements webhook `database.*` sont remplacés par `data_source.*`. **Non rétrocompatible** : une intégration restée en 2022-06-28 ne voit plus les bases à plusieurs sources. **[officiel]**
- `2026-03-11` : `archived` → `in_trash`, paramètre `after` → objet `position` sur l'ajout de blocs, bloc `transcription` → `meeting_notes`. **[officiel]**
- SDK : `Client.defaultNotionVersion = "2025-09-03"` ; `notionVersion: "2026-03-11"` en option. `notion.dataSources.query(...)` existe ; `notion.databases` n'a plus de `query`. **[officiel, code du SDK]**
- Source : https://developers.notion.com/reference/versioning, https://developers.notion.com/guides/get-started/upgrade-guide-2025-09-03, https://developers.notion.com/guides/get-started/upgrade-guide-2026-03-11.

Conséquence : la synchronisation doit **résoudre le `data_source_id` à partir de l'identifiant de la base « Éditions »** au démarrage (`GET /v1/databases/{id}` → `data_sources[0].id`) et ne travailler qu'avec lui.

### 2.5 Contraintes du plan gratuit Notion

Vérifié le 9 septembre 2026, même miroir de la doc officielle.

- **Limite de blocs** : « Free workspaces with more than one member have a limit of 1,000 lifetime blocks. Paid workspaces and single-member Free workspaces have unlimited blocks. Guests do not count as members. Deleting blocks does not restore capacity. » L'API applique cette limite aux intégrations internes : après une période de grâce de trois jours, toute création (page, bloc, base) échoue en HTTP 403 `restricted_resource` avec `additional_data.block_limit: "block_creation"`. Les lectures, modifications de propriétés et suppressions restent possibles. **[officiel]**
- **Fichiers** : 5 Mio par fichier sur espace gratuit (API File Upload et téléchargements par URL du connecteur MCP), 5 Gio sur espace payant. **[officiel]**
- **Limite de débit par workspace** : « scaled to the workspace's plan » ; la valeur pour le plan gratuit n'est pas publiée. **[non vérifié]**
- **Webhooks d'intégration** : aucune restriction de plan dans la référence. À ne pas confondre avec les « webhook actions » des automatisations Notion (boutons, automatisations de base), réservées aux plans payants. **[officiel pour l'absence de mention ; secondaire pour les automatisations]**
- **Connecteur Notion MCP** (celui qu'utilise Cowork) : les outils sont listés sur tous les plans et `notion-fetch` avec l'id `self` renvoie `current_tool_access` par outil. Création, lecture, mise à jour de pages et de bases : disponibles sans plan payant. `query_data_sources` : « View mode is available on every plan without a tool-specific quota » ; le mode SQL est mesuré puis payant. `notion-ai-search` exige Notion AI ; certains filtres de recherche exigent Business. Débit : 180 requêtes par minute par utilisateur, plus la limite par workspace. **[officiel]**
- Source : https://developers.notion.com/reference/workspace-block-limits, https://developers.notion.com/reference/file-upload, https://developers.notion.com/guides/mcp/mcp-supported-tools.

Conséquence : **l'espace de travail Notion doit rester à un seul membre** (l'opérateur). Les clients ne sont jamais membres ni invités de Notion, le portail est leur seule interface. Toute invitation d'un second membre déclencherait le plafond de 1 000 blocs et bloquerait les tâches Cowork au bout de trois jours.

---

## 3. Trigger.dev : webhook entrant, cron, durée, reprise

### 3.1 Version : la v3 est arrêtée

- « Trigger.dev v3 is end of life. v4 is stable, fully supported, and recommended for all users. » « On Trigger.dev Cloud, v3 has been shut down: v3 triggers and deploys no longer run. » Chronologie publique : nouveaux déploiements v3 refusés depuis le 1er avril 2026, arrêt complet le 1er juillet 2026. **[officiel]**
- Import : `import { task } from "@trigger.dev/sdk"` (le chemin `@trigger.dev/sdk/v3` est déprécié). Changements notables : `handleError` → `catchError`, hooks de cycle de vie à paramètre unique (`onStart: ({ payload, ctx, task }) => …`), files d'attente déclarées à l'avance avec `queue({ name, concurrencyLimit })`, `ctx.attempt.id` supprimé. **[officiel]**
- Source : https://trigger.dev/docs/migrating-from-v3.

### 3.2 Webhook entrant

- Trigger.dev **n'héberge pas d'endpoint webhook**. Le schéma documenté est : un route handler Next.js reçoit le POST, vérifie la signature, puis appelle `tasks.trigger<typeof maTache>("id", payload)` avec un **import de type seulement** (« common in Next.js », évite d'embarquer le code de la tâche dans l'app). **[officiel]**
- Clé d'API dédiée « Trigger only » dans `TRIGGER_SECRET_KEY`. `triggerAndWait` est interdit hors d'une tâche (« it will throw an error »). **[officiel]**
- Options utiles à notre cas : `idempotencyKey` (« ensure that a task is only triggered once with the same key »), `idempotencyKeyTTL` (30 jours par défaut), `debounce: { key, delay, mode }`, `concurrencyKey`, `delay`, `ttl`, `tags`. **[officiel]**
- Idempotence : la clé est **par tâche et par environnement** ; un run **échoué** libère sa clé (« the key is automatically cleared »), un run réussi ou annulé la conserve. Pas d'idempotence par contenu du payload. **[officiel]**
- Source : https://trigger.dev/docs/guides/frameworks/nextjs-webhooks, https://trigger.dev/docs/triggering, https://trigger.dev/docs/idempotency.

Application : clé d'idempotence = `id` de l'événement Notion (stable entre les 8 tentatives de Notion), ou mieux, `debounce` sur `page_id` pour absorber les rafales de `page.properties_updated`.

### 3.3 Tâches cron

- `schedules.task({ id, cron, run })`. Syntaxe à 5 champs, **pas de secondes**. Chaîne = UTC ; objet `{ pattern, timezone, environments, window }` pour le reste. Charge utile : `timestamp`, `lastTimestamp`, `timezone`, `scheduleId`, `externalId`, `upcoming`. **[officiel]**
- **Plan gratuit : une exécution par heure au maximum**, avec fenêtre d'étalement minimale de 60 minutes : « creating or deploying a schedule whose cron fires more often than once an hour is rejected with an actionable error ». S'applique à tous les environnements, y compris Development. Limites : 10 schedules par projet (gratuit), 100 (Hobby), 1 000+ (Pro). **[officiel]**
- En Dev, une tâche planifiée ne tourne que si la CLI `dev` est lancée ; en Prod, seulement si elle est dans le déploiement courant. **[officiel]**
- `ttl` sur une tâche planifiée : expire un run en attente si le précédent tourne encore, évite l'empilement. **[officiel]**
- Source : https://trigger.dev/docs/tasks/scheduled, https://trigger.dev/docs/limits.

### 3.4 Durée maximale

- « You must set a default maxDuration in your trigger.config.ts file, which will apply to all tasks unless overridden. » Minimum 5 s, pas de maximum documenté ; désactivable avec `timeout.None`. Compté en **temps CPU par tentative**, hors `wait.*`. **[officiel]**
- Au dépassement, le run est arrêté et « the lifecycle functions cleanup, onSuccess, and onFailure will not be called ». Le doc ne précise pas si une tentative expirée est réessayée. **[non vérifié]**
- Autres bornes : payload ≤ 3 Mo, sortie ≤ 10 Mo, TTL maximal d'un run 14 jours (défaut en prod), API 1 500 req/min, concurrence 10 runs (gratuit) / 25 (Hobby). Machine par défaut `small-1x` (0,5 vCPU, 0,5 Go). **[officiel]**
- Source : https://trigger.dev/docs/runs/max-duration, https://trigger.dev/docs/limits, https://trigger.dev/docs/machines.

### 3.5 Reprise sur échec

- « A task is retried if an error is thrown. By default, we retry 3 times. » `maxAttempts` inclut la première tentative ; `factor`, `minTimeoutInMs`, `maxTimeoutInMs`, `randomize` configurables par tâche ou globalement. **Les retentatives sont désactivées en Dev par défaut** par `init`. **[officiel]**
- `catchError` peut retourner `{ skipRetrying: true }` ou `{ retryAt }` ; `AbortTaskRunError` interdit toute retentative ; `retry.onThrow` et `retry.fetch` pour réessayer un bloc ou un appel HTTP (utile pour les 429 Notion). **[officiel]**
- OOM : `TASK_PROCESS_OOM_KILLED`, retentative optionnelle sur machine plus grosse avec `retry.outOfMemory`. `onFailure` ne se déclenche pas pour `Crashed`, `System failures`, `Canceled`. **[officiel]**
- Source : https://trigger.dev/docs/errors-retrying.

Conséquence pour la règle 4 (alerte opérateur) : l'alerte email doit être émise depuis `onFailure` **et** couverte par les alertes de la plateforme (1 destination sur le plan gratuit), car `onFailure` ne couvre pas les crashs système.

---

## 4. Supabase Auth : lien magique en invitation seule, RLS multi-tenant

### 4.1 Lien magique

- « Though the method is labelled "OTP", it sends a Magic Link by default. The two methods differ only in the content of the confirmation email sent to the user. » Un lien magique est **à usage unique**. **[officiel]**
- `signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo } })`. **`shouldCreateUser` vaut `true` par défaut** ; à `false`, un email inconnu reçoit HTTP 422 `otp_disabled` (« Signups not allowed for otp »). Ce dernier détail vient du code serveur (`internal/api/otp.go`), pas de la doc. **[officiel, code]**
- Réglage projet « Allow new users to sign up » : « If this config is disabled, only existing users can sign in. » (HTTP 422 `signup_disabled`). **[officiel]**
- Validité : une demande par utilisateur toutes les **60 s**, lien valable **1 h** (réglage « Email OTP expiration », qui gouverne aussi les liens d'invitation ; au-delà de 86 400 s « strongly discouraged »). **[officiel]**
- Source : https://supabase.com/docs/guides/auth/auth-email-passwordless, https://supabase.com/docs/guides/auth/general-configuration.

### 4.2 Mode « invitation seule »

- `auth.admin.inviteUserByEmail(email, { data, redirectTo })` : « an admin action, so it must be performed from a trusted server environment using your secret key, or from the Dashboard. When you invite an email that doesn't yet belong to a user, a new unconfirmed user is created. Inviting an email that already belongs to a confirmed user returns an error. » **[officiel]**
- La **clé secrète** `sb_secret_…` remplace la clé `service_role` historique ; elle contourne RLS et ne doit jamais quitter le serveur. **[officiel]**
- `redirectTo` doit figurer dans la liste blanche des URL de redirection, sinon il est ignoré silencieusement. **[officiel]**
- Invitation avec inscriptions désactivées : **non documenté**. Le code serveur (`internal/api/invite.go`) ne vérifie pas `DisableSignup`, donc l'invitation fonctionne ; à confirmer en recette. **[secondaire, code]**
- Source : https://supabase.com/docs/guides/auth/users.

Schéma retenu, cohérent avec les docs : inscriptions désactivées au niveau projet **+** `shouldCreateUser: false` côté client **+** création des comptes par `inviteUserByEmail` depuis un script opérateur, puis insertion dans `memberships`.

### 4.3 Flux serveur et pièges

- **Préchargement des liens par les antivirus de messagerie** : « {{ .ConfirmationURL }} sent will be consumed instantly which leads to a "Token has expired or is invalid" error. » Parade documentée : modèle d'email avec `{{ .TokenHash }}` pointant vers une route du portail, qui appelle `verifyOtp({ token_hash, type })` côté serveur ; « the session will be returned in the response body, which can be read by the server ». **[officiel]**
- Ce flux `token_hash` évite aussi la contrainte PKCE des clients `@supabase/ssr` (« the code exchange must be initiated on the same browser and device where the flow was started »), donc un lien ouvert sur un autre appareil fonctionne. **[officiel]**
- SMTP intégré : **2 emails par heure**, uniquement vers les membres de l'équipe du projet, « best-effort only ». Un SMTP personnalisé est **obligatoire** en production (limite initiale 30/h, ajustable). **[officiel]**
- `@supabase/ssr` : toujours créer le client dans le handler, jamais au niveau module ; `export const dynamic = 'force-dynamic'` sur les pages authentifiées ; protéger avec `supabase.auth.getClaims()`. **[officiel]**
- Limites de débit par défaut : `/otp` 60 s par utilisateur ; `/verify` 30 par 5 min par IP ; `/token` 150 par 5 min par IP ; envoi d'emails 2/h sur SMTP intégré. **[officiel]**
- Source : https://supabase.com/docs/guides/auth/auth-email-templates, https://supabase.com/docs/guides/auth/auth-smtp, https://supabase.com/docs/guides/auth/rate-limits, https://supabase.com/docs/guides/auth/server-side/advanced-guide.

### 4.4 RLS multi-tenant par table de jointure

- Avertissement officiel : « A table in an exposed schema without RLS is readable and writable by any role with a grant on it. Enable RLS on every table in an exposed schema. » Et : « Grants and RLS belong in the same migration. » Confirme la règle 1 du CLAUDE.md. **[officiel]**
- Recommandations de performance : nommer le rôle (`to authenticated`), envelopper `(select auth.uid())` (« allows the Postgres optimizer to "cache" the results per-statement »), **indexer chaque colonne filtrée par une politique** (exemple officiel : « A membership table keyed on (team_id, user_id) has no index on user_id: create index team_members_user_id_idx … »). **[officiel]**
- Schéma officiel pour l'appartenance, avec fonction `security definer` dans un schéma **non exposé** pour éviter la récursion (erreur `42P17`) :

```sql
create function private.user_tenant_ids()
returns setof uuid
language sql
security definer
set search_path = ''
stable
as $$
  select tenant_id from public.memberships
  where user_id = (select auth.uid());
$$;

create policy "editions_select" on public.editions
  for select to authenticated
  using ( tenant_id in (select private.user_tenant_ids()) );
```

- Règles associées : `set search_path = ''` sur toute fonction `security definer` ; jamais dans un schéma exposé ; `using` pour la lecture, `with check` pour l'écriture ; une politique `select` est requise pour `update`. **[officiel]**
- Alternative par claims JWT (`auth.jwt() -> 'app_metadata'`) : documentée mais avec réserve explicite, « a JWT is not always up-to-date… will not be reflected using auth.jwt() until the user's JWT is refreshed ». Le hook « custom access token » permet d'y mettre des `tenant_id`, mais aucune doc ne le recommande pour le multi-tenant, et la taille du JWT pèse sur les cookies (limite 4 096 octets). **La table de jointure reste la solution de référence.** **[officiel]**
- Vues : elles contournent RLS par défaut ; en Postgres 15+, `create view … with (security_invoker = true)`. **[officiel]**
- Tests : pgTAP sous `supabase/tests/`, `supabase test db`. **[officiel]**
- Source : https://supabase.com/docs/guides/database/postgres/row-level-security, https://supabase.com/docs/guides/database/tables.

---

## 5. Tailwind v4 avec Next.js : tokens CSS et next/font

### 5.1 Installation

- Paquets : `tailwindcss`, `@tailwindcss/postcss`, `postcss`. `postcss.config.mjs` : `{ plugins: { "@tailwindcss/postcss": {} } }`. `app/globals.css` : `@import "tailwindcss";`. Plus de `tailwind.config.js` (« no longer detected automatically in v4 », chargeable avec `@config` si besoin), plus de `postcss-import` ni `autoprefixer`. **[officiel]**
- Navigateurs : « Safari 16.4+, Chrome 111+, and Firefox 128+ » (Tailwind), alignés sur Next.js 16 (Chrome/Edge/Firefox 111+, Safari 16.4+). **[officiel]**
- Source : https://tailwindcss.com/docs/installation/framework-guides/nextjs, https://tailwindcss.com/docs/upgrade-guide.

### 5.2 Tokens de la charte dans `@theme`

- « Theme variables are special CSS variables defined using the @theme directive that influence which utility classes exist in your project. » Au niveau racine uniquement, jamais sous un sélecteur ou une media query. **[officiel]**
- Espaces de noms utiles : `--color-*` → `bg-…` / `text-…` ; `--font-*` → `font-…` ; `--text-*` (avec `--text-xs--line-height`) → `text-…` ; `--radius-*` → `rounded-…` ; `--spacing` (base 0,25 rem) ; `--breakpoint-*`. Un nom libre dans un espace crée l'utilitaire correspondant (`--font-titre` → `font-titre`). **[officiel]**
- Réinitialiser un espace de noms : `--color-*: initial;` (supprime la palette par défaut), `--*: initial;` pour tout. `--font-*: initial` suit la même règle, non citée littéralement. **[officiel]**
- Toutes les variables `@theme` sont émises comme variables CSS sur `:root` (seules celles utilisées, par défaut). Utiliser `:root` pour une variable sans utilitaire. **[officiel]**
- Source : https://tailwindcss.com/docs/theme.

### 5.3 next/font et `@theme inline`

- « CSS and font files are downloaded at build time and self-hosted with the rest of your static assets. No requests are sent to Google by the browser. » **[officiel]**
- Les trois polices de la charte existent dans `next/font/google` (`font-data.json`, 1 942 familles) :

| Police | Import | Graisses | Variable | Sous-ensembles |
|---|---|---|---|---|
| Lora | `Lora` | 400 à 700, italique | oui (`wght` 400–700) | latin, latin-ext, cyrillic, vietnamese |
| Public Sans | `Public_Sans` | 100 à 900, italique | oui (`wght` 100–900) | latin, latin-ext, vietnamese |
| IBM Plex Mono | `IBM_Plex_Mono` | 100 à 700, italique | **non** | latin, latin-ext, cyrillic |

- Conséquence : `IBM_Plex_Mono` **exige** un tableau `weight` (« If you can't use a variable font, you will need to specify a weight »). `subsets: ['latin']` à préciser sous peine d'avertissement au build. **[officiel]**
- Contrainte du compilateur : appel au niveau module, affecté à un `const`, arguments littéraux (messages d'erreur du transform SWC). **[officiel, code]**
- Intégration Tailwind v4, exemple officiel de la doc Next.js :

```css
@import 'tailwindcss';

@theme inline {
  --font-sans: var(--font-public-sans);
  --font-serif: var(--font-lora);
  --font-mono: var(--font-ibm-plex-mono);
}
```

avec les variables posées sur `<html className={`${lora.variable} ${publicSans.variable} ${plexMono.variable}`}>`. Le mot-clé `inline` est **obligatoire** ici : « Without using inline, your utility classes might resolve to unexpected values because of how variables are resolved in CSS. » **[officiel]**

- Sentence case (règle 7) : Preflight ne contient **aucun** `text-transform` ; `uppercase` est un utilitaire explicite. La règle est donc purement une discipline de composants. **[officiel, code]**
- Source : https://nextjs.org/docs/app/api-reference/components/font, https://tailwindcss.com/docs/theme, https://tailwindcss.com/docs/font-family.

### 5.4 État de Next.js

- Stable : **16.3.4**. Next.js 15 est en **Maintenance LTS** depuis la sortie de 16 (21 octobre 2025) ; la politique officielle donne deux ans de maintenance après la sortie initiale, soit **fin de vie le 21 octobre 2026**, dans six semaines. Le tag npm `backport` (15.5.25) est encore publié. **[officiel pour la politique, secondaire pour la date exacte]**
- Changements de 16 qui touchent le portail : Turbopack par défaut ; `middleware.ts` déprécié au profit de **`proxy.ts`** (runtime Node uniquement, export `proxy`) ; accès **exclusivement asynchrone** à `cookies()`, `headers()`, `params`, `searchParams` ; `next lint` supprimé (ESLint ou Biome en direct) ; Node ≥ 20.9 ; TypeScript ≥ 5.1 ; React 19.2. **[officiel]**
- Codemod : `npx @next/codemod@canary upgrade latest`, ou `npx next upgrade` depuis 16.1. **[officiel]**
- Source : https://nextjs.org/docs/app/guides/upgrading/version-16, https://nextjs.org/support-policy, discussion `vercel/next.js#85289`.

### 5.5 Cache de Next.js 16 : `use cache`, `cacheLife`, `revalidateTag`

Vérifié le 9 septembre 2026 sur `docs/01-app/03-api-reference` du dépôt
`vercel/next.js` (canary), pages `use-cache`, `use-cache-remote`,
`cacheLife` (fonction et config), `cacheHandlers`, `revalidateTag`,
`updateTag`.

- **Trois durées** par profil : `stale` (« How long the client can use cached data without checking the server », minimum 30 s imposé par le routeur client), `revalidate` (« After this time, the next request will trigger a background refresh » ; la requête est servie depuis le cache, la régénération se fait en arrière-plan), `expire` (« After this time with no requests, the next one waits for fresh content » ; doit être supérieur à `revalidate`, sinon erreur au build). **[officiel]**
- **Profils prédéfinis** : `default` 5 min / 15 min / jamais ; `hours` 5 min / 1 h / 1 jour ; `days` 5 min / 1 jour / 1 semaine ; `weeks` 5 min / 1 semaine / 30 jours ; `max` 5 min / 30 jours / 1 an. Profils personnalisés dans `next.config.ts` sous `cacheLife`, avec `cacheComponents: true`. **[officiel]**
- **Serverless** : « With the default in-memory handler, serverless instances are ephemeral, so entries may not be reused between requests. » Et : « Neither caching directive carries over to a new deploy, because the cache key includes the build ID. » La doc recommande `'use cache: remote'` pour « Rate-limited APIs », « Flaky or unreliable services » et « a rate-limited CMS », le gestionnaire distant étant fourni par l'hébergeur (« hosting providers should typically provide this automatically »). **[officiel]**
- **Interdit dans une fonction cachée** : `cookies()`, `headers()`, `searchParams`, y compris via une fonction appelée (erreur `next-request-in-use-cache`). Les valeurs de requête se lisent dehors et se passent en argument. Confirme la règle 1 du CLAUDE.md. **[officiel]**
- **`revalidateTag(tag, profil)`** : « marks the tagged data as stale. The next request for that data kicks off a revalidation and is served stale content while it runs. » Avec `'max'` (recommandé par la doc), le contenu périmé est servi pendant la régénération ; avec `{ expire: 0 }`, la requête suivante bloque. Utilisable depuis un route handler (webhook). **[officiel]**
- **`updateTag`** : expiration immédiate, réservée aux Server Actions ; sans objet pour un webhook. **[officiel]**
- **Non vérifié** : le comportement quand la régénération en arrière-plan échoue (Notion injoignable). La doc ne dit pas explicitement que l'ancienne valeur est conservée jusqu'à `expire` ; c'est le comportement historique de l'ISR, à **tester en recette** en coupant l'accès à Notion. **[non vérifié]**
- Source : https://nextjs.org/docs/app/api-reference/directives/use-cache, https://nextjs.org/docs/app/api-reference/directives/use-cache-remote, https://nextjs.org/docs/app/api-reference/functions/cacheLife, https://nextjs.org/docs/app/api-reference/functions/revalidateTag.

### 5.6 Resend (envoi des liens d'accès)

- Plan gratuit : 3 000 emails par mois, 100 par jour, jusqu'à trois domaines vérifiés, rétention 30 jours. **[secondaire, recoupé sur plusieurs sources ; resend.com inaccessible depuis l'environnement]**
- Suffisant par construction : quelques dizaines de personnes, un email par demande de lien.
- Source : https://resend.com/pricing (à recouper), https://resend.com/blog/new-free-tier.

---

## 6. Ajustements proposés (rien n'est codé)

> **Note du 9 septembre 2026, après-midi** : l'architecture a été réorientée
> vers un Notion headless alimenté par des tâches Cowork, avec accès par lien
> magique persistant (voir `docs/architecture-notion-headless.md`). Les
> ajustements ci-dessous décrivent l'architecture initiale (Postgres, RLS,
> Trigger.dev) et sont conservés pour mémoire ; seuls les points Notion,
> Next.js et Tailwind restent applicables.

### 6.1 CLAUDE.md, section « Stack »

| Ligne actuelle | Ajustement proposé | Motif |
|---|---|---|
| « Next.js 15, App Router » | **Next.js 16**, App Router | 15 sort de maintenance le 21 octobre 2026 ; démarrer un projet neuf sur une version à six semaines de sa fin de vie n'a pas de sens. Effets : `proxy.ts` au lieu de `middleware.ts` pour le rafraîchissement de session Supabase, APIs de requête asynchrones, ESLint configuré à part. |
| « Trigger.dev v3 pour la tâche de synchronisation » | **Trigger.dev v4** | v3 est arrêtée depuis le 1er juillet 2026. Import `@trigger.dev/sdk`, `catchError`, files déclarées à l'avance, `maxDuration` obligatoire dans la config. |
| « API Notion officielle (intégration interne…) » | ajouter : **version d'API `2025-09-03` minimum, SDK `@notionhq/client` v5**, requêtes via `data_sources` | modèle « data sources » non rétrocompatible ; la synchronisation doit résoudre le `data_source_id` de la base « Éditions ». |
| « Supabase Postgres avec RLS, Auth par lien magique » | préciser : **inscriptions désactivées au niveau projet, `shouldCreateUser: false`, comptes créés par `inviteUserByEmail`, SMTP personnalisé obligatoire, flux `token_hash` + `verifyOtp` côté serveur** | sans ces trois verrous, le lien magique crée des comptes ; le SMTP intégré est limité à 2 emails/heure vers l'équipe du projet ; le flux `token_hash` évite le préchargement des liens par les antivirus et la contrainte PKCE « même appareil ». |
| Commande « `pnpm lint` » | à définir avec ESLint en direct (ou Biome) | `next lint` n'existe plus en 16. |

### 6.2 CLAUDE.md, section « Règles non négociables »

- **Règle 3** (« n'importe que les pages en statut publiée ») : ajouter le cas symétrique. Un événement `page.properties_updated` ne dit pas si le statut monte ou descend ; la relecture de page peut révéler une **dépublication** (statut revenu à brouillon) ou une mise à la corbeille (`page.deleted`). Le comportement attendu doit être écrit : retirer l'item du portail, ou le figer ? Ce point manque au modèle de données (pas de colonne de statut sur `items`).
- **Règle 2** (jamais Notion à la requête) : ajouter la conséquence sur les **médias**. Les URL de fichiers Notion expirent en une heure ; la synchronisation doit copier les fichiers dans Supabase Storage, ou le référentiel doit interdire les uploads Notion. Le modèle de données ne prévoit rien pour cela.
- **Règle 4** (mode dégradé et alerte) : préciser que l'alerte doit aussi couvrir les crashs non rattrapés par `onFailure` (alerte de plateforme Trigger.dev, 1 destination sur le plan gratuit).

### 6.3 CLAUDE.md, section « Modèle de données »

- `notion_page_map` : ajouter une colonne `last_edited_time` (borne de reprise du polling) et prévoir la **déduplication à la minute** (arrondi Notion).
- `sync_runs` : ajouter `declencheur` (`webhook` | `cron` | `manuel`) et l'`id` d'événement Notion, pour tracer l'idempotence.
- Ajouter une table `medias` (ou une colonne sur `items`) si l'option « copie dans Supabase Storage » est retenue.
- Index sur `memberships(user_id)` et sur chaque `tenant_id` filtré par une politique, conformément à la recommandation officielle.

### 6.4 Plan de sessions (`docs/plan-sessions-portail.md`, absent du dépôt à ce jour)

- Le plan cité par le CLAUDE.md n'existe pas encore dans le dépôt, pas plus que `docs/charte-design.md`, `docs/maquette-edition.html`, `docs/cahier-des-charges.md` ni `docs/prompt-referentiel.md`. Ils sont à ajouter avant la première session de code.
- Prévoir dans la session « synchronisation » : (a) le handler webhook Next.js qui vérifie la signature avec `verifyWebhookSignature` du SDK puis appelle `tasks.trigger` avec `debounce` sur `page_id` ; (b) la tâche de relecture qui décide « publié / dépublié / inchangé » ; (c) le cron de rattrapage **horaire** (contrainte du plan gratuit Trigger.dev) avec borne `last_edited_time` moins une minute ; (d) une mise en pause volontaire de l'abonnement en recette pour vérifier que le cron rattrape.
- Prévoir dans la session « auth » : script opérateur d'invitation, modèle d'email `{{ .TokenHash }}`, route `/auth/confirm` serveur, SMTP personnalisé, et le test « email inconnu → 422 sans création de compte ».
- Prévoir dans la session « design » : `@theme inline` pour les trois polices, `weight` explicite pour IBM Plex Mono, purge des palettes par défaut avec `--color-*: initial` avant de poser les couleurs de la charte.

---

## 7. Points restés non vérifiés

1. Date exacte de passage des webhooks Notion de beta à GA (sans incidence : fonctionnalité stable et versionnée).
2. Délai de réponse maximal toléré par Notion avant qu'une livraison soit comptée en échec (une source tierce dit 5 s). Réponse immédiate 2xx à prévoir dans tous les cas.
3. Plafond du nombre d'abonnements webhook par intégration et quota d'événements.
4. Largeur exacte de la fenêtre d'agrégation des événements Notion (« typically under one minute »).
5. Existence d'un journal ou d'un rejeu des livraisons échouées dans l'interface Notion.
6. Comportement de `inviteUserByEmail` quand les inscriptions sont désactivées : déduit du code serveur, à confirmer en recette.
7. Si une tentative Trigger.dev arrêtée par `maxDuration` est réessayée.
8. Le miroir de la doc Notion est une copie tierce datée du 2 septembre 2026, cohérente avec le SDK officiel, mais ce n'est pas le site en direct. À recouper dès que `developers.notion.com` est accessible.
