# Schéma de données du portail (Postgres)

*Proposé le 15 octobre 2026 (action 9 du plan de travail), validé le 16 octobre 2026 avec la décision d'architecture. Palier 1a livré : `organisations`, `veilles`, `lecteurs` (`lib/base/schema.ts`, migration `drizzle/0000_*`). Le schéma décrit l'état cible à la fin du palier 2 ; chaque palier n'en crée que ce dont il a besoin. Conventions : identifiants `uuid` générés par la base, horodatages `timestamptz`, noms en français comme le reste du code, suppression jamais physique (colonne `archivée_le`).*

## Ce qui va où

| Ce que c'est | Où ça vit | Qui écrit |
|---|---|---|
| L'état d'une organisation, ses veilles, ses lecteurs, son parcours, son abonnement | Postgres | le portail, seul |
| La demande d'un prospect, la file de travaux, le journal des runs, les envois | Postgres | le portail, seul |
| Les sources d'une veille et ce qui a changé dessus (palier 3) | Postgres | le portail, seul |
| Le texte d'un référentiel, le corps d'une lettre, les points de validation | Notion | les tâches Claude, après acceptation du résultat par le portail |
| L'abonnement (source de vérité) | Stripe | Stripe ; le portail en tient une copie dans `abonnements` |

Règle : Postgres ne contient jamais le corps d'une lettre ni le texte d'un référentiel ; il contient leurs identifiants Notion. La migration du contenu, si elle vient un jour, ajoute une colonne, elle ne change pas le schéma.

## Les tables

### `organisations`

Une par client, prospect ou organisation de test.

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `slug` | text, unique | celui des URL du portail ; jamais modifié après la première lettre |
| `nom` | text | libellé affiché ; aujourd'hui « Organisation (libellé) » de la base Accès |
| `url_site` | text, nullable | normalisée (schéma, hôte en minuscules, sans fragment) ; vient du formulaire. Nulle pour les organisations migrées de la base Accès : le portail n'a jamais lu le registre qui la porte |
| `page_organisation_notion` | text, nullable | page sous « Veilles clients » ; jamais utilisée pour le cloisonnement |
| `registre_notion` | text, nullable | identifiant de l'ancienne ligne du registre, celui que portent les éditions ; conservé tant que des éditions Notion le référencent |
| `état` | enum | `demande`, `generation`, `essai`, `abonnee`, `suspendue`, `ecartee`, `test` |
| `demandée_le`, `activée_le`, `suspendue_le` | timestamptz, nullable | `activée_le` fixe J0 du parcours |
| `relecture_requise` | boolean, défaut vrai | tant que vrai, les envois vont à l'adresse de relecture |
| `email_relecture` | text, nullable | vide : l'adresse par défaut de l'environnement |
| `créée_le`, `modifiée_le`, `archivée_le` | timestamptz | |

### `veilles`

N par organisation. Remplace le libellé `Veille` et la propriété `Famille` à deux valeurs de la base Éditions.

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `organisation_id` | uuid, référence | |
| `type` | text | `ecosysteme`, `concurrentielle` aujourd'hui ; `reglementaire`, `reputation`, `appels_a_projets` demain. Une donnée, pas un enum : un type se crée sans migration |
| `libellé` | text | le nom que le client voit (« Positionnement », « Attractivité »…) |
| `referentiel_notion` | text, nullable | page du référentiel |
| `jour_parution` | smallint | 1 (lundi) à 7 |
| `heure_parution` | time | heure de Paris |
| `cadence` | enum | `hebdomadaire`, `bimensuelle`, `mensuelle` |
| `numéro_courant` | integer, défaut 0 | le dernier numéro attribué ; le portail l'incrémente dans la même transaction que l'acceptation du résultat |
| `état` | enum | `active`, `suspendue`, `archivée` |
| contrainte | | unique (`organisation_id`, `type`) |

### `lecteurs`

Remplace la base Notion « Accès, portail ». Une ligne par personne.

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `organisation_id` | uuid, référence, nullable pour l'opérateur | |
| `nom`, `email` | text | `email` unique par organisation, comparé en minuscules |
| `identifiant_acces` | text, unique | 32 hexadécimaux ; jamais recopié d'une ligne à l'autre, c'est la contrainte qui l'interdit désormais |
| `actif` | boolean | révocation effective à la requête suivante |
| `tous_les_espaces` | boolean, défaut faux | privilège opérateur, une ou deux lignes dans toute la table |
| `rôle` | enum | `lecteur`, `relecteur`, `operateur` |
| `créé_le`, `dernière_visite_le` | timestamptz | |

### `demandes`

