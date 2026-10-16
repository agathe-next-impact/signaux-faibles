import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Accès } from '@/lib/notion/acces'

/**
 * La façade d'appartenance : quelle source répond, et ce qui se passe quand
 * l'autre se tait ou diverge. Les deux sources sont simulées ; leurs lectures
 * réelles sont mesurées ailleurs (`base.lecteurs.test.ts` pour Postgres).
 */
const notion = vi.hoisted(() => ({
  lireAccèsParIdentifiant: vi.fn(),
  lireAccèsActifParEmail: vi.fn(),
  organisationDuSlug: vi.fn(),
  espacesOuverts: vi.fn(),
}))
const postgres = vi.hoisted(() => ({
  lireLecteurParIdentifiant: vi.fn(),
  lireLecteurActifParEmail: vi.fn(),
  organisationParSlug: vi.fn(),
  espacesAvecLecteurs: vi.fn(),
}))

vi.mock('@/lib/notion/acces', () => notion)
vi.mock('@/lib/base/lecteurs', () => postgres)

const { écartsEntre, lireAccèsParIdentifiant, lireAccèsActifParEmail, sourceAccès, espacesOuverts } =
  await import('@/lib/auth/source-acces')

const accès: Accès = {
  nom: 'Claire',
  email: 'claire@hermitage.fr',
  organisationLibellé: 'L’Hermitage',
  organisationId: '3d5fe829ce71810da651f3783a725bd8',
  slug: 'hermitage',
  actif: true,
  tousLesEspaces: false,
}

let avertissements: string[]

beforeEach(() => {
  vi.resetAllMocks()
  avertissements = []
  vi.spyOn(console, 'warn').mockImplementation((message: string) => {
    avertissements.push(message)
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('sourceAccès', () => {
  it('vaut notion tant que rien n’est posé', () => {
    vi.stubEnv('SOURCE_ACCES', '')
    expect(sourceAccès()).toBe('notion')
  })

  it('lit les trois valeurs connues', () => {
    for (const valeur of ['notion', 'double', 'postgres'] as const) {
      vi.stubEnv('SOURCE_ACCES', valeur)
      expect(sourceAccès()).toBe(valeur)
    }
  })

  it('retombe sur notion devant une faute de frappe, en le disant', () => {
    vi.stubEnv('SOURCE_ACCES', 'postgre')
    expect(sourceAccès()).toBe('notion')
    expect(avertissements.join()).toContain('SOURCE_ACCES')
  })
})

describe('écartsEntre', () => {
  it('ne voit rien entre deux lectures identiques, email comparé sans casse', () => {
    expect(écartsEntre(accès, { ...accès, email: 'Claire@Hermitage.fr' })).toEqual([])
  })

  it('nomme les champs qui diffèrent, et la présence d’un seul côté', () => {
    expect(écartsEntre(accès, { ...accès, actif: false, slug: 'autre' })).toEqual(['slug', 'actif'])
    expect(écartsEntre(accès, null)).toEqual(['présence'])
    expect(écartsEntre(null, null)).toEqual([])
  })
})

describe('mode notion, le défaut', () => {
  it('n’ouvre jamais Postgres', async () => {
    vi.stubEnv('SOURCE_ACCES', 'notion')
    notion.lireAccèsParIdentifiant.mockResolvedValue(accès)
    expect(await lireAccèsParIdentifiant('a'.repeat(32))).toBe(accès)
    expect(postgres.lireLecteurParIdentifiant).not.toHaveBeenCalled()
  })
})

describe('mode double', () => {
  beforeEach(() => vi.stubEnv('SOURCE_ACCES', 'double'))

  it('sert Notion et se tait quand les deux concordent', async () => {
    notion.lireAccèsParIdentifiant.mockResolvedValue(accès)
    postgres.lireLecteurParIdentifiant.mockResolvedValue({ ...accès })
    expect(await lireAccèsParIdentifiant('a'.repeat(32))).toBe(accès)
    expect(avertissements).toEqual([])
  })

  it('sert Notion et journalise l’écart, sans identifiant en clair', async () => {
    notion.lireAccèsParIdentifiant.mockResolvedValue(accès)
    postgres.lireLecteurParIdentifiant.mockResolvedValue({ ...accès, actif: false })
    expect(await lireAccèsParIdentifiant('a'.repeat(32))).toBe(accès)
    expect(avertissements).toHaveLength(1)
    expect(avertissements[0]).toContain('[accès:double]')
    expect(avertissements[0]).toContain('actif')
    expect(avertissements[0]).not.toContain('a'.repeat(32))
  })

  it('une panne Postgres ne change rien pour le lecteur', async () => {
    notion.lireAccèsParIdentifiant.mockResolvedValue(accès)
    postgres.lireLecteurParIdentifiant.mockRejectedValue(new Error('connexion refusée'))
    expect(await lireAccèsParIdentifiant('a'.repeat(32))).toBe(accès)
    expect(avertissements[0]).toContain('Postgres en échec')
  })

  it('une panne Notion reste celle du portail, comme avant', async () => {
    notion.lireAccèsParIdentifiant.mockRejectedValue(new Error('Notion indisponible'))
    postgres.lireLecteurParIdentifiant.mockResolvedValue(accès)
    await expect(lireAccèsParIdentifiant('a'.repeat(32))).rejects.toThrow('Notion indisponible')
  })

  it('compare aussi l’identifiant rendu par la lecture par email, sans l’écrire', async () => {
    notion.lireAccèsActifParEmail.mockResolvedValue({ ...accès, identifiant: 'a'.repeat(32) })
    postgres.lireLecteurActifParEmail.mockResolvedValue({ ...accès, identifiant: 'b'.repeat(32) })
    const servi = await lireAccèsActifParEmail('claire@hermitage.fr')
    expect(servi?.identifiant).toBe('a'.repeat(32))
    expect(avertissements[0]).toContain('identifiant')
    expect(avertissements[0]).not.toContain('claire@hermitage.fr')
    expect(avertissements[0]).not.toContain('b'.repeat(32))
  })

  it('compare les listes d’espaces sans dépendre de l’ordre', async () => {
    notion.espacesOuverts.mockResolvedValue([
      { slug: 'a', organisationLibellé: 'A', lecteurs: 1 },
      { slug: 'b', organisationLibellé: 'B', lecteurs: 2 },
    ])
    postgres.espacesAvecLecteurs.mockResolvedValue([
      { slug: 'b', organisationLibellé: 'B', lecteurs: 2 },
      { slug: 'a', organisationLibellé: 'A', lecteurs: 1 },
    ])
    await espacesOuverts()
    expect(avertissements).toEqual([])
  })
})

describe('mode postgres, après la bascule', () => {
  it('sert Postgres et ne lit plus Notion', async () => {
    vi.stubEnv('SOURCE_ACCES', 'postgres')
    postgres.lireLecteurParIdentifiant.mockResolvedValue(accès)
    expect(await lireAccèsParIdentifiant('a'.repeat(32))).toBe(accès)
    expect(notion.lireAccèsParIdentifiant).not.toHaveBeenCalled()
  })
})
