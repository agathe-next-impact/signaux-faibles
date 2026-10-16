import { join } from 'node:path'
import { migrate } from 'drizzle-orm/neon-serverless/migrator'
import type { NeonDatabase } from 'drizzle-orm/neon-serverless'
import { base } from '@/lib/base/client'
import { protéger } from '@/lib/base/erreurs'

/**
 * Applique les migrations SQL de `drizzle/` à la base du portail.
 *
 * Appelée par `POST /api/veille/migrer` (le portail tient lui-même
 * `DATABASE_URL`, que personne n'a à recopier) et par `pnpm base:migrer`.
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
