import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { baseConfigurée } from '@/lib/base/client'
import type { SynthèseProposée } from '@/lib/domaine/strategie'
import { refuserSiNonAutorisé } from '@/lib/portail/garde-veille'
import { lireLaSynthèseDuPilote, recevoirLaSynthèse, type RésultatDeLaSynthèse } from '@/lib/portail/strategie'

/**
 * La synthèse stratégique d'une période (outils stratégiques, lot 6 de
 * `docs/plan-outils-strategiques.md`), postée par la revue mensuelle, section
 * « Synthèse stratégique ».
 *
 *   POST /api/veille/syntheses
 *   Authorization: Bearer <ACTIVATION_SECRET>
 *   { "slug", "periode": "2026-11", "fenetre": { "debut", "fin" }, "synthese": {
 *       "mode": "mensuel", "grilleVersion": 1,
 *       "pestel": [{ "lettre", "enonce" | null, "faits": [] }],
 *       "swot": [{ "id": "S1", "case", "enonce", "etat", "origine", "hypothese", "filiation", "faits", "referenceFiche" }],
 *       "casesInsuffisantes": [], "tows": [{ "type", "enonce", "elements": ["S1", "O2"], "candidate" }],
 *       "positions": [{ "outil", "sujet", "axe", "cran", "nonSuivi", "tendance", "faits" }],
 *       "scenarios": [], "interpretations": [] } }
 *
 * Les faits sont désignés par leur `id`, tel que `GET /api/veille/faits` le
 * rend. Une synthèse acceptée remplace celle de la même période. Refusée : 422
 * avec la liste des refus et le message de reprise, deux reprises au plus ; une
 * synthèse refusée ne bloque jamais la revue.
 *
 *   GET /api/veille/syntheses?slug=infralliance&periode=2026-11
 *
 * La synthèse vivante de la période, rendue en texte pour le courriel
 * « [Relecture] » de la revue. Rien n'est montré au client pendant le pilote.
 */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const DATE = /^\d{4}-\d{2}-\d{2}$/
const PÉRIODE = /^\d{4}-(?:0[1-9]|1[0-2]|T[1-4])$/

const texte = (max: number) => z.string().trim().max(max)
const ids = z.array(z.string().trim().max(64)).max(40)
const demande = z.object({
  slug: z.string().trim().regex(SLUG),
  periode: z.string().regex(PÉRIODE),
  fenetre: z.object({ debut: z.string().regex(DATE), fin: z.string().regex(DATE) }),
  synthese: z.object({
    mode: z.enum(['initial', 'mensuel', 'trimestriel']),
    grilleVersion: z.number().int().min(1),
    pestel: z.array(z.object({ lettre: texte(40), enonce: texte(600).nullable(), faits: ids })).max(12),
    swot: z
      .array(
        z.object({
          id: texte(20),
          case: texte(40),
          enonce: texte(600),
          etat: texte(40),
          origine: texte(40),
          hypothese: z.boolean(),
          filiation: z.string().trim().max(64).nullish(),
          faits: ids,
          referenceFiche: texte(200).nullish(),
        }),
      )
      .max(30),
    casesInsuffisantes: z.array(texte(40)).max(4).nullish(),
    tows: z.array(z.object({ type: texte(4), enonce: texte(600), elements: z.array(texte(20)).max(10), candidate: z.boolean() })).max(10),
    positions: z
      .array(
        z.object({
          outil: texte(20),
          sujet: texte(200),
          axe: texte(60),
          cran: z.number().int().nullable(),
          nonSuivi: z.boolean().nullish(),
          tendance: texte(20).nullish(),
          faits: ids,
        }),
      )
      .max(200),
    scenarios: z
      .array(
        z.object({
          titre: texte(200),
          enonce: texte(1000),
          indicateurs: z.array(z.object({ famille: z.number().int().min(1).max(99), signal: texte(300) })).max(8),
          faits: ids,
        }),
      )
      .max(6)
      .nullish(),
    interpretations: z.array(z.object({ outil: z.enum(['indice_cycle', 'benchmark']), enonce: texte(600) })).max(2).nullish(),
  }),
})

const STATUT: Record<RésultatDeLaSynthèse['sorte'], number> = {
  enregistrée: 201,
  refusée: 422,
  'hors-pilote': 200,
  'organisation-inconnue': 404,
  'grille-absente': 409,
  'grille-périmée': 409,
  'fait-inconnu': 422,
  'filiation-inconnue': 422,
  'référence-inconnue': 422,
}

