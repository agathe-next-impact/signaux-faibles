import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

/**
 * Le schéma Postgres du portail, palier 1a.
 *
 * Il porte l'**état** du dispositif ; Notion porte les **documents**
 * (`docs/decision-portail-moteur.md`, validée le 16 octobre 2026). Postgres ne
 * contient jamais le corps d'une lettre ni le texte d'un référentiel : il en
 * contient les identifiants Notion.
 *
 * Ce fichier ne crée que ce dont les paliers engagés ont besoin : organisations,
 * veilles et lecteurs (palier 1a), abonnements (palier 1c), travaux et runs
 * (palier 2). Les tables suivantes du schéma cible (`docs/schema-donnees.md`)
 * arrivent avec le palier qui s'en sert, chacune par sa propre migration.
 *
 * Conventions, celles du schéma cible : identifiants `uuid` tirés par la base,
 * horodatages avec fuseau, noms en français comme le reste du code, suppression
 * jamais physique (`archivée_le`).
 */

const horodatage = (nom: string) => timestamp(nom, { withTimezone: true, mode: 'date' })

export const étatOrganisation = pgEnum('état_organisation', [
  'demande',
  'generation',
  'essai',
  'abonnee',
  'suspendue',
  'ecartee',
  'test',
])

/**
 * L'offre d'une organisation (19 octobre 2026) : ce qu'elle paie, ou non.
 *   · `standard` : les formules de l'offre, 149 € ou 1 490 € HT depuis le 23 octobre 2026 (89 € ou 890 € avant) ;
 *   · `early_adopter` : la seule formule à 29 € HT par mois, réservée par
 *     l'opératrice à une organisation nommée ;
 *   · `gratuite` : accès offert, aucune ligne Stripe, jamais de fin d'essai.
 * Avant elle, « abonnée sans ligne Stripe » confondait l'accès offert et
 * l'abonnement facturé par virement.
 */
export const offreOrganisation = pgEnum('offre_organisation', ['standard', 'early_adopter', 'gratuite'])

/** Une par client, prospect ou organisation de test. */
export const organisations = pgTable(
  'organisations',
  {
  id: uuid('id').primaryKey().defaultRandom(),
  /** Celui des URL du portail ; jamais modifié après la première lettre. */
  slug: text('slug').notNull().unique(),
  nom: text('nom').notNull(),
  /**
   * Normalisée, vient du formulaire. **Nulle pour les organisations migrées** :
   * le portail n'a jamais eu accès au registre qui la porte, et le palier 1a ne
   * l'ouvre pas.
   */
  urlSite: text('url_site'),
  /** Page sous « Veilles clients ». Jamais utilisée pour le cloisonnement. */
  pageOrganisationNotion: text('page_organisation_notion'),
  /**
   * L'identifiant de la ligne du registre, celui que portent les éditions dans
   * leur relation `Organisation`. **C'est la clé de cloisonnement des lectures
   * Notion** (règle 2) tant que des éditions le référencent : sans lui, aucune
   * requête sur « Éditions » ne peut être filtrée, et l'accès est refusé.
   * 32 hexadécimaux, sans tirets, en minuscules.
   */
  registreNotion: text('registre_notion').unique(),
  état: étatOrganisation('état').notNull(),
  demandéeLe: horodatage('demandée_le'),
  /** Fixe le J0 du parcours d'essai. */
  activéeLe: horodatage('activée_le'),
  /**
   * Entrée dans le parcours d'essai par l'onboarding (`ouvrirEnEssai`). J0 ne
   * peut pas tomber avant le lundi de cette semaine : une lettre publiée plus
   * tôt (test, erreur) ne raccourcit pas l'essai.
   */
  essaiOuvertLe: horodatage('essai_ouvert_le'),
  /**
   * Entrée par prospection (19 octobre 2026) : la lettre 1 est partie sans
   * sollicitation, et l'essai n'ouvre qu'à la **première visite** du lecteur.
   * Tant que `essai_ouvert_le` est nul, J0 n'est pas fixé et aucune lettre
   * publiée avant la visite ne compte dans l'essai.
   */
  entréeParProspection: boolean('entrée_par_prospection').notNull().default(false),
  suspendueLe: horodatage('suspendue_le'),
  offre: offreOrganisation('offre').notNull().default('standard'),
  /**
   * Parutions complètes de l'essai avant « L'essentiel » seul : trois par
   * défaut (J0, J+7, J+14), réglable par l'opératrice pour qu'un essai à J+28
   * ne soit pas un cas codé en dur.
   */
  parutionsDEssai: smallint('parutions_d_essai').notNull().default(3),
  /** Tant que vrai, les envois partent à l'adresse de relecture, pas au client. */
  relectureRequise: boolean('relecture_requise').notNull().default(true),
  emailRelecture: text('email_relecture'),
  crééeLe: horodatage('créée_le').notNull().defaultNow(),
  modifiéeLe: horodatage('modifiée_le').notNull().defaultNow(),
  archivéeLe: horodatage('archivée_le'),
  },
  (table) => [
    check('organisations_slug_non_vide', sql`length(trim(${table.slug})) > 0`),
    // La forme que portent les éditions : 32 hexadécimaux, sans tirets, en
    // minuscules. Un identifiant mal formé ne filtrerait rien, en silence.
    check(
      'organisations_registre_notion_forme',
      sql`${table.registreNotion} is null or ${table.registreNotion} ~ '^[0-9a-f]{32}$'`,
    ),
    check('organisations_parutions_d_essai', sql`${table.parutionsDEssai} between 1 and 8`),
  ],
)

