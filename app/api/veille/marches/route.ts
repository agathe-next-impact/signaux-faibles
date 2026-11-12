import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { baseConfigurée } from '@/lib/base/client'
import type { SegmentDeMarché } from '@/lib/domaine/marches'
import type { Veille } from '@/lib/domaine/strategie'
import { refuserSiNonAutorisé } from '@/lib/portail/garde-veille'
import { lireLesMarchésDuPilote, mesurerLesMarchésDuPilote, publierLesMarchésDuPilote, recevoirLesSegments } from '@/lib/portail/marches'

/**
 * Marchés et niches d'une organisation du pilote (12 novembre 2026,
 * `docs/plan-marches-et-niches.md`, `docs/api-veille.md`).
 *
 *   POST /api/veille/marches
 *   Authorization: Bearer <ACTIVATION_SECRET>
 *   { "slug": "…", "segments": [{ "cle", "libelle", "parent": null | "<cle>",
 *       "cibles": { "sorte": "registre", "naf"?, "tranches"?, "departements"?, "collectivites"?, "libelle"? }
 *               | { "sorte": "declare", "nombre", "source" } | null,
 *       "offre": { "naf"?, "departements"?, "texte"? } | null,
 *       "depense": { "basse", "haute", "source" } | null,
 *       "entites": ["<nom de la grille>"], "presents": ["<concurrent de la grille>"] | null,
 *       "familles": [{ "veille", "numero" }] }] }
 *
 * L'arbre des segments : une racine (le marché), ses offres, leurs niches. La
 * même liste re-postée ne crée pas de version (`inchangée`). Refusée : 422 avec
 * les refus et le message de reprise.
 *
 *   GET /api/veille/marches?slug=…
 *
 * La dernière version, les périodes mesurées et leur état de publication, la
 * vue calculée sur toutes les mesures.
 *
 *   PATCH /api/veille/marches
 *   { "slug": "…", "periode": "2026-T4", "action": "mesurer" }
 *   { "slug": "…", "periode": "2026-T4", "etat": "publie" | "retire" | "propose" }
 *
 * `mesurer` : le portail compte et enregistre les mesures du trimestre, en
 * proposition ; une période publiée est refusée (409), la retirer d'abord.
 * `etat` : le geste de l'opératrice, rien n'est montré au client avant lui.
 */
export const maxDuration = 60

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const PÉRIODE = /^\d{4}-T[1-4]$/

// Des bornes de forme seulement, larges : celles du contrat sont dans la porte, qui les nomme.
const texte = (max: number) => z.string().trim().max(max)
const codes = z.array(texte(20)).max(60)
const segment = z.object({
  cle: texte(80),
  libelle: texte(200),
  parent: texte(80).nullable(),
  cibles: z
    .union([
      z.object({ sorte: z.literal('registre'), naf: codes.optional(), tranches: codes.optional(), departements: codes.optional(), collectivites: z.boolean().optional(), libelle: texte(200).optional() }),
      z.object({ sorte: z.literal('declare'), nombre: z.number(), source: texte(600), libelle: texte(200).optional() }),
    ])
    .nullish(),
  offre: z.object({ naf: codes.optional(), departements: codes.optional(), texte: texte(200).optional() }).nullish(),
  depense: z.object({ basse: z.number(), haute: z.number(), source: texte(600) }).nullish(),
  marches_publics: z.object({ cpv: codes }).nullish(),
  entites: z.array(texte(300)).max(200).optional(),
  presents: z.array(texte(300)).max(200).nullish(),
  familles: z.array(z.object({ veille: texte(40), numero: z.number().int().min(1).max(99) })).max(60).optional(),
})
const demande = z.object({ slug: z.string().trim().regex(SLUG), segments: z.array(segment).max(200) })
const geste = z.union([
  z.object({ slug: z.string().trim().regex(SLUG), periode: z.string().regex(PÉRIODE), action: z.literal('mesurer') }),
  z.object({ slug: z.string().trim().regex(SLUG), periode: z.string().regex(PÉRIODE), etat: z.enum(['publie', 'retire', 'propose']) }),
])

/** Le JSON de la route vers le type du domaine : les valeurs inconnues passent, la porte les nomme. */
function versLeDomaine(s: z.infer<typeof segment>): SegmentDeMarché {
  const c = s.cibles ?? null
  return {
    clé: s.cle,
    libellé: s.libelle,
    parent: s.parent,
    cibles:
      c === null
        ? null
        : c.sorte === 'declare'
          ? { sorte: 'declare', nombre: c.nombre, source: c.source, ...(c.libelle ? { libellé: c.libelle } : {}) }
          : {
              sorte: 'registre',
              ...(c.naf ? { naf: c.naf } : {}),
              ...(c.tranches ? { tranches: c.tranches } : {}),
              ...(c.departements ? { départements: c.departements } : {}),
              ...(c.collectivites === true ? { collectivités: true } : {}),
              ...(c.libelle ? { libellé: c.libelle } : {}),
            },
    offre: s.offre
      ? { ...(s.offre.naf ? { naf: s.offre.naf } : {}), ...(s.offre.departements ? { départements: s.offre.departements } : {}), ...(s.offre.texte !== undefined ? { texte: s.offre.texte } : {}) }
      : null,
    dépense: s.depense ?? null,
    ...(s.marches_publics ? { marchésPublics: { cpv: s.marches_publics.cpv } } : {}),
    entités: s.entites ?? [],
    présents: s.presents ?? null,
    familles: (s.familles ?? []).map((f) => ({ veille: f.veille as Veille, numéro: f.numero })),
  }
}

