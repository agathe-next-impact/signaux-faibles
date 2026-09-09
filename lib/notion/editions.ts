import { notion, sourcesDeDonnées } from '@/lib/notion/client'
import {
  lireCase,
  lireDate,
  lireNombre,
  lireRelation,
  lireSélection,
  lireTexte,
  lireTitre,
  normaliserIdentifiant,
} from '@/lib/notion/proprietes'
import type { BlocNotion } from '@/lib/domaine/document'

/**
 * Une édition, telle que le portail l'expose.
 *
 * Ce type ne porte **aucune** propriété interne : ni `Famille`, ni
 * « Amendements au référentiel », ni `Livraison`. Ce qui n'entre pas ici
 * n'atteint jamais le navigateur, y compris dans les charges JSON non
 * affichées (règle 7).
 */
export type Édition = {
  readonly pageId: string
  readonly titre: string
  readonly veille: string | null
  readonly dateÉdition: string
  readonly numéro: number | null
  readonly périodeCouverte: string
  readonly fenêtreÉlargie: boolean
  readonly actionDeLaSemaine: string
  readonly dossiersOuvertsBruts: string
}

const STATUT_PUBLIÉ = 'Envoyé'

/**
 * Les éditions publiées d'une organisation, de la plus récente à la plus ancienne.
 *
 * Deux filtres, tous deux portés par la requête et jamais par un tri en
 * mémoire : le statut, et l'appartenance par identifiant de page du registre.
 * L'argument est l'identifiant de l'organisation, jamais l'identité de la
 * personne connectée : le résultat est partagé entre les membres du client.
 */
export async function listerÉditionsPubliées(
  organisationId: string,
): Promise<Édition[]> {
  'use cache: remote'

  const { cacheLife, cacheTag } = await import('next/cache')
  cacheLife('notion')

  const { éditions: sourceId } = await sourcesDeDonnées()
  cacheTag(`liste:${sourceId}`)

  const pages: unknown[] = []
  let curseur: string | undefined

  do {
    const réponse = await notion().dataSources.query({
      data_source_id: sourceId,
      filter: {
        and: [
          { property: 'Statut', select: { equals: STATUT_PUBLIÉ } },
          { property: 'Organisation', relation: { contains: organisationId } },
        ],
      },
      sorts: [{ property: "Date d'édition", direction: 'descending' }],
      page_size: 100,
      start_cursor: curseur,
    })

    pages.push(...réponse.results)
    curseur = réponse.next_cursor ?? undefined
  } while (curseur)

  const attendu = normaliserIdentifiant(organisationId)

  return pages
    // Ceinture et bretelles : le filtre Notion a déjà fait le travail, mais le
    // cloisonnement n'a plus de RLS derrière lui. Une page qui ne porte pas
    // l'organisation attendue ne passe pas, quoi qu'ait répondu l'API.
    .filter((page) => lireRelation(page, 'Organisation').includes(attendu))
    .filter((page) => lireSélection(page, 'Statut') === STATUT_PUBLIÉ)
    .map(versÉdition)
    .filter((édition): édition is Édition => édition !== null)
}

function versÉdition(page: unknown): Édition | null {
  const pageId = (page as { id?: unknown }).id
  const dateÉdition = lireDate(page, "Date d'édition")

  // Sans identifiant il n'y a pas d'URL ; sans date il n'y a pas de semaine.
  if (typeof pageId !== 'string' || !dateÉdition) return null

  return {
    pageId,
    titre: lireTitre(page, 'Titre'),
    veille: lireSélection(page, 'Veille'),
    dateÉdition,
    numéro: lireNombre(page, 'Numéro'),
    périodeCouverte: lireTexte(page, 'Période couverte'),
    fenêtreÉlargie: lireCase(page, 'Fenêtre élargie'),
    actionDeLaSemaine: lireTexte(page, 'Action de la semaine'),
    dossiersOuvertsBruts: lireTexte(page, 'Dossiers ouverts suivis'),
  }
}

/**
 * Les blocs de premier niveau d'une page, enfants de tableaux rattachés.
 *
 * Cette fonction ne contrôle **pas** l'appartenance : elle n'est appelée
 * qu'après que l'édition a été retrouvée dans la liste filtrée de
 * l'organisation, laquelle porte le contrôle. Ne jamais l'appeler sur un
 * identifiant venu directement de l'URL.
 */
export async function lireBlocsDePage(pageId: string): Promise<BlocNotion[]> {
  'use cache: remote'

  const { cacheLife, cacheTag } = await import('next/cache')
  cacheLife('notion')
  cacheTag(`page:${pageId}`)

  const blocs = await listerEnfants(pageId)

  // Seuls les tableaux ont besoin de leurs enfants pour être rendus. Les autres
  // blocs à enfants restent plats : la note n'en imbrique pas, et chaque appel
  // supplémentaire pèse sur les 3 requêtes par seconde de l'intégration.
  const enrichis = await Promise.all(
    blocs.map(async (bloc) =>
      bloc.type === 'table' && bloc.has_children
        ? { ...bloc, enfants: await listerEnfants(bloc.id) }
        : bloc,
    ),
  )

  return enrichis
}

async function listerEnfants(blocId: string): Promise<BlocNotion[]> {
  const blocs: BlocNotion[] = []
  let curseur: string | undefined

  do {
    const réponse = await notion().blocks.children.list({
      block_id: blocId,
      page_size: 100,
      start_cursor: curseur,
    })

    blocs.push(...(réponse.results as unknown as BlocNotion[]))
    curseur = réponse.next_cursor ?? undefined
  } while (curseur)

  return blocs
}

export type MédiaDeBloc = {
  /** Page qui porte le bloc : c'est elle qui décide de l'autorisation. */
  readonly pageParenteId: string
  readonly url: string
}

/**
 * Résout l'URL d'un bloc image, et la page qui le porte.
 *
 * Le profil de cache est court, et volontairement : une URL signée par Notion
 * expire en une heure, et servir depuis le cache une URL périmée donnerait une
 * image cassée. La page parente, elle, sert à vérifier que le demandeur a le
 * droit de voir ce média.
 */
export async function lireMédiaDeBloc(blocId: string): Promise<MédiaDeBloc | null> {
  'use cache: remote'

  const { cacheLife, cacheTag } = await import('next/cache')
  cacheLife('media')
  cacheTag(`page:${blocId}`)

  const bloc = (await notion().blocks.retrieve({ block_id: blocId })) as {
    type?: string
    parent?: { type?: string; page_id?: string }
    image?: { type?: string; file?: { url?: string }; external?: { url?: string } }
  }

  if (bloc.type !== 'image') return null

  const url = bloc.image?.file?.url ?? bloc.image?.external?.url
  const pageParenteId = bloc.parent?.page_id

  if (!url || !pageParenteId) return null

  return { pageParenteId, url }
}