export const cadenceVeille = pgEnum('cadence_veille', ['hebdomadaire', 'bimensuelle', 'mensuelle'])
export const étatVeille = pgEnum('état_veille', ['active', 'suspendue', 'archivée'])

/**
 * N par organisation. Remplace le libellé `Veille` et la propriété `Famille` à
 * deux valeurs de la base Éditions.
 */
export const veilles = pgTable(
  'veilles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organisationId: uuid('organisation_id')
      .notNull()
      .references(() => organisations.id),
    /**
     * `ecosysteme`, `concurrentielle` aujourd'hui. Une donnée et non un enum :
     * un type nouveau se crée sans migration.
     */
    type: text('type').notNull(),
    /** Le nom que le client voit (« Positionnement », « Attractivité »…). */
    libellé: text('libellé').notNull(),
    referentielNotion: text('referentiel_notion'),
    /** 1 (lundi) à 7. */
    jourParution: smallint('jour_parution').notNull(),
    /** Heure de Paris. */
    heureParution: time('heure_parution').notNull(),
    cadence: cadenceVeille('cadence').notNull(),
    /** Le dernier numéro attribué. */
    numéroCourant: integer('numéro_courant').notNull().default(0),
    état: étatVeille('état').notNull().default('active'),
  },
  (table) => [
    uniqueIndex('veilles_organisation_type').on(table.organisationId, table.type),
    check('veilles_jour_parution', sql`${table.jourParution} between 1 and 7`),
  ],
)

export const rôleLecteur = pgEnum('rôle_lecteur', ['lecteur', 'relecteur', 'operateur'])

/**
 * Remplace la base Notion « Accès — portail ». Une ligne par personne.
 *
 * Deux contraintes y remplacent deux contrôles que le portail faisait à la
 * main, après deux pannes réelles :
 * - `identifiant_acces` unique : dupliquer une ligne pour ajouter un lecteur
 *   recopiait l'identifiant, et les deux liens étaient refusés (11 septembre
 *   2026). La base refuse désormais la seconde ligne ;
 * - une adresse par organisation, comparée en minuscules.
 */