Ce que le formulaire public écrit. Une demande devient une organisation quand elle est validée.

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `url_site`, `email` | text | tels que saisis, plus la version normalisée |
| `jour_souhaité` | smallint, nullable | |
| `réponses` | jsonb, nullable | Q1, Q2, Q3 quand le site est pauvre |
| `origine` | text, nullable | empreinte de l'adresse IP, jamais l'adresse |
| `état` | enum | `recue`, `validee`, `refusee`, `doublon` |
| `motif` | text, nullable | DNS non résolu, domaine déjà client, abus |
| `organisation_id` | uuid, nullable | posé à la validation |
| `reçue_le`, `traitée_le` | timestamptz | |

### `travaux`

La file que lit la tâche « Runs de veille ». Une ligne par chose à faire.

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `type` | enum | `referentiel`, `premiere_lettre`, `lettre`, `revue` |
| `organisation_id`, `veille_id` | uuid | `veille_id` nul pour un travail d'organisation |
| `échéance` | timestamptz | avant quoi il ne doit pas être pris |
| `état` | enum | `a_faire`, `pris`, `accepte`, `refuse`, `abandonne` |
| `pris_le`, `pris_par` | timestamptz, text | identifiant de session de la tâche ; un travail pris depuis plus de trois heures redevient `a_faire` |
| `tentatives` | smallint | abandon à la troisième |
| `contexte` | jsonb | ce que le portail a assemblé : identifiants Notion, numéro à attribuer, période couverte, prompt à appliquer (nom et version), points de validation ouverts |
| `résultat_run_id` | uuid, nullable | |
| `créé_le` | timestamptz | |
| contrainte | | un seul travail `a_faire` ou `pris` par (`veille_id`, `type`) |

### `runs`

Le journal. Une ligne par résultat posté, accepté ou non.

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `travail_id` | uuid, référence | |
| `début`, `fin` | timestamptz | donnés par la tâche |
| `exécuteur` | text | `cowork:<session>` ou `api:<modèle>` |
| `résultat` | jsonb | la sortie structurée : `lettre` (Markdown Notion), `méthode`, `propriétés`, `amendements`, `points`, `grille` |
| `portes` | jsonb | rapport du lint, du vocabulaire, des citations : code, portée, message |
| `accepté` | boolean | |
| `page_notion` | text, nullable | l'identifiant de la page Édition créée par la tâche après acceptation |
| `coût` | jsonb, nullable | tokens, recherches, durée, quand l'exécuteur les donne |
| `créé_le` | timestamptz | |

### `envois`

L'idempotence des courriers. Une ligne est écrite **avant** l'appel Gmail.

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `run_id` | uuid, référence | la lettre |
| `lecteur_id` | uuid, référence | |
| `forme` | enum | `complete`, `tronquee`, `relecture` |
| `étape_parcours` | text | `j0`, `j7`, `j14`, `j21`, `abonne` au moment de l'envoi |
| `état` | enum | `prevu`, `envoye`, `echec` |
| `message_gmail` | text, nullable | |
| `prévu_le`, `envoyé_le` | timestamptz | |
| contrainte | | unique (`run_id`, `lecteur_id`) : un lecteur ne reçoit jamais deux fois la même lettre |

### `courriers` (créée le 18 octobre 2026, migration 0002)

Le journal de tout courrier que le portail envoie : lien d'accès, alerte du soir, courriers de fin d'essai. Une ligne est réservée **avant** l'appel Gmail, puis conclue. Distincte d'`envois`, qui servira la livraison des lettres au palier 1b.

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `sorte` | enum | `lien_acces`, `essai_derniere_parution`, `essai_tronquee`, `alerte_espaces` |
| `organisation_id` | uuid, référence, nullable | retrouvée par `registre_notion` pour un lien d'accès |
| `lecteur_id` | uuid, référence, nullable | nul pour un courrier à la relecture ou un lien venu de Notion |
| `destinataire_empreinte` | text | huit hexadécimaux, la même empreinte que les journaux ; jamais l'adresse |
| `déclencheur` | text | `recevoir-mon-lien`, `activation`, `cron`, `manuel` |
| `état` | enum | `prevu`, `envoye`, `echec` |
| `message_gmail` | text, nullable | identifiant rendu par Gmail |
| `erreur` | text, nullable | un code (`gmail-403`), jamais un message |
| `prévu_le`, `conclu_le` | timestamptz | |
| contrainte | | unique (`sorte`, `organisation_id`, `coalesce(lecteur_id, 0)`) pour les seuls courriers de fin d'essai |

### `abonnements`

