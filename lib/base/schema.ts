import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  date,
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
  type AnyPgColumn,
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
   * Parutions complètes de l'essai avant « L'essentiel » seul : deux par
   * défaut (J0, J+7) depuis le 24 octobre 2026, trois auparavant (migration
   * 0011, qui ne touche pas aux organisations existantes), réglable par
   * l'opératrice pour qu'un essai plus long ne soit pas un cas codé en dur.
   * Même valeur que `PARUTIONS_D_ESSAI`, qu'affiche la vitrine.
   */
  parutionsDEssai: smallint('parutions_d_essai').notNull().default(2),
  /**
   * Le prescripteur qui a recommandé l'organisation (24 octobre 2026,
   * `docs/prescripteurs.md`). Le premier garde l'organisation : jamais réécrit.
   * Exclusif de l'entrée par prospection : une organisation recommandée ne
   * reçoit pas de séquence, une organisation prospectée n'est pas attribuée.
   */
  recommandéePar: uuid('recommandée_par').references((): AnyPgColumn => prescripteurs.id),
  recommandéeLe: horodatage('recommandée_le'),
  /**
   * L'accord du client recommandé pour que son prescripteur voie son nom et son
   * étape (essai, abonnée, essai terminé) sur l'écran « Vos recommandations ».
   * Posé par l'opératrice, après l'accord du client ; faux par défaut : sans
   * lui, le prescripteur ne voit rien de l'organisation. Jamais une lettre.
   */
  partageAvecPrescripteur: boolean('partage_avec_prescripteur').notNull().default(false),
  /**
   * Le pilote des outils stratégiques (26 octobre 2026,
   * `docs/plan-outils-strategiques.md`) : tant que faux, les routes des faits,
   * de la grille et des synthèses répondent `hors-pilote`, et les tâches passent
   * l'étape. C'est ce qui borne le pilote sans propriété nouvelle dans le
   * registre Notion. Posé par l'opératrice.
   */
  outilsStratégiques: boolean('outils_strategiques').notNull().default(false),
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
    check(
      'organisations_recommandée_hors_prospection',
      sql`not (${table.entréeParProspection} and ${table.recommandéePar} is not null)`,
    ),
    check(
      'organisations_recommandée_datée',
      sql`(${table.recommandéePar} is null) = (${table.recommandéeLe} is null)`,
    ),
  ],
)

/** Le métier du prescripteur, pour le tableau de l'opératrice ; il ne change aucune règle. */
export const typePrescripteur = pgEnum('type_prescripteur', [
  'conseil',
  'expertise_comptable',
  'juridique',
  'chambre_consulaire',
  'developpement_economique',
  'cluster_federation',
  'ess_financeur',
  'autre',
])

/**
 * Les prescripteurs (24 octobre 2026, `docs/prescripteurs.md`) : expert-comptable,
 * cabinet de conseil, chambre, cluster, fédération, réseau de l'ESS. Ils
 * recommandent des clients et ne sont **jamais prospectés** : la prospection
 * automatisée est réservée aux clients finaux.
 *
 * Un prescripteur est une organisation du portail, qui a son propre espace en
 * accès offert ; cette table n'y ajoute que son code de recommandation. Il ne
 * lit jamais les lettres des organisations qu'il recommande (règles 2 et 7).
 */
export const prescripteurs = pgTable(
  'prescripteurs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organisationId: uuid('organisation_id')
      .notNull()
      .unique()
      .references(() => organisations.id),
    /** Porté par le lien de recommandation (`/demo?de=<code>`), en clair : ce n'est pas un secret. */
    code: text('code').notNull().unique(),
    type: typePrescripteur('type').notNull(),
    /** Faux : le code ne rattache plus d'organisation ; les rattachements passés restent. */
    actif: boolean('actif').notNull().default(true),
    crééLe: horodatage('créé_le').notNull().defaultNow(),
    modifiéLe: horodatage('modifié_le').notNull().defaultNow(),
  },
  (table) => [check('prescripteurs_code_forme', sql`${table.code} ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(${table.code}) between 3 and 40`)],
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

// ── Outils stratégiques (26 octobre 2026, migration 0013) ────────────────────
//
// Plan : `docs/plan-outils-strategiques.md`. Les listes fermées sont celles de
// `lib/domaine/strategie.ts`, qui en fait foi ; `tests/base.strategie.test.ts`
// vérifie qu'elles n'ont pas divergé. Chaque ligne porte `organisation_id`, et
// aucune lecture de `lib/base/strategie.ts` ne se fait sans lui.
//
// **Exception bornée à « Postgres ne contient jamais le texte d'un
// référentiel ni le corps d'une lettre »**, accordée par l'opératrice le
// 26 octobre 2026 : la grille recopie des libellés courts (40 caractères au
// plus, les critères complets restent dans Notion), et les énoncés de synthèse
// sont une analyse nouvelle, ni corps de lettre ni texte de référentiel. Un
// fait étiqueté, lui, ne garde que l'empreinte de sa phrase-titre.

