import { NextResponse, type NextRequest } from 'next/server'
import { vérifierJetonCowork } from '@/lib/portail/jeton-cowork'

/**
 * Le prologue commun des routes `/api/veille/*` : vérifier le jeton avant
 * toute lecture de l'environnement, et répondre 503 quand la route n'est pas
 * configurée plutôt que 401 — la demande n'est pas en cause, la route l'est.
 *
 * Rend `null` quand l'appel peut continuer, sinon la réponse à renvoyer.
 */
export function refuserSiNonAutorisé(requête: NextRequest, nomDeLaRoute: string): NextResponse | null {
  const décision = vérifierJetonCowork({
    autorisation: requête.headers.get('authorization'),
    secrets: [process.env['ACTIVATION_SECRET'], process.env['CRON_SECRET']],
  })

  switch (décision.sorte) {
    case 'non-configurée':
      console.error(
        `[veille/${nomDeLaRoute}] ACTIVATION_SECRET et CRON_SECRET absents : la route est fermée.`,
      )
      return NextResponse.json({ état: 'non-configurée' }, { status: 503 })
    case 'refusée':
      console.warn(`[veille/${nomDeLaRoute}] demande refusée : ${décision.raison}`)
      return NextResponse.json({ état: 'refusée' }, { status: 401 })
    case 'acceptée':
      return null
  }
}

/** Un identifiant Notion tel qu'il circule : 32 hexadécimaux, avec ou sans tirets. */
export function identifiantNotionValide(valeur: unknown): valeur is string {
  return typeof valeur === 'string' && /^[0-9a-f]{32}$/i.test(valeur.replaceAll('-', ''))
}

/**
 * La forme canonique d'un identifiant Notion : l'UUID avec tirets, telle que
 * l'API la renvoie. C'est celle des tags de cache (`page:<id>`) posés par les
 * écrans et invalidés par le webhook ; une autre forme créerait une seconde
 * entrée de cache pour la même page.
 */
export function identifiantAvecTirets(valeur: string): string {
  const hex = valeur.replaceAll('-', '').toLowerCase()
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
