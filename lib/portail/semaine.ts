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
export async function notesDeLaSemaine(
  semaine: SemaineDÉditions | undefined,
): Promise<{ readonly édition: Édition; readonly document: Document }[]> {
  if (!semaine) return []
  return Promise.all(
    semaine.éditions.map(async (édition) => ({
      édition,
      document: construireDocument(await lireBlocsDePage(édition.pageId)),
    })),
  )
}

/** Les mêmes corps, quand l'écran n'a que faire de savoir de quelle lettre ils viennent. */
export async function documentsDeLaSemaine(
  semaine: SemaineDÉditions | undefined,
): Promise<Document[]> {
  return (await notesDeLaSemaine(semaine)).map((note) => note.document)
}

/**
 * Le nombre de lettres que l'on remonte pour suivre un axe.
 *
 * Quatre : de quoi voir une tendance sans transformer un écran en une rafale de
 * requêtes Notion. Le débit est de trois par seconde ; on ne remonte jamais
 * toute l'archive corps par corps.
 */
export const LETTRES_SUIVIES = 4

/**
 * Le nombre de lettres au-delà duquel un acteur sans actualité quitte l'accueil.
 *
 * Trois : une semaine et demie de parution. Assez pour qu'un dossier qui vient
 * de bouger reste visible la semaine suivante, trop court pour qu'un dossier
 * dormant s'installe sur la page d'entrée.
 */
export const LETTRES_POUR_ACTUALITÉ = 3

/** Les corps des dernières lettres, avec la lettre dont ils viennent. */
export async function dernièresNotes(
  semaines: readonly SemaineDÉditions[],
  combien: number = LETTRES_SUIVIES,
): Promise<{ readonly lettre: Lettre; readonly document: Document }[]> {
  return Promise.all(
    lettresPubliées(semaines)
      .slice(0, combien)
      .map(async (lettre) => ({
        lettre,
        document: construireDocument(await lireBlocsDePage(lettre.édition.pageId)),
      })),
  )
}
/** Les écrans de l'espace client, dans l'ordre du rail. */
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
    { href: `/${slug}/cadrage`, libellé: 'Cadrage', libelléCourt: 'Cadrage' },
  ]
}
