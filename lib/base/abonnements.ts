import { desc, eq } from 'drizzle-orm'
import { base, type Base } from '@/lib/base/client'
import { protéger } from '@/lib/base/erreurs'
import { abonnements, organisations, type Abonnement } from '@/lib/base/schema'

/**
 * La copie de l'abonnement Stripe d'une organisation (palier 1c).
 *
 * **Seul le webhook Stripe écrit ici** (`app/api/webhooks/stripe`). Stripe est la
 * source de vérité ; cette table n'en est que le reflet, tenu pour que le
 * portail décide sans appeler Stripe à chaque page.
 *
 * Stripe documente deux travers de ses webhooks, et l'écriture les absorbe tous
 * les deux :
 *   · **le doublon** : un même événement peut être livré plusieurs fois ; il est
 *     reconnu à son identifiant (`dernier_événement`) et ignoré ;
 *   · **le désordre** : deux événements peuvent arriver dans l'ordre inverse de
 *     leur création ; un événement plus ancien que le dernier appliqué
 *     (`événement_le`) est ignoré, sans quoi un « résilié » tardif écraserait un
 *     « actif » plus récent, ou l'inverse.
 * Stripe date ses événements **à la seconde**, et un paiement par Checkout
 * produit `customer.subscription.created` et `.updated` dans la même. À égalité
 * de date, l'ordre du cycle de vie départage : création, puis mise à jour (ou
 * pause, reprise), puis suppression. C'est un palliatif : le remède complet est
 * de relire l'abonnement chez Stripe à chaque livraison, ce qui demande la clé
 * secrète, à poser avec le compte.
 *
 * **Une ligne par abonnement Stripe.** La résiliation tardive d'un ancien
 * abonnement ne touche que sa propre ligne, jamais celle du nouveau : une
 * organisation est abonnée tant que l'une de ses lignes est ouverte
 * (`lireAbonnement` rend celle-là en priorité).
 *
 * La ligne de l'**organisation** est verrouillée le temps de la décision
 * (`for update`) : elle existe toujours, à la différence de la ligne
 * d'abonnement au premier événement, et deux livraisons simultanées sont donc
 * vraiment mises en file.
 */

export type ÉvénementDAbonnement = {
  /** L'organisation du portail, lue dans les métadonnées de l'abonnement Stripe. */
  readonly organisationId: string
  readonly clientStripe: string
  readonly abonnementStripe: string
  readonly état: string
  readonly formule: 'mensuelle' | 'annuelle' | null
  readonly périodeFin: Date | null
  readonly événementId: string
  readonly événementLe: Date
  readonly type: string
}

export type RésultatAbonnement =
  | { readonly sorte: 'appliqué' }
  | { readonly sorte: 'déjà-reçu' }
  | { readonly sorte: 'périmé' }
  | { readonly sorte: 'organisation-inconnue' }
  /** L'abonnement est déjà rattaché à une autre organisation : il n'en change pas. */
  | { readonly sorte: 'autre-organisation' }

const ÉTATS_OUVERTS = new Set(['trialing', 'active', 'past_due'])

/** Rang d'un type d'événement dans le cycle de vie d'un abonnement. */
function rang(type: string): number {
  if (type === 'customer.subscription.created') return 0
  if (type === 'customer.subscription.deleted') return 2
  return 1
}

/**
 * Vrai si l'événement entrant vient après celui déjà appliqué : par sa date, ou
 * à la même seconde par son rang dans le cycle de vie.
 */
function vientAprès(entrant: { le: Date; type: string }, appliqué: { le: Date; type: string }): boolean {
  const écart = entrant.le.getTime() - appliqué.le.getTime()
  if (écart !== 0) return écart > 0
  return rang(entrant.type) >= rang(appliqué.type)
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function enregistrerÉvénementDAbonnement(
  événement: ÉvénementDAbonnement,
  db: Base = base(),
): Promise<RésultatAbonnement> {
  // Un identifiant mal formé ferait échouer la requête sur le type uuid : on le
  // refuse avant, comme une organisation inconnue.
  if (!UUID.test(événement.organisationId)) return { sorte: 'organisation-inconnue' }

  return protéger('enregistrement d’un événement d’abonnement', () =>
    db.transaction(async (tx) => {
      const [organisation] = await tx
        .select({ id: organisations.id })
        .from(organisations)
        .where(eq(organisations.id, événement.organisationId))
        .for('update')
        .limit(1)
      if (!organisation) return { sorte: 'organisation-inconnue' } as const

      const [existant] = await tx
        .select({
          dernierÉvénement: abonnements.dernierÉvénement,
          événementLe: abonnements.événementLe,
          dernierType: abonnements.dernierType,
          organisationId: abonnements.organisationId,
        })
        .from(abonnements)
        .where(eq(abonnements.abonnementStripe, événement.abonnementStripe))
        .limit(1)

      if (existant) {
        if (existant.dernierÉvénement === événement.événementId) return { sorte: 'déjà-reçu' } as const
        // Un abonnement ne change jamais d'organisation : une métadonnée
        // modifiée après coup chez Stripe ne déplace pas l'accès.
        if (existant.organisationId !== événement.organisationId) return { sorte: 'autre-organisation' } as const
        if (!vientAprès({ le: événement.événementLe, type: événement.type }, { le: existant.événementLe, type: existant.dernierType })) {
          return { sorte: 'périmé' } as const
        }
      }

      const valeurs = {
        clientStripe: événement.clientStripe,
        abonnementStripe: événement.abonnementStripe,
        état: événement.état,
        formule: événement.formule,
        périodeFin: événement.périodeFin,
        dernierÉvénement: événement.événementId,
        événementLe: événement.événementLe,
        dernierType: événement.type,
        reçuLe: new Date(),
      }
      await tx
        .insert(abonnements)
        .values({ organisationId: événement.organisationId, ...valeurs })
        .onConflictDoUpdate({ target: abonnements.abonnementStripe, set: valeurs })
      return { sorte: 'appliqué' } as const
    }),
  )
}

/**
 * L'abonnement qui fait foi pour une organisation : un abonnement ouvert s'il y
 * en a un, sinon le plus récent ; `null` si elle n'en a jamais eu.
 */
export async function lireAbonnement(organisationId: string, db: Base = base()): Promise<Abonnement | null> {
  if (!UUID.test(organisationId)) return null
  return protéger('lecture d’un abonnement', async () => {
    const lignes = await db
      .select()
      .from(abonnements)
      .where(eq(abonnements.organisationId, organisationId))
      .orderBy(desc(abonnements.événementLe))
    return lignes.find((l) => ÉTATS_OUVERTS.has(l.état)) ?? lignes[0] ?? null
  })
}
