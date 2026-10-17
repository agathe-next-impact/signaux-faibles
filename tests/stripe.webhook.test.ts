import Stripe from 'stripe'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { interpréterLivraisonStripe } from '@/lib/stripe/webhook'

/**
 * Le webhook Stripe, sans compte Stripe : les livraisons sont signées ici avec
 * l'outil de test du SDK, exactement comme Stripe les signerait.
 */
const SECRET = 'whsec_test_secret_de_signature'
const ORGANISATION = '6f1c2a4e-1d2b-4c3d-8e9f-0a1b2c3d4e5f'

const base = vi.hoisted(() => ({ enregistrerÉvénementDAbonnement: vi.fn() }))
vi.mock('@/lib/base/abonnements', () => base)
const { POST } = await import('@/app/api/webhooks/stripe/route')

function événement(type: string, objet: Record<string, unknown>, extras: Record<string, unknown> = {}) {
  return JSON.stringify({ id: 'evt_1', object: 'event', type, created: 1792231200, livemode: false, data: { object: objet }, ...extras })
}

function abonnement(extras: Record<string, unknown> = {}) {
  return {
    id: 'sub_123',
    object: 'subscription',
    customer: 'cus_123',
    status: 'active',
    metadata: { organisation_id: ORGANISATION },
    items: { data: [{ current_period_end: 1794909600, price: { recurring: { interval: 'month' } } }] },
    ...extras,
  }
}

const signer = (brut: string, secret = SECRET) => Stripe.webhooks.generateTestHeaderString({ payload: brut, secret })

describe('interpréterLivraisonStripe', () => {
  it('lit un abonnement signé : organisation, état, formule, fin de période, événement', () => {
    const brut = événement('customer.subscription.updated', abonnement())
    expect(interpréterLivraisonStripe({ brut, signature: signer(brut), secret: SECRET, modeRéel: false })).toEqual({
      sorte: 'abonnement',
      type: 'customer.subscription.updated',
      événement: {
        organisationId: ORGANISATION,
        clientStripe: 'cus_123',
        abonnementStripe: 'sub_123',
        état: 'active',
        formule: 'mensuelle',
        périodeFin: new Date(1794909600 * 1000),
        événementId: 'evt_1',
        événementLe: new Date(1792231200 * 1000),
        type: 'customer.subscription.updated',
      },
    })
  })

  it('n’applique jamais un événement de l’autre mode', () => {
    const test = événement('customer.subscription.updated', abonnement())
    expect(interpréterLivraisonStripe({ brut: test, signature: signer(test), secret: SECRET, modeRéel: true }).sorte).toBe(
      'autre-mode',
    )
    const réel = événement('customer.subscription.updated', abonnement(), { livemode: true })
    expect(interpréterLivraisonStripe({ brut: réel, signature: signer(réel), secret: SECRET, modeRéel: false }).sorte).toBe(
      'autre-mode',
    )
    expect(interpréterLivraisonStripe({ brut: réel, signature: signer(réel), secret: SECRET, modeRéel: true }).sorte).toBe(
      'abonnement',
    )
  })

  it('reconnaît la formule annuelle et un client développé en objet', () => {
    const brut = événement(
      'customer.subscription.created',
      abonnement({
        customer: { id: 'cus_456', object: 'customer' },
        items: { data: [{ current_period_end: 1824000000, price: { recurring: { interval: 'year' } } }] },
      }),
    )
    const décision = interpréterLivraisonStripe({ brut, signature: signer(brut), secret: SECRET, modeRéel: false })
    expect(décision.sorte === 'abonnement' && décision.événement.formule).toBe('annuelle')
    expect(décision.sorte === 'abonnement' && décision.événement.clientStripe).toBe('cus_456')
  })

  it('refuse une signature absente, fausse, d’un autre secret, ou un secret non posé', () => {
    const brut = événement('customer.subscription.updated', abonnement())
    expect(interpréterLivraisonStripe({ brut, signature: null, secret: SECRET, modeRéel: false }).sorte).toBe('refusée')
    expect(interpréterLivraisonStripe({ brut, signature: 't=1,v1=faux', secret: SECRET, modeRéel: false }).sorte).toBe('refusée')
    expect(interpréterLivraisonStripe({ brut, signature: signer(brut, 'whsec_autre'), secret: SECRET, modeRéel: false }).sorte).toBe('refusée')
    expect(interpréterLivraisonStripe({ brut, signature: signer(brut), secret: undefined, modeRéel: false }).sorte).toBe('refusée')
  })

  it('refuse un corps modifié après signature', () => {
    const brut = événement('customer.subscription.updated', abonnement())
    const signature = signer(brut)
    const falsifié = brut.replace('"active"', '"canceled"')
    expect(interpréterLivraisonStripe({ brut: falsifié, signature, secret: SECRET, modeRéel: false }).sorte).toBe('refusée')
  })

  it('refuse une signature trop ancienne (rejeu)', () => {
    const brut = événement('customer.subscription.updated', abonnement())
    const ancienne = Stripe.webhooks.generateTestHeaderString({
      payload: brut,
      secret: SECRET,
      timestamp: Math.floor(Date.now() / 1000) - 3600,
    })
    expect(interpréterLivraisonStripe({ brut, signature: ancienne, secret: SECRET, modeRéel: false }).sorte).toBe('refusée')
  })

  it('accuse réception sans effet d’un événement qui n’est pas un abonnement', () => {
    const brut = événement('invoice.paid', { id: 'in_1', object: 'invoice' })
    expect(interpréterLivraisonStripe({ brut, signature: signer(brut), secret: SECRET, modeRéel: false })).toEqual({
      sorte: 'sans-effet',
      type: 'invoice.paid',
    })
  })

  it('dit inexploitable un abonnement sans organisation du portail', () => {
    const brut = événement('customer.subscription.created', abonnement({ metadata: {} }))
    expect(interpréterLivraisonStripe({ brut, signature: signer(brut), secret: SECRET, modeRéel: false }).sorte).toBe('inexploitable')
  })
})

