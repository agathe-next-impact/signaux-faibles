import { NextResponse, type NextRequest } from 'next/server'
import { baseConfigurée } from '@/lib/base/client'
import { courriersRécents } from '@/lib/base/courriers'
import { refuserSiNonAutorisé } from '@/lib/portail/garde-veille'

/**
 * Le journal des courriers, pour l'opératrice.
 *
 *   GET /api/veille/courriers?jours=30
 *   Authorization: Bearer <ACTIVATION_SECRET ou CRON_SECRET>
 *
 * Une ligne par courrier : date, sorte, état, espace, lecteur (son nom quand le
 * portail le connaît), empreinte de l'adresse, identifiant Gmail ou code
 * d'échec. Aucune adresse, aucun lien : l'empreinte suffit à rapprocher une
 * ligne des journaux Vercel, et le nom du lecteur à savoir de qui il s'agit.
 */
export async function GET(requête: NextRequest): Promise<NextResponse> {
  const refus = refuserSiNonAutorisé(requête, 'courriers')
  if (refus) return refus

  if (!baseConfigurée()) return NextResponse.json({ état: 'base-non-configurée' }, { status: 503 })

  const jours = Math.min(Math.max(Number(requête.nextUrl.searchParams.get('jours')) || 30, 1), 365)
  try {
    const depuis = new Date(Date.now() - jours * 24 * 60 * 60 * 1000)
    const lignes = await courriersRécents(depuis)
    return NextResponse.json({ état: 'lu', jours, nombre: lignes.length, courriers: lignes })
  } catch (erreur) {
    console.error(`[veille/courriers] échec : ${erreur instanceof Error ? erreur.message : String(erreur)}`)
    return NextResponse.json({ état: 'erreur' }, { status: 502 })
  }
}
