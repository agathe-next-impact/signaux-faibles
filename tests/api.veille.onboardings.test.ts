import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const portail = vi.hoisted(() => ({
  recevoirUnDébut: vi.fn(),
  recevoirUneFin: vi.fn(),
  recevoirUnRapport: vi.fn(),
  lireUnOnboarding: vi.fn(),
  TÂCHES_SUIVIES: { balayage: 'balayage', 'premiere-lettre': 'premiere_lettre' },
}))
const client = vi.hoisted(() => ({ baseConfigurée: vi.fn() }))
vi.mock('@/lib/portail/onboarding', () => portail)
vi.mock('@/lib/base/client', () => client)

const route = await import('@/app/api/veille/onboardings/route')

const URL = 'https://www.signauxfaibles.io/api/veille/onboardings'
const entêtes = (jeton = 'secret-de-test') => ({ authorization: `Bearer ${jeton}`, 'content-type': 'application/json' })
const poster = (corps: unknown, jeton?: string) => route.POST(new NextRequest(URL, { method: 'POST', headers: entêtes(jeton), body: JSON.stringify(corps) }))
const RUN = '0b6f2a6e-1c1e-4c4e-9a2a-0d6f5b1e2c3d'

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

describe('POST /api/veille/onboardings', () => {
  it('exige le jeton, 503 sans base, 409 en mode notion, avant toute écriture', async () => {
    expect((await poster({ evenement: 'debut', slug: 'mastora', tache: 'balayage', plafondUsd: 30 }, 'mauvais')).status).toBe(401)
    client.baseConfigurée.mockReturnValue(false)
    expect((await poster({ evenement: 'debut', slug: 'mastora', tache: 'balayage', plafondUsd: 30 })).status).toBe(503)
    client.baseConfigurée.mockReturnValue(true)
    vi.stubEnv('SOURCE_ACCES', 'notion')
    const notion = await poster({ evenement: 'debut', slug: 'mastora', tache: 'balayage', plafondUsd: 30 })
    expect(notion.status).toBe(409)
    expect((await notion.json()).état).not.toBe('budget-atteint')
    expect(portail.recevoirUnDébut).not.toHaveBeenCalled()
  })

  it('rejette un corps invalide', async () => {
    expect((await poster({ evenement: 'debut', slug: 'Mastora', tache: 'balayage', plafondUsd: 30 })).status).toBe(400)
    expect((await poster({ evenement: 'debut', slug: 'mastora', tache: 'lettres', plafondUsd: 30 })).status).toBe(400)
    expect((await poster({ evenement: 'debut', slug: 'mastora', tache: 'balayage', plafondUsd: 30, run: { id: 1, lien: 'https://exemple.example/x' } })).status).toBe(400)
    expect((await poster({ evenement: 'rapport', slug: 'mastora' })).status).toBe(400)
    expect((await poster({ evenement: 'rapport', slug: 'mastora', statut: 7 })).status).toBe(400)
    expect((await poster({ evenement: 'rapport', slug: 'mastora', registre: 'pas-un-identifiant' })).status).toBe(400)
    expect((await poster({ evenement: 'rapport', slug: 'mastora', motif: 'x'.repeat(301) })).status).toBe(400)
    expect((await poster({ evenement: 'fin', slug: 'mastora', run: 'r-1', issue: 'reussi' })).status).toBe(400)
  })

  it('début : 201 avec le run, 409 « budget-atteint » quand le budget refuse', async () => {
    portail.recevoirUnDébut.mockResolvedValueOnce({ sorte: 'ouvert', runId: RUN, onboardingId: 'o', budget: { sorte: 'sans-budget', dépenséUsd: 0 } })
    const ouvert = await poster({ evenement: 'debut', slug: 'mastora', tache: 'premiere-lettre', plafondUsd: 40, run: { id: 12, tentative: 1, lien: 'https://github.com/a/b/actions/runs/12' } })
    expect(ouvert.status).toBe(201)
    expect(await ouvert.json()).toMatchObject({ état: 'ouvert', run: RUN })
    expect(portail.recevoirUnDébut).toHaveBeenCalledWith({ slug: 'mastora', tâche: 'premiere_lettre', runGithub: 12, tentative: 1, lien: 'https://github.com/a/b/actions/runs/12', plafondUsd: 40, lancement: null, runTrigger: null })
    portail.recevoirUnDébut.mockResolvedValueOnce({ sorte: 'ouvert', runId: RUN, onboardingId: 'o', budget: { sorte: 'sans-budget', dépenséUsd: 0 } })
    await poster({ evenement: 'debut', slug: 'mastora', tache: 'balayage', plafondUsd: 30, lancement: RUN })
    expect(portail.recevoirUnDébut).toHaveBeenLastCalledWith(expect.objectContaining({ lancement: RUN }))
    expect((await poster({ evenement: 'debut', slug: 'mastora', tache: 'balayage', plafondUsd: 30, lancement: 'pas-un-uuid' })).status).toBe(400)

    portail.recevoirUnDébut.mockResolvedValueOnce({ sorte: 'refusé', runId: RUN, onboardingId: 'o', budget: { sorte: 'refusé', dépenséUsd: 44.82, plafondUsd: 30, budgetUsd: 50 } })
    const refusé = await poster({ evenement: 'debut', slug: 'mastora', tache: 'balayage', plafondUsd: 30 })
    expect(refusé.status).toBe(409)
    expect(await refusé.json()).toMatchObject({ état: 'budget-atteint', budget: { budgetUsd: 50 } })
  })

  it('fin et rapport : 404 sur un onboarding inconnu, un identifiant de registre normalisé', async () => {
    portail.recevoirUneFin.mockResolvedValueOnce('inconnu')
    expect((await poster({ evenement: 'fin', slug: 'mastora', run: RUN, issue: 'echec' })).status).toBe(404)
    portail.recevoirUnRapport.mockResolvedValueOnce('rapporté')
    const r = await poster({ evenement: 'rapport', slug: 'mastora', statut: 2, registre: 'AAAABBBB-CCCC-DDDD-EEEE-FFFF00005555' })
    expect(r.status).toBe(200)
    expect(portail.recevoirUnRapport).toHaveBeenCalledWith(expect.objectContaining({ statut: 2, registre: 'aaaabbbbccccddddeeeeffff00005555', motif: null }))
  })

  it('un rapport Cowork passe l’exécuteur, et répond 201 quand il crée l’onboarding (lot 4)', async () => {
    portail.recevoirUnRapport.mockResolvedValueOnce('créé')
    const r = await poster({ evenement: 'rapport', executeur: 'cowork', slug: 'suneido', nom: 'Suneido', statut: 2 })
    expect(r.status).toBe(201)
    expect(portail.recevoirUnRapport).toHaveBeenLastCalledWith(expect.objectContaining({ slug: 'suneido', exécuteur: 'cowork', statut: 2 }))
    expect((await poster({ evenement: 'rapport', executeur: 'api', slug: 'suneido', statut: 2 })).status).toBe(400)
  })

  it('une panne de base répond 502 sans détail', async () => {
    portail.recevoirUnDébut.mockRejectedValueOnce(new Error('SQLSTATE 42P01 onboardings'))
    const r = await poster({ evenement: 'debut', slug: 'mastora', tache: 'balayage', plafondUsd: 30 })
    expect(r.status).toBe(502)
    expect(JSON.stringify(await r.json())).not.toContain('SQLSTATE')
  })
})

describe('GET /api/veille/onboardings', () => {
  it('rend l’onboarding du slug, 404 sinon', async () => {
    portail.lireUnOnboarding.mockResolvedValueOnce({ slug: 'mastora', runs: [] }).mockResolvedValueOnce(null)
    const lu = await route.GET(new NextRequest(`${URL}?slug=mastora`, { headers: entêtes() }))
    expect(await lu.json()).toMatchObject({ état: 'lu', onboarding: { slug: 'mastora' } })
    expect((await route.GET(new NextRequest(`${URL}?slug=autre`, { headers: entêtes() }))).status).toBe(404)
    expect((await route.GET(new NextRequest(`${URL}?slug=Pas%20un%20slug`, { headers: entêtes() }))).status).toBe(400)
  })
})
