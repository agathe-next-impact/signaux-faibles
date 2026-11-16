import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const contrôle = vi.hoisted(() => ({ contrôlerLeDispositif: vi.fn() }))
const courriers = vi.hoisted(() => ({ envoyerCourrier: vi.fn() }))
vi.mock('@/lib/portail/controle-du-soir', () => contrôle)
vi.mock('@/lib/portail/courriers', () => courriers)

const { GET, POST } = await import('@/app/api/veille/etat/route')

const URL_DE_LA_ROUTE = 'https://www.signauxfaibles.io/api/veille/etat'
const sain = {
  état: { date: '2026-11-15', espaces: [], défauts: [], lignesSansSlug: 0, opérateursActifs: 1 },
  accès: { source: 'postgres', base: 'joignable', lecteursActifs: 3 },
  statuts: null,
}
const avecDéfaut = {
  ...sain,
  état: {
    ...sain.état,
    défauts: [{ slug: 'acme', code: 'statut-ecartee-registre', message: 'écartée au registre, en service au portail' }],
  },
  statuts: { lignes: 2, contrôlé: true },
}

const envoyer = (corps: unknown, { jeton = 'secret-de-test', requête = '' } = {}) =>
  POST(
    new NextRequest(`${URL_DE_LA_ROUTE}${requête}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${jeton}`, 'content-type': 'application/json' },
      body: typeof corps === 'string' ? corps : JSON.stringify(corps),
    }),
  )
const lire = (requête = '', jeton = 'secret-de-test') =>
  GET(new NextRequest(`${URL_DE_LA_ROUTE}${requête}`, { headers: { authorization: `Bearer ${jeton}` } }))

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('ACTIVATION_SECRET', 'secret-de-test')
  vi.stubEnv('RELECTEUR_EMAIL', 'relecteur@example.org')
  contrôle.contrôlerLeDispositif.mockResolvedValue(sain)
  courriers.envoyerCourrier.mockResolvedValue(undefined)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('GET /api/veille/etat', () => {
  it('reste le contrôle d’avant : aucun registre donné, aucune comparaison de statuts', async () => {
    const réponse = await lire()
    expect(réponse.status).toBe(200)
    expect(contrôle.contrôlerLeDispositif).toHaveBeenCalledWith({})
    expect(await réponse.json()).toMatchObject({ état: 'contrôlé', notification: 'silence', statuts: null })
  })

  it('exige le jeton', async () => {
    expect((await lire('', 'mauvais')).status).toBe(401)
    expect(contrôle.contrôlerLeDispositif).not.toHaveBeenCalled()
  })
})

describe('POST /api/veille/etat', () => {
  const registre = [
    { slug: 'acme', statut: '0 · Écartée' },
    { slug: 'autre', statut: 6 },
  ]

  it('exige le jeton avant même de lire le corps', async () => {
    expect((await envoyer({ registre }, { jeton: 'mauvais' })).status).toBe(401)
    expect((await envoyer('pas du json', { jeton: 'mauvais' })).status).toBe(401)
    expect(contrôle.contrôlerLeDispositif).not.toHaveBeenCalled()
  })

  it('refuse un corps illisible ou une ligne mal formée', async () => {
    expect((await envoyer('pas du json')).status).toBe(400)
    expect((await envoyer({})).status).toBe(400)
    expect((await envoyer({ registre: [{ slug: 'acme' }] })).status).toBe(400)
    expect((await envoyer({ registre: [{ slug: 'acme', statut: { x: 1 } }] })).status).toBe(400)
    expect(contrôle.contrôlerLeDispositif).not.toHaveBeenCalled()
  })

  it('donne les lignes du registre au contrôle et rend ce qui a été comparé', async () => {
    contrôle.contrôlerLeDispositif.mockResolvedValue(avecDéfaut)
    const réponse = await envoyer({ registre })
    expect(réponse.status).toBe(200)
    expect(contrôle.contrôlerLeDispositif).toHaveBeenCalledWith({ registre })
    const corps = await réponse.json()
    expect(corps).toMatchObject({ état: 'contrôlé', statuts: { lignes: 2, contrôlé: true }, notification: 'silence' })
    expect(corps.défauts).toHaveLength(1)
    // Sans ?notifier=1 et hors cron, rien ne part.
    expect(courriers.envoyerCourrier).not.toHaveBeenCalled()
  })

  it('accepte un registre vide : c’est un contrôle qui a eu lieu sur zéro ligne', async () => {
    expect((await envoyer({ registre: [] })).status).toBe(200)
    expect(contrôle.contrôlerLeDispositif).toHaveBeenCalledWith({ registre: [] })
  })

  it('notifie le relecteur d’un écart de statut avec ?notifier=1, seulement s’il y a un défaut', async () => {
    contrôle.contrôlerLeDispositif.mockResolvedValue(avecDéfaut)
    const réponse = await envoyer({ registre }, { requête: '?notifier=1' })
    expect((await réponse.json()).notification).toBe('envoyée')
    expect(courriers.envoyerCourrier).toHaveBeenCalledTimes(1)
    const envoi = courriers.envoyerCourrier.mock.calls[0]![0]
    expect(envoi).toMatchObject({ sorte: 'alerte_espaces', déclencheur: 'manuel', organisation: null })
    expect(envoi.message.texte).toContain('écartée au registre, en service au portail')

    courriers.envoyerCourrier.mockClear()
    contrôle.contrôlerLeDispositif.mockResolvedValue({ ...sain, statuts: { lignes: 2, contrôlé: true } })
    expect((await (await envoyer({ registre }, { requête: '?notifier=1' })).json()).notification).toBe('silence')
    expect(courriers.envoyerCourrier).not.toHaveBeenCalled()
  })

  it('dit qu’un contrôle n’a pas eu lieu plutôt que de se taire', async () => {
    contrôle.contrôlerLeDispositif.mockResolvedValue({
      ...sain,
      statuts: { lignes: 2, contrôlé: false, raison: 'SOURCE_ACCES vaut notion : Postgres n’est pas ouvert, les états du portail ne sont pas lus.' },
    })
    const corps = await (await envoyer({ registre })).json()
    expect(corps.statuts).toMatchObject({ lignes: 2, contrôlé: false })
    expect(corps.statuts.raison).toContain('SOURCE_ACCES')
  })

  it('un contrôle qui échoue répond 502 sans détail technique', async () => {
    contrôle.contrôlerLeDispositif.mockRejectedValue(new Error('SQLSTATE 42P01 relation absente'))
    const réponse = await envoyer({ registre })
    expect(réponse.status).toBe(502)
    expect(JSON.stringify(await réponse.json())).not.toContain('SQLSTATE')
  })
})
