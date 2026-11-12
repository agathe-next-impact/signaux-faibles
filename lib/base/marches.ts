import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm'
import { base, type Base } from '@/lib/base/client'
import { protéger } from '@/lib/base/erreurs'
import { mesuresDeMarché, organisations, segmentsDeMarché } from '@/lib/base/schema'

/**
 * Marchés et niches (12 novembre 2026) : seul écrivain et seul lecteur des
 * tables `segments_de_marche` et `mesures_de_marche`, appelé par la seule
 * orchestration `lib/portail/marches.ts`, qui passe la porte
 * `contrôlerLesSegments` avant d'écrire. Toute fonction prend l'identifiant de
 * l'organisation et ne lit rien sans lui. Rien n'est supprimé : une liste de
 * segments re-postée est une version, un recalcul archive la mesure précédente.
 */

export type ÉtatDesMesures = 'propose' | 'publie' | 'retire'

export type SegmentsEnregistrés = {
  readonly version: number
  readonly empreinte: string
  readonly grilleVersion: number
  readonly contenu: unknown[]
  readonly crééeLe: Date
}

export type MesureEnregistrée = {
  readonly période: string
  readonly clé: string
  readonly segmentsVersion: number
  readonly valeur: Record<string, unknown>
  readonly état: ÉtatDesMesures
  readonly calculéeLe: Date
}

/** La dernière version des segments, ou `null`. */
export async function derniersSegments(organisationId: string, db: Base = base()): Promise<SegmentsEnregistrés | null> {
  return protéger('lecture des segments de marché', async () => {
    const [ligne] = await db.select().from(segmentsDeMarché).where(eq(segmentsDeMarché.organisationId, organisationId)).orderBy(desc(segmentsDeMarché.version)).limit(1)
    return ligne ? { version: ligne.version, empreinte: ligne.empreinte, grilleVersion: ligne.grilleVersion, contenu: ligne.contenu, crééeLe: ligne.crééeLe } : null
  })
}

/** Enregistre une version des segments ; la même empreinte que la dernière ne crée rien. */
export async function posterLesSegments(
  entrée: { readonly organisationId: string; readonly empreinte: string; readonly grilleVersion: number; readonly contenu: unknown[] },
  db: Base = base(),
): Promise<{ readonly sorte: 'créée' | 'inchangée'; readonly version: number }> {
  return protéger('enregistrement des segments de marché', () =>
    db.transaction(async (tx) => {
      const [dernière] = await tx
        .select({ version: segmentsDeMarché.version, empreinte: segmentsDeMarché.empreinte })
        .from(segmentsDeMarché)
        .where(eq(segmentsDeMarché.organisationId, entrée.organisationId))
        .orderBy(desc(segmentsDeMarché.version))
        .limit(1)
      if (dernière && dernière.empreinte === entrée.empreinte) return { sorte: 'inchangée', version: dernière.version } as const
      const version = (dernière?.version ?? 0) + 1
      await tx.insert(segmentsDeMarché).values({ organisationId: entrée.organisationId, version, empreinte: entrée.empreinte, grilleVersion: entrée.grilleVersion, contenu: entrée.contenu })
      return { sorte: 'créée', version } as const
    }),
  )
}

const vivantes = (organisationId: string) => and(eq(mesuresDeMarché.organisationId, organisationId), isNull(mesuresDeMarché.archivéeLe))

/**
 * Remplace les mesures d'une période, en proposition. Une période dont une
 * ligne est publiée n'est pas touchée : ce que le client lit ne change pas sous
 * ses yeux, la retirer d'abord.
 */
