import { NextResponse, type NextRequest } from 'next/server'
import { contrôlerLeDispositif } from '@/lib/portail/controle-du-soir'
import { composerCourrierDÉtat } from '@/lib/portail/etat'
import { envoyerCourrier } from '@/lib/portail/courriers'
import { refuserSiNonAutorisé } from '@/lib/portail/garde-veille'

/**
 * Le contrôle des espaces clients — l'étape 3bis de la réconciliation, en code.
 *
 *   GET /api/veille/etat              → l'état, en JSON
 *   GET /api/veille/etat?notifier=1   → idem, et un courriel au relecteur
 *                                        SEULEMENT s'il y a un défaut
 *   Authorization: Bearer <ACTIVATION_SECRET ou CRON_SECRET>
 *
 * Le cron Vercel (en-tête `x-vercel-cron-schedule`) vaut `notifier=1` et
 * appelle la route chaque soir. Le silence est le
 * comportement normal : un courriel quotidien qui dit « tout va bien » n'est
 * plus lu au bout d'une semaine.
 *
 * Pour chaque espace : les lignes d'accès (identifiants, doublons, adresses),
 * les lettres publiées, et le contrat de forme de la dernière — par le même
 * validateur que `/api/veille/lint`. Coût Notion : une requête sur « Accès »,
 * une par organisation sur « Éditions », un corps de note par organisation.
 * Toutes cachées.
 */
export async function GET(requête: NextRequest): Promise<NextResponse> {
  const refus = refuserSiNonAutorisé(requête, 'etat')
  if (refus) return refus

  // Le cron Vercel ne porte pas de paramètre, mais il signe chaque appel de
  // l'en-tête `x-vercel-cron-schedule` : c'est lui qui vaut « notifier ». Un
  // appel à la main obtient la même chose avec `?notifier=1`.
  const notifier =
    requête.nextUrl.searchParams.get('notifier') === '1' ||
    requête.headers.get('x-vercel-cron-schedule') !== null

  try {
    const { état, accès } = await contrôlerLeDispositif()

    for (const défaut of état.défauts) console.warn(`[veille/etat] ${défaut.slug} : ${défaut.message}`)

    let notification: 'envoyée' | 'silence' | 'sans-destinataire' | 'échec' = 'silence'
    if (notifier && état.défauts.length > 0) {
      const destinataire = process.env['RELECTEUR_EMAIL']
      if (!destinataire) {
        notification = 'sans-destinataire'
        console.error('[veille/etat] RELECTEUR_EMAIL absent : défauts constatés, personne à prévenir.')
      } else {
        try {
          const courrier = composerCourrierDÉtat(état)
          await envoyerCourrier({
            message: { destinataire, sujet: courrier.objet, texte: courrier.texte },
            sorte: 'alerte_espaces',
            déclencheur: requête.headers.get('x-vercel-cron-schedule') !== null ? 'cron' : 'manuel',
            organisation: null,
            lecteurId: null,
            unique: false,
          })
          notification = 'envoyée'
        } catch (erreur) {
          notification = 'échec'
          console.error(
            `[veille/etat] courriel non envoyé : ${erreur instanceof Error ? erreur.message : String(erreur)}`,
          )
        }
      }
    }

    return NextResponse.json({ état: 'contrôlé', notification, accès, ...état })
  } catch (erreur) {
    console.error(`[veille/etat] échec : ${erreur instanceof Error ? erreur.message : String(erreur)}`)
    return NextResponse.json({ état: 'erreur' }, { status: 502 })
  }
}
