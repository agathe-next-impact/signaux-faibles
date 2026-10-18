import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { sql } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/neon-serverless/migrator'
import type { NeonDatabase } from 'drizzle-orm/neon-serverless'
import { base, type Base } from '@/lib/base/client'
import { ErreurDeBase, protéger } from '@/lib/base/erreurs'

/**
 * Applique les migrations SQL de `drizzle/` à la base du portail.
 *
 * Appelée par `POST /api/veille/migrer` (le portail tient lui-même
 * `DATABASE_URL`, que personne n'a à recopier) et par `pnpm base:migrer`,
 * que le build de production lance avant `next build` (18 octobre 2026).
 * Drizzle tient le registre des migrations appliquées dans la base : relancer
 * n'applique que ce qui manque, et ne fait rien quand tout est à jour.
 *
 * Le dossier est inclus dans la fonction serverless par
 * `outputFileTracingIncludes` (`next.config.ts`) : sans cela, Vercel ne
 * l'embarquerait pas, puisqu'il n'est lu qu'à l'exécution.
 */
export async function appliquerLesMigrations(): Promise<void> {
  await protéger('application des migrations', () =>
    migrate(base() as unknown as NeonDatabase, { migrationsFolder: join(process.cwd(), 'drizzle') }),
  )
}

type Journal = { readonly entries: readonly { readonly tag: string; readonly when: number }[] }

/**
 * Les migrations du dépôt que la base n'a pas reçues, dans l'ordre.
 *
 * Drizzle enregistre chaque migration appliquée avec l'horodatage de son
 * entrée de journal (`created_at`) et n'applique ensuite que celles qui sont
 * plus récentes que la dernière : la comparaison est la sienne. `null` veut
 * dire qu'aucune n'a jamais été appliquée.
 */
export function migrationsNonAppliquées(journal: Journal, dernièreAppliquée: number | null): string[] {
  return journal.entries
    .filter((entrée) => dernièreAppliquée === null || entrée.when > dernièreAppliquée)
    .map((entrée) => entrée.tag)
}

/**
 * Lit le journal du dépôt et le registre de la base, et rend ce qui manque.
 *
 * Le 18 octobre 2026, la migration `0003_organisations_essai` est partie en
 * production avec le code qui en dépendait, sans être appliquée : l'entrée en
 * essai et l'import ont échoué en SQLSTATE 42703, et rien ne l'avait signalé.
 * Le contrôle du soir appelle cette fonction pour que l'écart se voie le jour
 * même, même si la migration du build venait à être retirée.
 */
export async function migrationsEnAttente(db?: Base): Promise<readonly string[]> {
  const journal = JSON.parse(
    await readFile(join(process.cwd(), 'drizzle', 'meta', '_journal.json'), 'utf8'),
  ) as Journal
  const cible = db ?? base()

  let dernière: number | null
  try {
    const résultat = await protéger('lecture du registre des migrations', () =>
      cible.execute(sql`select max(created_at) as dernier from drizzle.__drizzle_migrations`),
    )
    const lignes = (résultat as { rows?: readonly { dernier: unknown }[] }).rows ?? []
    const brut = lignes[0]?.dernier
    dernière = brut === null || brut === undefined ? null : Number(brut)
  } catch (erreur) {
    // Registre absent : la base n'a jamais été migrée.
    if (erreur instanceof ErreurDeBase && erreur.code === '42P01') dernière = null
    else throw erreur
  }

  return migrationsNonAppliquées(journal, dernière)
}
