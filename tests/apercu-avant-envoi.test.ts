import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import type { Base } from '@/lib/base/client'
import { aperçuAvantEnvoiDuRegistre, réglerLeParcours } from '@/lib/base/organisations'
import { organisations } from '@/lib/base/schema'
import { baseEnMémoire } from './aide/base-en-memoire'

const REGISTRE = 'aaaabbbbccccddddeeeeffff00005555'

describe('l’aperçu avant envoi, en base (migration 0022)', () => {
  let db: Base
  let fermer: () => Promise<void>
  beforeEach(async () => {
    ;({ db, fermer } = await baseEnMémoire())
  })
  afterEach(async () => {
    await fermer()
  })

  it('est actif par défaut, pour toute organisation', async () => {
    await db.insert(organisations).values({ slug: 'acme', nom: 'Acme', état: 'essai', registreNotion: REGISTRE })
    const [o] = await db.select().from(organisations).where(eq(organisations.slug, 'acme'))
    expect(o?.aperçuAvantEnvoi).toBe(true)
    expect(await aperçuAvantEnvoiDuRegistre(REGISTRE, db)).toBe(true)
  })

  it('se règle par réglerLeParcours, quel que soit l’état, et se lit par la clé avec ou sans tirets', async () => {
    await db.insert(organisations).values({ slug: 'acme', nom: 'Acme', état: 'abonnee', registreNotion: REGISTRE })
    expect(await réglerLeParcours('acme', { sorte: 'apercu', actif: false }, db)).toEqual({ sorte: 'aperçu-réglé', actif: false })
    expect(await aperçuAvantEnvoiDuRegistre('aaaabbbb-cccc-dddd-eeee-ffff00005555', db)).toBe(false)
    expect(await réglerLeParcours('acme', { sorte: 'apercu', actif: true }, db)).toEqual({ sorte: 'aperçu-réglé', actif: true })
    expect(await aperçuAvantEnvoiDuRegistre(REGISTRE, db)).toBe(true)
    expect(await réglerLeParcours('inconnue', { sorte: 'apercu', actif: false }, db)).toEqual({ sorte: 'inconnue' })
  })

  it('rend null pour une clé qu’aucune organisation ne porte', async () => {
    expect(await aperçuAvantEnvoiDuRegistre(REGISTRE, db)).toBeNull()
  })
})

describe('aperçuAvantEnvoi : dans le doute, l’aperçu tient', () => {
  afterEach(() => {
    vi.doUnmock('@/lib/base/client')
    vi.doUnmock('@/lib/base/organisations')
    vi.resetModules()
    vi.restoreAllMocks()
  })

  async function charger(configurée: boolean, lu: () => Promise<boolean | null>) {
    vi.resetModules()
    vi.doMock('@/lib/base/client', () => ({ baseConfigurée: () => configurée }))
    vi.doMock('@/lib/base/organisations', () => ({ aperçuAvantEnvoiDuRegistre: lu }))
    return (await import('@/lib/portail/apercu')).aperçuAvantEnvoi
  }

  it('sans base, organisation inconnue ou base injoignable : vrai ; levé : faux', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(await (await charger(false, async () => false))(REGISTRE)).toBe(true)
    expect(await (await charger(true, async () => null))(REGISTRE)).toBe(true)
    expect(await (await charger(true, async () => Promise.reject(new Error('SQLSTATE 08006'))))(REGISTRE)).toBe(true)
    expect(await (await charger(true, async () => false))(REGISTRE)).toBe(false)
  })
})

