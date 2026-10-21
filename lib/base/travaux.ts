import { and, asc, desc, eq, gte, inArray, isNull, lte, or, sql } from 'drizzle-orm'
import { base, type Base } from '@/lib/base/client'
import { protéger } from '@/lib/base/erreurs'
import { organisations, runs, travaux, veilles, type Travail, type TypeTravail, type ÉtatTravail } from '@/lib/base/schema'
import { instantÀParis } from '@/lib/domaine/calendrier'
import { familleDuType, parutionsÀPlanifier } from '@/lib/domaine/file'
import { lundiDeLaSemaine } from '@/lib/domaine/semaines'

/**
 * La file de travaux (palier 2, 21 octobre 2026) : ce que le portail décide de
 * faire faire, et le journal de ce qui en est sorti.
 *
 * Quatre gestes, et un seul appelant pour chacun, l'orchestration de
 * `lib/portail/file.ts` (le passage quotidien pour la planification) ;
 * `tests/architecture.test.ts` le vérifie :
 *
 *   · **planifier** : poser un travail `lettre` pour chaque parution de la
 *     semaine qui vient, une fois ;
 *   · **prendre** : donner à un exécuteur le prochain travail dont l'échéance
 *     est passée, et le lui réserver ;
 *   · **conclure** : enregistrer le résultat et la décision des portes,
 *     attribuer le numéro si le résultat est accepté ;
 *   · **lire** : l'état de la file, pour l'opératrice et le contrôle du soir.
 *
 * Tout ce qui décide (l'échéance, le numéro, le nombre de tentatives, la
 * reprise d'un travail resté pris) est ici, en code, et jamais dans le prompt.
 */

/** Un travail pris depuis plus longtemps est rendu à la file. */
export const REPRISE_APRÈS_MS = 3 * 60 * 60 * 1000
/** Au-delà, le travail est abandonné et le contrôle du soir le signale. */
export const TENTATIVES_MAX = 3

/**
 * Ce que le portail assemble sans lire Notion, et pose dans `travaux.contexte`.
 * Les identifiants Notion y sont dans la forme des éditions : 32 hexadécimaux
 * sans tirets.
 */
export type ContexteDeTravail = {
  readonly organisation: { readonly slug: string; readonly nom: string; readonly registreNotion: string | null }
  readonly veille?: {
    readonly id: string
    readonly type: string
    readonly libellé: string
    /** La famille Notion que la page devra porter ; nulle pour un type sans famille. */
    readonly famille: string | null
    readonly referentielNotion: string | null
  }
  /** Le numéro que la lettre devra porter ; attribué à l'acceptation. */
  readonly numéro?: number
  readonly parution?: { readonly date: string; readonly semaine: string }
  /** Le prompt à appliquer : la page Notion qui fait foi, et son étape. */
  readonly prompt: { readonly page: string; readonly étape?: string }
}

export const PROMPT_DES_LETTRES = { page: 'Tâche — Lettres de veille', étape: '3' } as const

export type TravailDeLaFile = {
  readonly id: string
  readonly type: TypeTravail
  readonly état: ÉtatTravail
  readonly échéance: Date
  readonly tentatives: number
  readonly prisLe: Date | null
  readonly prisPar: string | null
  readonly contexte: ContexteDeTravail
  readonly organisation: { readonly id: string; readonly slug: string; readonly registreNotion: string | null }
  readonly veille: { readonly id: string; readonly type: string; readonly numéroCourant: number } | null
}

const colonnesDuTravail = {
  id: travaux.id,
  type: travaux.type,
  état: travaux.état,
  échéance: travaux.échéance,
  tentatives: travaux.tentatives,
  prisLe: travaux.prisLe,
  prisPar: travaux.prisPar,
  contexte: travaux.contexte,
  organisationId: organisations.id,
  slug: organisations.slug,
  registreNotion: organisations.registreNotion,
  veilleId: veilles.id,
  veilleType: veilles.type,
  numéroCourant: veilles.numéroCourant,
}

type LigneDeTravail = {
  id: string
  type: TypeTravail
  état: ÉtatTravail
  échéance: Date
  tentatives: number
  prisLe: Date | null
  prisPar: string | null
  contexte: Record<string, unknown>
  organisationId: string
  slug: string
  registreNotion: string | null
  veilleId: string | null
  veilleType: string | null
  numéroCourant: number | null
}

