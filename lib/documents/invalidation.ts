import { revalidateTag } from 'next/cache'

/**
 * L'invalidation du cache des écrans quand une édition Payload change.
 *
 * Elle remplace le webhook Notion pour les documents Payload : mêmes tags,
 * `page:<id>` pour le corps et `liste:<organisation>` pour la liste des
 * éditions publiées de l'organisation. Elle est appelée par les crochets
 * `afterChange` et `afterDelete` de la collection `editions`, c'est-à-dire
 * après une écriture que Payload a déjà autorisée (utilisateur authentifié ou
 * API locale du portail) : c'est la garde qui précède ce pouvoir.
 *
 * Hors d'une requête Next (CLI Payload, migrations, tests), `revalidateTag`
 * peut lever : l'écriture, elle, ne doit jamais échouer pour cela.
 */
export function invaliderLÉdition({
  id,
  organisation,
}: {
  readonly id: string
  readonly organisation: string | null
}): void {
  const tags = [`page:${id}`]
  if (organisation) tags.push(`liste:${organisation}`)
  for (const tag of tags) {
    try {
      revalidateTag(tag, 'max')
    } catch (erreur) {
      console.warn(
        `[documents] invalidation de ${tag} impossible hors de Next : ${erreur instanceof Error ? erreur.message : String(erreur)}`,
      )
    }
  }
}
