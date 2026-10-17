import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Base } from '@/lib/base/client'
import { enregistrerÉvénementDAbonnement } from '@/lib/base/abonnements'
import { lireEntréeDuParcours } from '@/lib/base/parcours'
import { organisations } from '@/lib/base/schema'
import { baseEnMémoire } from './aide/base-en-memoire'

describe('lireEntréeDuParcours', () => {
  let db: Base
  let fermer: () => Promise<void>
  const REGISTRE = 'aaaabbbbccccddddeeeeffff00001111'

  beforeEach(async () => {
    ;({ db, fermer } = await baseEnMémoire())
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(async () => {
    vi.restoreAllMocks()
    await fermer()
  })

  it('lit l’état, l’activation et l’abonnement qui fait foi, par la clé de cloisonnement', async () => {
    const activée = new Date('2026-10-05T07:00:00Z')
    const [o] = await db
      .insert(organisations)
      .values({ slug: 'p', nom: 'P', état: 'essai', activéeLe: activée, registreNotion: REGISTRE })
      .returning({ id: organisations.id })
    expect(await lireEntréeDuParcours(REGISTRE, db)).toEqual({ organisation: { état: 'essai', activéeLe: activée }, abonnement: null })

    const commun = { organisationId: o!.id, clientStripe: 'cus_1', formule: 'mensuelle' as const, périodeFin: null, type: 'customer.subscription.updated' }
    await enregistrerÉvénementDAbonnement({ ...commun, abonnementStripe: 'sub_1', état: 'canceled', événementId: 'e1', événementLe: new Date('2026-10-20T00:00:00Z') }, db)
    await enregistrerÉvénementDAbonnement({ ...commun, abonnementStripe: 'sub_2', état: 'incomplete_expired', événementId: 'e2', événementLe: new Date('2026-10-21T00:00:00Z') }, db)
    expect((await lireEntréeDuParcours(REGISTRE, db))?.abonnement).toEqual({ état: 'canceled' })

    await enregistrerÉvénementDAbonnement({ ...commun, abonnementStripe: 'sub_3', état: 'active', événementId: 'e3', événementLe: new Date('2026-10-22T00:00:00Z') }, db)
    expect((await lireEntréeDuParcours(REGISTRE, db))?.abonnement).toEqual({ état: 'active' })
  })

  it('rend null pour une organisation absente ou une clé mal formée', async () => {
    expect(await lireEntréeDuParcours(REGISTRE, db)).toBeNull()
    expect(await lireEntréeDuParcours('pas-une-cle', db)).toBeNull()
  })
})