function versTravail(ligne: LigneDeTravail): TravailDeLaFile {
  return {
    id: ligne.id,
    type: ligne.type,
    état: ligne.état,
    échéance: ligne.échéance,
    tentatives: ligne.tentatives,
    prisLe: ligne.prisLe,
    prisPar: ligne.prisPar,
    contexte: ligne.contexte as ContexteDeTravail,
    organisation: { id: ligne.organisationId, slug: ligne.slug, registreNotion: ligne.registreNotion },
    veille:
      ligne.veilleId && ligne.veilleType !== null && ligne.numéroCourant !== null
        ? { id: ligne.veilleId, type: ligne.veilleType, numéroCourant: ligne.numéroCourant }
        : null,
  }
}

// ── Planifier ──────────────────────────────────────────────────────────────

export type RapportDePlanification = {
  readonly planifiés: number
  readonly déjàEnFile: number
  readonly parutions: ReadonlyArray<{ readonly slug: string; readonly veille: string; readonly date: string }>
}

/**
 * Pose un travail `lettre` pour chaque parution de la semaine qui vient, des
 * veilles actives des organisations en essai ou abonnées. Rejouable : un
 * travail déjà ouvert pour la même veille n'est pas doublé. L'échéance est la
 * parution à son heure de Paris : avant, le travail reste dans la file sans
 * être prenable.
 */
export async function planifierLesLettres(
  { aujourdHui }: { readonly aujourdHui: string },
  db: Base = base(),
): Promise<RapportDePlanification> {
  const lignes = await protéger('lecture des veilles à planifier', () =>
    db
      .select(colonnesDeLaVeille)
      .from(veilles)
      .innerJoin(organisations, eq(organisations.id, veilles.organisationId))
      .where(
        and(
          eq(veilles.état, 'active'),
          inArray(organisations.état, ['essai', 'abonnee']),
          isNull(organisations.archivéeLe),
        ),
      ),
  )
  const parVeille = new Map(lignes.map((ligne) => [ligne.id, ligne]))

  let planifiés = 0
  let déjàEnFile = 0
  const parutions: Array<{ slug: string; veille: string; date: string }> = []

  for (const parution of parutionsÀPlanifier(lignes, aujourdHui)) {
    const veille = parVeille.get(parution.veilleId)!
    const résultat = await créerLeTravail(
      {
        type: 'lettre',
        organisationId: veille.organisationId,
        veilleId: veille.id,
        échéance: instantÀParis(parution.date, veille.heureParution),
        contexte: contexteDeLettre(veille, parution.date),
      },
      db,
    )
    if (résultat.sorte === 'créé') {
      planifiés++
      parutions.push({ slug: veille.slug, veille: veille.type, date: parution.date })
    } else déjàEnFile++
  }

  return { planifiés, déjàEnFile, parutions }
}

const colonnesDeLaVeille = {
  id: veilles.id,
  type: veilles.type,
  libellé: veilles.libellé,
  jourParution: veilles.jourParution,
  heureParution: veilles.heureParution,
  cadence: veilles.cadence,
  numéroCourant: veilles.numéroCourant,
  referentielNotion: veilles.referentielNotion,
  organisationId: organisations.id,
  slug: organisations.slug,
  nom: organisations.nom,
  registreNotion: organisations.registreNotion,
}

type LigneDeVeille = {
  id: string
  type: string
  libellé: string
  heureParution: string
  numéroCourant: number
  referentielNotion: string | null
  organisationId: string
  slug: string
  nom: string
  registreNotion: string | null
}

/** Le contexte d'un travail de lettre, assemblé des seules colonnes Postgres. */
function contexteDeLettre(veille: LigneDeVeille, dateDeParution: string): ContexteDeTravail {
  return {
    organisation: { slug: veille.slug, nom: veille.nom, registreNotion: veille.registreNotion },
    veille: {
      id: veille.id,
      type: veille.type,
      libellé: veille.libellé,
      famille: familleDuType(veille.type),
      referentielNotion: veille.referentielNotion,
    },
    numéro: veille.numéroCourant + 1,
    parution: { date: dateDeParution, semaine: lundiDeLaSemaine(dateDeParution) },
    prompt: PROMPT_DES_LETTRES,
  }
}

export type RésultatDePose =
  | RésultatDeCréation
  | { readonly sorte: 'organisation-inconnue' }
  | { readonly sorte: 'veille-inconnue' }

/**
 * Pose un travail de lettre à la main, pour une veille désignée par le slug de
 * son organisation et son type, à une date de parution choisie : la première
 * lettre d'un client, ou une parution à rattraper. L'échéance est la parution
 * à l'heure de la veille, comme pour la planification.
 */
