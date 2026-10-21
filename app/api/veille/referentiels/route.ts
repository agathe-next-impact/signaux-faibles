import { NextResponse, type NextRequest } from 'next/server'
import { schémaDeRemiseDeRéférentiel } from '@/lib/moteur/remise'
import { lireRéférentielUnique } from '@/lib/moteur/referentiel'
import { enregistrerLeRéférentiel } from '@/lib/payload/dispositif'
import { refuserSiNonAutorisé } from '@/lib/portail/garde-veille'

/**
 * La remise d'un référentiel unique par la tâche d'onboarding (programme du
 * 22 octobre 2026, §5, palier 4). Le portail relit le Markdown avec le lecteur
 * du moteur avant de l'écrire : un référentiel illisible ne devient jamais
 * actif. L'ancien référentiel actif de la cible est désactivé, jamais effacé.
 *
 *   POST /api/veille/referentiels   Authorization: Bearer <ACTIVATION_SECRET>
 *   corps : RemiseDeRéférentiel (lib/moteur/remise.ts)
 */
export async function POST(requête: NextRequest): Promise<NextResponse> {
  const refus = refuserSiNonAutorisé(requête, 'referentiels')
  if (refus) return refus

  const lu = schémaDeRemiseDeRéférentiel.safeParse(await requête.json().catch(() => null))
  if (!lu.success) return NextResponse.json({ état: 'invalide', détails: lu.error.issues }, { status: 400 })
  const remise = lu.data
  if ((remise.organisation === null) === (remise.filiere === null)) {
    return NextResponse.json({ état: 'invalide', détails: 'exactement une cible, organisation ou filiere' }, { status: 400 })
  }
  try {
    const référentiel = lireRéférentielUnique(remise.markdown)
    const accusé = await enregistrerLeRéférentiel(remise)
    return NextResponse.json({ ...accusé, axes: référentiel.axes.length, sources: référentiel.axes.reduce((t, a) => t + a.sources.length, 0) })
  } catch (erreur) {
    const message = erreur instanceof Error ? erreur.message : String(erreur)
    if (message.startsWith('Référentiel unique :')) return NextResponse.json({ état: 'illisible', détails: message }, { status: 422 })
    console.error(`[veille/referentiels] run ${remise.run} : ${message}`)
    return NextResponse.json({ état: 'erreur' }, { status: 500 })
  }
}
