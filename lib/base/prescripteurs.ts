import { and, asc, desc, eq, inArray, isNotNull, isNull } from 'drizzle-orm'
import { abonnementQuiFaitFoi } from '@/lib/base/abonnements'
import { base, type Base } from '@/lib/base/client'
import { protéger } from '@/lib/base/erreurs'
import { abonnements, organisations, prescripteurs, typePrescripteur } from '@/lib/base/schema'
import type { Offre, ÉtatOrganisation } from '@/lib/domaine/parcours'

/**
 * Les prescripteurs (24 octobre 2026, `docs/prescripteurs.md`).
 *
 * Un prescripteur (expert-comptable, cabinet de conseil, chambre, cluster,
 * fédération, réseau de l'ESS) recommande des clients ; il n'est jamais
 * prospecté, et ses recommandations non plus : la prospection automatisée est
 * réservée aux clients finaux. Le rattachement d'une organisation recommandée
 * se fait à son ouverture (`ouvrirEnEssai`, `lib/base/organisations.ts`) ; ce
 * fichier tient le registre des prescripteurs, la liste d'exclusion que lit la
 * tâche de prospection, le tableau de l'opératrice, l'accord de partage et
 * l'écran « Vos recommandations » du prescripteur.
 *
 * Rien ici n'expose une lettre, une adresse ni un identifiant d'accès.
 */

export type TypePrescripteur = (typeof typePrescripteur.enumValues)[number]

export const TYPES_DE_PRESCRIPTEUR: readonly TypePrescripteur[] = typePrescripteur.enumValues

export type RésultatDeCréation =
  | { readonly sorte: 'créé' | 'déjà-prescripteur'; readonly code: string }
  | { readonly sorte: 'organisation-inconnue' | 'code-pris' | 'en-prospection' }

/**
 * Fait d'une organisation du portail un prescripteur, avec son code. Rejouable :
 * le même slug avec le même code rend `déjà-prescripteur`. Une organisation
 * entrée par prospection est refusée (`en-prospection`) : sa séquence est
 * peut-être en cours, et l'opératrice doit l'arrêter avant d'en faire un
 * prescripteur. Le code d'un prescripteur ne change pas ici.
 */
export async function créerPrescripteur(
  entrée: { readonly slug: string; readonly code: string; readonly type: TypePrescripteur },
  db: Base = base(),
  maintenant: Date = new Date(),
): Promise<RésultatDeCréation> {
  return protéger('création d’un prescripteur', () =>
    db.transaction(async (tx) => {
      const [organisation] = await tx
        .select({ id: organisations.id, entréeParProspection: organisations.entréeParProspection })
        .from(organisations)
        .where(and(eq(organisations.slug, entrée.slug), isNull(organisations.archivéeLe)))
        .limit(1)
      if (!organisation) return { sorte: 'organisation-inconnue' } as const

      const [existant] = await tx
        .select({ code: prescripteurs.code })
        .from(prescripteurs)
        .where(eq(prescripteurs.organisationId, organisation.id))
        .limit(1)
      if (existant) {
        return existant.code === entrée.code
          ? ({ sorte: 'déjà-prescripteur', code: existant.code } as const)
          : ({ sorte: 'code-pris' } as const)
      }
      if (organisation.entréeParProspection) return { sorte: 'en-prospection' } as const

      const [codeUtilisé] = await tx
        .select({ id: prescripteurs.id })
        .from(prescripteurs)
        .where(eq(prescripteurs.code, entrée.code))
        .limit(1)
      if (codeUtilisé) return { sorte: 'code-pris' } as const

      await tx.insert(prescripteurs).values({
        organisationId: organisation.id,
        code: entrée.code,
        type: entrée.type,
        crééLe: maintenant,
        modifiéLe: maintenant,
      })
      return { sorte: 'créé', code: entrée.code } as const
    }),
  )
}

export type Exclusion = {
  readonly slug: string
  readonly nom: string
  readonly registreNotion: string | null
  readonly rôle: 'prescripteur' | 'recommandée'
}

/**
 * Ce que la tâche de prospection ne doit jamais contacter : les prescripteurs,
 * actifs ou non, et les organisations qu'ils ont recommandées. Elle compare la
 * ligne du registre (`registreNotion`), et à défaut le nom, avant de
 * constituer son lot. Ni adresse ni domaine : le portail ne les tient pas.
 */
