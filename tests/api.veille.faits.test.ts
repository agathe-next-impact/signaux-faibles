import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const strategie = vi.hoisted(() => ({ recevoirLesÉtiquettes: vi.fn(), lireLesFaits: vi.fn() }))
const client = vi.hoisted(() => ({ baseConfigurée: vi.fn() }))
vi.mock('@/lib/portail/strategie', () => strategie)
vi.mock('@/lib/base/client', () => client)

const route = await import('@/app/api/veille/faits/route')

const URL = 'https://www.signauxfaibles.io/api/veille/faits'
const PAGE = '400fe829ce71814fbdbee7b1756d66ba'
const entêtes = (jeton = 'secret-de-test') => ({ authorization: `Bearer ${jeton}`, 'content-type': 'application/json' })
const poster = (corps: unknown, jeton?: string) =>
  route.POST(new NextRequest(URL, { method: 'POST', headers: entêtes(jeton), body: JSON.stringify(corps) }))
const lire = (requête: string, jeton?: string) => route.GET(new NextRequest(`${URL}${requête}`, { headers: entêtes(jeton) }))

const ÉTIQUETTE = {
  section: 'axe',
  axe: 4,
  rang: 1,
  titre: 'Telehouse a annoncé le 20 octobre 2026 un nouveau module de 3 MW.',
  date: '2026-10-20',
  source: 'https://www.telehouse.fr/actualites/',
  pestel: 'economique',
  rupture: true,
  impact: 'FORT',
  nouveaute: 'nouveau',
}
const corps = { slug: 'infralliance', page: PAGE, etiquettes: [ÉTIQUETTE] }

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

describe('POST /api/veille/faits', () => {
  it('exige le jeton, puis une base, avant de rien lire', async () => {
    expect((await poster(corps, 'mauvais')).status).toBe(401)
    client.baseConfigurée.mockReturnValue(false)
    expect((await poster(corps)).status).toBe(503)
    expect(strategie.recevoirLesÉtiquettes).not.toHaveBeenCalled()
  })

  it('rejette un corps mal formé en nommant le champ', async () => {
    const réponse = await poster({ ...corps, etiquettes: [{ ...ÉTIQUETTE, rang: 0 }] })
    expect(réponse.status).toBe(400)
    expect(await réponse.json()).toEqual({ état: 'invalide', raison: 'champ « etiquettes.0.rang »' })
    expect((await poster({ ...corps, page: 'pas-une-page' })).status).toBe(400)
    expect((await poster({ ...corps, slug: 'Infralliance' })).status).toBe(400)
    expect((await poster({ ...corps, etiquettes: [{ ...ÉTIQUETTE, rupture: 'oui' }] })).status).toBe(400)
    expect(strategie.recevoirLesÉtiquettes).not.toHaveBeenCalled()
  })

  it('transmet le lot tel quel, et rend chaque issue avec son statut', async () => {
    strategie.recevoirLesÉtiquettes.mockResolvedValueOnce({ sorte: 'accepté', édition: PAGE, faits: 1, insérées: 1, archivées: 0 })
    const acceptée = await poster(corps)
    expect(acceptée.status).toBe(200)
    expect(await acceptée.json()).toMatchObject({ état: 'accepté', insérées: 1 })
    expect(strategie.recevoirLesÉtiquettes).toHaveBeenCalledWith({ slug: 'infralliance', page: PAGE, lot: [ÉTIQUETTE] })

    strategie.recevoirLesÉtiquettes.mockResolvedValueOnce({ sorte: 'refusé', refus: [{ code: 'lot-incomplet', message: 'm' }], message: 'LE LOT…', faits: 11 })
    const refusée = await poster(corps)
    expect(refusée.status).toBe(422)
    expect(await refusée.json()).toMatchObject({ état: 'refusé', message: 'LE LOT…' })

    for (const [sorte, statut] of [
      ['hors-pilote', 200],
      ['organisation-inconnue', 404],
      ['édition-introuvable', 404],
      ['organisation-différente', 409],
      ['organisations-multiples', 409],
      ['édition-sans-date', 422],
    ] as const) {
      strategie.recevoirLesÉtiquettes.mockResolvedValueOnce({ sorte })
      const réponse = await poster(corps)
      expect(réponse.status, sorte).toBe(statut)
      expect(await réponse.json()).toEqual({ état: sorte, sorte })
    }
  })

  it('une panne rend 502 sans message technique', async () => {
    strategie.recevoirLesÉtiquettes.mockRejectedValueOnce(new Error('[base] remplacement en échec (SQLSTATE 08006).'))
    const réponse = await poster(corps)
    expect(réponse.status).toBe(502)
    expect(await réponse.json()).toEqual({ état: 'erreur' })
  })
})

describe('GET /api/veille/faits', () => {
  it('exige le jeton et une fenêtre valide, bornée à cent jours', async () => {
    expect((await lire('?slug=infralliance&debut=2026-10-01&fin=2026-10-31', 'mauvais')).status).toBe(401)
    expect((await lire('?slug=infralliance&debut=2026-10-31&fin=2026-10-01')).status).toBe(400)
    expect((await lire('?slug=infralliance&debut=2026-10-01')).status).toBe(400)
    expect((await lire('?slug=Infralliance&debut=2026-10-01&fin=2026-10-31')).status).toBe(400)
    expect((await lire('?slug=infralliance&debut=2026-01-01&fin=2026-10-31')).status).toBe(400)
    expect(strategie.lireLesFaits).not.toHaveBeenCalled()
  })

  it('rend les faits de la fenêtre, ou hors-pilote', async () => {
    strategie.lireLesFaits.mockResolvedValueOnce({ sorte: 'lu', faits: [{ id: 'f' }], titresIntrouvables: 0 })
    const réponse = await lire('?slug=infralliance&debut=2026-10-05&fin=2026-11-01')
    expect(await réponse.json()).toEqual({
      état: 'lu',
      organisation: 'infralliance',
      fenêtre: { début: '2026-10-05', fin: '2026-11-01' },
      nombre: 1,
      titresIntrouvables: 0,
      faits: [{ id: 'f' }],
    })
    expect(strategie.lireLesFaits).toHaveBeenCalledWith({ slug: 'infralliance', début: '2026-10-05', fin: '2026-11-01' })

    strategie.lireLesFaits.mockResolvedValueOnce({ sorte: 'hors-pilote' })
    const hors = await lire('?slug=infralliance&debut=2026-10-05&fin=2026-11-01')
    expect(hors.status).toBe(200)
    expect(await hors.json()).toEqual({ état: 'hors-pilote' })
    strategie.lireLesFaits.mockResolvedValueOnce({ sorte: 'organisation-inconnue' })
    expect((await lire('?slug=inconnue&debut=2026-10-05&fin=2026-11-01')).status).toBe(404)
  })
})
