import { and, desc, eq, gte, inArray, isNull, lt, lte, or } from 'drizzle-orm'
import { base, type Base } from '@/lib/base/client'
import { protéger } from '@/lib/base/erreurs'
import { lireAbonnement } from '@/lib/base/abonnements'
import { abonnements, courriers, lecteurs, organisations } from '@/lib/base/schema'

/**
 * Le journal des courriers du portail (table `courriers`).
 *
 * Deux temps, toujours dans cet ordre : `prévoirCourrier` **avant** l'appel à
 * Gmail, `conclureCourrier` après. Une ligne restée `prevu` dit qu'un envoi a
 * été tenté sans qu'on sache s'il est parti (fonction interrompue) : c'est
 * précisément ce que l'on veut voir, et ce qu'un journal écrit après coup
 * cacherait.
 *
 * Seul `lib/portail/courriers.ts` appelle ces fonctions ;
 * `tests/architecture.test.ts` le vérifie.
 */

export type SorteCourrier = (typeof courriers.sorte.enumValues)[number]

const SORTES_UNIQUES = new Set<SorteCourrier>(['essai_derniere_parution', 'essai_tronquee'])

/** Les courriers dus une fois, tenus par l'un des deux index d'unicité : fin d'essai, puis tout courrier commercial. */
export const SORTES_EN_SOUFFRANCE: readonly SorteCourrier[] = [
  'essai_derniere_parution',
  'essai_tronquee',
  'essai_rappel_j7',
  'essai_suspendu',
  'abonnement_confirme',
  'paiement_echec',
  'abonnement_renouvellement',
  'abonnement_resilie',
]

/**
 * Réserve la ligne d'un courrier. Rend son identifiant, ou `null` quand un
 * courrier de parcours a déjà été prévu pour ce destinataire : l'appelant
 * n'envoie alors rien. Une organisation désignée par sa clé de registre est
 * retrouvée ici ; inconnue, la ligne est écrite sans organisation plutôt que
 * perdue.
 */
export async function prévoirCourrier(
  courrier: {
    readonly sorte: SorteCourrier
    readonly organisation: { readonly id: string } | { readonly registreNotion: string } | null
    readonly lecteurId: string | null
    readonly destinataireEmpreinte: string
    readonly déclencheur: string
    /** La clé d'unicité d'un courrier commercial (`courriers_commerciaux_unique`). */
    readonly clé?: string | null
  },
  db: Base = base(),
): Promise<string | null> {
  return protéger('réservation d’un courrier', async () => {
    let organisationId: string | null = null
    if (courrier.organisation && 'id' in courrier.organisation) {
      organisationId = courrier.organisation.id
    } else if (courrier.organisation) {
      // La ligne Accès Notion peut porter l'identifiant avec tirets ou en
      // majuscules ; la base le tient sans tirets, en minuscules.
      const registre = courrier.organisation.registreNotion.replaceAll('-', '').toLowerCase()
      const [ligne] = /^[0-9a-f]{32}$/.test(registre)
        ? await db
        .select({ id: organisations.id })
        .from(organisations)
        .where(eq(organisations.registreNotion, registre))
        .limit(1)
        : []
      organisationId = ligne?.id ?? null
    }

    const [ligne] = await db
      .insert(courriers)
      .values({
        sorte: courrier.sorte,
        organisationId,
        lecteurId: courrier.lecteurId,
        destinataireEmpreinte: courrier.destinataireEmpreinte,
        déclencheur: courrier.déclencheur,
        clé: courrier.clé ?? null,
      })
      .onConflictDoNothing()
      .returning({ id: courriers.id })

    if (!ligne && !SORTES_UNIQUES.has(courrier.sorte) && !courrier.clé) {
      // Seuls les index des courriers uniques peuvent refuser une ligne : un refus
      // ailleurs serait une contrainte inattendue, à ne pas prendre pour un doublon.
      throw new Error('réservation refusée sans contrainte d’unicité attendue')
    }
    return ligne?.id ?? null
  })
}

/** Conclut une ligne réservée : envoyée ou déposée en brouillon (avec l'identifiant Gmail), ou en échec (avec un code). */
export async function conclureCourrier(
  id: string,
  issue:
    | { readonly état: 'envoye' | 'brouillon'; readonly messageGmail: string | null }
    | { readonly état: 'echec'; readonly erreur: string },
  db: Base = base(),
): Promise<void> {
  await protéger('conclusion d’un courrier', async () => {
    await db
      .update(courriers)
      .set({
        état: issue.état,
        messageGmail: issue.état === 'echec' ? null : issue.messageGmail,
        erreur: issue.état === 'echec' ? issue.erreur : null,
        concluLe: new Date(),
      })
      .where(eq(courriers.id, id))
  })
}

