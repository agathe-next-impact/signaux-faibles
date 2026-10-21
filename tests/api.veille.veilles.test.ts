import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const veilles = vi.hoisted(() => ({ déclarerLaVeille: vi.fn(), listerLesVeilles: vi.fn() }))
const client = vi.hoisted(() => ({ baseConfigurée: vi.fn() }))
vi.mock('@/lib/base/veilles', () => veilles)
vi.mock('@/lib/base/client', () => client)

const { GET, POST } = await import('@/app/api/veille/veilles/route')

const URL = 'https://www.signauxfaibles.io/api/veille/veilles'
const poster = (corps: unknown, jeton = 'secret-de-test') =>
  POST(new NextRequest(URL, { method: 'POST', headers: { authorization: `Bearer ${jeton}`, 'content-type': 'application/json' }, body: JSON.stringify(corps) }))

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('ACTIVATION_SECRET', 'secret-de-test')
  vi.stubEnv('SOURCE_ACCES', 'postgres')
  client.baseConfigurée.mockReturnValue(true)
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

const déclaration = { slug: 'acme', type: 'ecosysteme', libellé: 'Écosystème', jourParution: 5, heureParution: '06:30', cadence: 'hebdomadaire', numéroCourant: 12 }

describe('POST /api/veille/veilles', () => {
  it('exige le jeton, une base, et un corps valide', async () => {
    expect((await poster(déclaration, 'mauvais')).status).toBe(401)
    client.baseConfigurée.mockReturnValue(false)
    expect((await poster(déclaration)).status).toBe(503)
    client.baseConfigurée.mockReturnValue(true)
    expect((await poster({ ...déclaration, heureParution: '6h30' })).status).toBe(400)
    expect((await poster({ ...déclaration, jourParution: 0 })).status).toBe(400)
    expect((await poster({ ...déclaration, cadence: 'Hebdomadaire' })).status).toBe(400)
    expect(veilles.déclarerLaVeille).not.toHaveBeenCalled()
  })

  it('traduit chaque issue en statut, et passe la déclaration telle quelle', async () => {
    for (const [résultat, statut] of [
      [{ sorte: 'déclarée', veilleId: 'v' }, 201],
      [{ sorte: 'mise-à-jour', veilleId: 'v' }, 200],
      [{ sorte: 'organisation-inconnue' }, 404],
    ] as const) {
      veilles.déclarerLaVeille.mockResolvedValueOnce(résultat)
      const réponse = await poster(déclaration)
      expect(réponse.status).toBe(statut)
      expect((await réponse.json()).état).toBe(résultat.sorte)
    }
    expect(veilles.déclarerLaVeille).toHaveBeenLastCalledWith(déclaration)
  })
})

describe('GET /api/veille/veilles', () => {
  it('liste, par slug quand il est donné', async () => {
    veilles.listerLesVeilles.mockResolvedValue([{ slug: 'acme', type: 'ecosysteme' }])
    const réponse = await GET(new NextRequest(`${URL}?slug=acme`, { headers: { authorization: 'Bearer secret-de-test' } }))
    expect(await réponse.json()).toEqual({ état: 'lu', veilles: [{ slug: 'acme', type: 'ecosysteme' }] })
    expect(veilles.listerLesVeilles).toHaveBeenCalledWith('acme')
    await GET(new NextRequest(URL, { headers: { authorization: 'Bearer secret-de-test' } }))
    expect(veilles.listerLesVeilles).toHaveBeenLastCalledWith(null)
  })
})
