import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const prescripteurs = vi.hoisted(() => ({
  créerPrescripteur: vi.fn(),
  listeDExclusion: vi.fn(),
  TYPES_DE_PRESCRIPTEUR: ['conseil', 'expertise_comptable', 'chambre_consulaire', 'autre'],
}))
const client = vi.hoisted(() => ({ baseConfigurée: vi.fn() }))
vi.mock('@/lib/base/prescripteurs', () => prescripteurs)
vi.mock('@/lib/base/client', () => client)

const { GET, POST } = await import('@/app/api/veille/prescripteurs/route')

const URL_DE_LA_ROUTE = 'https://www.signauxfaibles.io/api/veille/prescripteurs'
const créer = (corps: unknown, jeton = 'secret-de-test') =>
  POST(
    new NextRequest(URL_DE_LA_ROUTE, {
      method: 'POST',
      headers: { authorization: `Bearer ${jeton}`, 'content-type': 'application/json' },
      body: JSON.stringify(corps),
    }),
  )
const lire = (requête = '?exclusions=1', jeton = 'secret-de-test') =>
  GET(new NextRequest(`${URL_DE_LA_ROUTE}${requête}`, { headers: { authorization: `Bearer ${jeton}` } }))

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('ACTIVATION_SECRET', 'secret-de-test')
  client.baseConfigurée.mockReturnValue(true)
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('POST /api/veille/prescripteurs', () => {
  const corps = { slug: 'cabinet-durand', code: 'durand', type: 'conseil' }

  it('exige le jeton et une base', async () => {
    expect((await créer(corps, 'mauvais')).status).toBe(401)
    client.baseConfigurée.mockReturnValue(false)
    expect((await créer(corps)).status).toBe(503)
    expect(prescripteurs.créerPrescripteur).not.toHaveBeenCalled()
  })

  it('rejette un code mal formé ou un type inconnu', async () => {
    expect((await créer({ ...corps, code: 'Du rand' })).status).toBe(400)
    expect((await créer({ ...corps, code: 'ab' })).status).toBe(400)
    expect((await créer({ ...corps, type: 'banque' })).status).toBe(400)
    expect(prescripteurs.créerPrescripteur).not.toHaveBeenCalled()
  })

  it('traduit chaque issue en statut HTTP', async () => {
    const cas: Array<[unknown, number]> = [
      [{ sorte: 'créé', code: 'durand' }, 201],
      [{ sorte: 'déjà-prescripteur', code: 'durand' }, 200],
      [{ sorte: 'organisation-inconnue' }, 404],
      [{ sorte: 'code-pris' }, 409],
      [{ sorte: 'en-prospection' }, 409],
    ]
    for (const [résultat, statut] of cas) {
      prescripteurs.créerPrescripteur.mockResolvedValueOnce(résultat)
      expect((await créer(corps)).status).toBe(statut)
    }
  })
})

describe('GET /api/veille/prescripteurs?exclusions=1', () => {
  it('exige le jeton et le paramètre', async () => {
    expect((await lire('?exclusions=1', 'mauvais')).status).toBe(401)
    expect((await lire('')).status).toBe(400)
    expect(prescripteurs.listeDExclusion).not.toHaveBeenCalled()
  })

  it('rend la liste d’exclusion', async () => {
    const exclusions = [{ slug: 'cabinet-durand', nom: 'Cabinet Durand', registreNotion: null, rôle: 'prescripteur' }]
    prescripteurs.listeDExclusion.mockResolvedValue(exclusions)
    const réponse = await lire()
    expect(réponse.status).toBe(200)
    expect(await réponse.json()).toEqual({ état: 'lu', nombre: 1, exclusions })
  })
})
