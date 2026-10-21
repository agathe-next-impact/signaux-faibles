import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const file = vi.hoisted(() => ({ lireLaFile: vi.fn(), planifierLaFile: vi.fn(), poserUnTravail: vi.fn(), prendreUnTravail: vi.fn(), prendreCeTravail: vi.fn(), recevoirUnRésultat: vi.fn() }))
const client = vi.hoisted(() => ({ baseConfigurée: vi.fn() }))
const cache = vi.hoisted(() => ({ revalidateTag: vi.fn() }))
vi.mock('@/lib/portail/file', () => file)
vi.mock('@/lib/base/client', () => client)
vi.mock('next/cache', () => cache)

const travaux = await import('@/app/api/veille/travaux/route')
const resultat = await import('@/app/api/veille/resultat/route')

const URL = 'https://www.signauxfaibles.io/api/veille/'
const entêtes = (jeton = 'secret-de-test', plus: Record<string, string> = {}) => ({
  authorization: `Bearer ${jeton}`,
  'content-type': 'application/json',
  ...plus,
})
const poster = (route: 'travaux' | 'resultat', corps: unknown, jeton?: string) => {
  const requête = new NextRequest(`${URL}${route}`, { method: 'POST', headers: entêtes(jeton), body: JSON.stringify(corps) })
  return route === 'travaux' ? travaux.POST(requête) : resultat.POST(requête)
}

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

describe('GET /api/veille/travaux', () => {
  it('exige le jeton, 503 sans base, 409 en mode notion', async () => {
    expect((await travaux.GET(new NextRequest(`${URL}travaux`, { headers: entêtes('mauvais') }))).status).toBe(401)
    client.baseConfigurée.mockReturnValue(false)
    expect((await travaux.GET(new NextRequest(`${URL}travaux`, { headers: entêtes() }))).status).toBe(503)
    client.baseConfigurée.mockReturnValue(true)
    vi.stubEnv('SOURCE_ACCES', 'notion')
    expect((await travaux.GET(new NextRequest(`${URL}travaux`, { headers: entêtes() }))).status).toBe(409)
    expect(file.lireLaFile).not.toHaveBeenCalled()
  })

  it('rend l’état de la file, et ne planifie que sur demande ou depuis le cron', async () => {
    file.lireLaFile.mockResolvedValue({ comptes: { a_faire: 1 }, travaux: [] })
    file.planifierLaFile.mockResolvedValue({ planifiés: 1, déjàEnFile: 0, parutions: [] })

    const simple = await travaux.GET(new NextRequest(`${URL}travaux`, { headers: entêtes() }))
    expect(await simple.json()).toEqual({ état: 'lu', comptes: { a_faire: 1 }, travaux: [] })
    expect(file.planifierLaFile).not.toHaveBeenCalled()

    const cron = await travaux.GET(new NextRequest(`${URL}travaux`, { headers: entêtes('secret-de-test', { 'x-vercel-cron-schedule': '0 8 * * *' }) }))
    expect(await cron.json()).toMatchObject({ état: 'lu', planification: { planifiés: 1 } })
    expect(file.planifierLaFile).toHaveBeenCalledWith({ aujourdHui: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) })
  })
})

describe('POST /api/veille/travaux', () => {
  it('rejette un corps invalide', async () => {
    expect((await poster('travaux', { action: 'prendre' })).status).toBe(400)
    expect((await poster('travaux', { action: 'poser', slug: 'acme', veille: 'ecosysteme', type: 'revue', parution: '2026-10-23' })).status).toBe(400)
    expect((await poster('travaux', { action: 'poser', slug: 'Acme', veille: 'ecosysteme', type: 'lettre', parution: '2026-10-23' })).status).toBe(400)
  })

  it('prendre : rend le travail pris, ou « vide »', async () => {
    file.prendreUnTravail.mockResolvedValueOnce(null)
    expect(await (await poster('travaux', { action: 'prendre', session: 's1' })).json()).toEqual({ état: 'vide' })
    file.prendreUnTravail.mockResolvedValueOnce({ travail: { id: 't', type: 'lettre', tentatives: 1, organisation: { slug: 'acme' } }, notion: null })
    const réponse = await poster('travaux', { action: 'prendre', session: 's1' })
    expect(await réponse.json()).toMatchObject({ état: 'pris', travail: { id: 't' }, notion: null })
    expect(file.prendreUnTravail).toHaveBeenCalledWith({ session: 's1' })
  })

  it('prendre avec « travail » : prend ce travail précis, 409 s’il n’est pas prenable', async () => {
    const travail = '11111111-2222-4333-8444-555555555555'
    file.prendreCeTravail.mockResolvedValueOnce({ travail: { id: travail, type: 'premiere_lettre', tentatives: 1, organisation: { slug: 'acme' } }, notion: null })
    const réponse = await poster('travaux', { action: 'prendre', session: 'run-1', travail })
    expect(réponse.status).toBe(200)
    expect(await réponse.json()).toMatchObject({ état: 'pris', travail: { id: travail } })
    expect(file.prendreCeTravail).toHaveBeenCalledWith({ travailId: travail, session: 'run-1' })
    expect(file.prendreUnTravail).not.toHaveBeenCalled()

    file.prendreCeTravail.mockResolvedValueOnce(null)
    const refus = await poster('travaux', { action: 'prendre', session: 'run-1', travail })
    expect(refus.status).toBe(409)
    expect(await refus.json()).toEqual({ état: 'non-prenable' })
    expect((await poster('travaux', { action: 'prendre', session: 'run-1', travail: 'pas-un-uuid' })).status).toBe(400)
  })

  it('poser : traduit chaque issue en statut', async () => {
    const corps = { action: 'poser', slug: 'acme', veille: 'ecosysteme', type: 'premiere_lettre', parution: '2026-10-23' }
    for (const [résultat, statut] of [
      [{ sorte: 'créé', travailId: 't' }, 201],
      [{ sorte: 'déjà-en-file', travailId: 't' }, 200],
      [{ sorte: 'organisation-inconnue' }, 404],
      [{ sorte: 'veille-inconnue' }, 404],
    ] as const) {
      file.poserUnTravail.mockResolvedValueOnce(résultat)
      const réponse = await poster('travaux', corps)
      expect(réponse.status).toBe(statut)
      expect((await réponse.json()).état).toBe(résultat.sorte)
    }
    expect(file.poserUnTravail).toHaveBeenLastCalledWith({ slug: 'acme', veille: 'ecosysteme', type: 'premiere_lettre', dateDeParution: '2026-10-23' })
  })

  it('une erreur de base rend 502 sans détail', async () => {
    file.prendreUnTravail.mockRejectedValue(new Error('SQLSTATE 42P01'))
    const réponse = await poster('travaux', { action: 'prendre', session: 's1' })
    expect(réponse.status).toBe(502)
    expect(await réponse.json()).toEqual({ état: 'échec' })
  })
})

