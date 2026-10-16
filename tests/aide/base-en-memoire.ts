import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import type { Base } from '@/lib/base/client'
import * as schema from '@/lib/base/schema'

/**
 * Une vraie base Postgres en mémoire, par test, avec les migrations du dépôt.
 *
 * PGlite est Postgres compilé en WebAssembly : les contraintes d'unicité, les
 * index sur `lower(email)`, les énumérations et les transactions s'y comportent
 * comme sur Neon. Les tests mesurent donc les migrations réellement commitées,
 * pas un schéma reconstitué à côté.
 */
export async function baseEnMémoire(): Promise<{ db: Base; fermer: () => Promise<void> }> {
  const client = new PGlite()
  const db = drizzle({ client, schema })
  await migrate(db, { migrationsFolder: 'drizzle' })
  return { db: db as unknown as Base, fermer: () => client.close() }
}