export async function listeDExclusion(db: Base = base()): Promise<Exclusion[]> {
  return protéger('liste d’exclusion de la prospection', async () => {
    const [desPrescripteurs, recommandées] = await Promise.all([
      db
        .select({ slug: organisations.slug, nom: organisations.nom, registreNotion: organisations.registreNotion })
        .from(prescripteurs)
        .innerJoin(organisations, eq(organisations.id, prescripteurs.organisationId)),
      db
        .select({ slug: organisations.slug, nom: organisations.nom, registreNotion: organisations.registreNotion })
        .from(organisations)
        .where(isNotNull(organisations.recommandéePar)),
    ])
    return [
      ...desPrescripteurs.map((ligne) => ({ ...ligne, rôle: 'prescripteur' as const })),
      ...recommandées.map((ligne) => ({ ...ligne, rôle: 'recommandée' as const })),
    ].sort((a, b) => a.slug.localeCompare(b.slug))
  })
}

export type OrganisationRecommandée = {
  readonly slug: string
  readonly nom: string
  readonly état: ÉtatOrganisation
  readonly activéeLe: Date | null
  readonly offre: Offre
  readonly parutionsDEssai: number
  readonly recommandéeLe: Date
  /** Le client a accepté que son prescripteur voie son nom et son étape. */
  readonly partageAvecPrescripteur: boolean
  /** L'état Stripe de l'abonnement qui fait foi, pour calculer l'étape ; jamais un identifiant. */
  readonly abonnement: { readonly état: string } | null
}

export type LigneDePrescripteur = {
  readonly slug: string
  readonly nom: string
  readonly code: string
  readonly type: TypePrescripteur
  readonly actif: boolean
  readonly recommandées: readonly OrganisationRecommandée[]
}

/**
 * Les prescripteurs et les organisations que chacun a recommandées, pour le
 * tableau de l'opératrice. Lecture qui **traverse les clients**, comme le
 * tableau des abonnements : sa garde est dans `listerLesPrescripteurs`
 * (`lib/auth/appartenance.ts`), le seul appelant admis
 * (`tests/architecture.test.ts`). Elle rend un nom, un état et l'état Stripe,
 * jamais une lettre, une adresse ni un identifiant d'abonnement.
 */
export async function tableauDesPrescripteurs(db: Base = base()): Promise<LigneDePrescripteur[]> {
  return protéger('tableau des prescripteurs', async () => {
    const lignes = await db
      .select({
        id: prescripteurs.id,
        code: prescripteurs.code,
        type: prescripteurs.type,
        actif: prescripteurs.actif,
        slug: organisations.slug,
        nom: organisations.nom,
      })
      .from(prescripteurs)
      .innerJoin(organisations, eq(organisations.id, prescripteurs.organisationId))
      .orderBy(asc(organisations.nom))
    if (lignes.length === 0) return []

    const recommandées = await db
      .select({
        id: organisations.id,
        recommandéePar: organisations.recommandéePar,
        slug: organisations.slug,
        nom: organisations.nom,
        état: organisations.état,
        activéeLe: organisations.activéeLe,
        offre: organisations.offre,
        parutionsDEssai: organisations.parutionsDEssai,
        recommandéeLe: organisations.recommandéeLe,
        partageAvecPrescripteur: organisations.partageAvecPrescripteur,
      })
      .from(organisations)
      .where(
        and(
          inArray(
            organisations.recommandéePar,
            lignes.map((l) => l.id),
          ),
          isNull(organisations.archivéeLe),
        ),
      )
      .orderBy(desc(organisations.recommandéeLe))

    const abonnementsLus =
      recommandées.length === 0
        ? []
        : await db
            .select({
              organisationId: abonnements.organisationId,
              état: abonnements.état,
              événementLe: abonnements.événementLe,
            })
            .from(abonnements)
            .where(
              inArray(
                abonnements.organisationId,
                recommandées.map((r) => r.id),
              ),
            )
            .orderBy(desc(abonnements.événementLe))

    return lignes.map((ligne) => ({
      slug: ligne.slug,
      nom: ligne.nom,
      code: ligne.code,
      type: ligne.type,
      actif: ligne.actif,
      recommandées: recommandées
        .filter((r) => r.recommandéePar === ligne.id)
        .map((r) => {
          const abonnement = abonnementQuiFaitFoi(abonnementsLus.filter((a) => a.organisationId === r.id))
          return {
            slug: r.slug,
            nom: r.nom,
            état: r.état,
            activéeLe: r.activéeLe,
            offre: r.offre,
            parutionsDEssai: r.parutionsDEssai,
            recommandéeLe: r.recommandéeLe!,
            partageAvecPrescripteur: r.partageAvecPrescripteur,
            abonnement: abonnement ? { état: abonnement.état } : null,
          }
        }),
    }))
  })
}

export type RésultatDuPartage =
  | { readonly sorte: 'partage-réglé'; readonly partage: boolean }
  | { readonly sorte: 'inconnue' | 'non-recommandée' }

