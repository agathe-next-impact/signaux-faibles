import { NextResponse, type NextRequest } from 'next/server'
import { baseConfigurée } from '@/lib/base/client'
import { refuserSiNonAutorisé } from '@/lib/portail/garde-veille'
import { lireLesCalculs } from '@/lib/portail/strategie'

/**
 * Les chiffres du trimestre (outils stratégiques, lot 7), calculés par le
 * portail pour que la revue en écrive l'interprétation avant de poster la
 * synthèse trimestrielle.
 *
 *   GET /api/veille/calculs?slug=mastora&fin=2026-12-31&departements=06,34,75,92&texte=formation commerciale
 *   Authorization: Bearer <ACTIVATION_SECRET>
 *
 * `indice` : créations et immatriculations contre procédures collectives
 * publiées au BODACC dans les départements et pour le texte d'activité donnés,
 * sur les douze mois qui finissent à `fin` et les douze précédents ; absent sans
 * `departements` ni `texte`. `benchmark` : les chiffres publiés au registre des
 * entités de la grille qui portent un SIREN, l'organisation comprise. Deux API
 * publiques, un budget de vingt secondes : ce qui ne répond pas vaut n.d.
 *
 * N'écrit rien : la synthèse postée recalcule et garde les chiffres.
 */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const DATE = /^\d{4}-\d{2}-\d{2}$/

export async function GET(requête: NextRequest): Promise<NextResponse> {
  const refus = refuserSiNonAutorisé(requête, 'calculs')
  if (refus) return refus
  if (!baseConfigurée()) return NextResponse.json({ état: 'base-non-configurée' }, { status: 503 })

  const params = requête.nextUrl.searchParams
  const slug = params.get('slug') ?? ''
  const fin = params.get('fin') ?? ''
  const départements = (params.get('departements') ?? '').split(',').map((d) => d.trim().toUpperCase()).filter(Boolean)
  const texte = (params.get('texte') ?? '').trim()
  if (!SLUG.test(slug) || !DATE.test(fin) || Number.isNaN(Date.parse(`${fin}T00:00:00Z`))) {
    return NextResponse.json({ état: 'invalide', raison: 'slug et fin (AAAA-MM-JJ) attendus' }, { status: 400 })
  }
  if ((départements.length > 0) !== (texte.length > 0)) {
    return NextResponse.json({ état: 'invalide', raison: 'departements et texte vont ensemble' }, { status: 400 })
  }

  try {
    const lecture = await lireLesCalculs({ slug, fin, cycle: départements.length > 0 ? { départements, texte } : null })
    const statut = lecture.sorte === 'calculé' || lecture.sorte === 'hors-pilote' ? 200 : lecture.sorte === 'organisation-inconnue' ? 404 : lecture.sorte === 'grille-absente' ? 409 : 422
    return NextResponse.json({ état: lecture.sorte, ...lecture }, { status: statut })
  } catch (erreur) {
    console.error(`[veille/calculs] ${slug} : ${erreur instanceof Error ? erreur.message : String(erreur)}`)
    return NextResponse.json({ état: 'erreur' }, { status: 502 })
  }
}
