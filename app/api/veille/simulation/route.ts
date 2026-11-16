import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { baseConfigurée } from '@/lib/base/client'
import type { Condition, Effets, LigneDAction, LigneDeCarte, TableDEffets } from '@/lib/domaine/simulation'
import { refuserSiNonAutorisé } from '@/lib/portail/garde-veille'
import { lireLaTableDuPilote, publierLaTableDuPilote, recevoirLaTableDEffets } from '@/lib/portail/simulation'

/**
 * La table d'effets de la simulation d'une organisation du pilote (16 novembre
 * 2026, lot 3b des simulations de scénarios, `docs/table-d-effets.md`,
 * `docs/api-veille.md`).
 *
 *   POST /api/veille/simulation
 *   Authorization: Bearer <ACTIVATION_SECRET>
 *   { "slug": "…",
 *     "engagements": [{ "segment": "<clé de l'arbre>", "cran": 0-3, "reference": "…" }],
 *     "actions": [{ "cle", "libelle", "geste": "investir" | "tester" | "retirer" | "allier" | "option",
 *       "segment"?, "partie_prenante"?, "cout": 1-3, "effets": { "marche"?, "concurrence"?, "environnement"?, "alliances"? },
 *       "condition"?: { "sur": "engagement" | "concurrents" | "pilier", "segment"?, "pilier"?, "comparaison": "au-moins" | "au-plus", "valeur" },
 *       "effets_sous_condition"?, "reference": "…" }],
 *     "cartes": [{ "cle", "libelle", "famille"?, "veille"?, "cadre"?, "rupture"?, "effets", "condition"?, "effets_sous_condition"?, "reference" }] }
 *
 * Des hypothèses, écrites par la revue trimestrielle. La même table re-postée
 * ne crée pas de version (`inchangée`). Refusée : 422 avec les refus et le
 * message de reprise. Une version créée est **proposée**, jamais publiée
 * d'office : aucune fréquence ni aucun état de départ ne vient de l'appelant,
 * le portail les compte.
 *
 *   GET /api/veille/simulation?slug=…
 *
 * Les versions, la dernière table et ce que la porte en dit aujourd'hui.
 *
 *   PATCH /api/veille/simulation
 *   { "slug": "…", "version": 2, "etat": "publie" | "retire" | "propose" }
 *
 * Le geste de l'opératrice : publier une version ouvre l'écran « Simulation »
 * au client et retire la version publiée avant elle.
 */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

// Des bornes de forme seulement, larges : celles du contrat sont dans la porte, qui les nomme.
const texte = (max: number) => z.string().trim().max(max)
const effets = z.record(z.string().max(40), z.number())
const condition = z.object({ sur: texte(40), segment: texte(80).nullish(), pilier: texte(40).nullish(), comparaison: texte(40), valeur: z.number() })
const ligne = { cle: texte(80), libelle: texte(200), effets, condition: condition.nullish(), effets_sous_condition: effets.nullish(), reference: texte(400) }
const action = z.object({ ...ligne, geste: texte(40), segment: texte(80).nullish(), partie_prenante: texte(300).nullish(), cout: z.number() })
const carte = z.object({ ...ligne, famille: z.number().int().min(1).max(99).nullish(), veille: texte(40).nullish(), cadre: texte(40).nullish(), rupture: z.boolean().nullish() })
const demande = z.object({
  slug: z.string().trim().regex(SLUG),
  engagements: z.array(z.object({ segment: texte(80), cran: z.number(), reference: texte(400) })).max(200).default([]),
  actions: z.array(action).max(200),
  cartes: z.array(carte).max(200),
})
const geste = z.object({ slug: z.string().trim().regex(SLUG), version: z.number().int().min(1), etat: z.enum(['publie', 'retire', 'propose']) })

/** Le JSON de la route vers le type du domaine : les valeurs inconnues passent, la porte les nomme. */
const versLaCondition = (c: z.infer<typeof condition> | null | undefined): Condition | null =>
  c ? ({ sur: c.sur, segment: c.segment ?? null, pilier: c.pilier ?? null, comparaison: c.comparaison, valeur: c.valeur } as unknown as Condition) : null
