# Schéma de données du portail (Postgres)

*Proposé le 15 octobre 2026 (action 9 du plan de travail), validé le 16 octobre 2026 avec la décision d'architecture. Palier 1a livré : `organisations`, `veilles`, `lecteurs` (`lib/base/schema.ts`, migration `drizzle/0000_*`). Palier 2, première livraison le 21 octobre 2026 : `travaux` et `runs` (migration 0009 sur `main`, après `0008_lettres_du_moteur`), et `veilles` enfin écrite (`POST /api/veille/veilles`). Le schéma décrit l'état cible à la fin du palier 2 ; chaque palier n'en crée que ce dont il a besoin. Conventions : identifiants `uuid` générés par la base, horodatages `timestamptz`, noms en français comme le reste du code, suppression jamais physique (colonne `archivée_le`).*

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
| `demandée_le`, `activée_le`, `suspendue_le` | timestamptz, nullable | `activée_le` fixe J0 du parcours ; posée une seule fois par le passage quotidien, à la date de la première lettre publiée (`fixerJ0`) |
| `essai_ouvert_le` | timestamptz, nullable | entrée dans l'essai par l'onboarding (`ouvrirEnEssai`) ; plancher de J0 (lundi de cette semaine). Nulle pour une entrée par prospection tant que le lecteur n'a pas fait sa première visite |
| `entrée_par_prospection` | boolean, défaut faux | lettre 1 partie sans sollicitation (migration 0006) ; l'essai n'ouvre qu'à la première visite, qui pose `essai_ouvert_le` |
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
| `numéro_courant` | integer, défaut 0 | le dernier numéro attribué ; semé à la déclaration (`POST /api/veille/veilles`, lu sur `GET /api/veille/contexte`), puis écrit par le portail dans la même transaction que l'acceptation du résultat |
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

### `travaux` (créée le 21 octobre 2026, migration 0009)

La file que lisent les exécuteurs : les tâches Trigger.dev du moteur
(`vider-la-file`) et, le temps de la transition, la tâche Cowork « Runs de
veille ». Une ligne par chose à faire. Écrite par `lib/base/travaux.ts`, appelé
de la seule orchestration `lib/portail/file.ts` ; planifiée chaque matin par le
passage quotidien (`GET /api/veille/parcours`), servie par
`POST /api/veille/travaux`, conclue par `POST /api/veille/editions` (lettre
Markdown du moteur) ou `POST /api/veille/resultat` (page Notion)
(`docs/api-veille.md`). Le palier 2 pose des travaux `lettre`, et
`premiere_lettre` à la main ou par l'onboarding ; les autres types attendent
leur porte.

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `type` | enum | `referentiel`, `premiere_lettre`, `lettre`, `revue` |
| `organisation_id`, `veille_id` | uuid | `veille_id` nul pour un travail d'organisation |
| `échéance` | timestamptz | avant quoi il ne doit pas être pris : la parution, à l'heure de Paris de la veille (`heure_parution`) |
| `état` | enum | `a_faire`, `pris`, `accepte`, `refuse`, `abandonne`. `refuse` n'est pas final : le dernier résultat a été refusé par les portes, et la file le propose à nouveau |
| `pris_le`, `pris_par` | timestamptz, text | identifiant de session de la tâche ; un travail pris depuis plus de trois heures redevient `a_faire` (ou `abandonne` s'il a épuisé ses tentatives) |
| `tentatives` | smallint | comptées à la prise ; abandon à la troisième |
| `contexte` | jsonb | ce que le portail sait **sans lire Notion** : organisation (slug, registre), veille (type, famille, référentiel), **numéro à attribuer** (`numéro_courant + 1`), parution (date, semaine), prompt à appliquer (page et étape). Les dernières éditions sont relues de Notion à la prise et servies dans la réponse, jamais copiées ici |
| `résultat_run_id` | uuid, nullable | le run accepté |
| `créé_le` | timestamptz | |
| contrainte | | un seul travail ouvert (`a_faire`, `pris` ou `refuse`) par (`organisation_id`, `veille_id`, `type`), index partiel `travaux_ouvert_unique` |

### `runs` (créée le 21 octobre 2026, migration 0009)

Le journal, **le seul** (décision du 22 octobre 2026 : la collection Payload
`runs` a été retirée). Une ligne par résultat posté, accepté ou non. Le résultat
d'une lettre est soit la page Notion en Brouillon que l'exécuteur Cowork a
écrite (`page_notion`), soit l'édition Markdown remise par le moteur
(`page_notion` nul, `résultat.sorte = "edition"`, l'édition Payload n'étant
écrite que si le run est accepté) ; dans les deux cas contrôlée par le parseur
de production. `résultat` garde ce que l'exécuteur a dit de son run (mesures,
contrôle du moteur), jamais le corps de la lettre.

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `travail_id` | uuid, référence | |
| `début`, `fin` | timestamptz | donnés par la tâche |
| `exécuteur` | text | `cowork:<session>`, `trigger:<run>` ou `api:<modèle>` |
| `résultat` | jsonb | ce que l'exécuteur dit de son run : `méthode`, `amendements`, `grille`… ; jamais le corps |
| `portes` | jsonb | `portail` (organisation, famille, numéro, page), `ruptures` et `avertissements` du lint |
| `accepté` | boolean | |
| `page_notion` | text, nullable | l'identifiant de la page Édition écrite par l'exécuteur Cowork, en Brouillon, 32 hexadécimaux ; nul pour une édition du moteur |
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

