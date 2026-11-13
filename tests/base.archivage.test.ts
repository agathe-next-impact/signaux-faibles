import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import type { Base } from '@/lib/base/client'
import { archiverLOrganisation, désarchiverLOrganisation, organisationsArchivées, ouvrirEnEssai, slugDuRegistre } from '@/lib/base/organisations'
import { tableauDesAbonnements } from '@/lib/base/situation'
import { abonnements, lecteurs, organisations, travaux } from '@/lib/base/schema'
import { baseEnMémoire } from './aide/base-en-memoire'

/**
 * L'archivage d'une organisation (13 novembre 2026) : avant lui, `archivée_le`
 * était lu partout et écrit nulle part, et une organisation dont les accès
 * avaient été supprimés restait au tableau des abonnements.
 */
const REGISTRE = 'aaaabbbbccccddddeeeeffff00007777'
const LE_13 = new Date('2026-11-13T09:00:00Z')

describe('archivage d’une organisation', () => {
  let db: Base
  let fermer: () => Promise<void>
  beforeEach(async () => {
    ;({ db, fermer } = await baseEnMémoire())
  })
  afterEach(async () => {
    await fermer()
  })

  const lire = async (slug: string) => (await db.select().from(organisations).where(eq(organisations.slug, slug)))[0]!

  it('pose la date, désactive les lecteurs du client, abandonne les travaux non pris, et sort du tableau', async () => {
    await ouvrirEnEssai({ slug: 'acme', nom: 'Acme', registreNotion: REGISTRE }, db)
    const o = await lire('acme')
    await db.insert(lecteurs).values([
      { organisationId: o.id, nom: 'Léa', email: 'lea@acme.fr', identifiantAcces: 'a'.repeat(32) },
      { organisationId: o.id, nom: 'Paul', email: 'paul@acme.fr', identifiantAcces: 'b'.repeat(32), actif: false },
    ])
    await db.insert(travaux).values([
      { type: 'lettre', organisationId: o.id, échéance: LE_13, état: 'a_faire', contexte: {} },
      { type: 'revue', organisationId: o.id, échéance: LE_13, état: 'pris', contexte: {} },
    ])
    expect((await tableauDesAbonnements(db)).map((l) => l.slug)).toEqual(['acme'])

    expect(await archiverLOrganisation('acme', db, LE_13)).toEqual({ sorte: 'archivée', lecteursDésactivés: 1, travauxAbandonnés: 1 })
    expect((await lire('acme')).archivéeLe).toEqual(LE_13)
    expect((await db.select({ actif: lecteurs.actif }).from(lecteurs)).every((l) => !l.actif)).toBe(true)
    expect((await db.select({ état: travaux.état }).from(travaux)).map((t) => t.état).sort()).toEqual(['abandonne', 'pris'])
    expect(await tableauDesAbonnements(db)).toEqual([])
    expect(await organisationsArchivées(db)).toEqual([{ slug: 'acme', nom: 'Acme', archivéeLe: LE_13 }])
    expect((await archiverLOrganisation('acme', db, LE_13)).sorte).toBe('déjà-archivée')
  })

  it('désarchiver la rend au tableau sans réactiver aucun lecteur', async () => {
    await ouvrirEnEssai({ slug: 'acme', nom: 'Acme', registreNotion: REGISTRE }, db)
    const o = await lire('acme')
    await db.insert(lecteurs).values({ organisationId: o.id, nom: 'Léa', email: 'lea@acme.fr', identifiantAcces: 'a'.repeat(32) })
    await archiverLOrganisation('acme', db, LE_13)
    expect(await désarchiverLOrganisation('acme', db, LE_13)).toEqual({ sorte: 'désarchivée' })
    expect((await lire('acme')).archivéeLe).toBeNull()
    expect((await db.select({ actif: lecteurs.actif }).from(lecteurs))[0]!.actif).toBe(false)
    expect((await tableauDesAbonnements(db)).map((l) => l.slug)).toEqual(['acme'])
    expect((await désarchiverLOrganisation('acme', db, LE_13)).sorte).toBe('pas-archivée')
    expect((await désarchiverLOrganisation('nulle-part', db, LE_13)).sorte).toBe('inconnue')
  })

  it('refuse tant qu’un abonnement Stripe est ouvert, et laisse l’opérateur global en place', async () => {
    await ouvrirEnEssai({ slug: 'payee', nom: 'Payée', registreNotion: REGISTRE }, db)
    const o = await lire('payee')
    await db.insert(abonnements).values({
      organisationId: o.id, clientStripe: 'cus_1', abonnementStripe: 'sub_1', état: 'active',
      dernierÉvénement: 'evt_1', événementLe: new Date(), dernierType: 'customer.subscription.created',
    })
    await db.insert(lecteurs).values({ organisationId: null, nom: 'Opératrice', email: 'op@sf.io', identifiantAcces: 'c'.repeat(32), tousLesEspaces: true, rôle: 'operateur' })
    expect((await archiverLOrganisation('payee', db, LE_13)).sorte).toBe('abonnée-stripe')
    expect((await lire('payee')).archivéeLe).toBeNull()

    await db.update(abonnements).set({ état: 'canceled' })
    expect((await archiverLOrganisation('payee', db, LE_13)).sorte).toBe('archivée')
    expect((await db.select({ actif: lecteurs.actif }).from(lecteurs))[0]!.actif).toBe(true)
    expect((await archiverLOrganisation('nulle-part', db, LE_13)).sorte).toBe('inconnue')
  })

  it('retrouve le slug par la clé du registre, avec ou sans tirets', async () => {
    await ouvrirEnEssai({ slug: 'acme', nom: 'Acme', registreNotion: REGISTRE }, db)
    expect(await slugDuRegistre('aaaabbbb-cccc-dddd-eeee-ffff00007777', db)).toBe('acme')
    expect(await slugDuRegistre('f'.repeat(32), db)).toBeNull()
  })
})
