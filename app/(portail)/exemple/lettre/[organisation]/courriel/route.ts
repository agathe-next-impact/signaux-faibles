import { courrielDeDémonstration } from '@/lib/vitrine/courriel-demonstration'

/**
 * Le HTML du courriel de la dernière lettre d'une organisation de
 * démonstration, servi tel quel : c'est ce que la page « La dernière lettre »
 * affiche dans son cadre. Public, sans lecture ; un slug qui n'est pas une
 * démonstration est introuvable. Ses en-têtes admettent l'inclusion dans un
 * cadre de la même origine (`next.config.ts`), seule exception du portail.
 */
export async function GET(_requête: Request, { params }: { params: Promise<{ organisation: string }> }) {
  const { organisation } = await params
  const courriel = courrielDeDémonstration(organisation)
  if (!courriel) return new Response('Introuvable', { status: 404 })
  return new Response(courriel.html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300, s-maxage=3600' },
  })
}
