import { notion, sourcesDeDonnées } from '@/lib/notion/client'
import { lireCase, lireEmail, lireTexte, lireTitre } from '@/lib/notion/proprietes'

/**
 * Une ligne de la base « Accès — portail ».
 *
 * C'est la seule source de l'appartenance. La base est tenue par une tâche
 * Cowork ; le portail la lit et n'y écrit jamais.
 */
export type Accès = {
  readonly nom: string
  readonly email: string | null
  readonly organisationLibellé: string
  /** `page_id` de la ligne du registre : la seule clé de cloisonnement. */
  readonly organisationId: string
  readonly slug: string
  readonly actif: boolean
}

/**
 * Retrouve un accès par son identifiant.
 *
 * La fonction est cachée et porte le tag de la base : une révocation dans
 * Notion déclenche le webhook, qui invalide le tag, et la case décochée devient
 * effective à la requête suivante.
 *
 * L'argument est un identifiant d'accès, pas un contenu : c'est une lecture
 * d'authentification, et elle est volontairement clefée par personne. Aucune
 * fonction de *contenu* ne reçoit cet argument — elles ne voient que
 * `organisationId`.
 */
export async function lireAccèsParIdentifiant(
  identifiant: string,
): Promise<Accès | null> {
  'use cache: remote'

  const { cacheLife, cacheTag } = await import('next/cache')
  cacheLife('notion')

  const { accès: sourceId } = await sourcesDeDonnées()
  cacheTag(`liste:${sourceId}`)

  const réponse = await notion().dataSources.query({
    data_source_id: sourceId,
    filter: {
      property: "Identifiant d'accès",
      rich_text: { equals: identifiant },
    },
    page_size: 2,
  })

  // Deux lignes pour un même identifiant : la base est incohérente, et un
  // choix arbitraire rattacherait peut-être la personne au mauvais client.
  if (réponse.results.length !== 1) return null

  const page = réponse.results[0]
  const organisationId = lireTexte(page, "Identifiant Notion de l'organisation")
    .replaceAll('-', '')
    .toLowerCase()

  // Sans identifiant d'organisation il n'y a pas de filtre possible : refuser
  // vaut mieux que servir une requête non cloisonnée.
  if (organisationId.length === 0) return null

  return {
    nom: lireTitre(page, 'Nom'),
    email: lireEmail(page, 'Email'),
    organisationLibellé: lireTexte(page, 'Organisation (libellé)'),
    organisationId,
    slug: lireTexte(page, 'Slug'),
    actif: lireCase(page, 'Actif'),
  }
}

/**
 * Retrouve un accès actif par email, pour la page « recevoir mon lien ».
 *
 * Renvoie `null` sans distinguer « inconnu » de « révoqué » : la page dit la
 * même chose dans les deux cas, pour ne pas transformer le formulaire en
 * oracle sur les adresses inscrites.
 */
export async function lireAccèsActifParEmail(email: string): Promise<
  (Accès & { readonly identifiant: string }) | null
> {
  'use cache: remote'

  const { cacheLife, cacheTag } = await import('next/cache')
  cacheLife('notion')

  const { accès: sourceId } = await sourcesDeDonnées()
  cacheTag(`liste:${sourceId}`)

  const réponse = await notion().dataSources.query({
    data_source_id: sourceId,
    filter: {
      and: [
        { property: 'Email', email: { equals: email } },
        { property: 'Actif', checkbox: { equals: true } },
      ],
    },
    page_size: 2,
  })

  if (réponse.results.length !== 1) return null

  const page = réponse.results[0]
  const identifiant = lireTexte(page, "Identifiant d'accès")
  const organisationId = lireTexte(page, "Identifiant Notion de l'organisation")
    .replaceAll('-', '')
    .toLowerCase()

  if (identifiant.length === 0 || organisationId.length === 0) return null

  return {
    identifiant,
    nom: lireTitre(page, 'Nom'),
    email: lireEmail(page, 'Email'),
    organisationLibellé: lireTexte(page, 'Organisation (libellé)'),
    organisationId,
    slug: lireTexte(page, 'Slug'),
    actif: true,
  }
}
