import { NextResponse, type NextRequest } from 'next/server'
import { schémaDeRemiseDeBloc } from '@/lib/moteur/remise'
import { enregistrerLeBloc } from '@/lib/payload/dispositif'
import { refuserSiNonAutorisé } from '@/lib/portail/garde-veille'

/**
 * La remise du bloc personnalisé d'un prospect (programme du 22 octobre 2026,
 * §5, palier 1) : quatre à huit lignes « pour <organisation> », posées en tête
 * de la lettre de filière qu'il reçoit. Écrit sur la ligne du prospect, jamais
 * ailleurs ; aucune adresse ne transite ici.
 *
 *   POST /api/veille/prospects   Authorization: Bearer <ACTIVATION_SECRET>
 *   { "prospect": "<id>", "run": "<run>", "bloc": ["…", "…"] }
 */
export async function POST(requête: NextRequest): Promise<NextResponse> {
  const refus = refuserSiNonAutorisé(requête, 'prospects')
  if (refus) return refus

  const lu = schémaDeRemiseDeBloc.safeParse(await requête.json().catch(() => null))
  if (!lu.success) return NextResponse.json({ état: 'invalide', détails: lu.error.issues }, { status: 400 })
  try {
    const issue = await enregistrerLeBloc(lu.data.prospect, lu.data.run, lu.data.bloc)
    return issue === 'enregistré' ? NextResponse.json({ état: issue, lignes: lu.data.bloc.length }) : NextResponse.json({ état: issue }, { status: 404 })
  } catch (erreur) {
    console.error(`[veille/prospects] run ${lu.data.run} : ${erreur instanceof Error ? erreur.message : String(erreur)}`)
    return NextResponse.json({ état: 'erreur' }, { status: 500 })
  }
}
