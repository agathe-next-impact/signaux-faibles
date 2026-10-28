import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const strategie = vi.hoisted(() => ({ lireLesCalculs: vi.fn() }))
const client = vi.hoisted(() => ({ baseConfigurée: vi.fn() }))
vi.mock('@/lib/portail/strategie', () => strategie)
vi.mock('@/lib/base/client', () => client)

const route = await import('@/app/api/veille/calculs/route')
const lire = (requête: string, jeton = 'secret-de-test') =>
  route.GET(new NextRequest(`https://www.signauxfaibles.io/api/veille/calculs${requête}`, { headers: { authorization: `Bearer ${jeton}` } }))

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('ACTIVATION_SECRET', 'secret-de-test')
  client.baseConfigurée.mockReturnValue(true)
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('GET /api/veille/calculs', () => {
  it('exige le jeton, une base, un slug et une date de fin', async () => {
    expect((await lire('?slug=mastora&fin=2026-12-31', 'mauvais')).status).toBe(401)
    expect((await lire('?slug=mastora')).status).toBe(400)
    expect((await lire('?slug=Mastora&fin=2026-12-31')).status).toBe(400)
    client.baseConfigurée.mockReturnValue(false)
    expect((await lire('?slug=mastora&fin=2026-12-31')).status).toBe(503)
    expect(strategie.lireLesCalculs).not.toHaveBeenCalled()
  })

  it('départements et texte vont ensemble ; sans eux, pas d’indice demandé', async () => {
    expect((await lire('?slug=mastora&fin=2026-12-31&departements=75')).status).toBe(400)
    strategie.lireLesCalculs.mockResolvedValue({ sorte: 'calculé', grilleVersion: 1, indice: null, benchmark: { lignes: [] } })
    expect((await lire('?slug=mastora&fin=2026-12-31')).status).toBe(200)
    expect(strategie.lireLesCalculs).toHaveBeenLastCalledWith({ slug: 'mastora', fin: '2026-12-31', cycle: null })
    await lire('?slug=mastora&fin=2026-12-31&departements=06,%2034,2a&texte=formation%20commerciale')
    expect(strategie.lireLesCalculs).toHaveBeenLastCalledWith({ slug: 'mastora', fin: '2026-12-31', cycle: { départements: ['06', '34', '2A'], texte: 'formation commerciale' } })
  })

  it('rend chaque issue avec son statut', async () => {
    const cas: Array<[unknown, number]> = [
      [{ sorte: 'calculé', grilleVersion: 1, indice: null, benchmark: { lignes: [] } }, 200],
      [{ sorte: 'hors-pilote' }, 200],
      [{ sorte: 'organisation-inconnue' }, 404],
      [{ sorte: 'grille-absente' }, 409],
      [{ sorte: 'refusée', refus: [{ code: 'département-invalide', message: '' }] }, 422],
    ]
    for (const [résultat, statut] of cas) {
      strategie.lireLesCalculs.mockResolvedValueOnce(résultat)
      const réponse = await lire('?slug=mastora&fin=2026-12-31')
      expect(réponse.status, (résultat as { sorte: string }).sorte).toBe(statut)
    }
    strategie.lireLesCalculs.mockRejectedValueOnce(new Error('SQLSTATE 08006'))
    expect(await (await lire('?slug=mastora&fin=2026-12-31')).json()).toEqual({ état: 'erreur' })
  })
})
