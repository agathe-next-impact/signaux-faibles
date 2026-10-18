import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import type { Base } from '@/lib/base/client'
import { fixerJ0, ouvrirEnEssai } from '@/lib/base/organisations'
import { abonnements, lecteurs, organisations } from '@/lib/base/schema'
import { baseEnMémoire } from './aide/base-en-memoire'

const REGISTRE = 'aaaabbbbccccddddeeeeffff00005555'
const AUTRE = 'aaaabbbbccccddddeeeeffff00006666'

describe('ouverture d’une organisation en essai', () => {
  let db: Base
  let fermer: () => Promise<void>
  beforeEach(async () => {
    ;({ db, fermer } = await baseEnMémoire())
  })
  afterEach(async () => {
    await fermer()
  })

  const lire = async (slug: string) => (await db.select().from(organisations).where(eq(organisations.slug, slug)))[0]!

  it('crée en essai, sans J0, sans relecture, et reste rejouable', async () => {
    const r = await ouvrirEnEssai({ slug: 'acme', nom: 'Acme', registreNotion: REGISTRE }, db)
    expect(r.sorte).toBe('créée')
    const o = await lire('acme')
    expect(o).toMatchObject({ état: 'essai', activéeLe: null, relectureRequise: false, registreNotion: REGISTRE })
    expect((await ouvrirEnEssai({ slug: 'acme', nom: 'Acme', registreNotion: REGISTRE }, db)).sorte).toBe('déjà-en-essai')
  })

  it('fait passer demande et génération en essai', async () => {
    await db.insert(organisations).values({ slug: 'gen', nom: 'Gen', état: 'generation' })
    expect((await ouvrirEnEssai({ slug: 'gen', nom: 'Gen SA', registreNotion: REGISTRE }, db)).sorte).toBe('passée-en-essai')
    expect(await lire('gen')).toMatchObject({ état: 'essai', nom: 'Gen SA', registreNotion: REGISTRE })
  })

  it('ne rétrograde jamais un client historique : abonnée avec un lecteur actif, ou suspendue', async () => {
    const [h] = await db.insert(organisations).values({ slug: 'hist', nom: 'Hist', état: 'abonnee', registreNotion: REGISTRE }).returning()
    await db.insert(lecteurs).values({ organisationId: h!.id, nom: 'Léa', email: 'lea@h.fr', identifiantAcces: 'a'.repeat(32) })
    expect(await ouvrirEnEssai({ slug: 'hist', nom: 'Hist', registreNotion: REGISTRE }, db)).toEqual({ sorte: 'état-incompatible', état: 'abonnee' })
    await db.insert(organisations).values({ slug: 'susp', nom: 'Susp', état: 'suspendue' })
    expect((await ouvrirEnEssai({ slug: 'susp', nom: 'Susp', registreNotion: AUTRE }, db)).sorte).toBe('état-incompatible')
    expect((await lire('hist')).état).toBe('abonnee')
  })

  it('reprend une organisation créée par l’import avant l’activation : abonnée, sans J0, sans abonnement, sans lecteur actif', async () => {
    const [o] = await db.insert(organisations).values({ slug: 'neuve', nom: 'Neuve', état: 'abonnee', relectureRequise: true, registreNotion: REGISTRE }).returning()
    await db.insert(lecteurs).values({ organisationId: o!.id, nom: 'Léa', email: 'lea@n.fr', identifiantAcces: 'b'.repeat(32), actif: false })
    expect((await ouvrirEnEssai({ slug: 'neuve', nom: 'Neuve', registreNotion: REGISTRE }, db)).sorte).toBe('passée-en-essai')
    expect(await lire('neuve')).toMatchObject({ état: 'essai', relectureRequise: false })
  })

  it('une abonnée sans lecteur mais avec un abonnement Stripe reste abonnée', async () => {
    const [o] = await db.insert(organisations).values({ slug: 'payee', nom: 'Payée', état: 'abonnee', registreNotion: REGISTRE }).returning()
    await db.insert(abonnements).values({
      organisationId: o!.id, clientStripe: 'cus_1', abonnementStripe: 'sub_1', état: 'active',
      dernierÉvénement: 'evt_1', événementLe: new Date(), dernierType: 'customer.subscription.created',
    })
    expect(await ouvrirEnEssai({ slug: 'payee', nom: 'Payée', registreNotion: REGISTRE }, db)).toEqual({ sorte: 'état-incompatible', état: 'abonnee' })
  })

  it('refuse un registre déjà porté par un autre slug', async () => {
    await ouvrirEnEssai({ slug: 'acme', nom: 'Acme', registreNotion: REGISTRE }, db)
    expect(await ouvrirEnEssai({ slug: 'acme-bis', nom: 'Acme', registreNotion: REGISTRE }, db)).toEqual({ sorte: 'registre-pris', slug: 'acme' })
  })

  it('fixe J0 une seule fois, et seulement en essai', async () => {
    const r = await ouvrirEnEssai({ slug: 'acme', nom: 'Acme', registreNotion: REGISTRE }, db)
    if (r.sorte !== 'créée') throw new Error(r.sorte)
    const j0 = new Date('2026-10-19T12:00:00Z')
    expect(await fixerJ0(r.organisationId, j0, db)).toBe(true)
    expect(await fixerJ0(r.organisationId, new Date('2026-10-26T12:00:00Z'), db)).toBe(false)
    expect((await lire('acme')).activéeLe?.toISOString()).toBe(j0.toISOString())
    const [h] = await db.insert(organisations).values({ slug: 'hist', nom: 'Hist', état: 'abonnee' }).returning()
    expect(await fixerJ0(h!.id, j0, db)).toBe(false)
  })
})