export async function poserUnTravailDeLettre(
  entrée: {
    readonly slug: string
    readonly veille: string
    readonly type: 'lettre' | 'premiere_lettre'
    readonly dateDeParution: string
  },
  db: Base = base(),
): Promise<RésultatDePose> {
  const [organisation] = await protéger('lecture de l’organisation', () =>
    db
      .select({ id: organisations.id })
      .from(organisations)
      .where(and(eq(organisations.slug, entrée.slug), isNull(organisations.archivéeLe)))
      .limit(1),
  )
  if (!organisation) return { sorte: 'organisation-inconnue' }

  const [veille] = await protéger('lecture de la veille', () =>
    db
      .select(colonnesDeLaVeille)
      .from(veilles)
      .innerJoin(organisations, eq(organisations.id, veilles.organisationId))
      .where(and(eq(veilles.organisationId, organisation.id), eq(veilles.type, entrée.veille)))
      .limit(1),
  )
  if (!veille) return { sorte: 'veille-inconnue' }

  return créerLeTravail(
    {
      type: entrée.type,
      organisationId: veille.organisationId,
      veilleId: veille.id,
      échéance: instantÀParis(entrée.dateDeParution, veille.heureParution),
      contexte: contexteDeLettre(veille, entrée.dateDeParution),
    },
    db,
  )
}

export type RésultatDeCréation =
  | { readonly sorte: 'créé'; readonly travailId: string }
  | { readonly sorte: 'déjà-en-file'; readonly travailId: string }

/**
 * Pose un travail, sauf si un travail ouvert (à faire, pris ou refusé) existe
 * déjà pour la même veille et le même type : l'index `travaux_ouvert_unique`
 * le garantit, et le verrou rend deux planifications simultanées sérielles
 * plutôt que fautives.
 */
export async function créerLeTravail(
  entrée: {
    readonly type: TypeTravail
    readonly organisationId: string
    readonly veilleId: string | null
    readonly échéance: Date
    readonly contexte: ContexteDeTravail
  },
  db: Base = base(),
): Promise<RésultatDeCréation> {
  return protéger('création d’un travail', () =>
    db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext('file-de-travaux'))`)

      const [ouvert] = await tx
        .select({ id: travaux.id })
        .from(travaux)
        .where(
          and(
            eq(travaux.organisationId, entrée.organisationId),
            entrée.veilleId ? eq(travaux.veilleId, entrée.veilleId) : isNull(travaux.veilleId),
            eq(travaux.type, entrée.type),
            inArray(travaux.état, ['a_faire', 'pris', 'refuse']),
          ),
        )
        .limit(1)
      if (ouvert) return { sorte: 'déjà-en-file', travailId: ouvert.id } as const

      const [créé] = await tx
        .insert(travaux)
        .values({
          type: entrée.type,
          organisationId: entrée.organisationId,
          veilleId: entrée.veilleId,
          échéance: entrée.échéance,
          contexte: entrée.contexte,
        })
        .returning({ id: travaux.id })
      return { sorte: 'créé', travailId: créé!.id } as const
    }),
  )
}

// ── Prendre ────────────────────────────────────────────────────────────────

/**
 * Le prochain travail prenable, réservé à la session qui le demande ; `null`
 * si la file n'en a pas. Avant de choisir, les travaux restés `pris` au-delà
 * de la reprise sont rendus à la file, ou abandonnés s'ils ont épuisé leurs
 * tentatives : une session qui meurt sans conclure ne bloque pas une veille.
 */
export async function prendreLeProchainTravail(
  { session, maintenant = new Date() }: { readonly session: string; readonly maintenant?: Date },
  db: Base = base(),
): Promise<TravailDeLaFile | null> {
  return protéger('prise d’un travail', () =>
    db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext('file-de-travaux'))`)

      const limite = new Date(maintenant.getTime() - REPRISE_APRÈS_MS)
      await tx
        .update(travaux)
        .set({
          état: sql`case when ${travaux.tentatives} >= ${TENTATIVES_MAX} then 'abandonne'::"état_travail" else 'a_faire'::"état_travail" end`,
          prisLe: null,
          prisPar: null,
        })
        .where(and(eq(travaux.état, 'pris'), lte(travaux.prisLe, limite)))

      const [prochain] = await tx
        .select({ id: travaux.id })
        .from(travaux)
        .where(and(inArray(travaux.état, ['a_faire', 'refuse']), lte(travaux.échéance, maintenant)))
        .orderBy(asc(travaux.échéance), asc(travaux.crééLe))
        .limit(1)
      if (!prochain) return null

      await tx
        .update(travaux)
        .set({ état: 'pris', prisLe: maintenant, prisPar: session, tentatives: sql`${travaux.tentatives} + 1` })
        .where(eq(travaux.id, prochain.id))

      const [ligne] = await tx
        .select(colonnesDuTravail)
        .from(travaux)
        .innerJoin(organisations, eq(organisations.id, travaux.organisationId))
        .leftJoin(veilles, eq(veilles.id, travaux.veilleId))
        .where(eq(travaux.id, prochain.id))
      return versTravail(ligne!)
    }),
  )
}

