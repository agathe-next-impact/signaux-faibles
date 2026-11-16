import { and, desc, eq, inArray, isNull, ne } from 'drizzle-orm'
import { base, type Base } from '@/lib/base/client'
import { protéger } from '@/lib/base/erreurs'
import { organisations, tablesDEffets } from '@/lib/base/schema'

/**
 * Simulation (16 novembre 2026, lot 3b) : seul écrivain et seul lecteur de la
 * table `tables_d_effets`. Les écritures ne sont appelées que par
 * `lib/portail/simulation.ts`, qui passe la porte `contrôlerLaTableDEffets`
 * avant d'écrire. Toute fonction prend l'identifiant de l'organisation et ne
 * lit rien sans lui, sauf `tablesDEffetsDuPilote`, le tableau de l'opératrice.
 * Rien n'est supprimé : une table re-postée est une version.
 */

export type ÉtatDeLaTable = 'propose' | 'publie' | 'retire'

export type TableEnregistrée = {
  readonly version: number
  readonly empreinte: string
  readonly contenu: Record<string, unknown>
  readonly état: ÉtatDeLaTable
  readonly crééeLe: Date
}

const lue = (l: typeof tablesDEffets.$inferSelect): TableEnregistrée => ({ version: l.version, empreinte: l.empreinte, contenu: l.contenu, état: l.étatPublication, crééeLe: l.crééeLe })

/** Enregistre une version proposée ; la même empreinte que la dernière ne crée rien. Jamais publiée d'office. */
export async function enregistrerLaTableDEffets(
  entrée: { readonly organisationId: string; readonly empreinte: string; readonly contenu: Record<string, unknown> },
  db: Base = base(),
): Promise<{ readonly sorte: 'créée' | 'inchangée'; readonly version: number }> {
  return protéger('enregistrement de la table d’effets', () =>
    db.transaction(async (tx) => {
      const [dernière] = await tx
        .select({ version: tablesDEffets.version, empreinte: tablesDEffets.empreinte })
        .from(tablesDEffets)
        .where(eq(tablesDEffets.organisationId, entrée.organisationId))
        .orderBy(desc(tablesDEffets.version))
        .limit(1)
      if (dernière && dernière.empreinte === entrée.empreinte) return { sorte: 'inchangée', version: dernière.version } as const
      const version = (dernière?.version ?? 0) + 1
      await tx.insert(tablesDEffets).values({ organisationId: entrée.organisationId, version, empreinte: entrée.empreinte, contenu: entrée.contenu })
      return { sorte: 'créée', version } as const
    }),
  )
}

/**
 * La table que l'écran joue : la version publiée, ou, pour l'aperçu de
 * l'opératrice, la dernière version qui n'est pas retirée.
 */
export async function tableDEffetsDeLOrganisation(
  entrée: { readonly organisationId: string; readonly aperçu?: boolean },
  db: Base = base(),
): Promise<TableEnregistrée | null> {
  return protéger('lecture de la table d’effets', async () => {
    const état = entrée.aperçu === true ? ne(tablesDEffets.étatPublication, 'retire') : eq(tablesDEffets.étatPublication, 'publie')
    const [ligne] = await db.select().from(tablesDEffets).where(and(eq(tablesDEffets.organisationId, entrée.organisationId), état)).orderBy(desc(tablesDEffets.version)).limit(1)
    return ligne ? lue(ligne) : null
  })
}

/** Les versions d'une organisation, de la plus récente à la plus ancienne : ce que l'opératrice relit. */
export async function versionsDeLaTableDEffets(organisationId: string, db: Base = base()): Promise<TableEnregistrée[]> {
  return protéger('lecture des versions de la table d’effets', async () => {
    const lignes = await db.select().from(tablesDEffets).where(eq(tablesDEffets.organisationId, organisationId)).orderBy(desc(tablesDEffets.version)).limit(10)
    return lignes.map(lue)
  })
}

/**
 * Publie, retire ou remet en proposition une version : le geste de l'opératrice.
 * Publier une version retire celle qui l'était : une seule est jouée à la fois.
 */
export async function réglerLaTableDEffets(
  entrée: { readonly organisationId: string; readonly version: number; readonly état: ÉtatDeLaTable },
  db: Base = base(),
): Promise<boolean> {
  return protéger('publication de la table d’effets', () =>
    db.transaction(async (tx) => {
      const sienne = and(eq(tablesDEffets.organisationId, entrée.organisationId), eq(tablesDEffets.version, entrée.version))
      const [ligne] = await tx.select({ id: tablesDEffets.id }).from(tablesDEffets).where(sienne).limit(1)
      if (!ligne) return false
      if (entrée.état === 'publie') {
        await tx
          .update(tablesDEffets)
          .set({ étatPublication: 'retire' })
          .where(and(eq(tablesDEffets.organisationId, entrée.organisationId), eq(tablesDEffets.étatPublication, 'publie'), ne(tablesDEffets.version, entrée.version)))
      }
      await tx
        .update(tablesDEffets)
        .set({ étatPublication: entrée.état, publiéeLe: entrée.état === 'publie' ? new Date() : null })
        .where(sienne)
      return true
    }),
  )
}

/** Ce que le rail demande : une table est-elle publiée, une autre attend-elle la relecture ? Des états, jamais un contenu. */
export async function étatDeLaSimulation(organisationId: string, db: Base = base()): Promise<{ readonly publiée: boolean; readonly proposée: boolean }> {
  return protéger('lecture de l’état de la simulation', async () => {
    const lignes = await db
      .select({ état: tablesDEffets.étatPublication })
      .from(tablesDEffets)
      .where(and(eq(tablesDEffets.organisationId, organisationId), inArray(tablesDEffets.étatPublication, ['publie', 'propose'])))
    return { publiée: lignes.some((l) => l.état === 'publie'), proposée: lignes.some((l) => l.état === 'propose') }
  })
}

/**
 * Les versions vivantes (proposées ou publiées) de toutes les organisations du
 * pilote : le tableau de l'opératrice. Traverse les clients ; des versions et
 * des états, jamais une ligne de table.
 */
export async function tablesDEffetsDuPilote(db: Base = base()): Promise<{ slug: string; nom: string; version: number; état: ÉtatDeLaTable; crééeLe: Date }[]> {
  return protéger('lecture des tables d’effets du pilote', async () => {
    const lignes = await db
      .select({ slug: organisations.slug, nom: organisations.nom, version: tablesDEffets.version, état: tablesDEffets.étatPublication, crééeLe: tablesDEffets.crééeLe })
      .from(tablesDEffets)
      .innerJoin(organisations, eq(organisations.id, tablesDEffets.organisationId))
      .where(and(eq(organisations.outilsStratégiques, true), isNull(organisations.archivéeLe)))
      .orderBy(organisations.nom, desc(tablesDEffets.version))
    return lignes
  })
}
