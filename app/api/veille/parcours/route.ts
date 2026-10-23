import { NextResponse, type NextRequest } from 'next/server'
import { sourceAccès } from '@/lib/auth/source-acces'
import { baseConfigurée } from '@/lib/base/client'
import { aujourdHuiÀParis } from '@/lib/domaine/calendrier'
import { env } from '@/lib/env'
import { planifierLaFile } from '@/lib/portail/file'
import { refuserSiNonAutorisé } from '@/lib/portail/garde-veille'
import { préparerLesRappelsDeRenouvellement } from '@/lib/portail/courriers-abonnement'
import { envoyerLesCourriersDeParcours } from '@/lib/portail/parcours-courriers'
import { synchroniserLaProspection } from '@/lib/portail/prospection'

/**
 * Les courriers d'essai et les rappels de renouvellement annuel, une fois par
 * jour, déposés en brouillon Gmail (23 octobre 2026), puis la synchronisation
 * de la prospection avec lemlist (19 octobre 2026).
 *
 *   GET /api/veille/parcours
 *   Authorization: Bearer <CRON_SECRET ou ACTIVATION_SECRET>
 *
 * Appelée par le cron de `vercel.json`. Rejouable : un courrier déjà réservé
 * dans le journal n'est jamais renvoyé, et lemlist ne reçoit que ce qu'il ne
 * sait pas encore. Rend le rapport du passage, sans aucune adresse (empreintes
 * seulement). La synchronisation vient après les courriers et ne peut pas les
 * empêcher : son échec est rapporté, pas levé.
 *
 * Depuis le 21 octobre 2026, le même passage **planifie la file de travaux**
 * (palier 2) : un travail de lettre par parution de la semaine qui vient, une
 * fois. Après les courriers et la prospection, isolé comme eux.
 */
export async function GET(requête: NextRequest): Promise<NextResponse> {
  const refus = refuserSiNonAutorisé(requête, 'parcours')
  if (refus) return refus

  // Le parcours vit dans Postgres. Sans base, ou en `SOURCE_ACCES=notion`
  // (l'interrupteur de retour en arrière, qui n'ouvre jamais Postgres), il n'y a
  // rien à faire : 200 et non une erreur, pour que le cron quotidien ne
  // ressemble pas à une panne.
  if (!baseConfigurée() || sourceAccès() === 'notion') {
    return NextResponse.json({ état: 'inactif', raison: 'base non configurée ou SOURCE_ACCES=notion' })
  }

  try {
    const aujourdHui = aujourdHuiÀParis()
    const rapport = await envoyerLesCourriersDeParcours({
      aujourdHui,
      portailUrl: env().PORTAIL_URL,
    })
    const renouvellements = await préparerLesRappelsDeRenouvellement({ maintenant: new Date(), portailUrl: env().PORTAIL_URL }).catch(
      (erreur: unknown) => {
        console.error(`[veille/parcours] rappels de renouvellement non préparés : ${erreur instanceof Error ? erreur.message : String(erreur)}`)
        return null
      },
    )
    const prospection = await synchroniserLaProspection({ aujourdHui }).catch((erreur: unknown) => {
      console.error(`[veille/parcours] prospection non synchronisée : ${erreur instanceof Error ? erreur.message : String(erreur)}`)
      return { état: 'erreur' as const }
    })
    const file = await planifierLaFile({ aujourdHui }).catch((erreur: unknown) => {
      console.error(`[veille/parcours] file non planifiée : ${erreur instanceof Error ? erreur.message : String(erreur)}`)
      return { état: 'erreur' as const }
    })
    return NextResponse.json({ état: 'passé', ...rapport, renouvellements, prospection, file })
  } catch (erreur) {
    // L'erreur sort de lib/base sans donnée : seulement un code.
    console.error(`[veille/parcours] échec : ${erreur instanceof Error ? erreur.message : String(erreur)}`)
    return NextResponse.json({ état: 'erreur' }, { status: 502 })
  }
}
