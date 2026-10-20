import { and, desc, eq, gte, inArray, isNull, lt, or } from 'drizzle-orm'
import { base, type Base } from '@/lib/base/client'
import { protéger } from '@/lib/base/erreurs'
import { lireAbonnement } from '@/lib/base/abonnements'
import { courriers, lecteurs, organisations } from '@/lib/base/schema'

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
      })
      .onConflictDoNothing()
      .returning({ id: courriers.id })

    if (!ligne && !SORTES_UNIQUES.has(courrier.sorte)) {
      // Seul l'index des courriers de parcours peut refuser une ligne : un refus
      // ailleurs serait une contrainte inattendue, à ne pas prendre pour un doublon.
      throw new Error('réservation refusée sans contrainte d’unicité attendue')
    }
    return ligne?.id ?? null
  })
}

/** Conclut une ligne réservée : envoyée (avec l'identifiant Gmail) ou en échec (avec un code). */
export async function conclureCourrier(
  id: string,
  issue: { readonly état: 'envoye'; readonly messageGmail: string | null } | { readonly état: 'echec'; readonly erreur: string },
  db: Base = base(),
): Promise<void> {
  await protéger('conclusion d’un courrier', async () => {
    await db
      .update(courriers)
      .set({
        état: issue.état,
        messageGmail: issue.état === 'envoye' ? issue.messageGmail : null,
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
      const actifs = await db
        .select({ id: lecteurs.id, nom: lecteurs.nom, email: lecteurs.email })
        .from(lecteurs)
        .where(and(eq(lecteurs.organisationId, ligne.id), eq(lecteurs.actif, true), eq(lecteurs.tousLesEspaces, false)))
      résultat.push({
        ...ligne,
        activéeLe: ligne.activéeLe,
        offre: ligne.offre,
        parutionsDEssai: ligne.parutionsDEssai,
        abonnement: abonnement ? { état: abonnement.état } : null,
        lecteurs: actifs.flatMap((l) => (l.email && l.email.includes('@') ? [{ id: l.id, nom: l.nom, email: l.email }] : [])),
      })
    }
    return résultat
  })
}

/**
 * Les courriers de fin d'essai en souffrance, pour le contrôle du soir : en
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
          inArray(courriers.sorte, ['essai_derniere_parution', 'essai_tronquee']),
          gte(courriers.prévuLe, septJours),
          or(eq(courriers.état, 'echec'), and(eq(courriers.état, 'prevu'), lt(courriers.prévuLe, dixMinutes))),
        ),
      )
      .orderBy(desc(courriers.prévuLe)),
  )
}