### `prospections` et `événements_prospection` (créées le 19 octobre 2026, migration 0005)

Une ligne de `prospections` par lead lemlist, c'est-à-dire par adresse engagée dans une campagne de prospection (lettre 1 non sollicitée, puis relances). Elle tient ce que lemlist et le portail ne savent pas l'un sans l'autre : où en est le prospect, et quel lead lemlist le porte. Écrite par le webhook lemlist, par la première visite d'un lecteur et par la synchronisation quotidienne ; lue par `GET /api/veille/prospection`. Le détail est dans `docs/prospection-lemlist.md`.

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `organisation_id`, `lecteur_id` | uuid, référence, nullables | nuls tant qu'aucun lecteur actif ne porte l'adresse du lead ; rattachés au premier événement, ou à la première visite |
| `destinataire_empreinte` | text | huit hexadécimaux ; jamais l'adresse |
| `campagne_lemlist`, `lead_lemlist`, `contact_lemlist` | text, nullables | `cam_…`, `lea_…` (unique), `con_…` ; apportés par le webhook |
| `statut` | enum | `envoye`, `actif`, `abonne`, `expire`, `resilie`, `rebondi`, `desinscrit` (final) |
| `statut_le` | timestamptz | |
| `séquence_arrêtée_le` | timestamptz, nullable | posée quand lemlist a accepté d'arrêter la séquence |
| `synchronisé_statut`, `synchronisé_le` | enum, timestamptz, nullables | le dernier statut écrit chez lemlist ; tant qu'il diffère de `statut`, la synchronisation retente |
| `erreur_synchro` | text, nullable | un code (`lemlist-503`, `lemlist-réseau`), jamais un message |
| `dernier_événement_le`, `créée_le`, `modifiée_le` | timestamptz | |

`événements_prospection` : le journal des webhooks, une ligne par activité lemlist (`activité_lemlist` unique, `act_…`), avec `type` (`emailsSent`, `emailsOpened`…), `étape` de la séquence, `survenu_le`, `reçu_le`. Le score d'un prospect se calcule dans la tâche à partir de ces comptes.

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

`étapeDuParcours(organisation, abonnement, aujourdHui)` est une fonction pure de `lib/domaine/parcours.ts` : J0 à `activée_le`, puis par semaines ISO autant de parutions complètes que `parutions_d_essai` (deux par défaut depuis le 24 octobre 2026, J0 et J+7 ; trois auparavant) ; la semaine suivante (J+14 par défaut) sans abonnement, une parution réduite à « L'essentiel » de chaque lettre ; `abonne` si `abonnements.état` est `trialing` ou `active`, `suspendue` au-delà de cette parution réduite sans abonnement (offre décidée le 17 octobre 2026, `docs/decision-portail-moteur.md`). Rien de cela n'est une colonne : une date et un état Stripe suffisent, et un état stocké divergerait.

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
