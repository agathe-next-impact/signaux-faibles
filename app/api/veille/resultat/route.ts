import { revalidateTag } from 'next/cache'
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { recevoirUnRésultat, type RéceptionDuRésultat } from '@/lib/portail/file'
import {
  identifiantAvecTirets,
  identifiantNotionValide,
  refuserSiBaseIndisponible,
  refuserSiNonAutorisé,
} from '@/lib/portail/garde-veille'

/**
 * Le résultat d'un travail de la file (palier 2, 21 octobre 2026).
 *
 *   POST /api/veille/resultat
 *   Authorization: Bearer <ACTIVATION_SECRET>
 *   { "travail": "<uuid>", "session": "<la session qui l'a pris>",
 *     "page": "<page_id de l'édition, en Brouillon>",
 *     "exécuteur": "cowork:<session>" | "api:<modèle>",
 *     "début": "<ISO>", "fin": "<ISO>", "résultat": { … }, "coût": { … } }
 *
 * Le résultat d'une lettre est la page Notion que l'exécuteur a écrite. Le
 * portail la relit et la passe par les mêmes portes que `/api/veille/lint`,
 * plus trois qu'il est seul à pouvoir tenir : la page appartient à
 * l'organisation du travail, porte la famille attendue et le numéro attribué.
 *
 *   200 `accepté` : le numéro est écrit, le travail est conclu ;
 *   200 `refusé` : le rapport dit pourquoi, le travail est à reprendre
 *                  (une nouvelle prise, puis un nouveau résultat) ;
 *   200 `abandonné` : troisième refus, le contrôle du soir le signale ;
 *   404 `inconnu`, 409 `pas-pris` (`état`), 409 `autre-session`.
 *
 * **Le tag de la page est expiré avant la lecture**, comme pour le validateur :
 * la page vient d'être écrite. C'est un pouvoir d'invalidation, tenu derrière
 * le jeton ; `tests/architecture.test.ts` en tient la liste.
 */
const demande = z.object({
  travail: z.string().uuid(),
  session: z.string().trim().min(1).max(200),
  page: z.string().trim().refine(identifiantNotionValide),
  exécuteur: z.string().trim().min(1).max(200).optional(),
  début: z.string().datetime({ offset: true }).optional(),
  fin: z.string().datetime({ offset: true }).optional(),
  résultat: z.record(z.string(), z.unknown()).optional(),
  coût: z.record(z.string(), z.unknown()).optional(),
})

const STATUT: Record<RéceptionDuRésultat['sorte'], number> = {
  accepté: 200,
  refusé: 200,
  abandonné: 200,
  inconnu: 404,
  'pas-pris': 409,
  'autre-session': 409,
}

export async function POST(requête: NextRequest): Promise<NextResponse> {
  const refus = refuserSiNonAutorisé(requête, 'resultat')
  if (refus) return refus
  const indisponible = refuserSiBaseIndisponible()
  if (indisponible) return indisponible

  const lue = demande.safeParse(await requête.json().catch(() => null))
  if (!lue.success) return NextResponse.json({ état: 'invalide' }, { status: 400 })
  const { travail, session, page, exécuteur, début, fin, résultat, coût } = lue.data
  const pageId = identifiantAvecTirets(page)

  try {
    revalidateTag(`page:${pageId}`, { expire: 0 })

    const réception = await recevoirUnRésultat({
      travailId: travail,
      session,
      page: pageId,
      exécuteur: exécuteur ?? `cowork:${session}`,
      début: début ? new Date(début) : null,
      fin: fin ? new Date(fin) : null,
      résultat,
      coût,
    })

    if (réception.sorte === 'inconnu' || réception.sorte === 'autre-session') {
      console.warn(`[veille/resultat] ${travail} : ${réception.sorte}.`)
      return NextResponse.json({ état: réception.sorte }, { status: STATUT[réception.sorte] })
    }
    if (réception.sorte === 'pas-pris') {
      console.warn(`[veille/resultat] ${travail} : pas pris (${réception.état}).`)
      return NextResponse.json({ état: 'pas-pris', étatDuTravail: réception.état }, { status: STATUT['pas-pris'] })
    }

    const { portes } = réception
    console.info(
      `[veille/resultat] ${travail} (${pageId}) : ${réception.sorte}, ` +
        `${portes.portail.length} porte(s) du portail, ${portes.ruptures.length} rupture(s), ${portes.avertissements.length} avertissement(s).`,
    )
    return NextResponse.json({
      état: réception.sorte,
      page: pageId,
      conforme: réception.sorte === 'accepté',
      portes: portes.portail,
      ruptures: portes.ruptures,
      avertissements: portes.avertissements,
      aperçu: réception.aperçu,
      tentatives: réception.conclusion.sorte === 'accepté' ? undefined : réception.conclusion.tentatives,
      numéro: réception.conclusion.sorte === 'accepté' ? réception.conclusion.numéro : undefined,
    })
  } catch (erreur) {
    console.error(`[veille/resultat] ${travail} : ${erreur instanceof Error ? erreur.message : String(erreur)}`)
    return NextResponse.json({ état: 'échec' }, { status: 502 })
  }
}
