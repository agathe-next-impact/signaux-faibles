import type { MetadataRoute } from 'next'
import { absolue, PAGES_INDEXABLES } from '@/lib/vitrine/referencement'

/**
 * Le sitemap de la vitrine (16 novembre 2026) : ses pages indexables, et elles
 * seules. Aucune date de modification : la poser à la date du build mentirait
 * à chaque déploiement, et un moteur apprend vite à l'ignorer.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES_INDEXABLES.map((page) => ({
    url: absolue(page.chemin),
    changeFrequency: page.fréquence,
    priority: page.priorité,
  }))
}