/** Les courriers des derniers jours, du plus récent au plus ancien, pour l'opérateur. */
export async function courriersRécents(
  depuis: Date,
  db: Base = base(),
): Promise<
  Array<{
    readonly prévuLe: Date
    readonly sorte: SorteCourrier
    readonly état: string
    readonly slug: string | null
    readonly lecteur: string | null
    readonly destinataireEmpreinte: string
    readonly déclencheur: string
    readonly messageGmail: string | null
    readonly erreur: string | null
  }>
> {
  return protéger('lecture du journal des courriers', () =>
    db
      .select({
        prévuLe: courriers.prévuLe,
        sorte: courriers.sorte,
        état: courriers.état,
        slug: organisations.slug,
        lecteur: lecteurs.nom,
        destinataireEmpreinte: courriers.destinataireEmpreinte,
        déclencheur: courriers.déclencheur,
        messageGmail: courriers.messageGmail,
        erreur: courriers.erreur,
      })
      .from(courriers)
      .leftJoin(organisations, eq(courriers.organisationId, organisations.id))
      .leftJoin(lecteurs, eq(courriers.lecteurId, lecteurs.id))
      .where(gte(courriers.prévuLe, depuis))
      .orderBy(desc(courriers.prévuLe))
      .limit(500),
  )
}

/**
 * Les organisations en essai, J0 fixé ou non, avec ce que les courriers de parcours doivent
 * savoir : la date d'activation, l'abonnement qui fait foi, la relecture, et
 * leurs lecteurs actifs (hors opérateur, qui n'appartient à aucune).
 */
export async function organisationsEnEssai(db: Base = base()): Promise<
  Array<{
    readonly id: string
    readonly slug: string
    readonly nom: string
    /** Nul tant que J0 n'est pas fixé (première lettre publiée). */
    readonly activéeLe: Date | null
    /** Entrée dans l'essai par l'onboarding ; nulle pour une organisation antérieure, ou pour une prospection sans visite. */
    readonly essaiOuvertLe: Date | null
    /** Entrée par prospection : J0 attend la première visite. */
    readonly entréeParProspection: boolean
    readonly relectureRequise: boolean
    readonly emailRelecture: string | null
    readonly registreNotion: string | null
    readonly offre: 'standard' | 'early_adopter' | 'gratuite'
    readonly parutionsDEssai: number
    readonly abonnement: { readonly état: string } | null
    readonly lecteurs: Array<{ readonly id: string; readonly nom: string; readonly email: string }>
  }>
> {
  return protéger('lecture des organisations en essai', async () => {
    const lignes = await db
      .select({
        id: organisations.id,
        slug: organisations.slug,
        nom: organisations.nom,
        activéeLe: organisations.activéeLe,
        offre: organisations.offre,
        parutionsDEssai: organisations.parutionsDEssai,
        essaiOuvertLe: organisations.essaiOuvertLe,
        entréeParProspection: organisations.entréeParProspection,
        relectureRequise: organisations.relectureRequise,
        emailRelecture: organisations.emailRelecture,
        registreNotion: organisations.registreNotion,
      })
      .from(organisations)
      .where(and(eq(organisations.état, 'essai'), isNull(organisations.archivéeLe)))

    const résultat = []
    for (const ligne of lignes) {
      const abonnement = await lireAbonnement(ligne.id, db)
      résultat.push({
        ...ligne,
        activéeLe: ligne.activéeLe,
        offre: ligne.offre,
        parutionsDEssai: ligne.parutionsDEssai,
        abonnement: abonnement ? { état: abonnement.état } : null,
        lecteurs: await lecteursActifs(ligne.id, db),
      })
    }
    return résultat
  })
}

/** Les lecteurs actifs d'une organisation, hors opérateur, avec une adresse exploitable. */
async function lecteursActifs(
  organisationId: string,
  db: Base,
): Promise<Array<{ readonly id: string; readonly nom: string; readonly email: string }>> {
  const actifs = await db
    .select({ id: lecteurs.id, nom: lecteurs.nom, email: lecteurs.email })
    .from(lecteurs)
    .where(and(eq(lecteurs.organisationId, organisationId), eq(lecteurs.actif, true), eq(lecteurs.tousLesEspaces, false)))
  return actifs.flatMap((l) => (l.email && l.email.includes('@') ? [{ id: l.id, nom: l.nom, email: l.email }] : []))
}

