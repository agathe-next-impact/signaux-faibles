import Stripe from 'stripe'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Base } from '@/lib/base/client'
import { enregistrerÉvénementDAbonnement, lireFacturation, lireLeForfait } from '@/lib/base/abonnements'
import { changerActivation, créerLecteur } from '@/lib/base/ecriture-lecteurs'
import { réglerLeParcours } from '@/lib/base/organisations'
import { lecteurs, organisations } from '@/lib/base/schema'
import { lireSituationDAbonnement } from '@/lib/base/situation'
import {
  DÉFINITIONS_DES_FORFAITS,
  FORFAITS,
  forfaitAtteint,
  forfaitEnVigueur,
  lecteursFaceAuForfait,
  LECTEURS_ACTIFS_MAX,
  PRIX_MENSUEL_HT,
  prixAnnuelDuForfaitHT,
  plafondDeLecteurs,
} from '@/lib/domaine/offre'
import { configurationStripe, paramètresDePaiement, prixPosé, type ConfigurationStripe } from '@/lib/stripe/souscription'
import { interpréterLivraisonStripe } from '@/lib/stripe/webhook'
import { baseEnMémoire } from './aide/base-en-memoire'

/**
 * Les forfaits par nombre de lecteurs (19 novembre 2026) : trois, dix, cent,
 * illimité ; le plafond tenu à l'écriture des lecteurs, le forfait lu chez
 * Stripe par le webhook, posé par l'opératrice à défaut.
 */
describe('les forfaits de l’offre', () => {
  it('sont les quatre demandés, aux prix demandés, le premier étant le forfait d’origine', () => {
    expect(FORFAITS.map((f) => [DÉFINITIONS_DES_FORFAITS[f].lecteurs, DÉFINITIONS_DES_FORFAITS[f].prixMensuelHT])).toEqual([
      [3, PRIX_MENSUEL_HT],
      [10, 199],
      [100, 299],
      [null, 499],
    ])
    expect(plafondDeLecteurs('trois')).toBe(LECTEURS_ACTIFS_MAX)
  })

  it('l’annuel est à dix mois payés pour chaque forfait', () => {
    expect(FORFAITS.map(prixAnnuelDuForfaitHT)).toEqual([PRIX_MENSUEL_HT * 10, 1990, 2990, 4990])
  })

  it('le plafond bloque au nombre du forfait, jamais en illimité', () => {
    expect(forfaitAtteint('trois', 2)).toBe(false)
    expect(forfaitAtteint('trois', 3)).toBe(true)
    expect(forfaitAtteint('dix', 9)).toBe(false)
    expect(forfaitAtteint('dix', 10)).toBe(true)
    expect(forfaitAtteint('cent', 100)).toBe(true)
    expect(forfaitAtteint('illimite', 10_000)).toBe(false)
    expect(lecteursFaceAuForfait(4, 'dix')).toBe('4 sur 10')
    expect(lecteursFaceAuForfait(4, 'illimite')).toBe('4 · illimité')
  })

  it('un abonnement ouvert qui porte un forfait l’emporte ; fermé ou muet, le forfait posé fait foi', () => {
    expect(forfaitEnVigueur({ forfaitPosé: 'trois', abonnement: { ouvert: true, forfait: 'cent' } })).toBe('cent')
    expect(forfaitEnVigueur({ forfaitPosé: 'dix', abonnement: { ouvert: false, forfait: 'cent' } })).toBe('dix')
    expect(forfaitEnVigueur({ forfaitPosé: 'dix', abonnement: { ouvert: true, forfait: null } })).toBe('dix')
    expect(forfaitEnVigueur({ forfaitPosé: 'illimite', abonnement: null })).toBe('illimite')
  })
})