export const pestelDeFait = pgEnum('pestel', ['politique', 'economique', 'socioculturel', 'technologique', 'ecologique', 'legal'])
export const forcePorter = pgEnum('force_porter', ['rivalite', 'nouveaux_entrants', 'substituts', 'pouvoir_clients', 'pouvoir_fournisseurs'])
export const mouvementAnsoff = pgEnum('ansoff', ['penetration', 'developpement_produit', 'developpement_marche', 'diversification'])
export const sectionDeFait = pgEnum('section_de_fait', ['axe', 'acteurs'])
export const impactDeFait = pgEnum('impact_de_fait', ['FORT', 'MOYEN'])
export const nouveautéDeFait = pgEnum('nouveauté_de_fait', ['nouveau', 'contexte'])
/** `ge` : la matrice McKinsey/GE, annuelle, au lot 13. */
export const outilDeSynthèse = pgEnum('outil_de_synthèse', ['pestel', 'swot', 'tows', 'scenario', 'indice_cycle', 'benchmark', 'ge'])
export const étatDÉlément = pgEnum('état_d_élément', ['nouveau', 'renforce', 'inchange', 'affaibli'])
export const origineDÉlément = pgEnum('origine_d_élément', ['faits', 'declaratif'])
export const outilDePosition = pgEnum('outil_de_position', ['groupes', 'mendelow', 'forces', 'ge'])
export const tendanceDeForce = pgEnum('tendance_de_force', ['hausse', 'stable', 'baisse'])
/** `propose` pendant le pilote : rien ne va au client. */
export const étatDePublication = pgEnum('état_de_publication', ['propose', 'publie', 'retire'])

/** `AAAA-MM` (mensuel), `AAAA-T1` à `AAAA-T4` (trimestriel), `AAAA` (annuel). */
const FORME_DE_PÉRIODE = '^[0-9]{4}(-(0[1-9]|1[0-2])|-T[1-4])?$'

/**
 * Un fait d'une lettre, étiqueté (PESTEL ou force de Porter, mouvement
 * d'Ansoff, rupture). Désigné par sa place dans l'édition (section, axe, rang)
 * et par l'empreinte de sa phrase-titre : **le texte n'est pas conservé**.
 *
 * Un lot remplace les étiquettes précédentes de la même édition : les
 * anciennes sont archivées, jamais supprimées, et une synthèse qui les citait
 * les retrouve. L'unicité ne vaut donc que parmi les lignes non archivées.
 */
export const faitsÉtiquetés = pgTable(
  'faits_etiquetes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organisationId: uuid('organisation_id')
      .notNull()
      .references(() => organisations.id),
    /** La page Édition, 32 hexadécimaux sans tirets. */
    éditionNotion: text('édition_notion').notNull(),
    /** La propriété interne `Famille` de l'édition, en minuscules sans accent ; nulle pour la lettre unique. */
    familleÉdition: text('famille_édition'),
    dateÉdition: date('date_édition', { mode: 'string' }).notNull(),
    section: sectionDeFait('section').notNull(),
    /** Requis pour un fait d'axe, nul pour l'actualité des acteurs. */
    numéroAxe: smallint('numéro_axe'),
    rang: smallint('rang').notNull(),
    /** `empreinteDeTitre` (`lib/domaine/strategie.ts`) : huit hexadécimaux. */
    empreinteTitre: text('empreinte_titre').notNull(),
    dateFait: date('date_fait', { mode: 'string' }).notNull(),
    sourceUrl: text('source_url').notNull(),
    pestel: pestelDeFait('pestel'),
    forcePorter: forcePorter('force_porter'),
    ansoff: mouvementAnsoff('ansoff'),
    entité: text('entité'),
    rupture: boolean('rupture').notNull(),
    impact: impactDeFait('impact').notNull(),
    nouveauté: nouveautéDeFait('nouveauté').notNull(),
    runId: uuid('run_id').references(() => runs.id),
    crééLe: horodatage('créé_le').notNull().defaultNow(),
    archivéeLe: horodatage('archivée_le'),
  },
  (table) => [
    // Une place, un fait vivant. `coalesce` range l'actualité des acteurs (axe
    // nul) sous 0, sans quoi Postgres tiendrait deux valeurs nulles pour
    // distinctes.
    uniqueIndex('faits_etiquetes_place_unique')
      .on(table.éditionNotion, table.section, sql`coalesce(${table.numéroAxe}, 0)`, table.rang)
      .where(sql`${table.archivéeLe} is null`),
    index('faits_etiquetes_organisation').on(table.organisationId, table.dateÉdition),
    check('faits_etiquetes_edition_forme', sql`${table.éditionNotion} ~ '^[0-9a-f]{32}$'`),
    check('faits_etiquetes_empreinte_forme', sql`${table.empreinteTitre} ~ '^[0-9a-f]{8}$'`),
    check('faits_etiquetes_axe', sql`(${table.section} = 'axe') = (${table.numéroAxe} is not null)`),
    check('faits_etiquetes_rang', sql`${table.rang} >= 1 and (${table.numéroAxe} is null or ${table.numéroAxe} >= 1)`),
    check('faits_etiquetes_date', sql`${table.dateFait} <= ${table.dateÉdition}`),
    // Exactement un cadre : une lettre PESTEL ou une force de Porter.
    check('faits_etiquetes_un_cadre', sql`(${table.pestel} is null) <> (${table.forcePorter} is null)`),
    // Ansoff seulement pour un concurrent nommé, sous rivalité ou nouveaux entrants.
    check(
      'faits_etiquetes_ansoff',
      sql`${table.ansoff} is null or (${table.forcePorter} in ('rivalite', 'nouveaux_entrants') and ${table.entité} is not null)`,
    ),
    check('faits_etiquetes_entite', sql`${table.entité} is null or length(${table.entité}) between 1 and 120`),
  ],
)