describe('POST /api/veille/resultat', () => {
  const TRAVAIL = '2e4d2aa4-66df-41e8-88d7-731d18ddecf2'
  const corps = { travail: TRAVAIL, session: 's1', page: '11112222333344445555666677778888' }

  it('exige le jeton et un corps valide, avant d’expirer quoi que ce soit', async () => {
    expect((await poster('resultat', corps, 'mauvais')).status).toBe(401)
    expect((await poster('resultat', { ...corps, page: 'pas-une-page' })).status).toBe(400)
    expect((await poster('resultat', { ...corps, travail: 'x' })).status).toBe(400)
    expect(cache.revalidateTag).not.toHaveBeenCalled()
    expect(file.recevoirUnRésultat).not.toHaveBeenCalled()
  })

  it('expire la page avec tirets, puis la soumet à l’orchestration', async () => {
    file.recevoirUnRésultat.mockResolvedValue({
      sorte: 'accepté',
      conclusion: { sorte: 'accepté', runId: 'r', numéro: 13 },
      portes: { portail: [], ruptures: [], avertissements: [] },
      aperçu: { titre: 't' },
    })
    const réponse = await poster('resultat', { ...corps, exécuteur: 'api:modèle', début: '2026-10-23T06:00:00Z', résultat: { méthode: 'm' } })
    expect(réponse.status).toBe(200)
    expect(await réponse.json()).toMatchObject({ état: 'accepté', conforme: true, page: '11112222-3333-4444-5555-666677778888', numéro: 13 })
    expect(cache.revalidateTag).toHaveBeenCalledWith('page:11112222-3333-4444-5555-666677778888', { expire: 0 })
    expect(file.recevoirUnRésultat).toHaveBeenCalledWith(
      expect.objectContaining({ travailId: TRAVAIL, session: 's1', page: '11112222-3333-4444-5555-666677778888', exécuteur: 'api:modèle', résultat: { méthode: 'm' } }),
    )
    expect(file.recevoirUnRésultat.mock.calls[0]![0].début).toBeInstanceOf(Date)
  })

  it('un refus rend le rapport et les tentatives, en 200', async () => {
    file.recevoirUnRésultat.mockResolvedValue({
      sorte: 'refusé',
      conclusion: { sorte: 'refusé', runId: 'r', tentatives: 1 },
      portes: { portail: [{ code: 'numéro-différent', message: 'm' }], ruptures: [], avertissements: [] },
      aperçu: null,
    })
    const réponse = await poster('resultat', corps)
    expect(réponse.status).toBe(200)
    expect(await réponse.json()).toMatchObject({ état: 'refusé', conforme: false, tentatives: 1, portes: [{ code: 'numéro-différent' }] })
    expect(file.recevoirUnRésultat.mock.calls[0]![0].exécuteur).toBe('cowork:s1')
  })

  it('traduit inconnu, pas-pris et autre-session', async () => {
    file.recevoirUnRésultat.mockResolvedValueOnce({ sorte: 'inconnu' })
    expect((await poster('resultat', corps)).status).toBe(404)
    file.recevoirUnRésultat.mockResolvedValueOnce({ sorte: 'pas-pris', état: 'accepte' })
    const pasPris = await poster('resultat', corps)
    expect(pasPris.status).toBe(409)
    expect(await pasPris.json()).toEqual({ état: 'pas-pris', étatDuTravail: 'accepte' })
    file.recevoirUnRésultat.mockResolvedValueOnce({ sorte: 'autre-session' })
    expect((await poster('resultat', corps)).status).toBe(409)
  })
})
