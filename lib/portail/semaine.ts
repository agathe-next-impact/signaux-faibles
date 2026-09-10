import { construireDocument, type Document } from '@/lib/domaine/document'
import { regrouperParSemaine, type Semaine } from '@/lib/domaine/semaines'
import { lireBlocsDePage, listerÉditionsPubliées, type Édition } from '@/lib/notion/editions'

/**
 * Ce que tous les écrans de l'espace client partagent.
 *
 * Les lectures Notion restent dans les fonctions cachées de `lib/notion` ; ces
 * assemblages n'y ajoutent rien de coûteux. Le layout et les pages appellent
 * les mêmes fonctions, et se partagent donc les mêmes entrées de cache.
 */
export type SemaineDÉditions = Semaine<Édition>

export async function semainesPubliées(organisationId: string): Promise<SemaineDÉditions[]> {
  return regrouperParSemaine(await listerÉditionsPubliées(organisationId))
}

/**
 * Les corps des notes d'une semaine.
 *
 * Deux lectures de blocs au plus par semaine : c'est le coût d'un écran qui
 * parle des familles. Aucun écran ne le fait sur toute l'archive — ce serait
 * une requête par édition, et le débit Notion ne le permet pas.
 */
export async function documentsDeLaSemaine(
  semaine: SemaineDÉditions | undefined,
): Promise<Document[]> {
  if (!semaine) return []
  return Promise.all(
    semaine.éditions.map(async (édition) =>
      construireDocument(await lireBlocsDePage(édition.pageId)),
    ),
  )
}

/** Les cinq écrans de l'espace client, dans l'ordre du rail. */
export function ongletsDe(slug: string, comptes: { recommandations: number; archives: number }) {
  return [
    { href: `/${slug}`, libellé: "Vue d'ensemble" },
    { href: `/${slug}/signaux`, libellé: 'Signaux' },
    { href: `/${slug}/tendances`, libellé: 'Tendances' },
    { href: `/${slug}/recommandations`, libellé: 'Recommandations', compte: comptes.recommandations },
    { href: `/${slug}/archives`, libellé: 'Archives', compte: comptes.archives },
  ]
}
