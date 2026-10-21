import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import { migrationsEnAttente, migrationsNonAppliquées } from '@/lib/base/migrer'
import { baseEnMémoire } from './aide/base-en-memoire'

/**
 * Ce que le contrôle du soir compare : le journal du dépôt et le registre que
 * Drizzle tient dans la base. Mesuré sur une vraie base, avec les migrations
 * commitées, parce que c'est l'écart entre les deux qui a cassé l'onboarding
 * du 18 octobre 2026.
 */
const journal = {
  entries: [
    { tag: '0000_a', when: 100 },
    { tag: '0001_b', when: 200 },
    { tag: '0002_c', when: 300 },
  ],
}

describe('migrationsNonAppliquées', () => {
  it('rend tout le journal quand rien n’a été appliqué', () => {
    expect(migrationsNonAppliquées(journal, null)).toEqual(['0000_a', '0001_b', '0002_c'])
  })

  it('rend les migrations plus récentes que la dernière appliquée, dans l’ordre', () => {
    expect(migrationsNonAppliquées(journal, 100)).toEqual(['0001_b', '0002_c'])
  })

  it('ne rend rien quand la base est à jour', () => {
    expect(migrationsNonAppliquées(journal, 300)).toEqual([])
  })
})

describe('migrationsEnAttente', () => {
  let fermer: (() => Promise<void>) | null = null
  afterEach(async () => {
    await fermer?.()
    fermer = null
  })

  it('ne signale rien sur une base migrée avec le dépôt', async () => {
    const base = await baseEnMémoire()
    fermer = base.fermer
    expect(await migrationsEnAttente(base.db)).toEqual([])
    // Le premier démarrage de PGlite d'un fichier paie la compilation WebAssembly ; sous la charge de la suite complète, cinq secondes ne suffisent pas toujours.
  }, 20_000)

  it('signale la dernière migration quand la base ne l’a pas reçue', async () => {
    const base = await baseEnMémoire()
    fermer = base.fermer
    await base.db.execute(
      sql`delete from drizzle.__drizzle_migrations where created_at = (select max(created_at) from drizzle.__drizzle_migrations)`,
    )
    const manquantes = await migrationsEnAttente(base.db)
    expect(manquantes).toHaveLength(1)
    // La dernière du journal du dépôt, quelle qu'elle soit : le test ne doit pas se réécrire à chaque migration.
    const journalDuDépôt = JSON.parse(readFileSync(join(process.cwd(), 'drizzle', 'meta', '_journal.json'), 'utf8')) as { entries: Array<{ tag: string }> }
    expect(manquantes[0]).toBe(journalDuDépôt.entries.at(-1)?.tag)
  }, 20_000)
})
