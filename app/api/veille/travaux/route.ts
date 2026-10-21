import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { aujourdHuiÀParis } from '@/lib/domaine/calendrier'
import { lireLaFile, planifierLaFile, poserUnTravail, prendreUnTravail } from '@/lib/portail/file'
import { refuserSiBaseIndisponible, refuserSiNonAutorisé } from '@/lib/portail/garde-veille'

/**
 * La file de travaux (palier 2, 21 octobre 2026) : ce que le portail a décidé
 * de faire faire, lu et pris par l'exécuteur, posé par l'opératrice.
 *
 *   GET /api/veille/travaux                → l'état de la file
 *   GET /api/veille/travaux?planifier=1    → planifie la semaine qui vient, puis l'état
 *   Authorization: Bearer <ACTIVATION_SECRET ou CRON_SECRET>
 *
 * La planification est aussi faite chaque matin par `GET /api/veille/parcours`,
 * le passage quotidien ; ici, elle sert à ne pas attendre le lendemain.
 *
 *   POST /api/veille/travaux
 *   { "action": "prendre", "session": "<identifiant de la session>" }
 *     → 200 `pris` avec le travail et son contexte Notion, ou 200 `vide`.
 *       Le travail est réservé à cette session ; c'est elle qui devra poster
 *       le résultat (`POST /api/veille/resultat`). Un travail pris et jamais
 *       conclu revient dans la file après trois heures.
 *   { "action": "poser", "slug", "veille": "ecosysteme", "type": "lettre" | "premiere_lettre", "parution": "AAAA-MM-JJ" }
 *     → 201 `créé`, 200 `déjà-en-file`, 404 `organisation-inconnue` | `veille-inconnue`.
 *
 * Le modèle ne choisit pas son travail : la file lui donne le plus ancien dont
 * l'échéance est passée.
 */
const demande = z.discriminatedUnion('action', [
  z.object({ action: z.literal('prendre'), session: z.string().trim().min(1).max(200) }),
  z.object({
    action: z.literal('poser'),
    slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    veille: z.string().trim().regex(/^[a-z_]+$/),
    type: z.enum(['lettre', 'premiere_lettre']),
    parution: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
])

const STATUT_DE_LA_POSE: Record<string, number> = {
  créé: 201,
  'déjà-en-file': 200,
  'organisation-inconnue': 404,
  'veille-inconnue': 404,
}

export async function GET(requête: NextRequest): Promise<NextResponse> {
  const refus = refuserSiNonAutorisé(requête, 'travaux')
  if (refus) return refus
  const indisponible = refuserSiBaseIndisponible()
  if (indisponible) return indisponible

  const planifier =
    requête.nextUrl.searchParams.get('planifier') === '1' || requête.headers.get('x-vercel-cron-schedule') !== null

  try {
    const planification = planifier ? await planifierLaFile({ aujourdHui: aujourdHuiÀParis() }) : null
    if (planification) {
      console.info(`[veille/travaux] planification : ${planification.planifiés} posé(s), ${planification.déjàEnFile} déjà en file.`)
    }
    const file = await lireLaFile()
    return NextResponse.json({ état: 'lu', ...file, ...(planification ? { planification } : {}) })
  } catch (erreur) {
    console.error(`[veille/travaux] lecture : ${erreur instanceof Error ? erreur.message : String(erreur)}`)
    return NextResponse.json({ état: 'échec' }, { status: 502 })
  }
}

export async function POST(requête: NextRequest): Promise<NextResponse> {
  const refus = refuserSiNonAutorisé(requête, 'travaux')
  if (refus) return refus
  const indisponible = refuserSiBaseIndisponible()
  if (indisponible) return indisponible

  const lue = demande.safeParse(await requête.json().catch(() => null))
  if (!lue.success) return NextResponse.json({ état: 'invalide' }, { status: 400 })

  try {
    if (lue.data.action === 'prendre') {
      const pris = await prendreUnTravail({ session: lue.data.session })
      if (!pris) return NextResponse.json({ état: 'vide' })
      console.info(
        `[veille/travaux] ${pris.travail.organisation.slug} / ${pris.travail.type} pris (tentative ${pris.travail.tentatives}).`,
      )
      return NextResponse.json({ état: 'pris', ...pris })
    }

    const résultat = await poserUnTravail({
      slug: lue.data.slug,
      veille: lue.data.veille,
      type: lue.data.type,
      dateDeParution: lue.data.parution,
    })
    console.info(`[veille/travaux] ${lue.data.slug} / ${lue.data.veille} : ${résultat.sorte}.`)
    const { sorte, ...reste } = résultat
    return NextResponse.json({ état: sorte, ...reste }, { status: STATUT_DE_LA_POSE[sorte] ?? 200 })
  } catch (erreur) {
    console.error(`[veille/travaux] ${lue.data.action} : ${erreur instanceof Error ? erreur.message : String(erreur)}`)
    return NextResponse.json({ état: 'échec' }, { status: 502 })
  }
}
