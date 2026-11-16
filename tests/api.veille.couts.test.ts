import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const portail = vi.hoisted(() => ({ recevoirUnCoût: vi.fn(), coûtsDuMois: vi.fn() }))
const client = vi.hoisted(() => ({ baseConfigurée: vi.fn() }))
vi.mock('@/lib/portail/couts', () => portail)
vi.mock('@/lib/base/client', () => client)

const route = await import('@/app/api/veille/couts/route')

const URL = 'https://www.signauxfaibles.io/api/veille/couts'
const entêtes = (jeton = 'secret-de-test') => ({ authorization: `Bearer ${jeton}`, 'content-type': 'application/json' })
const poster = (corps: unknown, jeton?: string) => route.POST(new NextRequest(URL, { method: 'POST', headers: entêtes(jeton), body: JSON.stringify(corps) }))
const lire = (requête = '', jeton?: string) => route.GET(new NextRequest(`${URL}${requête}`, { headers: entêtes(jeton) }))

const MESURE = {
  tâche: 'lettres',
  organisation: null,
  date: '2026-11-16T05:00:02.000Z',
  issue: 'success',
  duréeMs: 1_820_000,
  tours: 212,
  coûtTotalUsd: 18.42,
  plafondUsd: 60,
  parModèle: { 'claude-opus': { coûtUsd: 17.2 } },
  organisationsTraitées: ['hermitage', 'mastora'],
  pagesNotionCréées: 4,
  étapes: {},
}
const RUN = { id: 501, tentative: 1, lien: 'https://github.com/agathe-next-impact/signaux-faibles/actions/runs/501' }

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('ACTIVATION_SECRET', 'secret-de-test')
  vi.stubEnv('SOURCE_ACCES', 'double')
  client.baseConfigurée.mockReturnValue(true)
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('POST /api/veille/couts', () => {
  it('exige le jeton et la base, avant toute écriture', async () => {
    expect((await poster({ mesure: MESURE, run: RUN }, 'mauvais')).status).toBe(401)
    client.baseConfigurée.mockReturnValue(false)
    expect((await poster({ mesure: MESURE, run: RUN })).status).toBe(503)
    expect(portail.recevoirUnCoût).not.toHaveBeenCalled()
  })

  it('rejette un corps invalide', async () => {
    expect((await poster({})).status).toBe(400)
    expect((await poster({ mesure: { ...MESURE, coûtTotalUsd: -1 } })).status).toBe(400)
    expect((await poster({ mesure: { ...MESURE, tâche: 'Lettres du jour' } })).status).toBe(400)
    expect((await poster({ mesure: { ...MESURE, date: 'hier' } })).status).toBe(400)
    expect((await poster({ mesure: MESURE, run: { id: 1, tentative: 1, lien: 'https://exemple.example/x' } })).status).toBe(400)
    expect(portail.recevoirUnCoût).not.toHaveBeenCalled()
  })

  it('enregistre la mesure telle que le harnais l’écrit : 201, puis 200 pour le même run', async () => {
    portail.recevoirUnCoût.mockResolvedValueOnce({ sorte: 'enregistré' })
    const reçu = await poster({ mesure: MESURE, run: RUN })
    expect(reçu.status).toBe(201)
    expect(await reçu.json()).toEqual({ état: 'enregistré' })
    expect(portail.recevoirUnCoût).toHaveBeenCalledWith({
      tâche: 'lettres',
      organisation: null,
      organisations: ['hermitage', 'mastora'],
      issue: 'success',
      coûtUsd: 18.42,
      plafondUsd: 60,
      duréeMs: 1_820_000,
      tours: 212,
      parModèle: { 'claude-opus': { coûtUsd: 17.2 } },
      run: RUN,
      mesuréLe: new Date('2026-11-16T05:00:02.000Z'),
    })
    portail.recevoirUnCoût.mockResolvedValueOnce({ sorte: 'déjà-enregistré' })
    const rejoué = await poster({ mesure: MESURE, run: RUN })
    expect(rejoué.status).toBe(200)
    expect(await rejoué.json()).toEqual({ état: 'déjà-enregistré' })
  })

  it('ramène un nom d’organisation à son slug plutôt que de perdre la dépense', async () => {
    portail.recevoirUnCoût.mockResolvedValue({ sorte: 'enregistré' })
    await poster({ mesure: { ...MESURE, tâche: 'premiere-lettre', organisation: 'Aquitaine Robotics', organisationsTraitées: ['Aquitaine Robotics', 'aquitaine-robotics'] } })
    expect(portail.recevoirUnCoût).toHaveBeenLastCalledWith(expect.objectContaining({ organisation: 'aquitaine-robotics', organisations: ['aquitaine-robotics'], run: null }))
  })

  it('n’écrit pas un usage par modèle démesuré, et garde le coût', async () => {
    portail.recevoirUnCoût.mockResolvedValue({ sorte: 'enregistré' })
    await poster({ mesure: { ...MESURE, parModèle: { modèle: { note: 'x'.repeat(9_000) } } } })
    expect(portail.recevoirUnCoût).toHaveBeenLastCalledWith(expect.objectContaining({ parModèle: null, coûtUsd: 18.42 }))
  })

  it('une base en panne répond 502 sans détail', async () => {
    portail.recevoirUnCoût.mockRejectedValueOnce(new Error('relation "couts_des_runs" does not exist'))
    const réponse = await poster({ mesure: MESURE, run: RUN })
    expect(réponse.status).toBe(502)
    expect(await réponse.json()).toEqual({ état: 'échec' })
  })
})

describe('GET /api/veille/couts', () => {
  it('exige le jeton et un mois bien formé', async () => {
    expect((await lire('?mois=2026-11', 'mauvais')).status).toBe(401)
    expect((await lire('?mois=novembre')).status).toBe(400)
    expect(portail.coûtsDuMois).not.toHaveBeenCalled()
  })

  it('rend les totaux du mois demandé, et du mois en cours à défaut', async () => {
    const totaux = { runs: 1, échecs: 0, coûtUsd: 18.42, parTâche: [], parOrganisation: [], nonAttribuéUsd: 0, répartiUsd: 18.42 }
    portail.coûtsDuMois.mockResolvedValue({ mois: '2026-10', runs: [{}], totaux, noms: { mastora: 'Mastora' } })
    const réponse = await lire('?mois=2026-10')
    expect(réponse.status).toBe(200)
    expect(await réponse.json()).toEqual({ état: 'lu', mois: '2026-10', runs: 1, totaux, noms: { mastora: 'Mastora' } })
    expect(portail.coûtsDuMois).toHaveBeenCalledWith('2026-10')
    await lire()
    expect(portail.coûtsDuMois.mock.calls[1]?.[0]).toMatch(/^\d{4}-\d{2}$/)
  })
})