export const lecteurs = pgTable(
  'lecteurs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Nulle pour un opérateur sans organisation propre. */
    organisationId: uuid('organisation_id').references(() => organisations.id),
    nom: text('nom').notNull(),
    email: text('email'),
    /** 32 hexadécimaux, le secret que le lien signe. Jamais journalisé. */
    identifiantAcces: text('identifiant_acces').notNull().unique(),
    /** Révocation effective à la requête suivante. */
    actif: boolean('actif').notNull().default(true),
    /** Privilège opérateur (règle 2 de `CLAUDE.md`). */
    tousLesEspaces: boolean('tous_les_espaces').notNull().default(false),
    rôle: rôleLecteur('rôle').notNull().default('lecteur'),
    crééLe: horodatage('créé_le').notNull().defaultNow(),
    dernièreVisiteLe: horodatage('dernière_visite_le'),
  },
  (table) => [
    uniqueIndex('lecteurs_organisation_email').on(table.organisationId, sql`lower(${table.email})`),
    check('lecteurs_identifiant_non_vide', sql`length(trim(${table.identifiantAcces})) > 0`),
  ],
)

/**
 * L'abonnement d'une organisation, **copie de Stripe** (palier 1c).
 *
 * Stripe est la seule source de vérité de l'abonnement
 * (`docs/decision-portail-moteur.md`, point 6) : cette table n'est écrite que
 * par son webhook, jamais par un écran ni par une tâche, et le portail ne la lit
 * que pour ses propres décisions (le parcours d'essai, la lecture autorisée).
 *
 * **Une ligne par abonnement Stripe**, et non par organisation : un client qui
 * passe du mois à l'année, ou se réabonne après une résiliation, a deux
 * abonnements, parfois ouverts en même temps quelques instants. Une ligne unique
 * par organisation laissait la résiliation tardive de l'ancien écraser le
 * nouveau (relecture du 17 octobre 2026). Une organisation est abonnée si
 * **l'une** de ses lignes est ouverte.
 *
 * `dernier_événement` et `événement_le` rendent le webhook sûr face aux deux
 * travers de Stripe, qui sont documentés : un même événement peut arriver
 * plusieurs fois, et deux événements peuvent arriver dans le désordre. Le
 * premier est reconnu à son identifiant, le second à sa date de création.
 */
export const abonnements = pgTable(
  'abonnements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organisationId: uuid('organisation_id')
      .notNull()
      .references(() => organisations.id),
    clientStripe: text('client_stripe').notNull(),
    abonnementStripe: text('abonnement_stripe').notNull().unique(),
    /** Tel que Stripe le donne : `trialing`, `active`, `past_due`, `canceled`… */
    état: text('état').notNull(),
    /** `mensuelle` ou `annuelle`, lue sur l'intervalle du prix ; nulle si Stripe ne le dit pas. */
    formule: text('formule'),
    périodeFin: horodatage('période_fin'),
    /** Identifiant du dernier événement Stripe appliqué. */
    dernierÉvénement: text('dernier_événement').notNull(),
    /** Date de création de cet événement chez Stripe : un événement plus ancien est ignoré. */
    événementLe: horodatage('événement_le').notNull(),
    /**
     * Type de cet événement (`customer.subscription.updated`…). Stripe date ses
     * événements à la seconde, et un paiement par Checkout produit `created` et
     * `updated` dans la même : à égalité de date, l'ordre du cycle de vie
     * départage (création, puis mise à jour, puis suppression).
     */
    dernierType: text('dernier_type').notNull(),
    reçuLe: horodatage('reçu_le').notNull().defaultNow(),
  },
  (table) => [
    index('abonnements_organisation').on(table.organisationId),
    check('abonnements_client_stripe_forme', sql`${table.clientStripe} ~ '^cus_'`),
    check('abonnements_abonnement_stripe_forme', sql`${table.abonnementStripe} ~ '^sub_'`),
  ],
)

export type Organisation = typeof organisations.$inferSelect
export type Lecteur = typeof lecteurs.$inferSelect
export type Veille = typeof veilles.$inferSelect
export type Abonnement = typeof abonnements.$inferSelect

