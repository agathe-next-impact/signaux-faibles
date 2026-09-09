/**
 * Lecture d'une charge utile de webhook Notion.
 *
 * Les charges sont éparses : elles disent quoi a changé, pas ce que c'est
 * devenu. Le portail n'a pas besoin de plus — il n'en tire que des tags à
 * invalider, et ne relit jamais Notion depuis le handler.
 */
export type ChargeWebhook = {
  readonly type?: string
  readonly entity?: { readonly id?: string; readonly type?: string }
  readonly data?: {
    readonly parent?: { readonly id?: string; readonly type?: string }
  }
  /** Présent uniquement lors de la poignée de main d'abonnement. */
  readonly verification_token?: string
}

/**
 * Tags à invalider pour un événement.
 *
 * Une propriété modifiée change la *liste* (le statut, la date, le numéro) ;
 * un contenu modifié change la *page*. Comme l'ordre des événements n'est pas
 * garanti et que les charges sont éparses, on invalide les deux dès qu'une page
 * bouge : le coût d'une invalidation de trop est une régénération en arrière-
 * plan, celui d'une invalidation manquante est une édition périmée servie
 * pendant un mois.
 */
export function tagsÀInvalider(charge: ChargeWebhook): string[] {
  const tags = new Set<string>()

  const entité = charge.entity
  const parent = charge.data?.parent

  if (entité?.type === 'page' && entité.id) {
    tags.add(`page:${entité.id}`)
    // Le parent d'une page en base est sa source de données : c'est le tag de
    // liste, et il vient de la charge, sans aucune lecture Notion.
    if (parent?.type === 'data_source' && parent.id) tags.add(`liste:${parent.id}`)
  }

  if (entité?.type === 'data_source' && entité.id) {
    tags.add(`liste:${entité.id}`)
    // Un changement de schéma doit refaire passer la garde de démarrage.
    if (charge.type?.includes('schema')) tags.add('schema:notion')
  }

  return [...tags]
}
