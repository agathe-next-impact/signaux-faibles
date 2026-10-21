import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { déclarerLaVeille, listerLesVeilles, type RésultatDeDéclaration } from '@/lib/base/veilles'
import { identifiantNotionValide, refuserSiBaseIndisponible, refuserSiNonAutorisé } from '@/lib/portail/garde-veille'

/**
 * Les veilles d'une organisation, déclarées au portail (palier 2, 21 octobre
 * 2026) : ce que la file de travaux a besoin de savoir pour planifier.
 *
 *   POST /api/veille/veilles
 *   Authorization: Bearer <ACTIVATION_SECRET>
 *   { "slug": "acme", "type": "ecosysteme", "libellé": "Écosystème",
 *     "jourParution": 5, "heureParution": "06:30", "cadence": "hebdomadaire",
 *     "referentielNotion": "<page_id>", "numéroCourant": 12, "état": "active" }
 *
 * Rejouable : une veille déjà déclarée (même organisation, même type) est mise
 * à jour. `numéroCourant` est le dernier numéro attribué, à lire une fois sur
 * `GET /api/veille/contexte` (`dernierNuméro` de la famille) : ensuite le
 * portail le tient seul, et le poser à nouveau ne sert qu'à corriger.
 *
 *   GET /api/veille/veilles?slug=acme   → les veilles déclarées (toutes sans slug)
 */
const déclaration = z.object({
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  type: z.string().trim().regex(/^[a-z_]+$/),
  libellé: z.string().trim().min(1).max(100),
  jourParution: z.number().int().min(1).max(7),
  heureParution: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  cadence: z.enum(['hebdomadaire', 'bimensuelle', 'mensuelle']),
  referentielNotion: z.string().trim().refine(identifiantNotionValide).nullable().optional(),
  numéroCourant: z.number().int().min(0).optional(),
  état: z.enum(['active', 'suspendue', 'archivée']).optional(),
})

const STATUT: Record<RésultatDeDéclaration['sorte'], number> = {
  déclarée: 201,
  'mise-à-jour': 200,
  'organisation-inconnue': 404,
}

export async function POST(requête: NextRequest): Promise<NextResponse> {
  const refus = refuserSiNonAutorisé(requête, 'veilles')
  if (refus) return refus
  const indisponible = refuserSiBaseIndisponible()
  if (indisponible) return indisponible

  const lue = déclaration.safeParse(await requête.json().catch(() => null))
  if (!lue.success) return NextResponse.json({ état: 'invalide' }, { status: 400 })

  try {
    const résultat = await déclarerLaVeille(lue.data)
    console.info(`[veille/veilles] ${lue.data.slug} / ${lue.data.type} : ${résultat.sorte}.`)
    const { sorte, ...reste } = résultat
    return NextResponse.json({ état: sorte, ...reste }, { status: STATUT[sorte] })
  } catch (erreur) {
    console.error(`[veille/veilles] ${lue.data.slug} : ${erreur instanceof Error ? erreur.message : String(erreur)}`)
    return NextResponse.json({ état: 'échec' }, { status: 502 })
  }
}

export async function GET(requête: NextRequest): Promise<NextResponse> {
  const refus = refuserSiNonAutorisé(requête, 'veilles')
  if (refus) return refus
  const indisponible = refuserSiBaseIndisponible()
  if (indisponible) return indisponible

  const slug = requête.nextUrl.searchParams.get('slug')
  try {
    const veilles = await listerLesVeilles(slug)
    return NextResponse.json({ état: 'lu', veilles })
  } catch (erreur) {
    console.error(`[veille/veilles] lecture : ${erreur instanceof Error ? erreur.message : String(erreur)}`)
    return NextResponse.json({ état: 'échec' }, { status: 502 })
  }
}