/**
 * Le journal des courriers que le portail envoie (17 et 18 octobre 2026).
 *
 * Une ligne par courrier, **écrite avant l'appel à Gmail** (`prevu`), conclue
 * après (`envoye` avec l'identifiant du message, ou `echec` avec un code). Elle
 * répond à la question que les journaux Vercel, éphémères et anonymisés, ne
 * permettent pas de trancher : tel lecteur a-t-il reçu tel courrier, et quand ?
 *
 * L'adresse n'est jamais copiée ici : le lecteur est désigné par `lecteur_id`
 * quand le portail le connaît, et toujours par l'empreinte de huit caractères
 * de son adresse (`empreinte`, `lib/portail/debit.ts`), la même que celle des
 * journaux, pour pouvoir rapprocher les deux.
 *
 * Les courriers de parcours (fin d'essai) ne partent **qu'une fois** par
 * organisation et par destinataire : l'index unique partiel ci-dessous le
 * garantit, et c'est la réservation de la ligne qui décide de l'envoi, pas une
 * lecture préalable. Une ligne en `echec` sort de l'index : le passage du
 * lendemain retente le courrier, au lieu de tenir un refus de Gmail pour un envoi.
 * Un courrier adressé à la relecture n'a pas de lecteur :
 * `coalesce` le range sous un identifiant nul, sans quoi Postgres tiendrait deux
 * valeurs nulles pour distinctes et laisserait partir un doublon.
 *
 * Distinct de la table `envois` du schéma cible, qui servira l'envoi des lettres
 * elles-mêmes au palier 1b.
 */
export const sorteCourrier = pgEnum('sorte_courrier', [
  'lien_acces',
  'essai_derniere_parution',
  'essai_tronquee',
  'alerte_espaces',
  'demande_demo',
  /** La lettre unique d'une parution, aux lecteurs actifs (programme du 22 octobre 2026). */
  'lettre',
  /** La lettre de filière, aux prospects (palier 1). */
  'lettre_filiere',
  /**
   * Les courriers commerciaux du 23 octobre 2026, tous déposés en brouillon
   * Gmail : rappel de la deuxième parution de l'essai (J+7), espace suspendu
   * après l'essai, puis ce que dit Stripe (abonnement actif, paiement refusé,
   * renouvellement annuel à venir, résiliation).
   */
  'essai_rappel_j7',
  'essai_suspendu',
  'abonnement_confirme',
  'paiement_echec',
  'abonnement_renouvellement',
  'abonnement_resilie',
])
/** `brouillon` : déposé dans la boîte émettrice, à relire et envoyer à la main (23 octobre 2026). */
export const étatCourrier = pgEnum('état_courrier', ['prevu', 'envoye', 'echec', 'brouillon'])