export type DestinatairesDOrganisation = {
  readonly id: string
  readonly slug: string
  readonly nom: string
  readonly registreNotion: string | null
  readonly offre: 'standard' | 'early_adopter' | 'gratuite'
  readonly lecteurs: Array<{ readonly id: string; readonly nom: string; readonly email: string }>
}

/**
 * Une organisation et ses lecteurs actifs, pour un courrier d'abonnement
 * (23 octobre 2026). `null` si elle n'existe pas ou est archivée.
 */
export async function organisationEtSesLecteurs(
  organisationId: string,
  db: Base = base(),
): Promise<DestinatairesDOrganisation | null> {
  return protéger('lecture d’une organisation et de ses lecteurs', async () => {
    const [ligne] = await db
      .select({
        id: organisations.id,
        slug: organisations.slug,
        nom: organisations.nom,
        registreNotion: organisations.registreNotion,
        offre: organisations.offre,
      })
      .from(organisations)
      .where(and(eq(organisations.id, organisationId), isNull(organisations.archivéeLe)))
      .limit(1)
    if (!ligne) return null
    return { ...ligne, lecteurs: await lecteursActifs(ligne.id, db) }
  })
}

/**
 * Les abonnements annuels actifs dont l'échéance tombe dans la fenêtre donnée,
 * avec leur organisation et ses lecteurs : le rappel de renouvellement.
 * Un abonnement mensuel n'en reçoit jamais, ce serait un courrier par mois.
 */
export async function abonnementsAnnuelsÀÉchéance(
  fenêtre: { readonly depuis: Date; readonly jusquÀ: Date },
  db: Base = base(),
): Promise<
  Array<{
    readonly abonnementStripe: string
    readonly périodeFin: Date
    readonly organisation: DestinatairesDOrganisation
  }>
> {
  return protéger('lecture des abonnements à renouveler', async () => {
    const lignes = await db
      .select({
        abonnementStripe: abonnements.abonnementStripe,
        périodeFin: abonnements.périodeFin,
        organisationId: abonnements.organisationId,
      })
      .from(abonnements)
      .where(
        and(
          eq(abonnements.état, 'active'),
          eq(abonnements.formule, 'annuelle'),
          gte(abonnements.périodeFin, fenêtre.depuis),
          lte(abonnements.périodeFin, fenêtre.jusquÀ),
        ),
      )
    const résultat = []
    for (const ligne of lignes) {
      if (!ligne.périodeFin) continue
      const organisation = await organisationEtSesLecteurs(ligne.organisationId, db)
      if (organisation) résultat.push({ abonnementStripe: ligne.abonnementStripe, périodeFin: ligne.périodeFin, organisation })
    }
    return résultat
  })
}

/**
 * Les courriers dus une fois (fin d'essai, courriers commerciaux) en souffrance, pour le contrôle du soir : en
 * échec sur les sept derniers jours, ou restés `prevu` plus de dix minutes (la
 * fonction a été interrompue entre la réservation et Gmail : le courrier n'est
 * plus retenté, puisque la ligne le tient pour pris, et il faut le savoir).
 */
export async function courriersDeParcoursEnSouffrance(
  maintenant: Date,
  db: Base = base(),
): Promise<Array<{ readonly slug: string | null; readonly sorte: SorteCourrier; readonly état: string; readonly prévuLe: Date }>> {
  const dixMinutes = new Date(maintenant.getTime() - 10 * 60 * 1000)
  const septJours = new Date(maintenant.getTime() - 7 * 24 * 60 * 60 * 1000)
  return protéger('lecture des courriers en souffrance', () =>
    db
      .select({ slug: organisations.slug, sorte: courriers.sorte, état: courriers.état, prévuLe: courriers.prévuLe })
      .from(courriers)
      .leftJoin(organisations, eq(courriers.organisationId, organisations.id))
      .where(
        and(
          inArray(courriers.sorte, [...SORTES_EN_SOUFFRANCE]),
          gte(courriers.prévuLe, septJours),
          or(eq(courriers.état, 'echec'), and(eq(courriers.état, 'prevu'), lt(courriers.prévuLe, dixMinutes))),
        ),
      )
      .orderBy(desc(courriers.prévuLe)),
  )
}
