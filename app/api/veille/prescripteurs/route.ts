import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { baseConfigurée } from '@/lib/base/client'
import {
  créerPrescripteur,
  listeDExclusion,
  TYPES_DE_PRESCRIPTEUR,
  type RésultatDeCréation,
  type TypePrescripteur,
} from '@/lib/base/prescripteurs'
import { codeDePrescripteurValide } from '@/lib/domaine/prescripteurs'
import { refuserSiNonAutorisé } from '@/lib/portail/garde-veille'

/**
 * Les prescripteurs (24 octobre 2026, `docs/prescripteurs.md`).
 *
 *   POST /api/veille/prescripteurs
 *   Authorization: Bearer <ACTIVATION_SECRET>
 *   { "slug": "cabinet-x", "code": "cabinet-x", "type": "conseil" }
 *
 * Fait d'une organisation déjà ouverte dans le portail un prescripteur, avec
 * son code de recommandation (celui du lien `/demo?de=<code>`). Rejouable :
 * `déjà-prescripteur`. Elle ne pose pas l'accès offert : l'opératrice le pose
 * par `PATCH /api/veille/organisations` (`offre: gratuite`), parce qu'un client
 * qui paie peut aussi devenir prescripteur.
 *
 *   GET /api/veille/prescripteurs?exclusions=1
 *
 * La liste que la tâche de prospection lit **avant** de constituer son lot :
 * les prescripteurs et les organisations qu'ils ont recommandées, par slug,
 * nom et ligne du registre. Aucune ne reçoit de séquence.
 */
const demande = z.object({
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  code: z.string().trim().refine(codeDePrescripteurValide),
  type: z.enum(TYPES_DE_PRESCRIPTEUR as [TypePrescripteur, ...TypePrescripteur[]]),
})

const STATUT: Record<RésultatDeCréation['sorte'], number> = {
  créé: 201,
  'déjà-prescripteur': 200,
  'organisation-inconnue': 404,
  'code-pris': 409,
  'en-prospection': 409,
}

export async function POST(requête: NextRequest): Promise<NextResponse> {
  const refus = refuserSiNonAutorisé(requête, 'prescripteurs')
  if (refus) return refus
  if (!baseConfigurée()) return NextResponse.json({ état: 'base-non-configurée' }, { status: 503 })

  const lue = demande.safeParse(await requête.json().catch(() => null))
  if (!lue.success) return NextResponse.json({ état: 'invalide' }, { status: 400 })

  try {
    const résultat = await créerPrescripteur(lue.data)
    console.info(`[veille/prescripteurs] ${lue.data.slug} : ${résultat.sorte}.`)
    return NextResponse.json({ état: résultat.sorte, ...résultat }, { status: STATUT[résultat.sorte] })
  } catch (erreur) {
    console.error(`[veille/prescripteurs] ${lue.data.slug} : ${erreur instanceof Error ? erreur.message : String(erreur)}`)
    return NextResponse.json({ état: 'échec' }, { status: 502 })
  }
}

export async function GET(requête: NextRequest): Promise<NextResponse> {
  const refus = refuserSiNonAutorisé(requête, 'prescripteurs')
  if (refus) return refus
  if (!baseConfigurée()) return NextResponse.json({ état: 'base-non-configurée' }, { status: 503 })
  if (requête.nextUrl.searchParams.get('exclusions') !== '1') {
    return NextResponse.json({ état: 'invalide', raison: 'exclusions=1 attendu' }, { status: 400 })
  }

  try {
    const exclusions = await listeDExclusion()
    return NextResponse.json({ état: 'lu', nombre: exclusions.length, exclusions })
  } catch (erreur) {
    console.error(`[veille/prescripteurs] exclusions : ${erreur instanceof Error ? erreur.message : String(erreur)}`)
    return NextResponse.json({ état: 'erreur' }, { status: 502 })
  }
}
