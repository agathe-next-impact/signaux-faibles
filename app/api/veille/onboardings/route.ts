import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { refuserSiBaseIndisponible, refuserSiNonAutorisé } from '@/lib/portail/garde-veille'
import { lireUnOnboarding, recevoirUnDébut, recevoirUneFin, recevoirUnRapport, TÂCHES_SUIVIES } from '@/lib/portail/onboarding'

/**
 * Le suivi des onboardings (lot 1 de `docs/proposition-onboarding-admin.md`,
 * 1er novembre 2026). Appelée par le harnais des tâches, jamais par un
 * navigateur : début et fin d'un run, et le rapport de la tâche sur le registre.
 *
 *   POST /api/veille/onboardings
 *   Authorization: Bearer <ACTIVATION_SECRET>
 *
 *   { "evenement": "debut", "slug", "tache": "balayage" | "premiere-lettre",
 *     "plafondUsd": 30, "run": { "id": 123, "tentative": 1, "lien": "https://github.com/…" } | null,
 *     "lancement": "<uuid>" | null }
 *     `lancement` : la ligne réservée par le portail quand l'opératrice a lancé le
 *     run depuis son écran (lot 2), reçue par l'entrée du même nom du workflow.
 *     → 201 { état: "ouvert" | "déjà-ouvert", run: "<uuid>", budget, demande }
 *       `demande` : la demande enregistrée par le formulaire de l'opératrice
 *       (lot 3), tant que la ligne du registre n'est pas rapportée ; sinon null.
 *     → 409 { état: "budget-atteint", run, budget } quand le budget du mois
 *       (`ONBOARDING_BUDGET_MENSUEL_USD`) ne laisse pas la place du plafond du run.
 *       Le harnais s'arrête alors, sans ouvrir de session.
 *
 *   { "evenement": "fin", "slug", "run": "<uuid>", "issue": "reussi" | "echec", "coutUsd": 4.82 | null }
 *
 *   { "evenement": "rapport", "slug", "statut": 1..6?, "registre": "<32 hex>"?,
 *     "motif": "…" (300 caractères)?, "nom"?, "site"? }
 *     → 404 si aucun run n'a encore ouvert l'onboarding de ce slug.
 *     Avec `"executeur": "cowork"` (lot 4, commandes `/onboarding-*`) : l'onboarding
 *     est créé s'il manque (201 « créé »), ou rattaché à la demande Cowork du
 *     formulaire de même nom (200 « rattaché ») ; un onboarding existant garde
 *     son exécuteur.
 *
 *   GET /api/veille/onboardings?slug=<slug>
 *
 * L'onboarding du slug et ses dix derniers runs, sans adresse.
 *
 * 503 sans base, 409 en `SOURCE_ACCES=notion` (`refuserSiBaseIndisponible`) : le
 * harnais n'y voit qu'un suivi impossible, et le run part quand même.
 */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const slug = z.string().trim().max(80).regex(SLUG)

