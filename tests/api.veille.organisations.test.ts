import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const organisations = vi.hoisted(() => ({ ouvrirEnEssai: vi.fn(), réglerLeParcours: vi.fn() }))
const client = vi.hoisted(() => ({ baseConfigurée: vi.fn() }))
vi.mock('@/lib/base/organisations', () => organisations)
vi.mock('@/lib/base/client', () => client)

const { PATCH, POST } = await import('@/app/api/veille/organisations/route')

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

  it('porte le code du prescripteur, refuse un code mal formé et son mélange avec la prospection', async () => {
    organisations.ouvrirEnEssai.mockResolvedValue({ sorte: 'créée', organisationId: 'o' })
    expect((await appel({ ...corps, prescripteur: 'cabinet-durand' })).status).toBe(201)
    expect(organisations.ouvrirEnEssai).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'acme', prescripteur: 'cabinet-durand', prospection: false }),
    )
    organisations.ouvrirEnEssai.mockClear()
    expect((await appel({ ...corps, prescripteur: 'Cabinet Durand' })).status).toBe(400)
    expect((await appel({ ...corps, prescripteur: 'cabinet-durand', origine: 'prospection' })).status).toBe(400)
    expect(organisations.ouvrirEnEssai).not.toHaveBeenCalled()
  })

  it('traduit les refus liés aux prescripteurs', async () => {
    const cas: Array<[string, number]> = [
      ['prescripteur-inconnu', 404],
      ['hors-prospection', 409],
      ['déjà-prospectée', 409],
      ['recommandée-par-elle-même', 409],
    ]
    for (const [sorte, statut] of cas) {
      organisations.ouvrirEnEssai.mockResolvedValueOnce({ sorte })
      const réponse = await appel(corps)
      expect(réponse.status, sorte).toBe(statut)
      expect(await réponse.json()).toEqual({ état: sorte })
    }
  })

  it('une erreur de base rend 502 sans détail', async () => {
    organisations.ouvrirEnEssai.mockRejectedValue(new Error('23505'))
    const réponse = await appel(corps)
    expect(réponse.status).toBe(502)
    expect(await réponse.json()).toEqual({ état: 'échec' })
  })
})

describe('PATCH /api/veille/organisations', () => {
  const régler = (corps: unknown, jeton = 'secret-de-test') =>
    PATCH(
      new NextRequest('https://www.signauxfaibles.io/api/veille/organisations', {
        method: 'PATCH',
        headers: { authorization: `Bearer ${jeton}`, 'content-type': 'application/json' },
        body: JSON.stringify(corps),
      }),
    )

  it('exige le jeton, une base et un mode qui ouvre Postgres', async () => {
    const corps = { slug: 'acme', action: 'prolonger', semaines: 1 }
    expect((await régler(corps, 'mauvais')).status).toBe(401)
    client.baseConfigurée.mockReturnValue(false)
    expect((await régler(corps)).status).toBe(503)
    client.baseConfigurée.mockReturnValue(true)
    vi.stubEnv('SOURCE_ACCES', 'notion')
    expect((await régler(corps)).status).toBe(409)
    expect(organisations.réglerLeParcours).not.toHaveBeenCalled()
  })

  it('n’accepte que deux réglages, et une à trois semaines', async () => {
    for (const corps of [
      { slug: 'acme', action: 'prolonger', semaines: 0 },
      { slug: 'acme', action: 'prolonger', semaines: 4 },
      { slug: 'acme', action: 'prolonger', semaines: '2' },
      { slug: 'acme', action: 'relecture' },
      { slug: 'acme', action: 'suspendre' },
      { action: 'prolonger', semaines: 1 },
    ]) {
      expect((await régler(corps)).status, JSON.stringify(corps)).toBe(400)
    }
    expect(organisations.réglerLeParcours).not.toHaveBeenCalled()
  })

  it('transmet le réglage et traduit chaque issue en statut HTTP', async () => {
    const cas: Array<[unknown, unknown, number, Record<string, unknown>]> = [
      [{ slug: 'acme', action: 'prolonger', semaines: 2 }, { sorte: 'prolongé', ancienJ0: '2026-09-28', nouveauJ0: '2026-10-12' }, 200, { état: 'prolongé', ancienJ0: '2026-09-28', nouveauJ0: '2026-10-12' }],
      [{ slug: 'acme', action: 'relecture', requise: true }, { sorte: 'relecture-réglée', requise: true }, 200, { état: 'relecture-réglée', requise: true }],
      [{ slug: 'x', action: 'prolonger', semaines: 1 }, { sorte: 'inconnue' }, 404, { état: 'inconnue' }],
      [{ slug: 'acme', action: 'prolonger', semaines: 1 }, { sorte: 'sans-j0' }, 409, { état: 'sans-j0' }],
      [{ slug: 'acme', action: 'prolonger', semaines: 3 }, { sorte: 'au-delà-d-aujourdhui', j0Maximal: '2026-10-12' }, 409, { état: 'au-delà-d-aujourdhui', j0Maximal: '2026-10-12' }],
    ]
    for (const [corps, résultat, statut, json] of cas) {
      organisations.réglerLeParcours.mockResolvedValueOnce(résultat)
      const réponse = await régler(corps)
      expect(réponse.status).toBe(statut)
      expect(await réponse.json()).toEqual(json)
    }
    expect(organisations.réglerLeParcours).toHaveBeenNthCalledWith(1, 'acme', { sorte: 'prolonger', semaines: 2 })
    expect(organisations.réglerLeParcours).toHaveBeenNthCalledWith(2, 'acme', { sorte: 'relecture', requise: true })
  })

  it('une erreur de base rend 502 sans détail', async () => {
    organisations.réglerLeParcours.mockRejectedValue(new Error('40001'))
    const réponse = await régler({ slug: 'acme', action: 'relecture', requise: false })
    expect(réponse.status).toBe(502)
    expect(await réponse.json()).toEqual({ état: 'échec' })
  })
})
