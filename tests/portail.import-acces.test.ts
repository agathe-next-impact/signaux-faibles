import { afterEach, describe, expect, it, vi } from 'vitest'

const lignes = vi.fn()
vi.mock('@/lib/notion/acces', () => ({ lignesDAccèsPourImport: () => lignes() }))

const { importerLesAccès } = await import('@/lib/portail/import-acces')

describe('importerLesAccès, les refus avant toute écriture', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    lignes.mockReset()
  })

  it('refuse quand Postgres fait foi, sans lire Notion', async () => {
    vi.stubEnv('SOURCE_ACCES', 'postgres')
    vi.stubEnv('DATABASE_URL', 'postgresql://exemple/base')
    await expect(importerLesAccès({ àBlanc: true })).resolves.toEqual({
      état: 'refusé',
      raison: 'postgres-fait-foi',
      source: 'postgres',
    })
    expect(lignes).not.toHaveBeenCalled()
  })

  it('refuse sans base Postgres, sans lire Notion', async () => {
    vi.stubEnv('SOURCE_ACCES', 'double')
    vi.stubEnv('DATABASE_URL', '')
    await expect(importerLesAccès({ àBlanc: false })).resolves.toEqual({ état: 'refusé', raison: 'sans-base' })
    expect(lignes).not.toHaveBeenCalled()
  })

  it('refuse une base Notion vide, qui désactiverait tout le monde', async () => {
    vi.stubEnv('SOURCE_ACCES', 'double')
    vi.stubEnv('DATABASE_URL', 'postgresql://exemple/base')
    lignes.mockResolvedValue([])
    await expect(importerLesAccès({ àBlanc: false })).resolves.toEqual({ état: 'refusé', raison: 'base-notion-vide' })
  })
})
