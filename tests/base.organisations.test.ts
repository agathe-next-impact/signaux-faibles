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
    const [h] = await db.insert(organisations).values({ slug: 'hist', nom: 'Hist', état: 'abonnee', registreNotion: REGISTRE, crééeLe: new Date('2026-10-16T09:00:00Z') }).returning()
    await db.insert(lecteurs).values({ organisationId: h!.id, nom: 'Léa', email: 'lea@h.fr', identifiantAcces: 'a'.repeat(32) })
    expect(await ouvrirEnEssai({ slug: 'hist', nom: 'Hist', registreNotion: REGISTRE }, db)).toEqual({ sorte: 'état-incompatible', état: 'abonnee' })
    await db.insert(organisations).values({ slug: 'susp', nom: 'Susp', état: 'suspendue' })
    expect((await ouvrirEnEssai({ slug: 'susp', nom: 'Susp', registreNotion: AUTRE }, db)).sorte).toBe('état-incompatible')
    expect((await lire('hist')).état).toBe('abonnee')
  })

  it('reprend une abonnée née de l’import pendant l’onboarding : récente, après la mise en service, sans J0 ni abonnement', async () => {
    const maintenant = new Date('2026-10-25T08:00:00Z')
    const [o] = await db.insert(organisations).values({ slug: 'neuve', nom: 'Neuve', état: 'abonnee', relectureRequise: true, registreNotion: REGISTRE, crééeLe: new Date('2026-10-20T08:00:00Z') }).returning()
    // Un lecteur actif ne l'empêche pas : l'import a pu suivre la case Actif.
    await db.insert(lecteurs).values({ organisationId: o!.id, nom: 'Léa', email: 'lea@n.fr', identifiantAcces: 'b'.repeat(32) })
    expect((await ouvrirEnEssai({ slug: 'neuve', nom: 'Neuve', registreNotion: REGISTRE }, db, maintenant)).sorte).toBe('passée-en-essai')
    const lue = await lire('neuve')
    expect(lue).toMatchObject({ état: 'essai', relectureRequise: false })
    expect(lue.essaiOuvertLe?.toISOString()).toBe(maintenant.toISOString())
  })

  it('ne reprend jamais un client historique sans lecteur actif : importé avant la mise en service', async () => {
    await db.insert(organisations).values({ slug: 'vieux', nom: 'Vieux', état: 'abonnee', registreNotion: REGISTRE, crééeLe: new Date('2026-10-16T09:00:00Z') })
    expect(await ouvrirEnEssai({ slug: 'vieux', nom: 'Vieux', registreNotion: REGISTRE }, db, new Date('2026-10-20T08:00:00Z'))).toEqual({ sorte: 'état-incompatible', état: 'abonnee' })
  })

  it('ne reprend pas une abonnée créée il y a plus de quatorze jours', async () => {
    await db.insert(organisations).values({ slug: 'lente', nom: 'Lente', état: 'abonnee', registreNotion: REGISTRE, crééeLe: new Date('2026-10-19T09:00:00Z') })
    expect((await ouvrirEnEssai({ slug: 'lente', nom: 'Lente', registreNotion: REGISTRE }, db, new Date('2026-11-10T08:00:00Z'))).sorte).toBe('état-incompatible')
  })

  it('un rejeu corrige le registre tant que J0 n’est pas posé, puis le refuse', async () => {
    const r = await ouvrirEnEssai({ slug: 'acme', nom: 'Acme', registreNotion: AUTRE }, db)
    if (r.sorte !== 'créée') throw new Error(r.sorte)
    expect((await ouvrirEnEssai({ slug: 'acme', nom: 'Acme', registreNotion: REGISTRE }, db)).sorte).toBe('déjà-en-essai')
    expect((await lire('acme')).registreNotion).toBe(REGISTRE)
    await fixerJ0(r.organisationId, new Date('2026-10-19T12:00:00Z'), db)
    expect(await ouvrirEnEssai({ slug: 'acme', nom: 'Acme', registreNotion: AUTRE }, db)).toEqual({ sorte: 'registre-différent', registreActuel: REGISTRE })
  })

  it('normalise le registre : tirets et majuscules', async () => {
    const avecTirets = `${REGISTRE.slice(0, 8)}-${REGISTRE.slice(8, 12)}-${REGISTRE.slice(12, 16)}-${REGISTRE.slice(16, 20)}-${REGISTRE.slice(20)}`.toUpperCase()
    await ouvrirEnEssai({ slug: 'acme', nom: 'Acme', registreNotion: avecTirets }, db)
    expect((await lire('acme')).registreNotion).toBe(REGISTRE)
  })

  it('une abonnée récente mais avec un abonnement Stripe reste abonnée', async () => {
    const [o] = await db.insert(organisations).values({ slug: 'payee', nom: 'Payée', état: 'abonnee', registreNotion: REGISTRE, crééeLe: new Date('2026-10-20T08:00:00Z') }).returning()
    await db.insert(abonnements).values({
      organisationId: o!.id, clientStripe: 'cus_1', abonnementStripe: 'sub_1', état: 'active',
      dernierÉvénement: 'evt_1', événementLe: new Date(), dernierType: 'customer.subscription.created',
    })
    expect(await ouvrirEnEssai({ slug: 'payee', nom: 'Payée', registreNotion: REGISTRE }, db, new Date('2026-10-22T08:00:00Z'))).toEqual({ sorte: 'état-incompatible', état: 'abonnee' })
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