/**
 * Prend un travail **désigné**, sans attendre son échéance : celui que
 * l'onboarding ou la découverte vient de poser pour le produire tout de suite.
 * Même réservation que la prise ordinaire (session, tentative comptée) ; un
 * travail qui n'est ni à faire ni refusé n'est pas pris.
 */
export async function prendreLeTravailDésigné(
  { travailId, session, maintenant = new Date() }: { readonly travailId: string; readonly session: string; readonly maintenant?: Date },
  db: Base = base(),
): Promise<TravailDeLaFile | null> {
  if (!/^[0-9a-f-]{36}$/i.test(travailId)) return null
  return protéger('prise d’un travail désigné', () =>
    db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext('file-de-travaux'))`)
      const [pris] = await tx
        .update(travaux)
        .set({ état: 'pris', prisLe: maintenant, prisPar: session, tentatives: sql`${travaux.tentatives} + 1` })
        .where(and(eq(travaux.id, travailId), inArray(travaux.état, ['a_faire', 'refuse'])))
        .returning({ id: travaux.id })
      if (!pris) return null
      const [ligne] = await tx
        .select(colonnesDuTravail)
        .from(travaux)
        .innerJoin(organisations, eq(organisations.id, travaux.organisationId))
        .leftJoin(veilles, eq(veilles.id, travaux.veilleId))
        .where(eq(travaux.id, pris.id))
      return versTravail(ligne!)
    }),
  )
}

/** Un travail par son identifiant, avec son organisation et sa veille. */
export async function lireLeTravail(travailId: string, db: Base = base()): Promise<TravailDeLaFile | null> {
  if (!/^[0-9a-f-]{36}$/i.test(travailId)) return null
  return protéger('lecture d’un travail', async () => {
    const [ligne] = await db
      .select(colonnesDuTravail)
      .from(travaux)
      .innerJoin(organisations, eq(organisations.id, travaux.organisationId))
      .leftJoin(veilles, eq(veilles.id, travaux.veilleId))
      .where(eq(travaux.id, travailId))
      .limit(1)
    return ligne ? versTravail(ligne) : null
  })
}

// ── Conclure ───────────────────────────────────────────────────────────────

export type Conclusion = {
  readonly travailId: string
  /** La session qui avait pris le travail : une autre ne peut pas le conclure. */
  readonly session: string
  readonly accepté: boolean
  readonly résultat: Record<string, unknown>
  readonly portes: Record<string, unknown>
  readonly pageNotion: string | null
  readonly exécuteur: string
  readonly début?: Date | null
  readonly fin?: Date | null
  readonly coût?: Record<string, unknown> | null
  readonly maintenant?: Date
}

export type RésultatDeConclusion =
  | { readonly sorte: 'accepté'; readonly runId: string; readonly numéro: number | null }
  | { readonly sorte: 'refusé' | 'abandonné'; readonly runId: string; readonly tentatives: number }
  | { readonly sorte: 'inconnu' }
  | { readonly sorte: 'pas-pris'; readonly état: ÉtatTravail }
  | { readonly sorte: 'autre-session' }

/**
 * Enregistre un résultat et conclut le travail. Accepté : le travail est
 * `accepte`, et le numéro du contexte devient le `numéro_courant` de la veille,
 * **dans la même transaction**. Refusé : le travail redevient prenable
 * (`refuse`), ou `abandonne` s'il a épuisé ses tentatives. Le run est écrit
 * dans les deux cas : le journal garde ce que les portes ont dit.
 */
export async function conclureLeTravail(conclusion: Conclusion, db: Base = base()): Promise<RésultatDeConclusion> {
  const maintenant = conclusion.maintenant ?? new Date()
  return protéger('conclusion d’un travail', () =>
    db.transaction(async (tx) => {
      const [travail] = await tx
        .select({
          id: travaux.id,
          type: travaux.type,
          état: travaux.état,
          prisPar: travaux.prisPar,
          tentatives: travaux.tentatives,
          veilleId: travaux.veilleId,
          contexte: travaux.contexte,
        })
        .from(travaux)
        .where(eq(travaux.id, conclusion.travailId))
        .for('update')
        .limit(1)
      if (!travail) return { sorte: 'inconnu' } as const
      if (travail.état !== 'pris') return { sorte: 'pas-pris', état: travail.état } as const
      if (travail.prisPar !== conclusion.session) return { sorte: 'autre-session' } as const

      const [run] = await tx
        .insert(runs)
        .values({
          travailId: travail.id,
          début: conclusion.début ?? null,
          fin: conclusion.fin ?? maintenant,
          exécuteur: conclusion.exécuteur,
          résultat: conclusion.résultat,
          portes: conclusion.portes,
          accepté: conclusion.accepté,
          pageNotion: conclusion.pageNotion,
          coût: conclusion.coût ?? null,
        })
        .returning({ id: runs.id })

      if (!conclusion.accepté) {
        const abandonné = travail.tentatives >= TENTATIVES_MAX
        await tx
          .update(travaux)
          .set({ état: abandonné ? 'abandonne' : 'refuse', prisLe: null, prisPar: null })
          .where(eq(travaux.id, travail.id))
        return { sorte: abandonné ? 'abandonné' : 'refusé', runId: run!.id, tentatives: travail.tentatives } as const
      }

      await tx
        .update(travaux)
        .set({ état: 'accepte', résultatRunId: run!.id })
        .where(eq(travaux.id, travail.id))

      let numéro: number | null = null
      const attribué = (travail.contexte as ContexteDeTravail).numéro
      if (travail.veilleId && (travail.type === 'lettre' || travail.type === 'premiere_lettre')) {
        const [veille] = await tx
          .update(veilles)
          .set({
            numéroCourant:
              typeof attribué === 'number'
                ? sql`greatest(${veilles.numéroCourant}, ${attribué})`
                : sql`${veilles.numéroCourant} + 1`,
          })
          .where(eq(veilles.id, travail.veilleId))
          .returning({ numéroCourant: veilles.numéroCourant })
        numéro = veille?.numéroCourant ?? null
      }
      return { sorte: 'accepté', runId: run!.id, numéro } as const
    }),
  )
}

// ── Lire ───────────────────────────────────────────────────────────────────

export type TravailListé = {
  readonly id: string
  readonly type: TypeTravail
  readonly état: ÉtatTravail
  readonly slug: string
  readonly veille: string | null
  readonly échéance: Date
  readonly tentatives: number
  readonly prisPar: string | null
  readonly prisLe: Date | null
  readonly crééLe: Date
}

export type ÉtatDeLaFile = {
  readonly comptes: Record<ÉtatTravail, number>
  /** Les travaux ouverts, et les abandonnés des quatorze derniers jours. */
  readonly travaux: readonly TravailListé[]
}

const FENÊTRE_DES_ABANDONS_MS = 14 * 24 * 60 * 60 * 1000

export async function étatDeLaFile(maintenant: Date = new Date(), db: Base = base()): Promise<ÉtatDeLaFile> {
  return protéger('lecture de la file', async () => {
    const comptes: Record<ÉtatTravail, number> = { a_faire: 0, pris: 0, accepte: 0, refuse: 0, abandonne: 0 }
    for (const ligne of await db
      .select({ état: travaux.état, nombre: sql<number>`count(*)::int` })
      .from(travaux)
      .groupBy(travaux.état)) {
      comptes[ligne.état] = ligne.nombre
    }

    const depuis = new Date(maintenant.getTime() - FENÊTRE_DES_ABANDONS_MS)
    const lignes = await db
      .select({
        id: travaux.id,
        type: travaux.type,
        état: travaux.état,
        slug: organisations.slug,
        veille: veilles.type,
        échéance: travaux.échéance,
        tentatives: travaux.tentatives,
        prisPar: travaux.prisPar,
        prisLe: travaux.prisLe,
        crééLe: travaux.crééLe,
      })
      .from(travaux)
      .innerJoin(organisations, eq(organisations.id, travaux.organisationId))
      .leftJoin(veilles, eq(veilles.id, travaux.veilleId))
      .where(
        or(
          inArray(travaux.état, ['a_faire', 'pris', 'refuse']),
          and(eq(travaux.état, 'abandonne'), gte(travaux.crééLe, depuis)),
        ),
      )
      .orderBy(asc(travaux.échéance), desc(travaux.crééLe))
    return { comptes, travaux: lignes }
  })
}

export type { Travail }
