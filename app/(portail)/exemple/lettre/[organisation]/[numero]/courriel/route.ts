import { courrielDeDémonstration } from '@/lib/vitrine/courriel-demonstration'

/**
 * Le HTML du courriel d'une lettre de démonstration désignée par son numéro,
 * servi tel quel, comme `../../courriel` pour la dernière. Public, sans
 * lecture ; introuvable pour tout autre slug ou numéro. Encadrable par la même
 * origine seulement (`next.config.ts`).
 */
export async function GET(_requête: Request, { params }: { params: Promise<{ organisation: string; numero: string }> }) {
  const { organisation, numero } = await params
  const courriel = courrielDeDémonstration(organisation, numero)
  if (!courriel) return new Response('Introuvable', { status: 404 })
  return new Response(courriel.html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300, s-maxage=3600' },
  })
}
