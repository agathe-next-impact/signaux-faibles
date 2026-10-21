import { and, asc, eq, isNull } from 'drizzle-orm'
import { base, type Base } from '@/lib/base/client'
import { protéger } from '@/lib/base/erreurs'
import { organisations, veilles, type Veille } from '@/lib/base/schema'

/**
 * Les veilles d'une organisation, écrites par le portail (palier 2, 21 octobre
 * 2026).
 *
 * La table existe depuis le palier 1a, mais rien ne l'écrivait : le jour, l'heure
 * et la cadence de parution vivaient dans le registre Notion, que le portail ne
 * lit pas, et la tâche des lettres les lui **donnait** à chaque sélection du
 * jour (`POST /api/veille/calendrier`). La file de travaux a besoin de les
 * connaître elle-même pour planifier : c'est l'un des états que la décision du
 * 15 octobre (point 3) fait passer du registre à Postgres.
 *
 * `numéro_courant` est le dernier numéro attribué à cette veille. Il est
 * **semé** à la déclaration (lu une fois sur `GET /api/veille/contexte`, qui
 * compte les éditions Notion de la famille) puis tenu par le portail seul : le
 * contexte d'un travail porte `numéro_courant + 1`, et l'acceptation du résultat
 * l'écrit, dans la même transaction. Le modèle ne compte plus.
 */

export type DéclarationDeVeille = {
  readonly slug: string
  /** `ecosysteme`, `concurrentielle` ; une donnée, pas un enum. */
  readonly type: string
  /** Le nom que le client voit. */
  readonly libellé: string
  /** 1 (lundi) à 7. */
  readonly jourParution: number
  /** `HH:MM`, heure de Paris : l'heure à laquelle le travail de la lettre devient prenable. */
  readonly heureParution: string
  readonly cadence: Veille['cadence']
  readonly referentielNotion?: string | null
  /** Le dernier numéro attribué ; posé à la déclaration, puis tenu par la file. */
  readonly numéroCourant?: number
  readonly état?: Veille['état']
}

export type RésultatDeDéclaration =
  | { readonly sorte: 'déclarée' | 'mise-à-jour'; readonly veilleId: string }
  | { readonly sorte: 'organisation-inconnue' }

export async function déclarerLaVeille(
  déclaration: DéclarationDeVeille,
  db: Base = base(),
): Promise<RésultatDeDéclaration> {
  return protéger('déclaration d’une veille', () =>
    db.transaction(async (tx) => {
      const [organisation] = await tx
        .select({ id: organisations.id })
        .from(organisations)
        .where(and(eq(organisations.slug, déclaration.slug), isNull(organisations.archivéeLe)))
        .limit(1)
      if (!organisation) return { sorte: 'organisation-inconnue' } as const

      const [existante] = await tx
        .select({ id: veilles.id })
        .from(veilles)
        .where(and(eq(veilles.organisationId, organisation.id), eq(veilles.type, déclaration.type)))
        .for('update')
        .limit(1)

      const champs = {
        libellé: déclaration.libellé,
        jourParution: déclaration.jourParution,
        heureParution: déclaration.heureParution,
        cadence: déclaration.cadence,
        ...(déclaration.referentielNotion !== undefined
          ? { referentielNotion: déclaration.referentielNotion?.replaceAll('-', '').toLowerCase() ?? null }
          : {}),
        ...(déclaration.numéroCourant !== undefined ? { numéroCourant: déclaration.numéroCourant } : {}),
        ...(déclaration.état !== undefined ? { état: déclaration.état } : {}),
      }

      if (existante) {
        await tx.update(veilles).set(champs).where(eq(veilles.id, existante.id))
        return { sorte: 'mise-à-jour', veilleId: existante.id } as const
      }

      const [créée] = await tx
        .insert(veilles)
        .values({ organisationId: organisation.id, type: déclaration.type, ...champs })
        .returning({ id: veilles.id })
      return { sorte: 'déclarée', veilleId: créée!.id } as const
    }),
  )
}

export type VeilleListée = {
  readonly id: string
  readonly slug: string
  readonly type: string
  readonly libellé: string
  readonly jourParution: number
  readonly heureParution: string
  readonly cadence: Veille['cadence']
  readonly numéroCourant: number
  readonly état: Veille['état']
  readonly referentielNotion: string | null
}

/** Les veilles déclarées, d'une organisation ou de toutes, par slug puis par type. */
export async function listerLesVeilles(slug: string | null = null, db: Base = base()): Promise<VeilleListée[]> {
  return protéger('lecture des veilles', () =>
    db
      .select({
        id: veilles.id,
        slug: organisations.slug,
        type: veilles.type,
        libellé: veilles.libellé,
        jourParution: veilles.jourParution,
        heureParution: veilles.heureParution,
        cadence: veilles.cadence,
        numéroCourant: veilles.numéroCourant,
        état: veilles.état,
        referentielNotion: veilles.referentielNotion,
      })
      .from(veilles)
      .innerJoin(organisations, eq(organisations.id, veilles.organisationId))
      .where(slug ? eq(organisations.slug, slug) : undefined)
      .orderBy(asc(organisations.slug), asc(veilles.type)),
  )
}
