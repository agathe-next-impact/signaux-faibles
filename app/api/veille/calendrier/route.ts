import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import {
  CADENCES,
  JOURS,
  aujourdHuiÀParis,
  sélectionner,
} from '@/lib/domaine/calendrier'
import { estUneDateISO } from '@/lib/domaine/semaines'
import { refuserSiNonAutorisé } from '@/lib/portail/garde-veille'

/**
 * La sélection du jour.
 *
 *   POST /api/veille/calendrier
 *   Authorization: Bearer <ACTIVATION_SECRET>
 *   { "date": "2026-09-17",            ← facultatif, aujourd'hui à Paris sinon
 *     "organisations": [ { "slug": "hermitage", "jour": "Lundi",
 *                          "cadence": "Hebdomadaire", "heure": "6 h 30" }, … ] }
 *
 * Le portail ne lit pas le registre : la tâche lui **donne** les lignes de la
 * vue « Veilles actives » telles qu'elle les a lues, et reçoit la datation, les
 * parutions du jour dans l'ordre de traitement, les revues dues ce soir et la
 * prochaine parution de chacun. Le modèle ne calcule plus ni jour, ni
 * quantième, ni semaine ISO.
 */
const schéma = z.object({
  date: z.string().optional(),
  organisations: z
    .array(
      z.object({
        slug: z.string().min(1),
        jour: z.enum(JOURS),
        cadence: z.enum(CADENCES),
        heure: z.string().optional(),
      }),
    )
    .max(200),
})

export async function POST(requête: NextRequest): Promise<NextResponse> {
  const refus = refuserSiNonAutorisé(requête, 'calendrier')
  if (refus) return refus

  let charge: unknown
  try {
    charge = await requête.json()
  } catch {
    return NextResponse.json({ état: 'refusée', raison: 'corps illisible' }, { status: 400 })
  }

  const lecture = schéma.safeParse(charge)
  if (!lecture.success) {
    return NextResponse.json(
      {
        état: 'refusée',
        raison: lecture.error.issues.map((i) => `${i.path.join('.')} — ${i.message}`).join(' ; '),
        attendu: { jours: JOURS, cadences: CADENCES },
      },
      { status: 400 },
    )
  }

  const date = lecture.data.date ?? aujourdHuiÀParis()
  if (!estUneDateISO(date)) {
    return NextResponse.json({ état: 'refusée', raison: `date inexploitable : « ${date} »` }, { status: 400 })
  }

  const sélection = sélectionner(lecture.data.organisations, date)

  return NextResponse.json({
    état: 'calculée',
    fuseau: 'Europe/Paris',
    ...sélection,
    parutions: sélection.parutions.map((o) => o.slug),
    revuesDues: sélection.revuesDues.map((o) => o.slug),
  })
}
