import { and, desc, eq, sql } from 'drizzle-orm'
import { base, type Base } from '@/lib/base/client'
import { protéger } from '@/lib/base/erreurs'
import { fichesDeVeille } from '@/lib/base/schema'

/**
 * La fiche de veille pour le lecteur (lot 6, 30 octobre 2026) : seul écrivain
 * et seul lecteur de la table `fiches_de_veille`, appelé par la seule
 * orchestration `lib/portail/fiche-veille.ts`, qui passe la porte
 * `contrôlerLaFiche` avant d'écrire. Toute fonction prend l'identifiant de
 * l'organisation et ne lit rien sans lui. Rien n'est supprimé : chaque envoi est
 * une version, et les écrans ne lisent que la plus récente publiée.
 */

export type ÉtatDeLaFiche = 'propose' | 'publie' | 'retire'

export type FicheEnregistrée = {
  readonly version: number
  readonly grilleVersion: number
  readonly contenu: Record<string, unknown>
  readonly état: ÉtatDeLaFiche
  readonly reçueLe: Date
  readonly publiéeLe: Date | null
}

const versLaFiche = (l: typeof fichesDeVeille.$inferSelect): FicheEnregistrée => ({
  version: l.version,
  grilleVersion: l.grilleVersion,
  contenu: l.contenu,
  état: l.étatPublication,
  reçueLe: l.reçueLe,
  publiéeLe: l.publiéeLe,
})

/** Enregistre une nouvelle version, en proposition : rien n'est montré au client avant la publication. */
export async function enregistrerLaFiche(
  entrée: { readonly organisationId: string; readonly grilleVersion: number; readonly contenu: Record<string, unknown> },
  db: Base = base(),
): Promise<{ readonly version: number }> {
  return protéger('enregistrement d’une fiche de veille', () =>
    db.transaction(async (tx) => {
      const [dernière] = await tx
        .select({ version: sql<number>`coalesce(max(${fichesDeVeille.version}), 0)` })
        .from(fichesDeVeille)
        .where(eq(fichesDeVeille.organisationId, entrée.organisationId))
      const version = Number(dernière?.version ?? 0) + 1
      await tx.insert(fichesDeVeille).values({ organisationId: entrée.organisationId, version, grilleVersion: entrée.grilleVersion, contenu: entrée.contenu })
      return { version }
    }),
  )
}

/** La dernière version reçue, quel que soit son état : c'est celle que l'opératrice relit et publie. */
export async function dernièreFiche(organisationId: string, db: Base = base()): Promise<FicheEnregistrée | null> {
  return protéger('lecture de la dernière fiche de veille', async () => {
    const [ligne] = await db.select().from(fichesDeVeille).where(eq(fichesDeVeille.organisationId, organisationId)).orderBy(desc(fichesDeVeille.version)).limit(1)
    return ligne ? versLaFiche(ligne) : null
  })
}

/** La plus récente version publiée : c'est ce que les écrans du client lisent, et rien d'autre. */
export async function fichePubliée(organisationId: string, db: Base = base()): Promise<FicheEnregistrée | null> {
  return protéger('lecture de la fiche de veille publiée', async () => {
    const [ligne] = await db
      .select()
      .from(fichesDeVeille)
      .where(and(eq(fichesDeVeille.organisationId, organisationId), eq(fichesDeVeille.étatPublication, 'publie')))
      .orderBy(desc(fichesDeVeille.version))
      .limit(1)
    return ligne ? versLaFiche(ligne) : null
  })
}

/**
 * Publie ou remet en proposition la dernière version reçue ; retirer retire aussi
 * toute version publiée plus ancienne. `null` sans fiche.
 */
export async function réglerLaPublicationDeLaFiche(
  entrée: { readonly organisationId: string; readonly état: ÉtatDeLaFiche },
  db: Base = base(),
  maintenant: Date = new Date(),
): Promise<{ readonly version: number } | null> {
  return protéger('publication d’une fiche de veille', () =>
    db.transaction(async (tx) => {
      const [dernière] = await tx
        .select({ id: fichesDeVeille.id, version: fichesDeVeille.version })
        .from(fichesDeVeille)
        .where(eq(fichesDeVeille.organisationId, entrée.organisationId))
        .orderBy(desc(fichesDeVeille.version))
        .limit(1)
      if (!dernière) return null
      // Retirer cache la fiche au client : toute version publiée, pas seulement la dernière reçue.
      if (entrée.état === 'retire') {
        await tx
          .update(fichesDeVeille)
          .set({ étatPublication: 'retire', publiéeLe: null })
          .where(and(eq(fichesDeVeille.organisationId, entrée.organisationId), eq(fichesDeVeille.étatPublication, 'publie')))
      }
      await tx
        .update(fichesDeVeille)
        .set({ étatPublication: entrée.état, publiéeLe: entrée.état === 'publie' ? maintenant : null })
        .where(eq(fichesDeVeille.id, dernière.id))
      return { version: dernière.version }
    }),
  )
}
