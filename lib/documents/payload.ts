import type { BlocNotion } from '@/lib/domaine/document'
import type { Édition } from '@/lib/notion/editions'
import { identifiantDeRelation } from '@/lib/payload/relations'

/**
 * Les documents lus dans Payload, derrière la façade `lib/documents`.
 *
 * Mêmes signatures, mêmes règles que `lib/notion/editions.ts` : chaque lecture
 * vit dans une fonction `'use cache: remote'`, profil `notion`, tags
 * `liste:<organisation>` et `page:<id>` ; le filtre d'appartenance est porté
 * par la requête **et** revérifié en mémoire (règle 2) ; seules les éditions
 * `publiee` sont demandées (règle 3). La clé de cloisonnement est ici
 * l'identifiant Payload de l'organisation, celui que portent les éditions.
 *
 * Payload et sa configuration sont importés à la demande, dans la fonction :
 * en mode `notion`, aucun écran ne charge l'adaptateur Postgres.
 */
const STATUT_PUBLIÉ = 'publiee'

export async function listerÉditionsPubliées(organisationId: string): Promise<Édition[]> {
  'use cache: remote'

  const { cacheLife, cacheTag } = await import('next/cache')
  cacheLife('notion')
  cacheTag(`liste:${organisationId}`)

  const [{ getPayload }, { default: config }] = await Promise.all([import('payload'), import('@payload-config')])
  const payload = await getPayload({ config })

  const { docs } = await payload.find({
    collection: 'editions',
    where: {
      and: [{ organisation: { equals: organisationId } }, { statut: { equals: STATUT_PUBLIÉ } }],
    },
    sort: '-dateEdition',
    depth: 0,
    pagination: false,
  })

  return (docs as unknown[])
    // Ceinture et bretelles, comme pour Notion : la requête a filtré, la
    // lecture revérifie. Une édition qui ne porte pas l'organisation attendue
    // ou qui n'est pas publiée ne passe pas, quoi qu'ait répondu la base.
    .filter((doc) => identifiantDeRelation(champ(doc, 'organisation')) === organisationId)
    .filter((doc) => champ(doc, 'statut') === STATUT_PUBLIÉ)
    .map(versÉdition)
    .filter((édition): édition is Édition => édition !== null)
}

/**
 * Les blocs d'une édition, dérivés de son Markdown par le crochet `beforeChange`.
 *
 * Comme sa jumelle Notion, cette fonction ne contrôle **pas** l'appartenance :
 * elle n'est appelée qu'après que l'édition a été retrouvée dans la liste
 * filtrée de l'organisation. Elle vérifie en revanche que le document est
 * publié : un brouillon ne donne rien, même à qui en connaît l'identifiant.
 */
export async function lireBlocsDePage(pageId: string): Promise<BlocNotion[]> {
  'use cache: remote'

  const { cacheLife, cacheTag } = await import('next/cache')
  cacheLife('notion')
  cacheTag(`page:${pageId}`)

  const [{ getPayload }, { default: config }] = await Promise.all([import('payload'), import('@payload-config')])
  const payload = await getPayload({ config })

  const { docs } = await payload.find({
    collection: 'editions',
    where: { and: [{ id: { equals: pageId } }, { statut: { equals: STATUT_PUBLIÉ } }] },
    depth: 0,
    limit: 1,
    pagination: false,
  })

  const doc = (docs as unknown[])[0]
  if (!doc || champ(doc, 'statut') !== STATUT_PUBLIÉ) return []

  const blocs = champ(doc, 'blocs')
  return Array.isArray(blocs) ? (blocs as BlocNotion[]) : []
}

function champ(doc: unknown, nom: string): unknown {
  return typeof doc === 'object' && doc !== null ? (doc as Record<string, unknown>)[nom] : undefined
}

function texte(valeur: unknown): string {
  return typeof valeur === 'string' ? valeur : ''
}

/**
 * Le jour d'une date Payload, au format `AAAA-MM-JJ` des éditions Notion.
 *
 * Payload stocke un instant ISO 8601 complet. Le sélecteur `dayOnly` de
 * l'admin pose le jour choisi à 12 h UTC (`setHours(12 - décalage)` dans
 * `@payloadcms/ui`), et une écriture par l'API doit faire de même : les dix
 * premiers caractères donnent alors le jour voulu, quel que soit le fuseau.
 */
function jourDe(valeur: unknown): string | null {
  if (typeof valeur !== 'string' || valeur.length < 10) return null
  const jour = valeur.slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(jour) ? jour : null
}

function versÉdition(doc: unknown): Édition | null {
  const id = champ(doc, 'id')
  const dateÉdition = jourDe(champ(doc, 'dateEdition'))

  // Sans identifiant il n'y a pas d'URL ; sans date il n'y a pas de semaine.
  if ((typeof id !== 'string' && typeof id !== 'number') || !dateÉdition) return null

  const numéro = champ(doc, 'numero')

  return {
    pageId: String(id),
    titre: texte(champ(doc, 'titre')),
    // Une édition unique porte « Veille » ; le portail n'a jamais raisonné sur ce libellé.
    veille: 'Veille',
    dateÉdition,
    numéro: typeof numéro === 'number' ? numéro : null,
    périodeCouverte: texte(champ(doc, 'periodeCouverte')),
    fenêtreÉlargie: champ(doc, 'fenetreElargie') === true,
    actionDeLaSemaine: texte(champ(doc, 'actionDeLaSemaine')),
    dossiersOuvertsBruts: texte(champ(doc, 'dossiersOuvertsSuivis')),
  }
}
