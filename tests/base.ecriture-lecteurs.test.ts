import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Base } from '@/lib/base/client'
import { changerActivation, créerLecteur, sonderLaBase, tirerIdentifiantDAccès } from '@/lib/base/ecriture-lecteurs'
import { lireLecteurParIdentifiant } from '@/lib/base/lecteurs'
import { lecteurs, organisations } from '@/lib/base/schema'
import { baseEnMémoire } from './aide/base-en-memoire'

describe('écriture des lecteurs (palier 1a-bis)', () => {
  let db: Base
  let fermer: () => Promise<void>

  beforeEach(async () => {
    ;({ db, fermer } = await baseEnMémoire())
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    await db.insert(organisations).values({
      slug: 'hermitage',
      nom: 'L’Hermitage',
      état: 'abonnee',
      registreNotion: '3d5fe829ce71810da651f3783a725bd8',
    })
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await fermer()
  })

  it('tire un identifiant de 32 hexadécimaux, différent à chaque fois', () => {
    const a = tirerIdentifiantDAccès()
    expect(a).toMatch(/^[0-9a-f]{32}$/)
    expect(tirerIdentifiantDAccès()).not.toBe(a)
  })

  it('crée un lecteur actif, avec un identifiant tiré par le portail', async () => {
    expect(await créerLecteur({ slug: 'hermitage', nom: 'Claire', email: 'Claire@Hermitage.fr' }, db)).toEqual({
      sorte: 'créé',
    })
    const [ligne] = await db.select().from(lecteurs)
    expect(ligne?.actif).toBe(true)
    expect(ligne?.identifiantAcces).toMatch(/^[0-9a-f]{32}$/)
    expect((await lireLecteurParIdentifiant(ligne!.identifiantAcces, db))?.slug).toBe('hermitage')
  })

  it('ne recrée pas une adresse déjà inscrite chez ce client, casse ignorée', async () => {
    await créerLecteur({ slug: 'hermitage', nom: 'Claire', email: 'claire@hermitage.fr' }, db)
    expect(await créerLecteur({ slug: 'hermitage', nom: 'Claire', email: 'CLAIRE@hermitage.fr' }, db)).toEqual({
      sorte: 'déjà-inscrit',
    })
  })

  it('refuse un client inconnu ou archivé', async () => {
    expect(await créerLecteur({ slug: 'inconnu', nom: 'X', email: 'x@y.fr' }, db)).toEqual({
      sorte: 'organisation-inconnue',
    })
    await db.update(organisations).set({ archivéeLe: new Date() }).where(eq(organisations.slug, 'hermitage'))
    expect(await créerLecteur({ slug: 'hermitage', nom: 'X', email: 'x@y.fr' }, db)).toEqual({
      sorte: 'organisation-inconnue',
    })
  })

  it('révoque à la requête suivante, puis réactive', async () => {
    await créerLecteur({ slug: 'hermitage', nom: 'Claire', email: 'claire@hermitage.fr' }, db)
    const [ligne] = await db.select().from(lecteurs)

    expect(await changerActivation({ slug: 'hermitage', email: 'CLAIRE@hermitage.fr', actif: false }, db)).toEqual({
      sorte: 'révoqué',
    })
    expect((await lireLecteurParIdentifiant(ligne!.identifiantAcces, db))?.actif).toBe(false)
    expect(await changerActivation({ slug: 'hermitage', email: 'claire@hermitage.fr', actif: false }, db)).toEqual({
      sorte: 'inchangé',
    })
    expect(await changerActivation({ slug: 'hermitage', email: 'claire@hermitage.fr', actif: true }, db)).toEqual({
      sorte: 'réactivé',
    })
  })

  it('ne révoque pas chez un autre client que celui désigné', async () => {
    await créerLecteur({ slug: 'hermitage', nom: 'Claire', email: 'claire@hermitage.fr' }, db)
    expect(await changerActivation({ slug: 'autre', email: 'claire@hermitage.fr', actif: false }, db)).toEqual({
      sorte: 'lecteur-inconnu',
    })
  })

  it('la sonde compte les lecteurs actifs, et ne lève pas sur une base cassée', async () => {
    await créerLecteur({ slug: 'hermitage', nom: 'Claire', email: 'claire@hermitage.fr' }, db)
    expect(await sonderLaBase(db)).toEqual({ joignable: true, lecteursActifs: 1, code: null })

    const client = new PGlite()
    try {
      const cassée = await sonderLaBase(drizzle({ client }) as unknown as Base)
      expect(cassée.joignable).toBe(false)
      expect(cassée.code).toBe('42P01')
    } finally {
      await client.close()
    }
  })
})
