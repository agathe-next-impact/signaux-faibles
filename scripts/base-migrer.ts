/**
 * Applique les migrations SQL de `drizzle/` à la base désignée par DATABASE_URL.
 *
 *   pnpm base:migrer
 *
 * Drizzle tient le registre des migrations appliquées dans la base elle-même
 * (schéma `drizzle`, table `__drizzle_migrations`) : relancer la commande
 * n'applique que ce qui manque. Aucune migration ne supprime de donnée sans
 * qu'une PR l'ait dit en clair.
 */
import { migrate } from 'drizzle-orm/neon-serverless/migrator'
import { base } from '@/lib/base/client'
import type { NeonDatabase } from 'drizzle-orm/neon-serverless'

async function principal(): Promise<void> {
  await migrate(base() as unknown as NeonDatabase, { migrationsFolder: 'drizzle' })
  console.info('Migrations appliquées.')
}

principal()
  .then(() => process.exit(0))
  .catch((erreur: unknown) => {
    console.error(erreur instanceof Error ? erreur.message : erreur)
    process.exit(1)
  })
