import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { baseConfigurée } from '@/lib/base/client'
import type { ÉtiquetteProposée } from '@/lib/domaine/strategie'
import { identifiantNotionValide, refuserSiNonAutorisé } from '@/lib/portail/garde-veille'
import { lireLesFaits, recevoirLesÉtiquettes, type RésultatDesÉtiquettes } from '@/lib/portail/strategie'

/**
 * Les faits étiquetés (outils stratégiques, lot 3 de
 * `docs/plan-outils-strategiques.md`).
 *
 *   POST /api/veille/faits
 *   Authorization: Bearer <ACTIVATION_SECRET>
 *   { "slug": "infralliance", "page": "<page_id de l'édition>", "etiquettes": [ … ] }
 *
 * Une entrée par fait d'axe non RAS et de « L'actualité des acteurs » :
 * `section`, `axe`, `rang`, `titre` (la phrase-titre telle qu'écrite), `date`,
 * `source`, `pestel` ou `porter`, `ansoff` pour un concurrent nommé, `entite`,
 * `rupture`, `impact`, `nouveaute`. Le lot est accepté entier ou pas du tout :
 * 422 avec la liste des refus et le message de reprise ; la tâche corrige et
 * renvoie, deux fois au plus. Un lot accepté remplace celui de la même édition.
 *
 *   GET /api/veille/faits?slug=infralliance&debut=2026-10-05&fin=2026-11-01
 *
 * Les faits des éditions parues dans la fenêtre, bornes comprises, avec leur
 * phrase-titre relue dans la lettre : ce que la revue mensuelle synthétise.
 *
 * `hors-pilote` (200) : l'organisation n'a pas les outils stratégiques ; la
 * tâche passe l'étape. **Les étiquettes ne bloquent jamais l'envoi d'une
 * lettre.**
 */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const DATE = /^\d{4}-\d{2}-\d{2}$/

const facultatif = z.string().trim().max(120).nullish()
const étiquette = z.object({
  section: z.string(),
  axe: z.number().int().min(1).max(99).nullish(),
  rang: z.number().int().min(1).max(99),
  titre: z.string().max(600),
  date: z.string().max(10),
  source: z.string().trim().min(1).max(2000),
  pestel: facultatif,
  porter: facultatif,
  ansoff: facultatif,
  entite: z.string().trim().max(200).nullish(),
  rupture: z.boolean(),
  impact: z.string(),
  nouveaute: z.string(),
})
const demande = z.object({
  slug: z.string().trim().regex(SLUG),
  page: z.string().refine(identifiantNotionValide),
  etiquettes: z.array(étiquette).max(80),
})

const STATUT: Record<RésultatDesÉtiquettes['sorte'], number> = {
  accepté: 200,
  refusé: 422,
  'hors-pilote': 200,
  'organisation-inconnue': 404,
  'édition-introuvable': 404,
  'organisation-différente': 409,
  'organisations-multiples': 409,
  'édition-sans-date': 422,
}

export async function POST(requête: NextRequest): Promise<NextResponse> {
  const refus = refuserSiNonAutorisé(requête, 'faits')
  if (refus) return refus
  if (!baseConfigurée()) return NextResponse.json({ état: 'base-non-configurée' }, { status: 503 })

  const lue = demande.safeParse(await requête.json().catch(() => null))
  if (!lue.success) {
    const chemin = lue.error.issues[0]?.path.join('.') ?? ''
    return NextResponse.json({ état: 'invalide', raison: chemin ? `champ « ${chemin} »` : 'corps illisible' }, { status: 400 })
  }

  try {
    const résultat = await recevoirLesÉtiquettes({
      slug: lue.data.slug,
      page: lue.data.page,
      lot: lue.data.etiquettes as readonly ÉtiquetteProposée[],
    })
    console.info(
      `[veille/faits] ${lue.data.slug} : ${résultat.sorte}` +
        (résultat.sorte === 'accepté' ? ` (${résultat.insérées} faits, ${résultat.archivées} archivés)` : '') +
        (résultat.sorte === 'refusé' ? ` (${résultat.refus.length} refus)` : '') +
        '.',
    )
    return NextResponse.json({ état: résultat.sorte, ...résultat }, { status: STATUT[résultat.sorte] })
  } catch (erreur) {
    console.error(`[veille/faits] ${lue.data.slug} : ${erreur instanceof Error ? erreur.message : String(erreur)}`)
    return NextResponse.json({ état: 'erreur' }, { status: 502 })
  }
}

export async function GET(requête: NextRequest): Promise<NextResponse> {
  const refus = refuserSiNonAutorisé(requête, 'faits')
  if (refus) return refus
  if (!baseConfigurée()) return NextResponse.json({ état: 'base-non-configurée' }, { status: 503 })

  const paramètres = requête.nextUrl.searchParams
  const slug = paramètres.get('slug') ?? ''
  const début = paramètres.get('debut') ?? ''
  const fin = paramètres.get('fin') ?? ''
  const dateValide = (d: string) => DATE.test(d) && !Number.isNaN(Date.parse(d))
  if (!SLUG.test(slug) || !dateValide(début) || !dateValide(fin) || début > fin) {
    return NextResponse.json({ état: 'invalide', raison: 'slug, debut et fin (AAAA-MM-JJ, debut ≤ fin) attendus' }, { status: 400 })
  }
  // Une fenêtre bornée : la revue lit un mois, un trimestre au plus, et chaque
  // édition de la fenêtre coûte une lecture de corps.
  if ((Date.parse(fin) - Date.parse(début)) / 86_400_000 > 100) {
    return NextResponse.json({ état: 'invalide', raison: 'fenêtre de plus de cent jours' }, { status: 400 })
  }

  try {
    const lecture = await lireLesFaits({ slug, début, fin })
    if (lecture.sorte !== 'lu') {
      return NextResponse.json({ état: lecture.sorte }, { status: lecture.sorte === 'hors-pilote' ? 200 : 404 })
    }
    return NextResponse.json({
      état: 'lu',
      organisation: slug,
      fenêtre: { début, fin },
      nombre: lecture.faits.length,
      titresIntrouvables: lecture.titresIntrouvables,
      faits: lecture.faits,
    })
  } catch (erreur) {
    console.error(`[veille/faits] ${slug} : ${erreur instanceof Error ? erreur.message : String(erreur)}`)
    return NextResponse.json({ état: 'erreur' }, { status: 502 })
  }
}