describe('POST /api/webhooks/stripe', () => {
  const livrer = (brut: string, signature: string | null) =>
    POST(
      new NextRequest('https://www.signauxfaibles.io/api/webhooks/stripe', {
        method: 'POST',
        headers: signature ? { 'stripe-signature': signature } : {},
        body: brut,
      }),
    )

  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', SECRET)
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('recopie l’abonnement et répond 200', async () => {
    base.enregistrerÉvénementDAbonnement.mockResolvedValue({ sorte: 'appliqué' })
    const brut = événement('customer.subscription.updated', abonnement())
    const réponse = await livrer(brut, signer(brut))
    expect(réponse.status).toBe(200)
    expect(base.enregistrerÉvénementDAbonnement).toHaveBeenCalledWith(expect.objectContaining({ organisationId: ORGANISATION }))
  })

  it('refuse en 400 sans rien écrire', async () => {
    const brut = événement('customer.subscription.updated', abonnement())
    expect((await livrer(brut, null)).status).toBe(400)
    expect(base.enregistrerÉvénementDAbonnement).not.toHaveBeenCalled()
  })

  it('répond 500 sur une panne de la base, pour que Stripe relivre', async () => {
    base.enregistrerÉvénementDAbonnement.mockRejectedValue(new Error('[base] en échec (SQLSTATE 08006).'))
    const brut = événement('customer.subscription.updated', abonnement())
    expect((await livrer(brut, signer(brut))).status).toBe(500)
  })

  it('répond 500 à un événement de l’autre mode, pour que Stripe relivre et alerte', async () => {
    const réel = événement('customer.subscription.updated', abonnement(), { livemode: true })
    expect((await livrer(réel, signer(réel))).status).toBe(500)
    expect(base.enregistrerÉvénementDAbonnement).not.toHaveBeenCalled()
  })

  it('répond 200 à une contrainte violée : relivrer n’y changerait rien', async () => {
    base.enregistrerÉvénementDAbonnement.mockRejectedValue(Object.assign(new Error('[base] (SQLSTATE 23514).'), { code: '23514' }))
    const brut = événement('customer.subscription.updated', abonnement())
    expect((await livrer(brut, signer(brut))).status).toBe(200)
  })

  it('répond 200 à une organisation inconnue : relivrer n’y changerait rien', async () => {
    base.enregistrerÉvénementDAbonnement.mockResolvedValue({ sorte: 'organisation-inconnue' })
    const brut = événement('customer.subscription.updated', abonnement())
    expect((await livrer(brut, signer(brut))).status).toBe(200)
  })
})
