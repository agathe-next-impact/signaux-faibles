import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Base } from '@/lib/base/client'
import { enregistrerÉvénementDAbonnement, lireAbonnement, type ÉvénementDAbonnement } from '@/lib/base/abonnements'
import { organisations } from '@/lib/base/schema'
import { baseEnMémoire } from './aide/base-en-memoire'

describe('copie de l’abonnement Stripe (palier 1c)', () => {
  let db: Base
  let fermer: () => Promise<void>
  let organisationId: string

  const événement = (extras: Partial<ÉvénementDAbonnement> = {}): ÉvénementDAbonnement => ({
    organisationId,
    clientStripe: 'cus_123',
    abonnementStripe: 'sub_123',
    état: 'active',
    formule: 'mensuelle',
    périodeFin: new Date('2026-11-17T00:00:00Z'),
    événementId: 'evt_1',
    événementLe: new Date('2026-10-17T10:00:00Z'),
    type: 'customer.subscription.updated',
    ...extras,
  })

  beforeEach(async () => {
    ;({ db, fermer } = await baseEnMémoire())
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const [ligne] = await db
      .insert(organisations)
      .values({ slug: 'prospect', nom: 'Prospect', état: 'essai', activéeLe: new Date('2026-10-05T07:00:00Z') })
      .returning({ id: organisations.id })
    organisationId = ligne!.id
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await fermer()
  })

  it('crée la ligne au premier événement, puis la met à jour', async () => {
    expect(await enregistrerÉvénementDAbonnement(événement({ état: 'trialing' }), db)).toEqual({ sorte: 'appliqué', étatPrécédent: null })
    expect((await lireAbonnement(organisationId, db))?.état).toBe('trialing')

    expect(
      await enregistrerÉvénementDAbonnement(
        événement({ événementId: 'evt_2', événementLe: new Date('2026-10-17T11:00:00Z') }),
        db,
      ),
    ).toEqual({ sorte: 'appliqué', étatPrécédent: 'trialing' })
    const ligne = await lireAbonnement(organisationId, db)
    expect(ligne?.état).toBe('active')
    expect(ligne?.dernierÉvénement).toBe('evt_2')
  })

  it('ignore un événement déjà reçu', async () => {
    await enregistrerÉvénementDAbonnement(événement(), db)
    expect(await enregistrerÉvénementDAbonnement(événement({ état: 'canceled' }), db)).toEqual({ sorte: 'déjà-reçu' })
    expect((await lireAbonnement(organisationId, db))?.état).toBe('active')
  })

  it('ignore un événement plus ancien que le dernier appliqué', async () => {
    await enregistrerÉvénementDAbonnement(événement({ événementId: 'evt_2', événementLe: new Date('2026-10-17T12:00:00Z') }), db)
    expect(
      await enregistrerÉvénementDAbonnement(
        événement({ événementId: 'evt_1', état: 'incomplete', événementLe: new Date('2026-10-17T09:00:00Z') }),
        db,
      ),
    ).toEqual({ sorte: 'périmé' })
    expect((await lireAbonnement(organisationId, db))?.état).toBe('active')
  })

  it('à la même seconde, l’ordre du cycle de vie départage (Checkout)', async () => {
    const même = new Date('2026-10-17T10:00:00Z')
    // « updated » (active) arrive avant « created » (incomplete), dans la même seconde.
    await enregistrerÉvénementDAbonnement(événement({ événementId: 'evt_u', événementLe: même }), db)
    expect(
      await enregistrerÉvénementDAbonnement(
        événement({ événementId: 'evt_c', état: 'incomplete', événementLe: même, type: 'customer.subscription.created' }),
        db,
      ),
    ).toEqual({ sorte: 'périmé' })
    expect((await lireAbonnement(organisationId, db))?.état).toBe('active')
    // Dans l'ordre naturel, la mise à jour passe après la création.
    await enregistrerÉvénementDAbonnement(
      événement({ abonnementStripe: 'sub_2', événementId: 'evt_c2', état: 'incomplete', événementLe: même, type: 'customer.subscription.created' }),
      db,
    )
    expect(
      await enregistrerÉvénementDAbonnement(événement({ abonnementStripe: 'sub_2', événementId: 'evt_u2', événementLe: même }), db),
    ).toEqual({ sorte: 'appliqué', étatPrécédent: 'incomplete' })
  })

  it('la résiliation tardive d’un ancien abonnement ne touche pas le nouveau', async () => {
    await enregistrerÉvénementDAbonnement(événement({ abonnementStripe: 'sub_1', événementId: 'evt_1' }), db)
    await enregistrerÉvénementDAbonnement(
      événement({ abonnementStripe: 'sub_2', événementId: 'evt_2', événementLe: new Date('2026-12-01T00:00:00Z') }),
      db,
    )
    expect(
      await enregistrerÉvénementDAbonnement(
        événement({
          abonnementStripe: 'sub_1',
          événementId: 'evt_3',
          état: 'canceled',
          type: 'customer.subscription.deleted',
          événementLe: new Date('2026-12-02T00:00:00Z'),
        }),
        db,
      ),
    ).toEqual({ sorte: 'appliqué', étatPrécédent: 'active' })
    const ligne = await lireAbonnement(organisationId, db)
    expect(ligne?.abonnementStripe).toBe('sub_2')
    expect(ligne?.état).toBe('active')
  })

  it('sans abonnement ouvert ni fermé, rend le paiement le plus récent', async () => {
    await enregistrerÉvénementDAbonnement(événement({ abonnementStripe: 'sub_1', état: 'incomplete' }), db)
    await enregistrerÉvénementDAbonnement(
      événement({ abonnementStripe: 'sub_2', événementId: 'evt_2', état: 'incomplete_expired', événementLe: new Date('2026-12-01T00:00:00Z') }),
      db,
    )
    expect((await lireAbonnement(organisationId, db))?.abonnementStripe).toBe('sub_2')
  })

  it('un abonnement résilié fait foi devant un paiement abandonné ensuite', async () => {
    await enregistrerÉvénementDAbonnement(événement({ abonnementStripe: 'sub_2', état: 'canceled' }), db)
    await enregistrerÉvénementDAbonnement(
      événement({ abonnementStripe: 'sub_3', événementId: 'evt_3', état: 'incomplete_expired', événementLe: new Date('2026-12-01T00:00:00Z') }),
      db,
    )
    expect((await lireAbonnement(organisationId, db))?.état).toBe('canceled')
  })

  it('un abonnement ne change pas d’organisation', async () => {
    const [autre] = await db
      .insert(organisations)
      .values({ slug: 'autre', nom: 'Autre', état: 'essai' })
      .returning({ id: organisations.id })
    await enregistrerÉvénementDAbonnement(événement(), db)
    expect(
      await enregistrerÉvénementDAbonnement(
        événement({ organisationId: autre!.id, événementId: 'evt_x', événementLe: new Date('2026-10-18T00:00:00Z') }),
        db,
      ),
    ).toEqual({ sorte: 'autre-organisation' })
    expect(await lireAbonnement(autre!.id, db)).toBeNull()
  })

  it('refuse une organisation inconnue ou un identifiant mal formé, sans erreur de base', async () => {
    expect(
      await enregistrerÉvénementDAbonnement(événement({ organisationId: '00000000-0000-4000-8000-000000000000' }), db),
    ).toEqual({ sorte: 'organisation-inconnue' })
    expect(await enregistrerÉvénementDAbonnement(événement({ organisationId: 'pas-un-uuid' }), db)).toEqual({
      sorte: 'organisation-inconnue',
    })
    expect(await lireAbonnement('pas-un-uuid', db)).toBeNull()
  })

  it('refuse un identifiant Stripe qui n’en a pas la forme', async () => {
    await expect(enregistrerÉvénementDAbonnement(événement({ clientStripe: 'x' }), db)).rejects.toThrow('SQLSTATE 23514')
  })
})
