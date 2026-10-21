import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { buildConfig } from 'payload'
import { collections } from './lib/payload/collections'

/**
 * Payload CMS 3 dans le Next.js existant (`docs/programme-lettre-unique.md`, §4).
 *
 * Même base Neon que le portail, mais dans un **schéma `payload`** à part et
 * sans `push` : les tables du portail (`lib/base/schema.ts`, migrations
 * `drizzle/`) ne sont jamais touchées par Payload, et les migrations Payload
 * (`payload-migrations/`) sont relues et commitées comme les autres.
 *
 * Les routes sont `/admin` et `/payload-api`, jamais `/api` : les routes du
 * dispositif vivent sous `/api/veille`, `/api/acces`, `/api/media/[block_id]`
 * et `/api/webhooks`, et un attrape-tout Payload sous `/api` entrerait en
 * collision avec `/api/media/[id]`. GraphQL est désactivé : rien ne l'appelle.
 */
const racine = path.dirname(fileURLToPath(import.meta.url))

export default buildConfig({
  secret: process.env.PAYLOAD_SECRET ?? '',
  db: postgresAdapter({
    pool: { connectionString: process.env.DATABASE_URL ?? '' },
    schemaName: 'payload',
    push: false,
    idType: 'uuid',
    migrationDir: path.resolve(racine, 'payload-migrations'),
  }),
  routes: { admin: '/admin', api: '/payload-api' },
  admin: {
    user: 'utilisateurs',
    importMap: { baseDir: racine },
  },
  collections,
  editor: lexicalEditor(),
  typescript: { outputFile: path.resolve(racine, 'lib/payload/types.ts') },
  graphQL: { disable: true },
  telemetry: false,
})
