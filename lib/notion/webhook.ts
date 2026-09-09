import { verifyWebhookSignature } from '@notionhq/client'

/**
 * Lecture d'une livraison de webhook Notion.
 *
 * Toute la décision est ici, en fonction pure d'entrées explicites : le route
 * handler ne fait que les entrées-sorties. C'est ce qui rend la poignée de main
 * et les cas de refus testables sans serveur.
 *
 * Les charges sont éparses : elles disent quoi a changé, pas ce que c'est
 * devenu. Le portail n'en tire que des tags à invalider, et ne relit jamais
 * Notion depuis le handler.
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

export type Décision =
  /** Poignée de main : le jeton doit être remis à l'opérateur, il n'a pas d'autre source. */
  | { readonly sorte: 'poignée-de-main'; readonly jetonDeVérification: string }
  /** Livraison authentique : voici ce qu'il faut invalider. */
  | { readonly sorte: 'invalider'; readonly tags: readonly string[] }
  /** Authentique mais sans effet : accuser réception, ne rien faire. */
  | { readonly sorte: 'sans-effet' }
  /** À refuser en 401. */
  | { readonly sorte: 'refusée'; readonly raison: string }

/**
 * Décide du sort d'une livraison.
 *
 * L'ordre des étapes est une propriété de sécurité, pas un détail :
 *
 * 1. La poignée de main passe **avant** la vérification de signature, parce
 *    que Notion ne la signe pas — le secret de signature est justement ce
 *    qu'elle apporte. Elle ne déclenche aucune invalidation, seulement la
 *    remise du jeton : une charge forgée qui la mimerait ne ferait rien.
 * 2. Tout le reste est vérifié avant d'avoir le moindre effet.
 */
export async function interpréterLivraison(livraison: {
  readonly brut: string
  readonly signature: string | null | undefined
  readonly secret: string | undefined
}): Promise<Décision> {
  let charge: ChargeWebhook
  try {
    charge = JSON.parse(livraison.brut) as ChargeWebhook
  } catch {
    return { sorte: 'refusée', raison: 'corps illisible' }
  }

  if (typeof charge.verification_token === 'string' && charge.verification_token.length > 0) {
    return { sorte: 'poignée-de-main', jetonDeVérification: charge.verification_token }
  }

  if (!livraison.secret) {
    return { sorte: 'refusée', raison: 'NOTION_WEBHOOK_SECRET absent' }
  }

  const authentique = await verifyWebhookSignature({
    body: livraison.brut,
    signature: livraison.signature,
    verificationToken: livraison.secret,
  })

  if (!authentique) return { sorte: 'refusée', raison: 'signature invalide' }

  const tags = tagsÀInvalider(charge)
  return tags.length > 0 ? { sorte: 'invalider', tags } : { sorte: 'sans-effet' }
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
