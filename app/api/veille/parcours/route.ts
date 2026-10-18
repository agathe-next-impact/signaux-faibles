import { NextResponse, type NextRequest } from 'next/server'
import { aujourdHuiÀParis } from '@/lib/domaine/calendrier'
import { env } from '@/lib/env'
import { refuserSiNonAutorisé } from '@/lib/portail/garde-veille'
import { envoyerLesCourriersDeParcours } from '@/lib/portail/parcours-courriers'

/**
 * Les courriers de fin d'essai, une fois par jour.
 *
 *   GET /api/veille/parcours
 *   Authorization: Bearer <CRON_SECRET ou ACTIVATION_SECRET>
 *
 * Appelée par le cron de `vercel.json`. Rejouable : un courrier déjà réservé
 * dans le journal n'est jamais renvoyé. Rend le rapport du passage, sans aucune
 * adresse (empreintes seulement).
 */
export async function GET(requête: NextRequest): Promise<NextResponse> {
  const refus = refuserSiNonAutorisé(requête, 'parcours')
  if (refus) return refus

  try {
    const rapport = await envoyerLesCourriersDeParcours({
      aujourdHui: aujourdHuiÀParis(),
      portailUrl: env().PORTAIL_URL,
      relecteurParDéfaut: process.env['RELECTEUR_EMAIL'] || undefined,
    })
    return NextResponse.json({ état: 'passé', ...rapport })
  } catch (erreur) {
    // L'erreur sort de lib/base sans donnée : seulement un code.
    console.error(`[veille/parcours] échec : ${erreur instanceof Error ? erreur.message : String(erreur)}`)
    return NextResponse.json({ état: 'erreur' }, { status: 502 })
  }
}