/**
 * Pose ou retire l'accord d'une organisation recommandée pour que son
 * prescripteur voie son nom et son étape. Seule l'opératrice le règle, après
 * l'accord du client, par l'action de son tableau (`lib/portail/partage.ts`,
 * `exigerOpérateur` d'abord) ; `tests/architecture.test.ts` en tient le seul
 * appelant. Une organisation qui n'a pas de prescripteur est refusée : il n'y a
 * personne avec qui partager.
 */
export async function réglerLePartage(
  slug: string,
  partage: boolean,
  db: Base = base(),
  maintenant: Date = new Date(),
): Promise<RésultatDuPartage> {
  return protéger('accord de partage avec le prescripteur', async () => {
    const [organisation] = await db
      .select({ id: organisations.id, recommandéePar: organisations.recommandéePar })
      .from(organisations)
      .where(and(eq(organisations.slug, slug), isNull(organisations.archivéeLe)))
      .limit(1)
    if (!organisation) return { sorte: 'inconnue' } as const
    if (!organisation.recommandéePar) return { sorte: 'non-recommandée' } as const
    await db
      .update(organisations)
      .set({ partageAvecPrescripteur: partage, modifiéeLe: maintenant })
      .where(eq(organisations.id, organisation.id))
    return { sorte: 'partage-réglé', partage } as const
  })
}

export type RecommandationPartagée = {
  readonly nom: string
  readonly état: ÉtatOrganisation
  readonly activéeLe: Date | null
  readonly offre: Offre
  readonly parutionsDEssai: number
  readonly recommandéeLe: Date
  readonly abonnement: { readonly état: string } | null
}

export type EspacePrescripteur = {
  readonly code: string
  readonly actif: boolean
  /** Les seules organisations dont le client a accepté le partage, des plus récentes aux plus anciennes. */
  readonly partagées: readonly RecommandationPartagée[]
}

/**
 * Ce que le prescripteur voit de ses recommandations, sur l'écran « Vos
 * recommandations » de son propre espace. L'organisation est désignée par la
 * **clé de cloisonnement de la session** (`registre_notion`), comme pour « Mon
 * abonnement » : un prescripteur ne peut lire que ses propres recommandations.
 * `null` quand l'organisation n'est pas un prescripteur.
 *
 * Une organisation recommandée n'y figure **que si le client a accepté** le
 * partage ; les autres ne sont ni nommées ni comptées. Rien d'autre ne sort :
 * ni lettre, ni lecteur, ni formule, ni identifiant.
 */
export async function lireLEspacePrescripteur(registreNotion: string, db: Base = base()): Promise<EspacePrescripteur | null> {
  return protéger('espace du prescripteur', async () => {
    const clé = registreNotion.replaceAll('-', '').toLowerCase()
    const [prescripteur] = await db
      .select({ id: prescripteurs.id, code: prescripteurs.code, actif: prescripteurs.actif })
      .from(prescripteurs)
      .innerJoin(organisations, eq(organisations.id, prescripteurs.organisationId))
      .where(and(eq(organisations.registreNotion, clé), isNull(organisations.archivéeLe)))
      .limit(1)
    if (!prescripteur) return null

    const lignes = await db
      .select({
        id: organisations.id,
        nom: organisations.nom,
        état: organisations.état,
        activéeLe: organisations.activéeLe,
        offre: organisations.offre,
        parutionsDEssai: organisations.parutionsDEssai,
        recommandéeLe: organisations.recommandéeLe,
      })
      .from(organisations)
      .where(
        and(
          eq(organisations.recommandéePar, prescripteur.id),
          eq(organisations.partageAvecPrescripteur, true),
          isNull(organisations.archivéeLe),
        ),
      )
      .orderBy(desc(organisations.recommandéeLe))

    const abonnementsLus =
      lignes.length === 0
        ? []
        : await db
            .select({ organisationId: abonnements.organisationId, état: abonnements.état })
            .from(abonnements)
            .where(
              inArray(
                abonnements.organisationId,
                lignes.map((l) => l.id),
              ),
            )
            .orderBy(desc(abonnements.événementLe))

    return {
      code: prescripteur.code,
      actif: prescripteur.actif,
      partagées: lignes.map((l) => {
        const abonnement = abonnementQuiFaitFoi(abonnementsLus.filter((a) => a.organisationId === l.id))
        return {
          nom: l.nom,
          état: l.état,
          activéeLe: l.activéeLe,
          offre: l.offre,
          parutionsDEssai: l.parutionsDEssai,
          recommandéeLe: l.recommandéeLe!,
          abonnement: abonnement ? { état: abonnement.état } : null,
        }
      }),
    }
  })
}