/**
 * La grille de l'organisation : axes des groupes stratégiques, correspondance
 * des familles avec PESTEL et Porter, entités suivies, parties prenantes,
 * offres. Versionnée : un re-post identique (même empreinte) ne crée pas de
 * version. Les critères complets des crans restent dans la section « Grille
 * stratégique » du référentiel, dans Notion ; seuls les libellés courts sont ici.
 */
export const grilles = pgTable(
  'grilles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organisationId: uuid('organisation_id')
      .notNull()
      .references(() => organisations.id),
    version: integer('version').notNull(),
    /** `empreinteDeLaGrille` : insensible à l'ordre des familles, entités et parties prenantes. */
    empreinte: text('empreinte').notNull(),
    /** La page du référentiel qui porte la grille, 32 hexadécimaux. */
    référentielNotion: text('référentiel_notion').notNull(),
    axesGroupes: jsonb('axes_groupes').$type<unknown[]>().notNull(),
    familles: jsonb('familles').$type<unknown[]>().notNull(),
    entités: jsonb('entités').$type<unknown[]>().notNull(),
    partiesPrenantes: jsonb('parties_prenantes').$type<unknown[]>().notNull(),
    /** Pour la matrice GE, seulement si la fiche porte plusieurs offres. */
    offres: jsonb('offres').$type<unknown[]>(),
    /** Quand les points de validation des axes sont répondus. */
    validéeLe: horodatage('validée_le'),
    crééeLe: horodatage('créée_le').notNull().defaultNow(),
    archivéeLe: horodatage('archivée_le'),
  },
  (table) => [
    uniqueIndex('grilles_version_unique').on(table.organisationId, table.version),
    check('grilles_version', sql`${table.version} >= 1`),
    check('grilles_empreinte_forme', sql`${table.empreinte} ~ '^[0-9a-f]{8}$'`),
    check('grilles_referentiel_forme', sql`${table.référentielNotion} ~ '^[0-9a-f]{32}$'`),
  ],
)

/**
 * Un élément de synthèse : une lettre PESTEL, un élément SWOT, une option
 * TOWS, un scénario, l'interprétation d'un calcul. `énoncé` est écrit par le
 * modèle ; `valeur` est calculée par le portail, jamais fournie par le modèle.
 * Une synthèse remplace la précédente de la même période (archivage).
 */
