import { NextResponse, type NextRequest } from 'next/server'
import { aujourdHuiÀParis } from '@/lib/domaine/calendrier'
import { envoyerMessage } from '@/lib/email/gmail'
import { lignesDAccèsPourContrôle } from '@/lib/notion/acces'
import { listerÉditionsPubliées, lireBlocsDePage } from '@/lib/notion/editions'
import {
  composerCourrierDÉtat,
  contrôlerUnEspace,
  regrouperParSlug,
  type EspaceContrôlé,
  type ÉtatDuDispositif,
} from '@/lib/portail/etat'
import { refuserSiNonAutorisé } from '@/lib/portail/garde-veille'
import { CONTRAT_DE_FORME_DEPUIS, contrôlerLaLettre, type Rapport } from '@/lib/portail/lint'

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
    const { parSlug, sansSlug } = regrouperParSlug(await lignesDAccèsPourContrôle())
    const espaces: EspaceContrôlé[] = []

    for (const [slug, lignes] of parSlug) {
      // L'identifiant contrôlé est celui que les lignes portent — s'il diverge,
      // `contrôlerUnEspace` le dira, et on regarde le premier non vide pour
      // savoir au moins ce que ce lecteur-là voit.
      const organisationId = lignes.map((l) => l.organisationId).find((id) => id.length > 0)
      const lettres = organisationId ? await listerÉditionsPubliées(organisationId) : []

      let rapport: Rapport | null = null
      const dernière = lettres[0]
      // Le contrat de forme date du 11 septembre 2026 ; une dernière lettre
      // antérieure le rompt forcément, et le dirait chaque soir jusqu'à la
      // parution suivante. On ne contrôle que ce qui a été écrit sous le contrat.
      if (dernière && dernière.dateÉdition >= CONTRAT_DE_FORME_DEPUIS) {
        try {
          rapport = contrôlerLaLettre({
            titre: dernière.titre,
            blocs: await lireBlocsDePage(dernière.pageId),
            dossiersBruts: dernière.dossiersOuvertsBruts,
          })
        } catch (erreur) {
          console.warn(
            `[veille/etat] corps de ${dernière.pageId} illisible : ${erreur instanceof Error ? erreur.message : String(erreur)}`,
          )
        }
      }

      espaces.push(contrôlerUnEspace({ slug, lignes, lettres, rapport }))
    }

    const état: ÉtatDuDispositif = {
      date: aujourdHuiÀParis(),
      espaces,
      défauts: espaces.flatMap((e) => e.défauts),
      lignesSansSlug: sansSlug,
    }

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
          await envoyerMessage({ destinataire, sujet: courrier.objet, texte: courrier.texte })
          notification = 'envoyée'
        } catch (erreur) {
          notification = 'échec'
          console.error(
            `[veille/etat] courriel non envoyé : ${erreur instanceof Error ? erreur.message : String(erreur)}`,
          )
        }
      }
    }

    return NextResponse.json({ état: 'contrôlé', notification, ...état })
  } catch (erreur) {
    console.error(`[veille/etat] échec : ${erreur instanceof Error ? erreur.message : String(erreur)}`)
    return NextResponse.json({ état: 'erreur' }, { status: 502 })
  }
}
