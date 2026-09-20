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

/**
 * Les lectures de la base « Éditions » réservées au **dispositif**, jamais à un
 * écran client.
 *
 * `lib/notion/editions.ts` ne demande que les éditions au statut « Envoyé »
 * (règle 3) et son type ne porte aucune propriété interne (règle 7) : c'est ce
 * qui atteint le navigateur d'un client. Les routes `/api/veille/*` servent un
 * autre lecteur — la tâche Cowork qui écrit les lettres, authentifiée par le
 * jeton d'activation — et elles ont besoin de ce que le client ne voit pas :
 * les brouillons, la famille, les amendements. Un brouillon de lundi encore en
 * relecture mardi consomme déjà son numéro ; ne compter que les « Envoyé »
 * ferait repartir la numérotation.
 *
 * Ces fonctions ne sont donc appelées que depuis `lib/portail/` et les routes
 * `app/api/veille/` ; `tests/architecture.test.ts` le vérifie. Elles restent
 * cachées (règle 1) et filtrées par la relation Organisation (règle 2).
 */
export type ÉditionDeTravail = {
  readonly pageId: string
  readonly titre: string
  readonly statut: string | null
  readonly famille: string | null
  readonly veille: string | null
  readonly dateÉdition: string | null
  readonly numéro: number | null
  readonly périodeCouverte: string
  readonly fenêtreÉlargie: boolean
  readonly dossiersOuvertsBruts: string
  readonly actionDeLaSemaine: string
  readonly amendements: string
  readonly livraison: string
  readonly organisationIds: readonly string[]
}

function versÉditionDeTravail(page: unknown): ÉditionDeTravail | null {
  const pageId = (page as { id?: unknown }).id
  if (typeof pageId !== 'string') return null

  return {
    pageId,
    titre: lireTitre(page, 'Titre'),
    statut: lireSélection(page, 'Statut'),
    famille: lireSélection(page, 'Famille'),
    veille: lireSélection(page, 'Veille'),
    dateÉdition: lireDate(page, "Date d'édition"),
    numéro: lireNombre(page, 'Numéro'),
    périodeCouverte: lireTexte(page, 'Période couverte'),
    fenêtreÉlargie: lireCase(page, 'Fenêtre élargie'),
    dossiersOuvertsBruts: lireTexte(page, 'Dossiers ouverts suivis'),
    actionDeLaSemaine: lireTexte(page, 'Action de la semaine'),
    amendements: lireTexte(page, 'Amendements au référentiel'),
    livraison: lireTexte(page, 'Livraison'),
    organisationIds: lireRelation(page, 'Organisation'),
  }
}

/**
 * Une page d'édition par son identifiant, quel que soit son statut.
 *
 * L'appelant est la tâche qui vient de créer la page et veut la faire valider
 * avant l'envoi. Le cache est celui du profil `notion` ; la route qui appelle
 * cette fonction expire le tag `page:<id>` avant, pour relire la version qui
 * vient d'être corrigée.
 */
export async function lireÉditionDeTravail(pageId: string): Promise<ÉditionDeTravail | null> {
  'use cache: remote'

  const { cacheLife, cacheTag } = await import('next/cache')
  cacheLife('notion')
  cacheTag(`page:${pageId}`)

  const page = await notion().pages.retrieve({ page_id: pageId })
  const { éditions: sourceId } = await sourcesDeDonnées()

  // Une page à la corbeille est encore lisible par l'API ; la valider
  // reviendrait à rendre un rapport sur une lettre qui n'existe plus.
  if ((page as { in_trash?: boolean }).in_trash === true) return null

  // Une page qui n'est pas une édition n'a rien à faire ici : ni un accès, ni
  // une page organisation. Depuis l'API 2025-09-03, le parent d'une page de
  // base porte l'identifiant de sa source de données : c'est lui qu'on compare.
  const parent = (page as { parent?: { data_source_id?: string } }).parent
  const parentId = parent?.data_source_id
  if (!parentId || normaliserIdentifiant(parentId) !== normaliserIdentifiant(sourceId)) {
    return null
  }

  return versÉditionDeTravail(page)
}

/**
 * Toutes les éditions d'une organisation, tous statuts, de la plus récente à
 * la plus ancienne. Pour la numérotation et l'anti-doublon de la tâche des
 * lettres ; jamais pour un écran.
 */
export async function listerÉditionsDeTravail(
  organisationId: string,
): Promise<ÉditionDeTravail[]> {
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
      filter: { property: 'Organisation', relation: { contains: organisationId } },
      sorts: [{ property: "Date d'édition", direction: 'descending' }],
      page_size: 100,
      start_cursor: curseur,
    })
    pages.push(...réponse.results)
    curseur = réponse.next_cursor ?? undefined
  } while (curseur)

  const attendu = normaliserIdentifiant(organisationId)

  return pages
    .filter((page) => lireRelation(page, 'Organisation').includes(attendu))
    .map(versÉditionDeTravail)
    .filter((édition): édition is ÉditionDeTravail => édition !== null)
}