export const élémentsSynthèse = pgTable(
  'elements_synthese',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organisationId: uuid('organisation_id')
      .notNull()
      .references(() => organisations.id),
    période: text('période').notNull(),
    /** De première parution à première parution. */
    fenêtreDébut: date('fenêtre_début', { mode: 'string' }).notNull(),
    fenêtreFin: date('fenêtre_fin', { mode: 'string' }).notNull(),
    outil: outilDeSynthèse('outil').notNull(),
    /** `forces`, `SO`, `pestel:legal`, `scenario-1`… */
    clé: text('clé').notNull(),
    rang: smallint('rang').notNull(),
    énoncé: text('énoncé'),
    /** SWOT seulement. */
    état: étatDÉlément('état'),
    origine: origineDÉlément('origine').notNull().default('faits'),
    hypothèse: boolean('hypothèse').notNull().default(false),
    /** L'élément de la période précédente qu'il prolonge (renforcé, inchangé, affaibli). */
    filiation: uuid('filiation').references((): AnyPgColumn => élémentsSynthèse.id),
    /** Au moins un fait de l'organisation, sauf pour un élément déclaratif ou une lettre PESTEL sans fait. */
    faits: uuid('faits').array().notNull().default(sql`'{}'::uuid[]`),
    /** Éléments SWOT croisés (TOWS), indicateurs (scénario), section de fiche (déclaratif). */
    références: jsonb('références').$type<Record<string, unknown>>().notNull().default({}),
    valeur: jsonb('valeur').$type<Record<string, unknown>>(),
    /** TOWS : une seule par période. */
    candidateRecommandation: boolean('candidate_recommandation').notNull().default(false),
    grilleVersion: integer('grille_version').notNull(),
    étatPublication: étatDePublication('état_publication').notNull().default('propose'),
    crééLe: horodatage('créé_le').notNull().defaultNow(),
    archivéeLe: horodatage('archivée_le'),
  },
  (table) => [
    uniqueIndex('elements_synthese_place_unique')
      .on(table.organisationId, table.période, table.outil, table.clé, table.rang)
      .where(sql`${table.archivéeLe} is null`),
    // Une seule candidate par période parmi les lignes vivantes.
    uniqueIndex('elements_synthese_candidate_unique')
      .on(table.organisationId, table.période)
      .where(sql`${table.candidateRecommandation} and ${table.archivéeLe} is null`),
    check('elements_synthese_periode_forme', sql`${table.période} ~ '${sql.raw(FORME_DE_PÉRIODE)}'`),
    check('elements_synthese_fenetre', sql`${table.fenêtreDébut} <= ${table.fenêtreFin}`),
    check('elements_synthese_cle', sql`length(${table.clé}) between 1 and 40`),
    check('elements_synthese_rang', sql`${table.rang} >= 1`),
    check(
      'elements_synthese_enonce',
      sql`${table.énoncé} is null or length(${table.énoncé}) <= case when ${table.outil} = 'scenario' then 400 else 240 end`,
    ),
    check('elements_synthese_etat_swot', sql`(${table.outil} = 'swot') = (${table.état} is not null)`),
    check(
      'elements_synthese_declaratif',
      sql`${table.origine} = 'faits' or (${table.outil} = 'swot' and ${table.clé} in ('forces', 'faiblesses'))`,
    ),
    check('elements_synthese_candidate', sql`not ${table.candidateRecommandation} or ${table.outil} = 'tows'`),
    check('elements_synthese_grille_version', sql`${table.grilleVersion} >= 1`),
  ],
)

/**
 * Une position en crans : une entité sur un axe des groupes stratégiques, une
 * partie prenante en pouvoir et intérêt (Mendelow), l'intensité d'une force.
 * Un changement de cran par rapport à la période précédente exige un fait de la
 * fenêtre : la porte (`contrôlerLaSynthèse`) le vérifie avant l'écriture.
 */
export const positions = pgTable(
  'positions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organisationId: uuid('organisation_id')
      .notNull()
      .references(() => organisations.id),
    période: text('période').notNull(),
    outil: outilDePosition('outil').notNull(),
    /** Entité, partie prenante, force ou offre ; doit figurer dans la grille. */
    sujet: text('sujet').notNull(),
    /** Clé d'axe de la grille, ou `pouvoir`, `interet`, `intensite`. */
    axe: text('axe').notNull(),
    /** Nul si `non_suivi`. */
    cran: smallint('cran'),
    nonSuivi: boolean('non_suivi').notNull().default(false),
    tendance: tendanceDeForce('tendance'),
    faits: uuid('faits').array().notNull().default(sql`'{}'::uuid[]`),
    grilleVersion: integer('grille_version').notNull(),
    étatPublication: étatDePublication('état_publication').notNull().default('propose'),
    crééLe: horodatage('créé_le').notNull().defaultNow(),
    archivéeLe: horodatage('archivée_le'),
  },
  (table) => [
    uniqueIndex('positions_place_unique')
      .on(table.organisationId, table.période, table.outil, table.sujet, table.axe)
      .where(sql`${table.archivéeLe} is null`),
    check('positions_periode_forme', sql`${table.période} ~ '${sql.raw(FORME_DE_PÉRIODE)}'`),
    check('positions_sujet', sql`length(${table.sujet}) between 1 and 80`),
    check('positions_axe', sql`length(${table.axe}) between 1 and 40`),
    check('positions_cran', sql`(${table.nonSuivi} and ${table.cran} is null) or (not ${table.nonSuivi} and ${table.cran} between 1 and 5)`),
    check('positions_tendance', sql`${table.tendance} is null or ${table.outil} = 'forces'`),
    check('positions_grille_version', sql`${table.grilleVersion} >= 1`),
  ],
)

export type FaitÉtiqueté = typeof faitsÉtiquetés.$inferSelect
export type LigneDeGrille = typeof grilles.$inferSelect
export type ÉlémentDeSynthèse = typeof élémentsSynthèse.$inferSelect
export type Position = typeof positions.$inferSelect
