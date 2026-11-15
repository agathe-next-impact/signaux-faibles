import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { contrôlerLeDispositif } from '@/lib/portail/controle-du-soir'
import type { LigneDuRegistre } from '@/lib/portail/ecarts-de-statut'
import { composerCourrierDÉtat } from '@/lib/portail/etat'
import { envoyerCourrier } from '@/lib/portail/courriers'
import { refuserSiNonAutorisé } from '@/lib/portail/garde-veille'

const schéma = z.object({
  registre: z
    .array(z.object({ slug: z.string().max(120), statut: z.union([z.number(), z.string().max(200)]) }))
    .max(500),
})

/**
 * Le contrôle des espaces clients — l'étape 3bis de la réconciliation, en code.
 *
 *   GET /api/veille/etat              → l'état, en JSON
 *   GET /api/veille/etat?notifier=1   → idem, et un courriel au relecteur
 *                                        SEULEMENT s'il y a un défaut
 *   POST /api/veille/etat              → idem, plus la comparaison des statuts
 *        { "registre": [ { "slug": "acme", "statut": "6 · Veille active" }, … ] }
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
 *
 * Les écarts de statut (15 novembre 2026) : le portail ne lit jamais le
 * registre, donc le cron ne peut pas comparer. La tâche qui vient de le lire
 * **donne** ses lignes (slug et statut) au `POST`, qui les compare aux états
 * du portail : « 0 · Écartée » au registre d'une organisation encore en
 * service, organisation écartée au portail que le registre montre en service,
 * statut 4 à 6 sans organisation au portail, statut illisible. Rien n'est
 * gardé, rien n'est écrit. La réponse porte `statuts` : `null` si personne n'a
 * donné de lignes, sinon ce qui a été comparé, ou pourquoi cela n'a pas pu l'être.
 */
export async function GET(requête: NextRequest): Promise<NextResponse> {
  const refus = refuserSiNonAutorisé(requête, 'etat')
  if (refus) return refus
  return contrôler(requête)
}

export async function POST(requête: NextRequest): Promise<NextResponse> {
  const refus = refuserSiNonAutorisé(requête, 'etat')
  if (refus) return refus

  let charge: unknown
  try {
    charge = await requête.json()
  } catch {
    return NextResponse.json({ état: 'refusée', raison: 'corps illisible' }, { status: 400 })
  }
  const lecture = schéma.safeParse(charge)
  if (!lecture.success) {
    return NextResponse.json(
      { état: 'refusée', raison: lecture.error.issues.map((i) => `${i.path.join('.')} : ${i.message}`).join(' ; ') },
      { status: 400 },
    )
  }
  return contrôler(requête, lecture.data.registre)
}

/** Le contrôle et sa notification : l'appelant a déjà vérifié le jeton. */
async function contrôler(requête: NextRequest, registre?: readonly LigneDuRegistre[]): Promise<NextResponse> {
  // Le cron Vercel ne porte pas de paramètre, mais il signe chaque appel de
  // l'en-tête `x-vercel-cron-schedule` : c'est lui qui vaut « notifier ». Un
  // appel à la main obtient la même chose avec `?notifier=1`.
  const notifier =
    requête.nextUrl.searchParams.get('notifier') === '1' ||
    requête.headers.get('x-vercel-cron-schedule') !== null

  try {
    const { état, accès, statuts } = await contrôlerLeDispositif(registre ? { registre } : {})

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

    return NextResponse.json({ état: 'contrôlé', notification, accès, statuts, ...état })
  } catch (erreur) {
    console.error(`[veille/etat] échec : ${erreur instanceof Error ? erreur.message : String(erreur)}`)
    return NextResponse.json({ état: 'erreur' }, { status: 502 })
  }
}
