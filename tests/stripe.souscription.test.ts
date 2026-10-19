import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cléAccordéeAuMode,
  configurationStripe,
  lienTableauDeBordStripe,
  paramètresDeFacturation,
  paramètresDePaiement,
  type ConfigurationStripe,
} from '@/lib/stripe/souscription'

const ENV = {
  STRIPE_CLE_SECRETE: 'sk_test_abc',
  STRIPE_PRIX_MENSUEL: 'price_mensuel',
  STRIPE_PRIX_ANNUEL: 'price_annuel',
  STRIPE_TAUX_TVA: 'txr_20',
  PORTAIL_URL: 'https://www.signauxfaibles.io/',
} as unknown as NodeJS.ProcessEnv

describe('configurationStripe', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => vi.restoreAllMocks())

  it('lit la configuration complète et retire la barre finale de l’URL', () => {
    expect(configurationStripe(ENV)).toEqual({
      cléSecrète: 'sk_test_abc',
      prix: { mensuelle: 'price_mensuel', annuelle: 'price_annuel' },
      tauxDeTva: 'txr_20',
      portailUrl: 'https://www.signauxfaibles.io',
    })
  })

  it('le taux de TVA est facultatif, posé vide il vaut absent', () => {
    expect(configurationStripe({ ...ENV, STRIPE_TAUX_TVA: '' })?.tauxDeTva).toBeNull()
  })

  it('une pièce manquante ou mal formée rend la souscription indisponible, sans citer la valeur', () => {
    const avertir = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(configurationStripe({ ...ENV, STRIPE_CLE_SECRETE: '' })).toBeNull()
    expect(configurationStripe({ ...ENV, STRIPE_PRIX_ANNUEL: 'prod_123' })).toBeNull()
    expect(configurationStripe({ ...ENV, STRIPE_CLE_SECRETE: 'pk_test_publique' })).toBeNull()
    expect(configurationStripe({ ...ENV, STRIPE_TAUX_TVA: '20' })).toBeNull()
    const journal = avertir.mock.calls.flat().join(' ')
    expect(journal).toContain('STRIPE_CLE_SECRETE')
    expect(journal).not.toContain('pk_test_publique')
  })

  it('accepte une clé restreinte', () => {
    expect(configurationStripe({ ...ENV, STRIPE_CLE_SECRETE: 'rk_live_x' })?.cléSecrète).toBe('rk_live_x')
  })
})

describe('cléAccordéeAuMode', () => {
  it('refuse une clé de test en mode réel, et l’inverse', () => {
    expect(cléAccordéeAuMode('sk_test_a', false)).toBe(true)
    expect(cléAccordéeAuMode('sk_live_a', true)).toBe(true)
    expect(cléAccordéeAuMode('sk_test_a', true)).toBe(false)
    expect(cléAccordéeAuMode('rk_live_a', false)).toBe(false)
  })
})

describe('paramètresDePaiement', () => {
  const configuration = configurationStripe(ENV) as ConfigurationStripe
  const ORG = '0b8f3c1e-1111-4222-8333-944445555666'

  it('pose l’organisation dans les métadonnées de l’abonnement, celles que lit le webhook', () => {
    const p = paramètresDePaiement({ configuration, formule: 'annuelle', organisationId: ORG, slug: 'konica', clientStripe: null, email: 'a@b.fr' })
    expect(p.mode).toBe('subscription')
    expect(p.managed_payments).toEqual({ enabled: false })
    expect(p.subscription_data?.metadata).toEqual({ organisation_id: ORG, slug: 'konica' })
    expect(p.line_items).toEqual([{ price: 'price_annuel', quantity: 1 }])
    expect(p.subscription_data?.default_tax_rates).toEqual(['txr_20'])
    expect(p.client_reference_id).toBe(ORG)
    expect(p.customer_email).toBe('a@b.fr')
    expect(p.customer).toBeUndefined()
    expect(p.tax_id_collection).toEqual({ enabled: true })
    expect(p.billing_address_collection).toBe('required')
    expect(p.success_url).toBe('https://www.signauxfaibles.io/konica?abonnement=merci')
    expect(p.cancel_url).toBe('https://www.signauxfaibles.io/konica')
  })

  it('réutilise le client Stripe connu, avec la mise à jour exigée pour le numéro de TVA', () => {
    const p = paramètresDePaiement({ configuration, formule: 'mensuelle', organisationId: ORG, slug: 'k', clientStripe: 'cus_1', email: 'a@b.fr' })
    expect(p.customer).toBe('cus_1')
    expect(p.customer_email).toBeUndefined()
    expect(p.customer_update).toEqual({ address: 'auto', name: 'auto' })
    expect(p.line_items).toEqual([{ price: 'price_mensuel', quantity: 1 }])
  })

  it('sans taux de TVA, n’en ajoute aucun', () => {
    const p = paramètresDePaiement({ configuration: { ...configuration, tauxDeTva: null }, formule: 'mensuelle', organisationId: ORG, slug: 'k', clientStripe: null, email: null })
    expect(p.subscription_data).toEqual({ metadata: { organisation_id: ORG, slug: 'k' } })
    expect(p.customer_email).toBeUndefined()
  })
})

describe('paramètresDeFacturation', () => {
  it('ramène le lecteur à son espace', () => {
    const configuration = configurationStripe(ENV) as ConfigurationStripe
    expect(paramètresDeFacturation({ configuration, clientStripe: 'cus_1', slug: 'k' })).toEqual({
      customer: 'cus_1',
      locale: 'fr',
      return_url: 'https://www.signauxfaibles.io/k',
    })
  })
})

describe('lienTableauDeBordStripe', () => {
  it('mène à l’abonnement, en test ou en réel selon le mode', () => {
    expect(lienTableauDeBordStripe('sub_123', false)).toBe('https://dashboard.stripe.com/test/subscriptions/sub_123')
    expect(lienTableauDeBordStripe('sub_123', true)).toBe('https://dashboard.stripe.com/subscriptions/sub_123')
  })
})
