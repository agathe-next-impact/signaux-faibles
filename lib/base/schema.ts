import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  integer,
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
 * veilles et lecteurs (palier 1a), abonnements (palier 1c). Les tables suivantes
 * du schéma cible (`docs/schema-donnees.md`) arrivent avec le palier qui s'en
 * sert, chacune par sa propre migration.
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
  suspendueLe: horodatage('suspendue_le'),
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
 * Une ligne par organisation : un client qui se réabonne après une résiliation
 * reçoit un nouvel abonnement Stripe, qui remplace l'ancien sur la même ligne.
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
      .unique()
      .references(() => organisations.id),
    clientStripe: text('client_stripe').notNull(),
    abonnementStripe: text('abonnement_stripe').notNull(),
    /** Tel que Stripe le donne : `trialing`, `active`, `past_due`, `canceled`… */
    état: text('état').notNull(),
    /** `mensuelle` ou `annuelle`, lue sur l'intervalle du prix ; nulle si Stripe ne le dit pas. */
    formule: text('formule'),
    périodeFin: horodatage('période_fin'),
    /** Identifiant du dernier événement Stripe appliqué. */
    dernierÉvénement: text('dernier_événement').notNull(),
    /** Date de création de cet événement chez Stripe : un événement plus ancien est ignoré. */
    événementLe: horodatage('événement_le').notNull(),
    reçuLe: horodatage('reçu_le').notNull().defaultNow(),
  },
  (table) => [
    check('abonnements_client_stripe_forme', sql`${table.clientStripe} ~ '^cus_'`),
    check('abonnements_abonnement_stripe_forme', sql`${table.abonnementStripe} ~ '^sub_'`),
  ],
)

export type Organisation = typeof organisations.$inferSelect
export type Lecteur = typeof lecteurs.$inferSelect
export type Veille = typeof veilles.$inferSelect
export type Abonnement = typeof abonnements.$inferSelect