describe('les prix Stripe des forfaits', () => {
  const ENV = {
    STRIPE_CLE_SECRETE: 'sk_test_abc',
    STRIPE_PRIX_MENSUEL: 'price_mensuel',
    STRIPE_PRIX_ANNUEL: 'price_annuel',
    STRIPE_PRIX_FONDATEUR: 'price_fondateur',
    STRIPE_PRIX_MENSUEL_DIX: 'price_m10',
    STRIPE_PRIX_ANNUEL_DIX: 'price_a10',
    STRIPE_PRIX_MENSUEL_ILLIMITE: 'price_mi',
    PORTAIL_URL: 'https://www.signauxfaibles.io',
  } as unknown as NodeJS.ProcessEnv

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => vi.restoreAllMocks())

  it('lit chaque prix, et laisse absent celui qui n’est pas posé', () => {
    const configuration = configurationStripe(ENV) as ConfigurationStripe
    expect(prixPosé(configuration, 'mensuelle')).toBe('price_mensuel')
    expect(prixPosé(configuration, 'annuelle', 'dix')).toBe('price_a10')
    expect(prixPosé(configuration, 'mensuelle', 'cent')).toBeNull()
    expect(prixPosé(configuration, 'mensuelle', 'illimite')).toBe('price_mi')
    expect(prixPosé(configuration, 'annuelle', 'illimite')).toBeNull()
    // Le tarif fondateur n'existe qu'au forfait de base.
    expect(prixPosé(configuration, 'fondateur')).toBe('price_fondateur')
    expect(prixPosé(configuration, 'fondateur', 'dix')).toBeNull()
  })

  it('refuse la configuration entière pour un prix de forfait mal formé', () => {
    expect(configurationStripe({ ...ENV, STRIPE_PRIX_MENSUEL_CENT: 'prod_x' })).toBeNull()
  })

  it('la page de paiement prend le prix du forfait et pose le forfait dans les métadonnées de l’abonnement', () => {
    const configuration = configurationStripe(ENV) as ConfigurationStripe
    const p = paramètresDePaiement({
      configuration,
      formule: 'annuelle',
      forfait: 'dix',
      organisationId: '0b8f3c1e-1111-4222-8333-944445555666',
      slug: 'konica',
      clientStripe: null,
      email: null,
      fraisDeMiseEnPlace: false,
    })
    expect(p.line_items).toEqual([{ price: 'price_a10', quantity: 1 }])
    expect(p.subscription_data?.metadata).toMatchObject({ forfait: 'dix' })
    expect(() =>
      paramètresDePaiement({
        configuration,
        formule: 'mensuelle',
        forfait: 'cent',
        organisationId: '0b8f3c1e-1111-4222-8333-944445555666',
        slug: 'konica',
        clientStripe: null,
        email: null,
        fraisDeMiseEnPlace: false,
      }),
    ).toThrow()
  })
})

describe('le forfait lu par le webhook', () => {
  const SECRET = 'whsec_test_secret_de_signature'
  const livraison = (prix: Record<string, unknown>, métadonnées: Record<string, string> = {}) => {
    const brut = JSON.stringify({
      id: 'evt_1',
      object: 'event',
      type: 'customer.subscription.updated',
      created: 1792231200,
      livemode: false,
      data: {
        object: {
          id: 'sub_1',
          object: 'subscription',
          customer: 'cus_1',
          status: 'active',
          metadata: { organisation_id: '6f1c2a4e-1d2b-4c3d-8e9f-0a1b2c3d4e5f', ...métadonnées },
          items: { data: [{ current_period_end: 1794909600, price: { recurring: { interval: 'month' }, ...prix } }] },
        },
      },
    })
    const décision = interpréterLivraisonStripe({
      brut,
      signature: Stripe.webhooks.generateTestHeaderString({ payload: brut, secret: SECRET }),
      secret: SECRET,
      modeRéel: false,
    })
    return décision.sorte === 'abonnement' ? décision.événement.forfait : 'non lu'
  }

  it('prend celui du prix d’abord, qui suit un changement de forfait chez Stripe', () => {
    expect(livraison({ metadata: { forfait: 'cent' } }, { forfait: 'dix' })).toBe('cent')
  })
  it('à défaut, celui de l’abonnement, posé à la page de paiement', () => {
    expect(livraison({ metadata: {} }, { forfait: 'dix' })).toBe('dix')
  })
  it('une valeur inconnue vaut une absence', () => {
    expect(livraison({ metadata: { forfait: 'vingt' } })).toBeNull()
  })
})

