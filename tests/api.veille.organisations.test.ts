import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const organisations = vi.hoisted(() => ({ ouvrirEnEssai: vi.fn() }))
const client = vi.hoisted(() => ({ baseConfigurée: vi.fn() }))
vi.mock('@/lib/base/organisations', () => organisations)
vi.mock('@/lib/base/client', () => client)

const { POST } = await import('@/app/api/veille/organisations/route')

const REGISTRE = '3d5fe829ce71810da651f3783a725bd8'
const appel = (corps: unknown, jeton = 'secret-de-test') =>
  POST(
    new NextRequest('https://www.signauxfaibles.io/api/veille/organisations', {
      method: 'POST',
      headers: { authorization: `Bearer ${jeton}`, 'content-type': 'application/json' },
      body: JSON.stringify(corps),
    }),
  )

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('ACTIVATION_SECRET', 'secret-de-test')
  vi.stubEnv('SOURCE_ACCES', 'double')
  client.baseConfigurée.mockReturnValue(true)
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('POST /api/veille/organisations', () => {
  const corps = { slug: 'acme', nom: 'Acme', registreNotion: REGISTRE }

  it('exige le jeton', async () => {
    expect((await appel(corps, 'mauvais')).status).toBe(401)
    expect(organisations.ouvrirEnEssai).not.toHaveBeenCalled()
  })

  it('503 sans base, 409 en mode notion, sans rien ouvrir', async () => {
    client.baseConfigurée.mockReturnValue(false)
    expect((await appel(corps)).status).toBe(503)
    client.baseConfigurée.mockReturnValue(true)
    vi.stubEnv('SOURCE_ACCES', 'notion')
    expect((await appel(corps)).status).toBe(409)
    expect(organisations.ouvrirEnEssai).not.toHaveBeenCalled()
  })

  it('rejette un corps invalide : slug mal formé, registre qui n’est pas un identifiant Notion', async () => {
    expect((await appel({ ...corps, slug: 'Acme SA' })).status).toBe(400)
    expect((await appel({ ...corps, registreNotion: 'acme' })).status).toBe(400)
    expect((await appel({ slug: 'acme' })).status).toBe(400)
  })

  it('traduit chaque issue en statut HTTP', async () => {
    const cas: Array<[unknown, number, Record<string, string>]> = [
      [{ sorte: 'créée', organisationId: 'o' }, 201, { état: 'créée' }],
      [{ sorte: 'déjà-en-essai', organisationId: 'o' }, 200, { état: 'déjà-en-essai' }],
      [{ sorte: 'état-incompatible', état: 'abonnee' }, 409, { état: 'état-incompatible', étatActuel: 'abonnee' }],
      [{ sorte: 'registre-pris', slug: 'autre' }, 409, { état: 'registre-pris', slugExistant: 'autre' }],
    ]
    for (const [résultat, statut, json] of cas) {
      organisations.ouvrirEnEssai.mockResolvedValueOnce(résultat)
      const réponse = await appel(corps)
      expect(réponse.status).toBe(statut)
      expect(await réponse.json()).toEqual(json)
    }
  })

  it('une erreur de base rend 502 sans détail', async () => {
    organisations.ouvrirEnEssai.mockRejectedValue(new Error('23505'))
    const réponse = await appel(corps)
    expect(réponse.status).toBe(502)
    expect(await réponse.json()).toEqual({ état: 'échec' })
  })
})
