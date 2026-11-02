import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * La clé de cloisonnement d'une organisation Payload (2 novembre 2026).
 *
 * La session porte la clé sans tirets (`registre_notion`) ; Payload, l'uuid avec
 * tirets. La revérification en mémoire comparait les deux formes telles quelles :
 * aucune édition ne passait, même publiée dans Payload, et l'espace d'un client
 * restait vide en mode `SOURCE_DOCUMENTS=payload`. Le tag de liste et
 * l'invalidation des crochets parlaient aussi deux formes différentes.
 */
const cache = vi.hoisted(() => ({ cacheLife: vi.fn(), cacheTag: vi.fn(), revalidateTag: vi.fn() }))
const payload = vi.hoisted(() => ({ find: vi.fn() }))
vi.mock('next/cache', () => cache)
vi.mock('payload', () => ({ getPayload: async () => payload }))
vi.mock('@payload-config', () => ({ default: {} }))

const { listerÉditionsPubliées, listerÉditionsÀPrévisualiser } = await import('@/lib/documents/payload')
const { invaliderLÉdition } = await import('@/lib/documents/invalidation')

const UUID = 'aaaabbbb-cccc-4ddd-8eee-ffff00005555'
const CLÉ = 'aaaabbbbcccc4ddd8eeeffff00005555'
const AUTRE = '11112222-3333-4444-8555-666677778888'

const édition = (organisation: string, statut = 'publiee', id = 'ed-1') => ({
  id,
  titre: 'Veille Acme n° 1',
  organisation,
  statut,
  dateEdition: '2026-11-01T12:00:00.000Z',
  numero: 1,
})

beforeEach(() => vi.clearAllMocks())

describe('la façade Payload lit une organisation par sa clé de cloisonnement', () => {
  it('trouve les éditions publiées d’une session qui porte la clé sans tirets, et tague la liste par la clé', async () => {
    payload.find.mockResolvedValue({ docs: [édition(UUID)] })
    const éditions = await listerÉditionsPubliées(CLÉ)
    expect(éditions.map((é) => é.pageId)).toEqual(['ed-1'])
    expect(payload.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { and: [{ organisation: { equals: UUID } }, { statut: { equals: 'publiee' } }] } }),
    )
    expect(cache.cacheTag).toHaveBeenCalledWith(`liste:${CLÉ}`)
  })

  it('accepte aussi l’uuid avec tirets, et écarte toujours l’édition d’une autre organisation (règle 2)', async () => {
    payload.find.mockResolvedValue({ docs: [édition(UUID, 'publiee', 'ed-1'), édition(AUTRE, 'publiee', 'ed-2')] })
    expect((await listerÉditionsPubliées(UUID)).map((é) => é.pageId)).toEqual(['ed-1'])
  })

  it('l’aperçu de l’opératrice suit la même clé', async () => {
    payload.find.mockResolvedValue({ docs: [édition(UUID, 'a_publier', 'ed-3')] })
    const éditions = await listerÉditionsÀPrévisualiser(CLÉ)
    expect(éditions.map((é) => [é.pageId, é.aperçu])).toEqual([['ed-3', true]])
  })

  it('l’invalidation d’une édition expire le tag que lisent les écrans', () => {
    invaliderLÉdition({ id: 'ed-1', organisation: UUID })
    expect(cache.revalidateTag).toHaveBeenCalledWith(`liste:${CLÉ}`, 'max')
    expect(cache.revalidateTag).toHaveBeenCalledWith('page:ed-1', 'max')
  })
})