const commune = (l: z.infer<typeof action> | z.infer<typeof carte>) => ({
  clé: l.cle,
  libellé: l.libelle,
  effets: l.effets as Effets,
  condition: versLaCondition(l.condition),
  effetsSousCondition: (l.effets_sous_condition ?? null) as Effets | null,
  référence: l.reference,
})
function versLeDomaine(d: z.infer<typeof demande>): TableDEffets {
  return {
    engagements: d.engagements.map((e) => ({ segment: e.segment, cran: e.cran, référence: e.reference })),
    actions: d.actions.map((a) => ({ ...commune(a), geste: a.geste, segment: a.segment ?? null, partiePrenante: a.partie_prenante ?? null, coût: a.cout }) as unknown as LigneDAction),
    cartes: d.cartes.map((c) => ({ ...commune(c), famille: c.famille ?? null, veille: c.veille ?? null, cadre: c.cadre ?? null, rupture: c.rupture ?? null }) as unknown as LigneDeCarte),
  }
}

function invalide(erreur: z.ZodError): NextResponse {
  const chemin = erreur.issues[0]?.path.join('.') ?? ''
  return NextResponse.json({ état: 'invalide', raison: chemin ? `champ « ${chemin} »` : 'corps illisible' }, { status: 400 })
}

const STATUT: Record<string, number> = { créée: 201, refusée: 422, 'organisation-inconnue': 404, aucune: 404, 'arbre-absent': 404, 'grille-absente': 404 }

export async function POST(requête: NextRequest): Promise<NextResponse> {
  const refus = refuserSiNonAutorisé(requête, 'simulation')
  if (refus) return refus
  if (!baseConfigurée()) return NextResponse.json({ état: 'base-non-configurée' }, { status: 503 })

  const lue = demande.safeParse(await requête.json().catch(() => null))
  if (!lue.success) return invalide(lue.error)

  try {
    const résultat = await recevoirLaTableDEffets({ slug: lue.data.slug, table: versLeDomaine(lue.data) })
    console.info(`[veille/simulation] ${lue.data.slug} : table d’effets, ${résultat.sorte}${résultat.sorte === 'refusée' ? ` (${résultat.refus.length} refus)` : ''}.`)
    return NextResponse.json({ état: résultat.sorte, ...résultat }, { status: STATUT[résultat.sorte] ?? 200 })
  } catch (erreur) {
    console.error(`[veille/simulation] ${lue.data.slug} : ${erreur instanceof Error ? erreur.message : String(erreur)}`)
    return NextResponse.json({ état: 'erreur' }, { status: 502 })
  }
}

export async function GET(requête: NextRequest): Promise<NextResponse> {
  const refus = refuserSiNonAutorisé(requête, 'simulation')
  if (refus) return refus
  if (!baseConfigurée()) return NextResponse.json({ état: 'base-non-configurée' }, { status: 503 })

  const slug = requête.nextUrl.searchParams.get('slug') ?? ''
  if (!SLUG.test(slug)) return NextResponse.json({ état: 'invalide', raison: 'slug attendu' }, { status: 400 })

  try {
    const lecture = await lireLaTableDuPilote({ slug })
    return NextResponse.json({ état: lecture.sorte, organisation: slug, ...lecture }, { status: STATUT[lecture.sorte] ?? 200 })
  } catch (erreur) {
    console.error(`[veille/simulation] ${slug} : ${erreur instanceof Error ? erreur.message : String(erreur)}`)
    return NextResponse.json({ état: 'erreur' }, { status: 502 })
  }
}

export async function PATCH(requête: NextRequest): Promise<NextResponse> {
  const refus = refuserSiNonAutorisé(requête, 'simulation')
  if (refus) return refus
  if (!baseConfigurée()) return NextResponse.json({ état: 'base-non-configurée' }, { status: 503 })

  const lue = geste.safeParse(await requête.json().catch(() => null))
  if (!lue.success) return invalide(lue.error)

  try {
    const résultat = await publierLaTableDuPilote({ slug: lue.data.slug, version: lue.data.version, état: lue.data.etat })
    console.info(`[veille/simulation] ${lue.data.slug} v${lue.data.version} : état ${lue.data.etat}, ${résultat.sorte}.`)
    return NextResponse.json({ état: résultat.sorte, ...résultat }, { status: STATUT[résultat.sorte] ?? 200 })
  } catch (erreur) {
    console.error(`[veille/simulation] ${lue.data.slug} : ${erreur instanceof Error ? erreur.message : String(erreur)}`)
    return NextResponse.json({ état: 'erreur' }, { status: 502 })
  }
}
