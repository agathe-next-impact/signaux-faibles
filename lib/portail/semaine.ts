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

/** Une lettre, avec la semaine où elle est parue. */
export type Lettre = { readonly édition: Édition; readonly semaine: SemaineDÉditions }

/**
 * Toutes les lettres publiées, de la plus récente à la plus ancienne.
 *
 * Une lettre est une édition ; la semaine en rassemble deux, une par veille.
 * Aucune lecture de plus : tout vient de la liste déjà filtrée et cachée.
 */
export function lettresPubliées(semaines: readonly SemaineDÉditions[]): Lettre[] {
  return semaines.flatMap((semaine) =>
    semaine.éditions.map((édition) => ({ édition, semaine })),
  )
}

export async function semainesPubliées(organisationId: string): Promise<SemaineDÉditions[]> {
  return regrouperParSemaine(await listerÉditionsPubliées(organisationId))
}

/**
 * Les corps des notes d'une semaine.
 *
 * Deux lectures de blocs au plus par semaine : c'est le coût d'un écran qui
 * parle des axes. Aucun écran ne le fait sur toute l'archive — ce serait une
 * requête par édition, et le débit Notion ne le permet pas.
 *
 * La vue d'ensemble et les tendances demandent les deux mêmes semaines, la
 * courante et la précédente : elles partagent donc les mêmes entrées de cache,
 * et le second écran ne coûte rien de plus que le premier.
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
export function ongletsDe(
  slug: string,
  comptes: { lettres: number; recommandations: number; archives: number },
) {
  return [
    { href: `/${slug}`, libellé: 'Vue d’ensemble', libelléCourt: 'Vue', exact: true },
    { href: `/${slug}/lettres`, libellé: 'Lettres', libelléCourt: 'Lettres', compte: comptes.lettres },
    { href: `/${slug}/tendances`, libellé: 'Tendances', libelléCourt: 'Tendances' },
    {
      href: `/${slug}/recommandations`,
      libellé: 'Recommandations',
      libelléCourt: 'Reco.',
      compte: comptes.recommandations,
    },
    {
      href: `/${slug}/archives`,
      libellé: 'Archives',
      libelléCourt: 'Archives',
      compte: comptes.archives,
    },
  ]
}
