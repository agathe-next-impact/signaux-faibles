import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Base } from '@/lib/base/client'
import { enregistrerÉvénementDAbonnement } from '@/lib/base/abonnements'
import { lecteurs, organisations } from '@/lib/base/schema'
import { lireSituationDAbonnement, tableauDesAbonnements } from '@/lib/base/situation'
import { baseEnMémoire } from './aide/base-en-memoire'

/**
 * La situation d'abonnement (19 octobre 2026), lue pour « Mon abonnement » et
 * pour le tableau de l'opératrice : les mêmes règles que le parcours, et jamais
 * une adresse email.
 */
describe('situation d’abonnement', () => {
  let db: Base
  let fermer: () => Promise<void>
  const REGISTRE = 'aaaabbbbccccddddeeeeffff00003333'
  const J0 = new Date('2026-10-05T07:00:00Z')

  beforeEach(async () => {
    ;({ db, fermer } = await baseEnMémoire())
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(async () => {
    vi.restoreAllMocks()
    await fermer()
  })

  async function organisation(slug: string, état: 'essai' | 'abonnee', registre: string | null) {
    const [o] = await db
      .insert(organisations)
      .values({ slug, nom: slug.toUpperCase(), état, activéeLe: état === 'essai' ? J0 : null, registreNotion: registre })
      .returning({ id: organisations.id })
    return o!.id
  }

  it('rassemble l’état, l’abonnement qui fait foi et les lecteurs actifs, par leur nom seul', async () => {
    const id = await organisation('p', 'essai', REGISTRE)
    await db.insert(lecteurs).values([
      { organisationId: id, nom: 'Zoé', email: 'zoe@p.fr', identifiantAcces: 'a'.repeat(32), actif: true },
      { organisationId: id, nom: 'Ana', email: 'ana@p.fr', identifiantAcces: 'b'.repeat(32), actif: true },
      { organisationId: id, nom: 'Révoqué', email: 'r@p.fr', identifiantAcces: 'c'.repeat(32), actif: false },
      // L'opérateur global, sans organisation : jamais compté.
      { organisationId: null, nom: 'Opératrice', identifiantAcces: 'd'.repeat(32), actif: true, tousLesEspaces: true },
    ])
    const commun = { organisationId: id, clientStripe: 'cus_1', périodeFin: null, type: 'customer.subscription.updated' }
    await enregistrerÉvénementDAbonnement(
      { ...commun, abonnementStripe: 'sub_1', état: 'canceled', formule: 'mensuelle', événementId: 'e1', événementLe: new Date('2026-10-20T00:00:00Z') },
      db,
    )
    await enregistrerÉvénementDAbonnement(
      { ...commun, abonnementStripe: 'sub_2', état: 'active', formule: 'annuelle', périodeFin: new Date('2027-10-21T00:00:00Z'), événementId: 'e2', événementLe: new Date('2026-10-21T00:00:00Z') },
      db,
    )

    const situation = await lireSituationDAbonnement(REGISTRE, db)
    expect(situation).toEqual({
      organisation: { état: 'essai', activéeLe: J0, essaiOuvertLe: null, offre: 'standard', parutionsDEssai: 2, historique: false },
      abonnement: { état: 'active', formule: 'annuelle', périodeFin: new Date('2027-10-21T00:00:00Z') },
      lecteurs: [
        { id: expect.stringMatching(/^[0-9a-f-]{36}$/), nom: 'Ana' },
        { id: expect.stringMatching(/^[0-9a-f-]{36}$/), nom: 'Zoé' },
      ],
    })
    expect(JSON.stringify(situation)).not.toContain('@')
  })

  it('rend null pour une organisation absente, archivée, ou une clé mal formée', async () => {
    expect(await lireSituationDAbonnement(REGISTRE, db)).toBeNull()
    expect(await lireSituationDAbonnement('pas-une-cle', db)).toBeNull()
    const id = await organisation('a', 'essai', REGISTRE)
    await db.update(organisations).set({ archivéeLe: new Date() })
    expect(id).toBeTruthy()
    expect(await lireSituationDAbonnement(REGISTRE, db)).toBeNull()
  })

  it('le tableau porte toutes les organisations non archivées, triées, avec leur abonnement et leurs lecteurs', async () => {
    const b = await organisation('beta', 'abonnee', null)
    const a = await organisation('alpha', 'essai', REGISTRE)
    const z = await organisation('zeta', 'essai', 'aaaabbbbccccddddeeeeffff00004444')
    await db.update(organisations).set({ archivéeLe: new Date() }).where(eq(organisations.id, z))
    await db.insert(lecteurs).values([
      { organisationId: a, nom: 'Un', identifiantAcces: 'a'.repeat(32), actif: true },
      { organisationId: a, nom: 'Deux', identifiantAcces: 'b'.repeat(32), actif: true },
      { organisationId: a, nom: 'Trois', identifiantAcces: 'c'.repeat(32), actif: false },
    ])
    await enregistrerÉvénementDAbonnement(
      {
        organisationId: b,
        clientStripe: 'cus_b',
        abonnementStripe: 'sub_b',
        état: 'past_due',
        formule: 'mensuelle',
        périodeFin: null,
        événementId: 'eb',
        événementLe: new Date('2026-10-21T00:00:00Z'),
        type: 'customer.subscription.updated',
      },
      db,
    )

    const lignes = await tableauDesAbonnements(db)
    expect(lignes.map((l) => l.slug)).toEqual(['alpha', 'beta'])
    expect(lignes[0]).toMatchObject({ état: 'essai', activéeLe: J0, relectureRequise: true, offre: 'standard', parutionsDEssai: 2, abonnement: null, lecteursActifs: 2 })
    expect(lignes[1]).toMatchObject({
      état: 'abonnee',
      abonnement: { abonnementStripe: 'sub_b', état: 'past_due', formule: 'mensuelle', périodeFin: null },
      lecteursActifs: 0,
    })
  })
})