/** Le JSON de la route vers le type du domaine : les valeurs inconnues passent, la porte les nomme. */
function versLeDomaine(s: z.infer<typeof demande>['synthese']): SynthèseProposée {
  type S = SynthèseProposée
  return {
    mode: s.mode,
    grilleVersion: s.grilleVersion,
    pestel: s.pestel.map((l) => ({ lettre: l.lettre as S['pestel'][number]['lettre'], énoncé: l.enonce, faits: l.faits })),
    swot: s.swot.map((é) => ({
      id: é.id,
      case: é.case as S['swot'][number]['case'],
      énoncé: é.enonce,
      état: é.etat as S['swot'][number]['état'],
      origine: é.origine as S['swot'][number]['origine'],
      hypothèse: é.hypothese,
      filiation: é.filiation ?? null,
      faits: é.faits,
      référenceFiche: é.referenceFiche ?? null,
    })),
    casesInsuffisantes: (s.casesInsuffisantes ?? []) as S['casesInsuffisantes'],
    tows: s.tows.map((o) => ({ type: o.type as S['tows'][number]['type'], énoncé: o.enonce, éléments: o.elements, candidate: o.candidate })),
    positions: s.positions.map((p) => ({
      outil: p.outil as S['positions'][number]['outil'],
      sujet: p.sujet,
      axe: p.axe,
      cran: p.cran,
      nonSuivi: p.nonSuivi ?? false,
      tendance: (p.tendance ?? null) as S['positions'][number]['tendance'],
      faits: p.faits,
    })),
    scénarios: (s.scenarios ?? []).map((x) => ({ titre: x.titre, énoncé: x.enonce, indicateurs: x.indicateurs, faits: x.faits })),
    interprétations: (s.interpretations ?? []).map((i) => ({ outil: i.outil, énoncé: i.enonce })),
  }
}

/** Une date du calendrier : `Date.parse` accepte le 30 février, l'aller-retour non. */
function jour(date: string): number {
  const t = Date.parse(`${date}T00:00:00Z`)
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === date ? t : Number.NaN
}

/** Une fenêtre réelle et bornée : un mois de parutions, un trimestre au plus. */
function fenêtreValide(début: string, fin: string): boolean {
  const d = jour(début)
  const f = jour(fin)
  return !Number.isNaN(d) && !Number.isNaN(f) && d <= f && (f - d) / 86_400_000 <= 100
}

export async function POST(requête: NextRequest): Promise<NextResponse> {
  const refus = refuserSiNonAutorisé(requête, 'syntheses')
  if (refus) return refus
  if (!baseConfigurée()) return NextResponse.json({ état: 'base-non-configurée' }, { status: 503 })

  const lue = demande.safeParse(await requête.json().catch(() => null))
  if (!lue.success) {
    const chemin = lue.error.issues[0]?.path.join('.') ?? ''
    return NextResponse.json({ état: 'invalide', raison: chemin ? `champ « ${chemin} »` : 'corps illisible' }, { status: 400 })
  }
  const { slug, periode, fenetre, synthese } = lue.data
  if (!fenêtreValide(fenetre.debut, fenetre.fin)) {
    return NextResponse.json({ état: 'invalide', raison: 'fenêtre : debut ≤ fin, cent jours au plus' }, { status: 400 })
  }
  if ((synthese.mode === 'trimestriel') !== periode.includes('-T')) {
    return NextResponse.json({ état: 'invalide', raison: 'période : AAAA-Tn pour un trimestre, AAAA-MM sinon' }, { status: 400 })
  }

  try {
    const résultat = await recevoirLaSynthèse({ slug, période: periode, fenêtre: { début: fenetre.debut, fin: fenetre.fin }, synthèse: versLeDomaine(synthese) })
    console.info(
      `[veille/syntheses] ${slug} ${periode} : ${résultat.sorte}` +
        (résultat.sorte === 'enregistrée' ? ` (${résultat.éléments} éléments, ${résultat.positions} positions)` : '') +
        (résultat.sorte === 'refusée' ? ` (${résultat.refus.length} refus)` : '') +
        '.',
    )
    return NextResponse.json({ état: résultat.sorte, ...résultat }, { status: STATUT[résultat.sorte] })
  } catch (erreur) {
    console.error(`[veille/syntheses] ${slug} : ${erreur instanceof Error ? erreur.message : String(erreur)}`)
    return NextResponse.json({ état: 'erreur' }, { status: 502 })
  }
}

export async function GET(requête: NextRequest): Promise<NextResponse> {
  const refus = refuserSiNonAutorisé(requête, 'syntheses')
  if (refus) return refus
  if (!baseConfigurée()) return NextResponse.json({ état: 'base-non-configurée' }, { status: 503 })

  const slug = requête.nextUrl.searchParams.get('slug') ?? ''
  const période = requête.nextUrl.searchParams.get('periode') ?? ''
  if (!SLUG.test(slug) || !PÉRIODE.test(période)) {
    return NextResponse.json({ état: 'invalide', raison: 'slug et periode (AAAA-MM ou AAAA-Tn) attendus' }, { status: 400 })
  }

  try {
    const lecture = await lireLaSynthèseDuPilote({ slug, période })
    if (lecture.sorte !== 'lue') {
      return NextResponse.json({ état: lecture.sorte }, { status: lecture.sorte === 'organisation-inconnue' ? 404 : 200 })
    }
    return NextResponse.json({ état: 'lue', organisation: slug, ...lecture })
  } catch (erreur) {
    console.error(`[veille/syntheses] ${slug} : ${erreur instanceof Error ? erreur.message : String(erreur)}`)
    return NextResponse.json({ état: 'erreur' }, { status: 502 })
  }
}