export const courriers = pgTable(
  'courriers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sorte: sorteCourrier('sorte').notNull(),
    organisationId: uuid('organisation_id').references(() => organisations.id),
    lecteurId: uuid('lecteur_id').references(() => lecteurs.id),
    /** Empreinte de l'adresse du destinataire, jamais l'adresse. */
    destinataireEmpreinte: text('destinataire_empreinte').notNull(),
    /** Ce qui a provoqué l'envoi : `recevoir-mon-lien`, `activation`, `cron`. */
    déclencheur: text('déclencheur').notNull(),
    état: étatCourrier('état').notNull().default('prevu'),
    messageGmail: text('message_gmail'),
    /** Un code (statut HTTP de Gmail, SQLSTATE), jamais un message libre. */
    erreur: text('erreur'),
    prévuLe: horodatage('prévu_le').notNull().defaultNow(),
    concluLe: horodatage('conclu_le'),
    /**
     * La clé d'unicité d'un courrier commercial (23 octobre 2026) : `parcours`
     * pour un courrier d'essai, l'abonnement Stripe pour sa confirmation et sa
     * résiliation, l'abonnement et l'échéance pour un paiement refusé ou un
     * renouvellement. Nulle pour tout autre courrier.
     */
    clé: text('clé'),
  },
  (table) => [
    index('courriers_prevu_le').on(table.prévuLe),
    index('courriers_organisation').on(table.organisationId),
    check('courriers_empreinte_forme', sql`${table.destinataireEmpreinte} ~ '^[0-9a-f]{8}$'`),
    uniqueIndex('courriers_parcours_unique')
      .on(
        table.sorte,
        table.organisationId,
        sql`coalesce(${table.lecteurId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
      )
      .where(sql`${table.sorte} in ('essai_derniere_parution', 'essai_tronquee') and ${table.état} <> 'echec'`),
    // Le prédicat ne nomme aucune sorte : une valeur d'enum ajoutée ne peut pas
    // servir dans la transaction qui l'ajoute, et les migrations en font une seule.
    uniqueIndex('courriers_commerciaux_unique')
      .on(
        table.sorte,
        table.organisationId,
        sql`coalesce(${table.lecteurId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
        table.clé,
      )
      .where(sql`${table.clé} is not null and ${table.état} <> 'echec'`),
  ],
)

export type Courrier = typeof courriers.$inferSelect

/**
 * La prospection par lemlist (19 octobre 2026, liaison « portail ↔ lemlist »).
 *
 * Une ligne par lead lemlist, c'est-à-dire par adresse engagée dans une
 * campagne de prospection : la lettre 1 envoyée sans sollicitation, puis les
 * relances. Le portail tient ici deux choses que lemlist et lui ne peuvent pas
 * savoir l'un sans l'autre : **où en est le prospect** (il a ouvert son espace,
 * il s'est abonné, son essai a expiré, il s'est désinscrit) et **quel lead
 * lemlist le porte**, pour pouvoir arrêter la séquence à la seconde où il
 * s'active et tenir à jour ses variables.
 *
 * L'adresse n'est jamais copiée ici, comme dans `courriers` : le lecteur est
 * désigné par `lecteur_id` quand le rattachement a réussi, et toujours par
 * l'empreinte de huit caractères. Les identifiants lemlist (`lea_…`, `cam_…`,
 * `con_…`) ne sont pas des données personnelles.
 *
 * Le statut est **stocké**, à la différence de l'étape du parcours : il décrit
 * ce que lemlist doit savoir et quand on le lui a dit, pas un droit de lecture.
 * `synchronisé_statut` est le dernier statut effectivement écrit chez lemlist ;
 * tant qu'il diffère de `statut`, la synchronisation quotidienne retente.
 * `désinscrit` est final : rien ne l'écrase, et la tâche de prospection doit
 * le lire avant de recontacter une adresse.
 */
export const statutProspection = pgEnum('statut_prospection', [
  'envoye',
  'actif',
  'abonne',
  'expire',
  'resilie',
  'rebondi',
  'desinscrit',
])

export const prospections = pgTable(
  'prospections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Nulle quand aucun lecteur du portail ne porte l'adresse du lead. */
    organisationId: uuid('organisation_id').references(() => organisations.id),
    lecteurId: uuid('lecteur_id').references(() => lecteurs.id),
    /** Empreinte de l'adresse du lead, jamais l'adresse. */
    destinataireEmpreinte: text('destinataire_empreinte').notNull(),
    campagneLemlist: text('campagne_lemlist'),
    /** L'identifiant du lead dans la campagne (`lea_…`), par lequel les variables s'écrivent. */
    leadLemlist: text('lead_lemlist').unique(),
    contactLemlist: text('contact_lemlist'),
    statut: statutProspection('statut').notNull().default('envoye'),
    statutLe: horodatage('statut_le').notNull().defaultNow(),
    /** Posée quand la séquence lemlist a été arrêtée (lead marqué intéressé). */
    séquenceArrêtéeLe: horodatage('séquence_arrêtée_le'),
    /** Le dernier statut écrit dans les variables lemlist ; nul tant qu'aucune écriture n'a réussi. */
    synchroniséStatut: statutProspection('synchronisé_statut'),
    synchroniséLe: horodatage('synchronisé_le'),
    /** Un code (`lemlist-404`, `lemlist-réseau`), jamais un message. */
    erreurSynchro: text('erreur_synchro'),
    dernierÉvénementLe: horodatage('dernier_événement_le'),
    crééeLe: horodatage('créée_le').notNull().defaultNow(),
    modifiéeLe: horodatage('modifiée_le').notNull().defaultNow(),
  },
  (table) => [
    index('prospections_empreinte').on(table.destinataireEmpreinte),
    index('prospections_organisation').on(table.organisationId),
    check('prospections_empreinte_forme', sql`${table.destinataireEmpreinte} ~ '^[0-9a-f]{8}$'`),
    check('prospections_lead_forme', sql`${table.leadLemlist} is null or ${table.leadLemlist} ~ '^lea_'`),
    check('prospections_campagne_forme', sql`${table.campagneLemlist} is null or ${table.campagneLemlist} ~ '^cam_'`),
  ],
)

