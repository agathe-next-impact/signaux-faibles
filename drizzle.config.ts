import { defineConfig } from 'drizzle-kit'

/**
 * Génération des migrations SQL depuis `lib/base/schema.ts`.
 *
 * `pnpm base:generer` écrit un fichier SQL daté dans `drizzle/`, relu et
 * commité comme du code ; `pnpm base:migrer` l'applique à la base désignée par
 * `DATABASE_URL`. La génération n'ouvre aucune connexion.
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './lib/base/schema.ts',
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
  strict: true,
  verbose: true,
})
