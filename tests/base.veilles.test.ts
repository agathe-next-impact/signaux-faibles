import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Base } from '@/lib/base/client'
import { organisations } from '@/lib/base/schema'
import { déclarerLaVeille, listerLesVeilles } from '@/lib/base/veilles'
import { baseEnMémoire } from './aide/base-en-memoire'

describe('déclarerLaVeille', () => {
  let db: Base
  let fermer: () => Promise<void>
  beforeEach(async () => {
    ;({ db, fermer } = await baseEnMémoire())
    await db.insert(organisations).values({ slug: 'acme', nom: 'Acme', état: 'essai' })
  })
  afterEach(async () => {
    await fermer()
  })

  const déclaration = {
    slug: 'acme',
    type: 'ecosysteme',
    libellé: 'Écosystème',
    jourParution: 5,
    heureParution: '06:30',
    cadence: 'hebdomadaire' as const,
    numéroCourant: 12,
    referentielNotion: 'AAAABBBB-CCCC-DDDD-EEEE-FFFF00001111',
  }

  it('déclare, puis met à jour la même veille au lieu d’en créer une seconde', async () => {
    const première = await déclarerLaVeille(déclaration, db)
    expect(première.sorte).toBe('déclarée')
    const seconde = await déclarerLaVeille({ ...déclaration, jourParution: 1, libellé: 'Écosystème public' }, db)
    expect(seconde).toEqual({ sorte: 'mise-à-jour', veilleId: (première as { veilleId: string }).veilleId })

    const veilles = await listerLesVeilles('acme', db)
    expect(veilles).toHaveLength(1)
    expect(veilles[0]).toMatchObject({
      slug: 'acme',
      type: 'ecosysteme',
      libellé: 'Écosystème public',
      jourParution: 1,
      heureParution: '06:30:00',
      cadence: 'hebdomadaire',
      numéroCourant: 12,
      état: 'active',
      referentielNotion: 'aaaabbbbccccddddeeeeffff00001111',
    })
  })

  it('une mise à jour sans numéro ni référentiel ne les touche pas', async () => {
    await déclarerLaVeille(déclaration, db)
    const { numéroCourant: _n, referentielNotion: _r, ...sansNuméro } = déclaration
    await déclarerLaVeille({ ...sansNuméro, heureParution: '07:00' }, db)
    const [veille] = await listerLesVeilles('acme', db)
    expect(veille).toMatchObject({ numéroCourant: 12, heureParution: '07:00:00', referentielNotion: 'aaaabbbbccccddddeeeeffff00001111' })
  })

  it('refuse une organisation inconnue, et liste par slug puis par type', async () => {
    expect(await déclarerLaVeille({ ...déclaration, slug: 'inconnue' }, db)).toEqual({ sorte: 'organisation-inconnue' })
    await db.insert(organisations).values({ slug: 'abc', nom: 'ABC', état: 'abonnee' })
    await déclarerLaVeille({ ...déclaration, type: 'concurrentielle' }, db)
    await déclarerLaVeille(déclaration, db)
    await déclarerLaVeille({ ...déclaration, slug: 'abc' }, db)
    expect((await listerLesVeilles(null, db)).map((v) => `${v.slug}/${v.type}`)).toEqual([
      'abc/ecosysteme',
      'acme/concurrentielle',
      'acme/ecosysteme',
    ])
  })
})