/**
 * Le journal des événements que lemlist envoie par webhook : lettre envoyée,
 * ouverte, lien cliqué, réponse, rebond, désinscription. Un événement est
 * reconnu à son identifiant d'activité lemlist (`act_…`) : une livraison
 * répétée est ignorée. C'est de ce journal que la tâche de prospection tire le
 * score d'un prospect ; le portail ne le calcule pas.
 */
export const événementsProspection = pgTable(
  'événements_prospection',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    prospectionId: uuid('prospection_id')
      .notNull()
      .references(() => prospections.id),
    activitéLemlist: text('activité_lemlist').notNull().unique(),
    /** Tel que lemlist le nomme : `emailsSent`, `emailsOpened`, `emailsClicked`… */
    type: text('type').notNull(),
    /** Numéro de l'étape de la séquence, quand lemlist le donne. */
    étape: smallint('étape'),
    /** La date de l'événement chez lemlist. */
    survenuLe: horodatage('survenu_le').notNull(),
    reçuLe: horodatage('reçu_le').notNull().defaultNow(),
  },
  (table) => [index('événements_prospection_prospection').on(table.prospectionId)],
)

export type Prospection = typeof prospections.$inferSelect
export type ÉvénementProspection = typeof événementsProspection.$inferSelect


/**
 * La file de travaux et son journal (palier 2, 21 octobre 2026).
 *
 * La décision du 15 octobre (`docs/decision-portail-moteur.md`, point 4) fait du
 * portail l'endroit qui **décide** ce qu'il y a à faire : il assemble le
 * contexte d'un run (organisation, veille, numéro à attribuer, parution), le
 * pose dans la file, et l'exécuteur, tâche Claude planifiée ou appel d'API, ne
 * fait que le prendre, rédiger, et poster un résultat. Le modèle ne calcule
 * plus de date, ne compte plus de numéro, ne décide plus d'un statut.
 *
 * Une ligne de `travaux` par chose à faire. L'**échéance** est l'instant avant
 * lequel le travail ne doit pas être pris : la parution, à son heure de Paris.
 * Un travail `pris` depuis plus de trois heures est rendu à la file (la
 * session qui l'avait pris n'a pas conclu) ; au troisième échec, il est
 * `abandonne` et le contrôle du soir le signale. `refuse` n'est pas final : le
 * dernier résultat a été refusé par les portes, et la file le propose à
 * nouveau tant que les tentatives restent.
 *
 * `contexte` ne porte que ce que le portail sait **sans lire Notion** : des
 * identifiants, un numéro, des dates, le nom du prompt. Les dernières éditions
 * (dossiers, période couverte) sont relues de Notion à la prise du travail et
 * servies dans la réponse, jamais copiées ici : Postgres ne contient ni corps
 * de lettre ni texte de référentiel.
 *
 * **Un seul travail ouvert par veille et par type** : l'index partiel ci-dessous
 * rend la planification quotidienne rejouable, comme le journal des courriers
 * rend les envois de fin d'essai rejouables.
 */
