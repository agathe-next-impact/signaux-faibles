import Stripe from 'stripe'
import type { ÉvénementDAbonnement } from '@/lib/base/abonnements'

/**
 * Lecture d'une livraison de webhook Stripe (palier 1c).
 *
 * Même forme que le webhook Notion (`lib/notion/webhook.ts`) : toute la décision
 * est ici, en fonction pure d'entrées explicites, et le route handler ne fait
 * que les entrées-sorties. C'est ce qui rend la vérification et chaque cas de
 * refus testables sans serveur ni compte Stripe.
 *
 * **Rien n'est cru avant la signature.** Elle est vérifiée par le SDK Stripe
 * (`Stripe.webhooks.constructEvent`), sur le corps brut tel qu'il est arrivé, avec
 * le secret propre à ce point de terminaison (`STRIPE_WEBHOOK_SECRET`, `whsec_…`).
 * Le SDK refuse aussi une signature trop ancienne, ce qui ferme la porte au
 * rejeu d'une livraison interceptée.
 *
 * Seuls les événements d'abonnement sont lus. L'organisation du portail est
 * celle que porte `metadata.organisation_id` de l'abonnement : c'est le portail
 * qui la pose à la création du paiement, et il ne déduit jamais une organisation
 * d'une adresse ou d'un nom de client Stripe.
 */

export type DécisionStripe =
  | { readonly sorte: 'abonnement'; readonly événement: ÉvénementDAbonnement; readonly type: string }
  /** Authentique, mais sans rapport avec un abonnement : accuser réception. */
  | { readonly sorte: 'sans-effet'; readonly type: string }
  /** Authentique, mais inexploitable (métadonnée absente) : accuser réception et le dire. */
  | { readonly sorte: 'inexploitable'; readonly type: string; readonly raison: string }
  /**
   * Authentique, mais de l'autre mode (test ou réel) que celui du portail. Ce
   * n'est presque jamais légitime en production : c'est le signe d'un
   * `STRIPE_MODE` oublié ou faux. La route répond 500 pour que Stripe relivre et
   * signale l'échec dans son tableau de bord, plutôt que d'ignorer en silence
   * des clients qui paient.
   */
  | { readonly sorte: 'autre-mode'; readonly type: string; readonly raison: string }
  /** À refuser en 400 : signature absente, fausse, trop ancienne, ou secret non posé. */
  | { readonly sorte: 'refusée'; readonly raison: string }

const TYPES_D_ABONNEMENT = new Set([
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.paused',
  'customer.subscription.resumed',
])

function formuleDe(abonnement: Stripe.Subscription): 'mensuelle' | 'annuelle' | null {
  const intervalle = abonnement.items.data[0]?.price.recurring?.interval
  if (intervalle === 'month') return 'mensuelle'
  if (intervalle === 'year') return 'annuelle'
  return null
}

function finDePériode(abonnement: Stripe.Subscription): Date | null {
  // Depuis l'API « basil » (2025), la période est portée par chaque élément de
  // l'abonnement, plus par l'abonnement lui-même. L'offre n'en a qu'un.
  const fin = abonnement.items.data[0]?.current_period_end
  return typeof fin === 'number' ? new Date(fin * 1000) : null
}

export function interpréterLivraisonStripe(livraison: {
  readonly brut: string
  readonly signature: string | null | undefined
  readonly secret: string | undefined
  /**
   * Vrai en production réelle (`STRIPE_MODE=reel`). Un événement du mode test
   * n'est jamais appliqué en mode réel, ni l'inverse : sans ce filtre, un
   * abonnement d'essai fait pendant la recette, portant l'identifiant d'une
   * vraie organisation, resterait ouvert pour toujours après le passage en réel.
   */
  readonly modeRéel: boolean
}): DécisionStripe {
  if (!livraison.secret) return { sorte: 'refusée', raison: 'STRIPE_WEBHOOK_SECRET absent' }
  if (!livraison.signature) return { sorte: 'refusée', raison: 'en-tête stripe-signature absent' }

  let événement: Stripe.Event
  try {
    événement = Stripe.webhooks.constructEvent(livraison.brut, livraison.signature, livraison.secret)
  } catch {
    // Le message du SDK peut recopier l'en-tête reçu : on ne le transmet pas.
    return { sorte: 'refusée', raison: 'signature invalide ou trop ancienne' }
  }

  if (!TYPES_D_ABONNEMENT.has(événement.type)) return { sorte: 'sans-effet', type: événement.type }
  if (événement.livemode !== livraison.modeRéel) {
    return {
      sorte: 'autre-mode',
      type: événement.type,
      raison: `événement du mode ${événement.livemode ? 'réel' : 'test'}, portail en mode ${livraison.modeRéel ? 'réel' : 'test'}`,
    }
  }

  const abonnement = événement.data.object as Stripe.Subscription
  const organisationId = abonnement.metadata?.['organisation_id']
  if (!organisationId) {
    return { sorte: 'inexploitable', type: événement.type, raison: 'metadata.organisation_id absente de l’abonnement' }
  }
  const clientStripe = typeof abonnement.customer === 'string' ? abonnement.customer : abonnement.customer.id

  return {
    sorte: 'abonnement',
    type: événement.type,
    événement: {
      organisationId,
      clientStripe,
      abonnementStripe: abonnement.id,
      état: abonnement.status,
      formule: formuleDe(abonnement),
      périodeFin: finDePériode(abonnement),
      événementId: événement.id,
      événementLe: new Date(événement.created * 1000),
      type: événement.type,
    },
  }
}
