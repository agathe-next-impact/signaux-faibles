import { texteLlms } from '@/lib/vitrine/referencement'

/**
 * `/llms.txt` (16 novembre 2026, proposition llmstxt.org) : la vitrine résumée
 * en Markdown pour les moteurs de réponse par IA. Rien n'y est lu d'une base :
 * le texte vient des constantes de l'offre, il est donc statique.
 */
export function GET(): Response {
  return new Response(texteLlms(), {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  })
}