export const typeTravail = pgEnum('type_travail', ['referentiel', 'premiere_lettre', 'lettre', 'revue'])
export const étatTravail = pgEnum('état_travail', ['a_faire', 'pris', 'accepte', 'refuse', 'abandonne'])

export const travaux = pgTable(
  'travaux',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    type: typeTravail('type').notNull(),
    organisationId: uuid('organisation_id')
      .notNull()
      .references(() => organisations.id),
    /** Nul pour un travail d'organisation (référentiel). */
    veilleId: uuid('veille_id').references(() => veilles.id),
    /** Avant quoi le travail ne doit pas être pris. */
    échéance: horodatage('échéance').notNull(),
    état: étatTravail('état').notNull().default('a_faire'),
    prisLe: horodatage('pris_le'),
    /** L'identifiant de session de l'exécuteur qui tient le travail. */
    prisPar: text('pris_par'),
    tentatives: smallint('tentatives').notNull().default(0),
    /** Ce que le portail a assemblé ; identifiants, numéro, dates, prompt. */
    contexte: jsonb('contexte').$type<Record<string, unknown>>().notNull(),
    /** Le run accepté, une fois le travail conclu. */
    résultatRunId: uuid('résultat_run_id'),
    crééLe: horodatage('créé_le').notNull().defaultNow(),
  },
  (table) => [
    index('travaux_échéance').on(table.état, table.échéance),
    index('travaux_organisation').on(table.organisationId),
    check('travaux_tentatives', sql`${table.tentatives} between 0 and 3`),
    // Un seul travail ouvert (à faire, pris ou refusé) par veille et par type.
    // `coalesce` range les travaux d'organisation sous un identifiant nul, sans
    // quoi Postgres tiendrait deux valeurs nulles pour distinctes.
    uniqueIndex('travaux_ouvert_unique')
      .on(
        table.organisationId,
        sql`coalesce(${table.veilleId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
        table.type,
      )
      .where(sql`${table.état} in ('a_faire', 'pris', 'refuse')`),
  ],
)

/**
 * Le journal des résultats : une ligne par résultat posté, accepté ou non.
 *
 * Le résultat d'une lettre est **une page Notion en Brouillon** que l'exécuteur
 * a écrite, désignée par `page_notion` ; le portail la passe dans le parseur de
 * production (`lib/portail/lint.ts`) et tient ses portes dans `portes`. Un
 * résultat en Markdown aurait demandé un second parseur, et le validateur
 * n'aurait plus eu la même lecture que les écrans. `résultat` garde ce que
 * l'exécuteur a dit de son run (méthode, grille de collecte, amendements),
 * jamais le corps de la lettre.
 */
export const runs = pgTable(
  'runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    travailId: uuid('travail_id')
      .notNull()
      .references(() => travaux.id),
    début: horodatage('début'),
    fin: horodatage('fin'),
    /** `cowork:<session>` ou `api:<modèle>`. */
    exécuteur: text('exécuteur').notNull(),
    résultat: jsonb('résultat').$type<Record<string, unknown>>().notNull(),
    /** Le rapport des portes : code, portée, message. */
    portes: jsonb('portes').$type<Record<string, unknown>>().notNull(),
    accepté: boolean('accepté').notNull(),
    /** La page Édition, 32 hexadécimaux sans tirets. */
    pageNotion: text('page_notion'),
    /** Tokens, recherches, durée, quand l'exécuteur les donne. */
    coût: jsonb('coût').$type<Record<string, unknown>>(),
    crééLe: horodatage('créé_le').notNull().defaultNow(),
  },
  (table) => [
    index('runs_travail').on(table.travailId),
    check('runs_page_notion_forme', sql`${table.pageNotion} is null or ${table.pageNotion} ~ '^[0-9a-f]{32}$'`),
  ],
)

export type Travail = typeof travaux.$inferSelect
export type Run = typeof runs.$inferSelect
export type TypeTravail = Travail['type']
export type ÉtatTravail = Travail['état']