const début = z.object({
  evenement: z.literal('debut'),
  slug,
  tache: z.enum(['balayage', 'premiere-lettre']),
  plafondUsd: z.number().min(0).max(1_000),
  /** La réservation faite par le portail quand le run a été lancé depuis l'écran de l'opératrice (lot 2). */
  lancement: z.uuid().nullish(),
  run: z
    .object({
      id: z.number().int().positive(),
      tentative: z.number().int().min(1).max(100).nullish(),
      lien: z.string().max(400).regex(/^https:\/\/github\.com\//).nullish(),
    })
    .nullish(),
})

const fin = z.object({
  evenement: z.literal('fin'),
  slug,
  run: z.uuid(),
  issue: z.enum(['reussi', 'echec']),
  coutUsd: z.number().min(0).max(10_000).nullish(),
})

const rapport = z
  .object({
    evenement: z.literal('rapport'),
    slug,
    statut: z.number().int().min(1).max(6).nullish(),
    registre: z
      .string()
      .trim()
      .transform((v) => v.replaceAll('-', '').toLowerCase())
      .pipe(z.string().regex(/^[0-9a-f]{32}$/))
      .nullish(),
    motif: z.string().trim().min(1).max(300).nullish(),
    nom: z.string().trim().min(1).max(200).nullish(),
    site: z.url().max(500).nullish(),
    /** `cowork` : rapport d'une commande `/onboarding-*` (lot 4), qui crée ou rattache l'onboarding s'il manque. */
    executeur: z.literal('cowork').nullish(),
  })
  .refine((r) => r.statut != null || r.registre != null || r.motif != null || r.nom != null || r.site != null, { message: 'rapport vide' })

const demande = z.union([début, fin, rapport])

export async function POST(requête: NextRequest): Promise<NextResponse> {
  const refus = refuserSiNonAutorisé(requête, 'onboardings')
  if (refus) return refus
  const indisponible = refuserSiBaseIndisponible()
  if (indisponible) return indisponible

  const lue = demande.safeParse(await requête.json().catch(() => null))
  if (!lue.success) {
    const chemin = lue.error.issues[0]?.path.join('.') ?? ''
    return NextResponse.json({ état: 'invalide', raison: chemin ? `champ « ${chemin} »` : (lue.error.issues[0]?.message ?? 'corps illisible') }, { status: 400 })
  }
  const d = lue.data
  try {
    switch (d.evenement) {
      case 'debut': {
        const r = await recevoirUnDébut({
          slug: d.slug,
          tâche: TÂCHES_SUIVIES[d.tache]!,
          runGithub: d.run?.id ?? null,
          tentative: d.run?.tentative ?? null,
          lien: d.run?.lien ?? null,
          plafondUsd: d.plafondUsd,
          lancement: d.lancement ?? null,
        })
        console.info(`[veille/onboardings] ${d.slug} : début de ${d.tache}, ${r.sorte} (budget ${r.budget.sorte}, ${r.budget.dépenséUsd} $ ce mois).`)
        // Un état propre au budget : le 409 de `SOURCE_ACCES=notion` dit « refusé », et le harnais ne doit pas les confondre.
        if (r.sorte === 'refusé') return NextResponse.json({ état: 'budget-atteint', run: r.runId, budget: r.budget }, { status: 409 })
        return NextResponse.json({ état: r.sorte, run: r.runId, budget: r.budget, demande: r.demande }, { status: 201 })
      }
      case 'fin': {
        const r = await recevoirUneFin({ slug: d.slug, runId: d.run, issue: d.issue, coûtUsd: d.coutUsd ?? null })
        console.info(`[veille/onboardings] ${d.slug} : fin du run ${d.run}, ${d.issue}, ${r}.`)
        return NextResponse.json({ état: r }, { status: r === 'inconnu' ? 404 : 200 })
      }
      case 'rapport': {
        const r = await recevoirUnRapport({
          slug: d.slug,
          statut: d.statut ?? null,
          registre: d.registre ?? null,
          motif: d.motif ?? null,
          nom: d.nom ?? null,
          site: d.site ?? null,
          exécuteur: d.executeur ?? null,
        })
        console.info(`[veille/onboardings] ${d.slug} : rapport${d.statut ? `, statut ${d.statut}` : ''}${d.motif ? ', bloqué' : ''}, ${r}.`)
        return NextResponse.json({ état: r }, { status: r === 'inconnu' ? 404 : r === 'créé' ? 201 : 200 })
      }
    }
  } catch (erreur) {
    console.error(`[veille/onboardings] ${d.slug} : ${erreur instanceof Error ? erreur.message : String(erreur)}`)
    return NextResponse.json({ état: 'erreur' }, { status: 502 })
  }
}

export async function GET(requête: NextRequest): Promise<NextResponse> {
  const refus = refuserSiNonAutorisé(requête, 'onboardings')
  if (refus) return refus
  const indisponible = refuserSiBaseIndisponible()
  if (indisponible) return indisponible

  const lu = slug.safeParse(requête.nextUrl.searchParams.get('slug') ?? '')
  if (!lu.success) return NextResponse.json({ état: 'invalide', raison: 'slug attendu' }, { status: 400 })
  try {
    const onboarding = await lireUnOnboarding(lu.data)
    if (!onboarding) return NextResponse.json({ état: 'inconnu' }, { status: 404 })
    return NextResponse.json({ état: 'lu', onboarding })
  } catch (erreur) {
    console.error(`[veille/onboardings] ${lu.data} : ${erreur instanceof Error ? erreur.message : String(erreur)}`)
    return NextResponse.json({ état: 'erreur' }, { status: 502 })
  }
}