Copie de Stripe, écrite par son webhook seulement.

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `organisation_id` | uuid, référence, indexé | une organisation peut avoir plusieurs abonnements (passage du mois à l'année, réabonnement) ; elle est abonnée si l'un est ouvert |
| `client_stripe` | text | |
| `abonnement_stripe` | text, unique | une ligne par abonnement Stripe |
| `état` | text | tel que Stripe le donne (`trialing`, `active`, `past_due`, `canceled`…) |
| `période_fin` | timestamptz, nullable | |
| `formule` | text, nullable | `mensuelle` ou `annuelle`, lue sur l'intervalle du prix |
| `dernier_événement` | text | identifiant du dernier événement Stripe appliqué : un doublon est ignoré |
| `événement_le` | timestamptz | date de création de cet événement chez Stripe : un événement plus ancien est ignoré (Stripe ne garantit pas l'ordre) |
| `dernier_type` | text | type de cet événement : à la même seconde, création puis mise à jour puis suppression |
| `reçu_le` | timestamptz | |

Créée par la migration `0001_palier_1c_abonnements` ; écrite par `lib/base/abonnements.ts`, appelé du seul webhook `app/api/webhooks/stripe`, qui vérifie la signature avec le SDK Stripe (`STRIPE_WEBHOOK_SECRET`). L'organisation est lue dans `metadata.organisation_id` de l'abonnement, posée par le portail à la création du paiement ; jamais déduite d'une adresse ou d'un nom de client.

### `sources` (palier 3)

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `veille_id` | uuid, référence | |
| `url`, `famille`, `libellé` | text | tirés du référentiel |
| `mode_accès` | enum | `http`, `navigateur`, `ferme`, `extrait_fourni` |
| `dernière_lecture_le` | timestamptz, nullable | |
| `dernière_publication_vue` | date, nullable | |
| `empreinte` | text, nullable | du contenu utile, pour la détection de changement |
| `dernier_code` | smallint, nullable | HTTP, ou 0 pour robots |
| `état` | enum | `active`, `morte`, `déplacée`, `ecartee` |

## Le parcours, calculé et non stocké

`étapeDuParcours(organisation, abonnement, aujourdHui)` est une fonction pure de `lib/domaine/parcours.ts` : J0 à `activée_le`, puis J+7 et J+14 par semaines ISO, trois parutions complètes qui forment l'essai ; à J+21 sans abonnement, une parution réduite à « L'essentiel » de chaque lettre ; `abonne` si `abonnements.état` est `trialing` ou `active`, `suspendue` au-delà de J+21 sans abonnement (offre décidée le 17 octobre 2026, `docs/decision-portail-moteur.md`). Rien de cela n'est une colonne : une date et un état Stripe suffisent, et un état stocké divergerait.

## Migration depuis Notion (palier 1)

1. `organisations` et `veilles` : depuis les quatre lignes actives du registre (lecture manuelle, le portail n'y a pas accès) et les propriétés `Veille` et `Famille` des éditions. `registre_notion` reçoit l'identifiant que portent les éditions.
2. `lecteurs` : depuis la base Accès, en lecture seule, script rejouable (`pnpm base:importer-acces`, `--a-blanc` pour le plan). `tous_les_espaces` et `actif` recopiés tels quels. L'import crée aussi les `organisations` des clients historiques, à l'état `abonnee` avec `relecture_requise` : ils reçoivent leurs lettres hors Stripe, et le parcours d'essai ne s'applique pas à une organisation `abonnee` qui n'a pas de ligne `abonnements`. Les lignes que la lecture Notion refusait (identifiant vide ou partagé, slug ou organisation vides, slug portant deux organisations) ne sont pas importées ; un lecteur absent de Notion est désactivé, jamais supprimé.
3. Double exécution une semaine (`SOURCE_ACCES=double` : les deux lues, Notion servie, écarts journalisés `[accès:double]`), puis bascule (`SOURCE_ACCES=postgres`), puis gel de la base Accès. **Préalable à la bascule** : une voie d'écriture des lecteurs (création, révocation) qui ne passe plus par Notion, puisque la tâche Cowork qui tient aujourd'hui la base Accès y écrirait dans le vide.
4. La base Éditions reste lue par le portail ; son filtre d'organisation reste `Organisation contains registre_notion` tant que les éditions existantes le portent. Une nouvelle organisation sans ligne de registre reçoit un `registre_notion` égal à une page Notion vide créée par la tâche à la première génération, pour que la relation des éditions continue d'exister.

## Gardes d'architecture à ajouter

- Toute requête Postgres passe par `lib/base/` ; aucun import de Drizzle hors de ce dossier (lecture du source, comme pour Notion).
- `lecteurs` n'est jamais interrogée par email sans normalisation en minuscules, et jamais par `identifiant_acces` sans comparaison exacte.
- Aucune fonction cachée ne reçoit un `lecteur_id` : seulement un `organisation_id`.
- `envois` est écrite avant `envoyerMessage`, dans la même fonction, et le test le vérifie par lecture du source.
