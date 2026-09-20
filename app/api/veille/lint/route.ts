import { revalidateTag } from 'next/cache'
import { NextResponse, type NextRequest } from 'next/server'
import { lireBlocsDePage } from '@/lib/notion/editions'
import { lireÉditionDeTravail } from '@/lib/notion/travail'
import { identifiantAvecTirets, identifiantNotionValide, refuserSiNonAutorisé } from '@/lib/portail/garde-veille'
import { contrôlerLaLettre } from '@/lib/portail/lint'

/**
 * Valider une lettre avant l'envoi.
 *
 *   POST /api/veille/lint
 *   Authorization: Bearer <ACTIVATION_SECRET>
 *   { "page": "<page_id de l'édition, même en Brouillon>" }
 *
 * La tâche des lettres crée la page, appelle cette route, corrige tant que
 * `conforme` est faux, puis seulement envoie le brouillon au relecteur. Le
 * rapport dit ce que le portail affichera — axes, dossiers, cadrage — parce
 * qu'il sort du parseur de production (`lib/portail/lint.ts`).
 *
 * **Le tag de la page est expiré avant la lecture.** La page vient d'être écrite
 * ou corrigée ; servir la version en cache renverrait le rapport de la version
 * d'avant, et la tâche corrigerait dans le vide. C'est un pouvoir d'invalidation
 * de plus, tenu comme les trois autres derrière une vérification : le jeton.
 * `revalidateTag(…, { expire: 0 })` et non `updateTag` : ce dernier n'est
 * permis que dans une action serveur, et lèverait ici.
 *
 * L'identifiant est recomposé **avec tirets** : c'est la forme que Notion
 * renvoie, celle des tags des écrans et du webhook. Sans cela la route
 * expirerait un tag que personne ne lit et lirait une seconde entrée de cache.
 */
export async function POST(requête: NextRequest): Promise<NextResponse> {
  const refus = refuserSiNonAutorisé(requête, 'lint')
  if (refus) return refus

  let charge: unknown
  try {
    charge = await requête.json()
  } catch {
    return NextResponse.json({ état: 'refusée', raison: 'corps illisible' }, { status: 400 })
  }

  const page = (charge as { page?: unknown })?.page
  if (!identifiantNotionValide(page)) {
    return NextResponse.json({ état: 'refusée', raison: '« page » absent ou invalide' }, { status: 400 })
  }
  const pageId = identifiantAvecTirets(page)

  try {
    revalidateTag(`page:${pageId}`, { expire: 0 })

    const édition = await lireÉditionDeTravail(pageId)
    if (!édition) {
      return NextResponse.json(
        { état: 'introuvable', raison: 'aucune page d’édition à cet identifiant' },
        { status: 404 },
      )
    }

    const blocs = await lireBlocsDePage(pageId)
    const rapport = contrôlerLaLettre({
      titre: édition.titre,
      blocs,
      dossiersBruts: édition.dossiersOuvertsBruts,
    })

    console.info(
      `[veille/lint] ${pageId} (${édition.statut ?? 'sans statut'}) : ` +
        `${rapport.conforme ? 'conforme' : `${rapport.ruptures.length} rupture(s)`}, ` +
        `${rapport.avertissements.length} avertissement(s).`,
    )

    return NextResponse.json({
      état: 'contrôlée',
      page: pageId,
      statut: édition.statut,
      famille: édition.famille,
      numéro: édition.numéro,
      ...rapport,
    })
  } catch (erreur) {
    console.error(
      `[veille/lint] échec sur ${pageId} : ${erreur instanceof Error ? erreur.message : String(erreur)}`,
    )
    return NextResponse.json({ état: 'erreur' }, { status: 502 })
  }
}
