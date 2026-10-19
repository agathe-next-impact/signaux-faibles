/**
 * Applique les migrations SQL de `drizzle/` à la base désignée par DATABASE_URL.
 *
 *   pnpm base:migrer                 → toujours
 *   tsx scripts/base-migrer.ts --deploiement   → au build, en production seulement
 *
 * Drizzle tient le registre des migrations appliquées dans la base elle-même
 * (schéma `drizzle`, table `__drizzle_migrations`) : relancer la commande
 * n'applique que ce qui manque. Aucune migration ne supprime de donnée sans
 * qu'une PR l'ait dit en clair.
 *
 * `--deploiement` est l'appel du script `build` (18 octobre 2026) : le code et
 * le schéma partent ensemble, et une migration en échec fait échouer le
 * déploiement au lieu de mettre en ligne un code qui attend une colonne
 * absente. Seule la production migre : un aperçu ne touche jamais la base des
 * clients, et un `pnpm build` local ne touche rien. Sans DATABASE_URL, rien
 * n'est appliqué et le build continue, comme une page qui ne touche pas
 * Postgres ne tombe pas parce que la base n'existe pas encore.
 */
import { appliquerLesMigrations } from '@/lib/base/migrer'

async function principal(): Promise<void> {
  if (process.argv.includes('--deploiement')) {
    const environnement = process.env['VERCEL_ENV']
    if (environnement !== 'production') {
      console.info(`Migrations non appliquées : déploiement ${environnement ?? 'hors Vercel'}, seule la production migre au build.`)
      return
    }
    if (!process.env['DATABASE_URL']?.trim()) {
      console.warn('Migrations non appliquées : DATABASE_URL absente en production.')
      return
    }
  }
  await appliquerLesMigrations()
  console.info('Migrations appliquées.')
}

principal()
  .then(() => process.exit(0))
  .catch((erreur: unknown) => {
    console.error(erreur instanceof Error ? erreur.message : erreur)
    process.exit(1)
  })
