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
    expect(await enregistrerÉvénementDAbonnement(événement({ état: 'trialing' }), db)).toEqual({ sorte: 'appliqué' })
    expect((await lireAbonnement(organisationId, db))?.état).toBe('trialing')

    expect(
      await enregistrerÉvénementDAbonnement(
        événement({ événementId: 'evt_2', événementLe: new Date('2026-10-17T11:00:00Z') }),
        db,
      ),
    ).toEqual({ sorte: 'appliqué' })
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

  it('un réabonnement remplace l’ancien abonnement sur la même ligne', async () => {
    await enregistrerÉvénementDAbonnement(événement({ état: 'canceled' }), db)
    await enregistrerÉvénementDAbonnement(
      événement({ abonnementStripe: 'sub_456', événementId: 'evt_9', événementLe: new Date('2026-12-01T00:00:00Z') }),
      db,
    )
    const ligne = await lireAbonnement(organisationId, db)
    expect(ligne?.abonnementStripe).toBe('sub_456')
    expect(ligne?.état).toBe('active')
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
