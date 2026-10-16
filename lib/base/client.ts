import { Pool } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-serverless'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import * as schema from '@/lib/base/schema'

/**
 * La connexion Postgres, et le seul endroit qui la construit.
 *
 * **Toute lecture ou écriture Postgres passe par `lib/base/`**, jamais depuis
 * un composant ni une route directement ; `tests/architecture.test.ts` interdit
 * tout import de Drizzle ou du pilote hors de ce dossier.
 *
 * Le pilote est le client WebSocket de Neon (`Pool`) et non le client HTTP :
 * le palier 1b écrit un envoi et le courrier qui le suit, le palier 2 attribue
 * un numéro et accepte un résultat dans la même transaction, et seul le premier
 * tient une transaction interactive.
 *
 * `DATABASE_URL` est lue directement dans `process.env`, comme le secret du
 * webhook : une page qui ne touche pas Postgres — c'est le cas de toutes tant
 * que `SOURCE_ACCES` vaut `notion` — n'a pas à tomber parce que la base n'est
 * pas encore créée.
 */
export type Base = PgDatabase<PgQueryResultHKT, typeof schema>

let instance: Base | null = null

export function base(): Base {
  if (instance) return instance

  const adresse = process.env.DATABASE_URL
  if (!adresse) {
    throw new Error(
      'DATABASE_URL absente : la base Postgres du portail n’est pas configurée. ' +
        'Créer la base (Vercel, Storage) et la rattacher au projet, ou remettre SOURCE_ACCES=notion.',
    )
  }

  instance = drizzle({ client: new Pool({ connectionString: adresse }), schema })
  return instance
}

/** `true` quand une base est configurée, sans ouvrir de connexion. */
export function baseConfigurée(): boolean {
  return Boolean(process.env.DATABASE_URL)
}
