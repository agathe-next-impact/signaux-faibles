import { eq } from 'drizzle-orm'
import { base, type Base } from '@/lib/base/client'
import { protéger } from '@/lib/base/erreurs'
import { abonnements, organisations, type Abonnement } from '@/lib/base/schema'

/**
 * La copie de l'abonnement Stripe d'une organisation (palier 1c).
 *
 * **Seul le webhook Stripe écrit ici** (`app/api/stripe/webhook`). Stripe est la
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
 * La ligne est verrouillée le temps de la décision (`for update`) : deux
 * livraisons simultanées ne peuvent pas se croiser.
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
}

export type RésultatAbonnement =
  | { readonly sorte: 'appliqué' }
  | { readonly sorte: 'déjà-reçu' }
  | { readonly sorte: 'périmé' }
  | { readonly sorte: 'organisation-inconnue' }

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
        .limit(1)
      if (!organisation) return { sorte: 'organisation-inconnue' } as const

      const [existant] = await tx
        .select({ dernierÉvénement: abonnements.dernierÉvénement, événementLe: abonnements.événementLe })
        .from(abonnements)
        .where(eq(abonnements.organisationId, événement.organisationId))
        .for('update')
        .limit(1)

      if (existant?.dernierÉvénement === événement.événementId) return { sorte: 'déjà-reçu' } as const
      if (existant && existant.événementLe.getTime() > événement.événementLe.getTime()) {
        return { sorte: 'périmé' } as const
      }

      const valeurs = {
        clientStripe: événement.clientStripe,
        abonnementStripe: événement.abonnementStripe,
        état: événement.état,
        formule: événement.formule,
        périodeFin: événement.périodeFin,
        dernierÉvénement: événement.événementId,
        événementLe: événement.événementLe,
        reçuLe: new Date(),
      }
      await tx
        .insert(abonnements)
        .values({ organisationId: événement.organisationId, ...valeurs })
        .onConflictDoUpdate({ target: abonnements.organisationId, set: valeurs })
      return { sorte: 'appliqué' } as const
    }),
  )
}

/** L'abonnement d'une organisation, ou `null` si elle n'en a jamais eu. */
export async function lireAbonnement(organisationId: string, db: Base = base()): Promise<Abonnement | null> {
  if (!UUID.test(organisationId)) return null
  return protéger('lecture d’un abonnement', async () => {
    const [ligne] = await db.select().from(abonnements).where(eq(abonnements.organisationId, organisationId)).limit(1)
    return ligne ?? null
  })
}