export async function remplacerLesMesures(
  entrée: {
    readonly organisationId: string
    readonly période: string
    readonly segmentsVersion: number
    readonly mesures: readonly { readonly clé: string; readonly valeur: Record<string, unknown> }[]
  },
  db: Base = base(),
  maintenant: Date = new Date(),
): Promise<{ readonly sorte: 'enregistrées'; readonly mesures: number; readonly archivées: number } | { readonly sorte: 'période-publiée' }> {
  return protéger('enregistrement des mesures de marché', () =>
    db.transaction(async (tx) => {
      const période = and(vivantes(entrée.organisationId), eq(mesuresDeMarché.période, entrée.période))
      const [publiée] = await tx.select({ id: mesuresDeMarché.id }).from(mesuresDeMarché).where(and(période, eq(mesuresDeMarché.étatPublication, 'publie'))).limit(1)
      if (publiée) return { sorte: 'période-publiée' } as const
      const archivées = await tx.update(mesuresDeMarché).set({ archivéeLe: maintenant }).where(période).returning({ id: mesuresDeMarché.id })
      if (entrée.mesures.length > 0) {
        await tx.insert(mesuresDeMarché).values(
          entrée.mesures.map((m) => ({
            organisationId: entrée.organisationId,
            période: entrée.période,
            clé: m.clé,
            segmentsVersion: entrée.segmentsVersion,
            valeur: m.valeur,
            calculéeLe: maintenant,
          })),
        )
      }
      return { sorte: 'enregistrées', mesures: entrée.mesures.length, archivées: archivées.length } as const
    }),
  )
}

/** Les mesures vivantes de l'organisation, de la période la plus ancienne à la plus récente ; les seules publiées pour un écran. */
export async function mesuresVivantes(
  entrée: { readonly organisationId: string; readonly publiées?: boolean },
  db: Base = base(),
): Promise<MesureEnregistrée[]> {
  return protéger('lecture des mesures de marché', async () => {
    const lignes = await db
      .select()
      .from(mesuresDeMarché)
      .where(and(vivantes(entrée.organisationId), ...(entrée.publiées ? [eq(mesuresDeMarché.étatPublication, 'publie')] : [])))
      .orderBy(asc(mesuresDeMarché.période), asc(mesuresDeMarché.clé))
    return lignes.map((l) => ({ période: l.période, clé: l.clé, segmentsVersion: l.segmentsVersion, valeur: l.valeur, état: l.étatPublication, calculéeLe: l.calculéeLe }))
  })
}

/** Publie, retire ou remet en proposition les mesures vivantes d'une période : le geste de l'opératrice. */
export async function publierLesMesures(
  entrée: { readonly organisationId: string; readonly période: string; readonly état: ÉtatDesMesures },
  db: Base = base(),
): Promise<number> {
  return protéger('publication des mesures de marché', async () => {
    const lignes = await db
      .update(mesuresDeMarché)
      .set({ étatPublication: entrée.état })
      .where(and(vivantes(entrée.organisationId), eq(mesuresDeMarché.période, entrée.période)))
      .returning({ id: mesuresDeMarché.id })
    return lignes.length
  })
}

/** Le nombre de mesures vivantes par période et par état : ce que l'opératrice a à relire. */
export async function périodesMesurées(organisationId: string, db: Base = base()): Promise<{ période: string; état: ÉtatDesMesures; mesures: number }[]> {
  return protéger('lecture des périodes mesurées', async () => {
    const lignes = await db
      .select({ période: mesuresDeMarché.période, état: mesuresDeMarché.étatPublication, mesures: sql<number>`count(*)::int` })
      .from(mesuresDeMarché)
      .where(vivantes(organisationId))
      .groupBy(mesuresDeMarché.période, mesuresDeMarché.étatPublication)
      .orderBy(asc(mesuresDeMarché.période))
    return lignes.map((l) => ({ période: l.période, état: l.état, mesures: Number(l.mesures) }))
  })
}

/**
 * Les périodes mesurées de toutes les organisations du pilote, par état : le
 * tableau de l'opératrice. Traverse les clients ; des comptes, jamais une mesure.
 */
export async function périodesMesuréesDuPilote(db: Base = base()): Promise<{ slug: string; nom: string; période: string; état: ÉtatDesMesures; mesures: number }[]> {
  return protéger('lecture des périodes mesurées du pilote', async () => {
    const lignes = await db
      .select({ slug: organisations.slug, nom: organisations.nom, période: mesuresDeMarché.période, état: mesuresDeMarché.étatPublication, mesures: sql<number>`count(*)::int` })
      .from(mesuresDeMarché)
      .innerJoin(organisations, eq(organisations.id, mesuresDeMarché.organisationId))
      .where(and(isNull(mesuresDeMarché.archivéeLe), eq(organisations.outilsStratégiques, true), isNull(organisations.archivéeLe)))
      .groupBy(organisations.slug, organisations.nom, mesuresDeMarché.période, mesuresDeMarché.étatPublication)
    return lignes.map((l) => ({ slug: l.slug, nom: l.nom, période: l.période, état: l.état, mesures: Number(l.mesures) }))
  })
}
