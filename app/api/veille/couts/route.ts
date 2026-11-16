import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { estUnMois, moisDeParis, slugsDUnRun } from '@/lib/domaine/couts'
import { coûtsDuMois, recevoirUnCoût } from '@/lib/portail/couts'
import { refuserSiBaseIndisponible, refuserSiNonAutorisé } from '@/lib/portail/garde-veille'

/**
 * Le coût des runs (16 novembre 2026).
 *
 *   POST /api/veille/couts            ← le harnais, en fin de run
 *     { "mesure": { "tâche": "lettres", "organisation": null, "date": "2026-11-16T04:00:02.000Z",
 *                   "issue": "success", "duréeMs": 1820000, "tours": 212,
 *                   "coûtTotalUsd": 18.42, "plafondUsd": 60,
 *                   "parModèle": { … }, "organisationsTraitées": ["hermitage", "mastora"] },
 *       "run": { "id": 43828102333, "tentative": 1, "lien": "https://github.com/…/actions/runs/43828102333" } }
 *   GET  /api/veille/couts?mois=2026-11   → les totaux du mois, par tâche et par organisation
 *   Authorization: Bearer <ACTIVATION_SECRET>
 *
 * `mesure` est le contenu de `mesure.json`, tel que le harnais l'a écrit : le
 * coût vient du SDK (`total_cost_usd`), le portail ne recalcule rien. Un même
 * run GitHub n'est enregistré qu'une fois (`déjà-enregistré`). Ni adresse ni
 * texte : des chiffres et des slugs.
 *
 * `--organisation` accepte un slug ou un nom : la route ramène chaque valeur à
 * un slug (`slugsDUnRun`) plutôt que de refuser la mesure, parce qu'une dépense
 * mal étiquetée vaut mieux qu'une dépense perdue. Un nom qui ne donne pas le
 * slug d'une organisation s'affiche « pas encore dans le portail ».
 *
 * Le modèle n'appelle jamais cette route : l'outil `appeler_portail` du harnais
 * la refuse (`scripts/taches/outils.ts`), sans quoi une tâche pourrait écrire
 * son propre coût.
 */
const corps = z.object({
  mesure: z.object({
    tâche: z.string().regex(/^[a-z][a-z_-]{1,39}$/),
    organisation: z.string().max(120).nullable(),
    date: z.string().datetime(),
    issue: z.string().min(1).max(60),
    duréeMs: z.number().int().min(0).max(86_400_000).optional(),
    tours: z.number().int().min(0).max(100_000).optional(),
    coûtTotalUsd: z.number().min(0).max(10_000),
    plafondUsd: z.number().min(0).max(10_000).nullable().optional(),
    parModèle: z.record(z.string().max(80), z.unknown()).optional(),
    organisationsTraitées: z.array(z.string().max(120)).max(300).default([]),
  }),
  run: z
    .object({
      id: z.number().int().positive(),
      tentative: z.number().int().positive().max(1000).nullable(),
      lien: z.string().regex(/^https:\/\/github\.com\//).max(300).nullable(),
    })
    .nullable()
    .optional(),
})

/** L'usage par modèle ne sert qu'à relire un run : au-delà de cette taille, il n'est pas gardé. */
const PAR_MODÈLE_MAX = 8_000

export async function POST(requête: NextRequest): Promise<NextResponse> {
  const refus = refuserSiNonAutorisé(requête, 'couts')
  if (refus) return refus
  const indisponible = refuserSiBaseIndisponible()
  if (indisponible) return indisponible

  const lu = corps.safeParse(await requête.json().catch(() => null))
  if (!lu.success) {
    return NextResponse.json(
      { état: 'refusée', raison: lu.error.issues.map((i) => `${i.path.join('.')} : ${i.message}`).join(' ; ') },
      { status: 400 },
    )
  }
  const { mesure, run } = lu.data
  const parModèle = mesure.parModèle && JSON.stringify(mesure.parModèle).length <= PAR_MODÈLE_MAX ? mesure.parModèle : null
  const organisation = mesure.organisation === null ? null : (slugsDUnRun([mesure.organisation])[0] ?? null)

  try {
    const { sorte } = await recevoirUnCoût({
      tâche: mesure.tâche,
      organisation,
      organisations: slugsDUnRun(mesure.organisationsTraitées),
      issue: mesure.issue,
      coûtUsd: mesure.coûtTotalUsd,
      plafondUsd: mesure.plafondUsd ?? null,
      duréeMs: mesure.duréeMs ?? null,
      tours: mesure.tours ?? null,
      parModèle,
      run: run ?? null,
      mesuréLe: new Date(mesure.date),
    })
    console.info(`[veille/couts] ${mesure.tâche}${organisation ? ` (${organisation})` : ''} : ${mesure.coûtTotalUsd.toFixed(2)} $, ${sorte}.`)
    return NextResponse.json({ état: sorte }, { status: sorte === 'enregistré' ? 201 : 200 })
  } catch (erreur) {
    console.error(`[veille/couts] ${mesure.tâche} : ${erreur instanceof Error ? erreur.message : String(erreur)}`)
    return NextResponse.json({ état: 'échec' }, { status: 502 })
  }
}

export async function GET(requête: NextRequest): Promise<NextResponse> {
  const refus = refuserSiNonAutorisé(requête, 'couts')
  if (refus) return refus
  const indisponible = refuserSiBaseIndisponible()
  if (indisponible) return indisponible

  const demandé = requête.nextUrl.searchParams.get('mois')
  if (demandé !== null && !estUnMois(demandé)) {
    return NextResponse.json({ état: 'refusée', raison: 'mois attendu au format AAAA-MM' }, { status: 400 })
  }
  try {
    const { mois, runs, totaux, noms } = await coûtsDuMois(demandé ?? moisDeParis(new Date()))
    return NextResponse.json({ état: 'lu', mois, runs: runs.length, totaux, noms })
  } catch (erreur) {
    console.error(`[veille/couts] lecture : ${erreur instanceof Error ? erreur.message : String(erreur)}`)
    return NextResponse.json({ état: 'échec' }, { status: 502 })
  }
}
