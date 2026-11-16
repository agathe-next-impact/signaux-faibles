import type { MetadataRoute } from 'next'
import { absolue, CHEMINS_EXCLUS_DES_ROBOTS, ROBOTS_D_IA } from '@/lib/vitrine/referencement'

/**
 * `robots.txt` (16 novembre 2026). Avant lui, l'adresse n'existait pas et le
 * proxy la redirigeait vers « recevoir mon lien » : un robot lisait une page de
 * connexion à la place de ses règles, et aucun sitemap n'était annoncé.
 *
 * Tout robot est admis sur la vitrine ; les robots des moteurs de réponse par
 * IA sont nommés, avec les mêmes exclusions, parce qu'un robot qui trouve un
 * groupe à son nom ignore le groupe `*`. Les espaces clients ne sont pas
 * listés (leurs slugs ne se publient pas) : le proxy et le `noindex` les
 * gardent.
 */
export default function robots(): MetadataRoute.Robots {
  const exclusions = [...CHEMINS_EXCLUS_DES_ROBOTS]
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: exclusions },
      {
        userAgent: [...ROBOTS_D_IA.rechercheEtCitation, ...ROBOTS_D_IA.entraînement],
        allow: '/',
        disallow: exclusions,
      },
    ],
    sitemap: absolue('/sitemap.xml'),
  }
}
