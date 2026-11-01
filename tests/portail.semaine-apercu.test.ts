import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const documents = vi.hoisted(() => ({
  listerÉditionsPubliées: vi.fn(),
  listerÉditionsÀPrévisualiser: vi.fn(),
  lireBlocsDeLÉdition: vi.fn(),
}))
vi.mock('@/lib/documents', () => documents)

const { semainesDeLEspace } = await import('@/lib/portail/semaine')

const REGISTRE = 'aaaabbbbccccddddeeeeffff00005555'

describe('semainesDeLEspace : l’aperçu n’est que pour l’opératrice', () => {
  const publiée = { pageId: 'p1', titre: 'A', veille: 'Veille', dateÉdition: '2026-10-22', numéro: 1, périodeCouverte: '', fenêtreÉlargie: false, actionDeLaSemaine: '', dossiersOuvertsBruts: '' }
  const brouillon = { ...publiée, pageId: 'p2', dateÉdition: '2026-10-29', numéro: 2, aperçu: true as const }

  beforeEach(() => {
    documents.listerÉditionsPubliées.mockResolvedValue([publiée])
    documents.listerÉditionsÀPrévisualiser.mockResolvedValue([brouillon])
  })
  afterEach(() => vi.clearAllMocks())

  it('un client ne voit que les publiées, et l’aperçu n’est jamais demandé', async () => {
    const semaines = await semainesDeLEspace({ organisationId: REGISTRE, aperçu: false })
    expect(semaines.flatMap((s) => s.éditions.map((é) => é.pageId))).toEqual(['p1'])
    expect(documents.listerÉditionsÀPrévisualiser).not.toHaveBeenCalled()
  })

  it('l’opératrice voit en plus les non publiées, marquées, de la plus récente à la plus ancienne', async () => {
    const semaines = await semainesDeLEspace({ organisationId: REGISTRE, aperçu: true })
    const éditions = semaines.flatMap((s) => s.éditions)
    expect(éditions.map((é) => [é.pageId, é.aperçu ?? false])).toEqual([['p2', true], ['p1', false]])
  })

  it('une panne de l’aperçu ne prive pas l’opératrice des lettres publiées', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    documents.listerÉditionsÀPrévisualiser.mockRejectedValueOnce(new Error('Notion 502'))
    const semaines = await semainesDeLEspace({ organisationId: REGISTRE, aperçu: true })
    expect(semaines.flatMap((s) => s.éditions.map((é) => é.pageId))).toEqual(['p1'])
  })
})