describe('le plafond de lecteurs à l’écriture', () => {
  let db: Base
  let fermer: () => Promise<void>
  const REGISTRE = 'aaaabbbbccccddddeeeeffff00004444'

  beforeEach(async () => {
    ;({ db, fermer } = await baseEnMémoire())
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(async () => {
    vi.restoreAllMocks()
    await fermer()
  })

  async function organisationAvec(actifs: number) {
    const [o] = await db
      .insert(organisations)
      .values({ slug: 'acme', nom: 'Acme', état: 'abonnee', registreNotion: REGISTRE })
      .returning({ id: organisations.id })
    for (let i = 0; i < actifs; i++) {
      await db.insert(lecteurs).values({
        organisationId: o!.id,
        nom: `L${i}`,
        email: `l${i}@acme.fr`,
        identifiantAcces: i.toString(16).padStart(32, '0'),
        actif: true,
      })
    }
    return o!.id
  }

  it('au forfait de base, le quatrième lecteur est refusé', async () => {
    await organisationAvec(3)
    expect(await créerLecteur({ slug: 'acme', nom: 'Quatre', email: 'q@acme.fr' }, db)).toEqual({ sorte: 'plafond-atteint' })
  })

  it('au forfait de dix posé par l’opératrice, il passe, jusqu’au dixième', async () => {
    const id = await organisationAvec(3)
    expect(await réglerLeParcours('acme', { sorte: 'forfait', forfait: 'dix' }, db)).toEqual({ sorte: 'forfait-posé', forfait: 'dix' })
    expect(await créerLecteur({ slug: 'acme', nom: 'Quatre', email: 'q@acme.fr' }, db)).toEqual({ sorte: 'créé' })
    for (let i = 5; i <= 10; i++) {
      expect((await créerLecteur({ slug: 'acme', nom: `N${i}`, email: `n${i}@acme.fr` }, db)).sorte).toBe('créé')
    }
    expect(await créerLecteur({ slug: 'acme', nom: 'Onze', email: 'o@acme.fr' }, db)).toEqual({ sorte: 'plafond-atteint' })
    expect(await lireLeForfait(id, db)).toBe('dix')
  })

  it('un abonnement Stripe ouvert au forfait illimité l’emporte, et sa résiliation rend le forfait posé', async () => {
    const id = await organisationAvec(3)
    const commun = { organisationId: id, clientStripe: 'cus_1', abonnementStripe: 'sub_1', formule: 'mensuelle' as const, périodeFin: null }
    await enregistrerÉvénementDAbonnement(
      { ...commun, état: 'active', forfait: 'illimite', événementId: 'e1', événementLe: new Date('2026-11-19T08:00:00Z'), type: 'customer.subscription.created' },
      db,
    )
    expect(await lireLeForfait(id, db)).toBe('illimite')
    expect((await lireFacturation(REGISTRE, db))?.forfait).toBe('illimite')
    expect((await lireSituationDAbonnement(REGISTRE, db))?.forfait).toBe('illimite')
    expect(await créerLecteur({ slug: 'acme', nom: 'Quatre', email: 'q@acme.fr' }, db)).toEqual({ sorte: 'créé' })

    await enregistrerÉvénementDAbonnement(
      { ...commun, état: 'canceled', forfait: 'illimite', événementId: 'e2', événementLe: new Date('2026-11-20T08:00:00Z'), type: 'customer.subscription.deleted' },
      db,
    )
    expect(await lireLeForfait(id, db)).toBe('trois')
    // Quatre actifs au forfait de trois : personne n'est révoqué, la réactivation d'un retiré est refusée.
    await db.update(lecteurs).set({ actif: false }).where(eq(lecteurs.email, 'q@acme.fr'))
    await db.insert(lecteurs).values({ organisationId: id, nom: 'Cinq', email: 'c@acme.fr', identifiantAcces: 'f'.repeat(32), actif: true })
    expect(await changerActivation({ slug: 'acme', email: 'q@acme.fr', actif: true }, db)).toEqual({ sorte: 'plafond-atteint' })
  })
})