/** Le segment du domaine vers le JSON de la route, pour qu'une lecture se re-poste telle quelle. */
function versLeJson(s: SegmentDeMarché) {
  const c = s.cibles ?? null
  return {
    cle: s.clé,
    libelle: s.libellé,
    parent: s.parent,
    cibles:
      c === null
        ? null
        : c.sorte === 'declare'
          ? { sorte: 'declare', nombre: c.nombre, source: c.source, ...(c.libellé ? { libelle: c.libellé } : {}) }
          : { sorte: 'registre', ...(c.naf ? { naf: c.naf } : {}), ...(c.tranches ? { tranches: c.tranches } : {}), ...(c.départements ? { departements: c.départements } : {}), ...(c.collectivités ? { collectivites: true } : {}), ...(c.libellé ? { libelle: c.libellé } : {}) },
    offre: s.offre ? { ...(s.offre.naf ? { naf: s.offre.naf } : {}), ...(s.offre.départements ? { departements: s.offre.départements } : {}), ...(s.offre.texte !== undefined ? { texte: s.offre.texte } : {}) } : null,
    depense: s.dépense ?? null,
    ...(s.marchésPublics ? { marches_publics: { cpv: s.marchésPublics.cpv } } : {}),
    entites: s.entités ?? [],
    presents: s.présents ?? null,
    familles: (s.familles ?? []).map((f) => ({ veille: f.veille, numero: f.numéro })),
  }
}

function invalide(erreur: z.ZodError): NextResponse {
  const chemin = erreur.issues[0]?.path.join('.') ?? ''
  return NextResponse.json({ état: 'invalide', raison: chemin ? `champ « ${chemin} »` : 'corps illisible' }, { status: 400 })
}

const STATUT: Record<string, number> = {
  créée: 201,
  refusée: 422,
  'organisation-inconnue': 404,
  aucune: 404,
  'segments-absents': 404,
  'période-publiée': 409,
  'période-invalide': 400,
}

export async function POST(requête: NextRequest): Promise<NextResponse> {
  const refus = refuserSiNonAutorisé(requête, 'marches')
  if (refus) return refus
  if (!baseConfigurée()) return NextResponse.json({ état: 'base-non-configurée' }, { status: 503 })

  const lue = demande.safeParse(await requête.json().catch(() => null))
  if (!lue.success) return invalide(lue.error)

  try {
    const résultat = await recevoirLesSegments({ slug: lue.data.slug, segments: lue.data.segments.map(versLeDomaine) })
    console.info(`[veille/marches] ${lue.data.slug} : segments, ${résultat.sorte}${résultat.sorte === 'refusée' ? ` (${résultat.refus.length} refus)` : ''}.`)
    return NextResponse.json({ état: résultat.sorte, ...résultat }, { status: STATUT[résultat.sorte] ?? 200 })
  } catch (erreur) {
    console.error(`[veille/marches] ${lue.data.slug} : ${erreur instanceof Error ? erreur.message : String(erreur)}`)
    return NextResponse.json({ état: 'erreur' }, { status: 502 })
  }
}

export async function GET(requête: NextRequest): Promise<NextResponse> {
  const refus = refuserSiNonAutorisé(requête, 'marches')
  if (refus) return refus
  if (!baseConfigurée()) return NextResponse.json({ état: 'base-non-configurée' }, { status: 503 })

  const slug = requête.nextUrl.searchParams.get('slug') ?? ''
  if (!SLUG.test(slug)) return NextResponse.json({ état: 'invalide', raison: 'slug attendu' }, { status: 400 })

  try {
    const lecture = await lireLesMarchésDuPilote({ slug })
    if (lecture.sorte !== 'lus') return NextResponse.json({ état: lecture.sorte }, { status: lecture.sorte === 'organisation-inconnue' ? 404 : 200 })
    return NextResponse.json({
      état: 'lus',
      organisation: slug,
      version: lecture.version,
      grilleVersion: lecture.grilleVersion,
      segments: lecture.segments.map(versLeJson),
      périodes: lecture.périodes,
      vue: lecture.vue,
    })
  } catch (erreur) {
    console.error(`[veille/marches] ${slug} : ${erreur instanceof Error ? erreur.message : String(erreur)}`)
    return NextResponse.json({ état: 'erreur' }, { status: 502 })
  }
}

export async function PATCH(requête: NextRequest): Promise<NextResponse> {
  const refus = refuserSiNonAutorisé(requête, 'marches')
  if (refus) return refus
  if (!baseConfigurée()) return NextResponse.json({ état: 'base-non-configurée' }, { status: 503 })

  const lue = geste.safeParse(await requête.json().catch(() => null))
  if (!lue.success) return invalide(lue.error)

  try {
    const résultat =
      'action' in lue.data
        ? await mesurerLesMarchésDuPilote({ slug: lue.data.slug, période: lue.data.periode })
        : await publierLesMarchésDuPilote({ slug: lue.data.slug, période: lue.data.periode, état: lue.data.etat })
    console.info(`[veille/marches] ${lue.data.slug} ${lue.data.periode} : ${'action' in lue.data ? 'mesure' : `état ${lue.data.etat}`}, ${résultat.sorte}.`)
    return NextResponse.json({ état: résultat.sorte, ...résultat }, { status: STATUT[résultat.sorte] ?? 200 })
  } catch (erreur) {
    console.error(`[veille/marches] ${lue.data.slug} : ${erreur instanceof Error ? erreur.message : String(erreur)}`)
    return NextResponse.json({ état: 'erreur' }, { status: 502 })
  }
}
