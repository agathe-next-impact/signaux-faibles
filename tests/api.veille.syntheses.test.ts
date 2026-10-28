import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const strategie = vi.hoisted(() => ({ recevoirLaSynthèse: vi.fn(), lireLaSynthèseDuPilote: vi.fn(), publierLaSynthèseDuPilote: vi.fn() }))
const client = vi.hoisted(() => ({ baseConfigurée: vi.fn() }))
vi.mock('@/lib/portail/strategie', () => strategie)
vi.mock('@/lib/base/client', () => client)

const route = await import('@/app/api/veille/syntheses/route')

const URL = 'https://www.signauxfaibles.io/api/veille/syntheses'
const entêtes = (jeton = 'secret-de-test') => ({ authorization: `Bearer ${jeton}`, 'content-type': 'application/json' })
const envoyer = (corps: unknown, jeton?: string) => route.POST(new NextRequest(URL, { method: 'POST', headers: entêtes(jeton), body: JSON.stringify(corps) }))
const lire = (requête: string, jeton?: string) => route.GET(new NextRequest(`${URL}${requête}`, { headers: entêtes(jeton) }))

const SYNTHÈSE = {
  mode: 'mensuel',
  grilleVersion: 1,
  pestel: [
    { lettre: 'legal', enonce: 'La loi de finances recadre le crédit d’impôt.', faits: ['f1'] },
    { lettre: 'ecologique', enonce: null, faits: [] },
  ],
  swot: [
    { id: 'S1', case: 'forces', enonce: 'Une offre sur les trois couches.', etat: 'nouveau', origine: 'declaratif', hypothese: true, faits: [], referenceFiche: 'fiche §2' },
    { id: 'T1', case: 'menaces', enonce: 'Le cloud souverain se concentre.', etat: 'nouveau', origine: 'faits', hypothese: false, filiation: null, faits: ['f1'] },
  ],
  tows: [{ type: 'ST', enonce: 'Faire valoir les trois couches face à la concentration.', elements: ['S1', 'T1'], candidate: true }],
  positions: [
    { outil: 'groupes', sujet: 'CISPE', axe: 'couches', cran: 2, faits: ['f1'] },
    { outil: 'mendelow', sujet: 'DGE', axe: 'pouvoir', cran: null, nonSuivi: true, faits: [] },
  ],
}
const corps = { slug: 'infralliance', periode: '2026-11', fenetre: { debut: '2026-10-01', fin: '2026-10-31' }, synthese: SYNTHÈSE }

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

describe('POST /api/veille/syntheses', () => {
  it('exige le jeton, puis une base, avant de rien lire', async () => {
    expect((await envoyer(corps, 'mauvais')).status).toBe(401)
    client.baseConfigurée.mockReturnValue(false)
    expect((await envoyer(corps)).status).toBe(503)
    expect(strategie.recevoirLaSynthèse).not.toHaveBeenCalled()
  })

  it('rejette un corps mal formé en nommant le champ', async () => {
    const réponse = await envoyer({ ...corps, synthese: { ...SYNTHÈSE, grilleVersion: 0 } })
    expect(réponse.status).toBe(400)
    expect(await réponse.json()).toEqual({ état: 'invalide', raison: 'champ « synthese.grilleVersion »' })
    expect((await envoyer({ ...corps, periode: '2026-13' })).status).toBe(400)
    expect((await envoyer({ ...corps, slug: 'Infralliance' })).status).toBe(400)
    expect((await envoyer({ ...corps, synthese: { ...SYNTHÈSE, mode: 'hebdomadaire' } })).status).toBe(400)
    expect(strategie.recevoirLaSynthèse).not.toHaveBeenCalled()
  })

  it('refuse une fenêtre à l’envers ou plus longue qu’un trimestre', async () => {
    for (const fenetre of [
      { debut: '2026-10-31', fin: '2026-10-01' },
      { debut: '2026-01-01', fin: '2026-10-31' },
      { debut: '2026-02-30', fin: '2026-02-31' },
    ]) {
      const réponse = await envoyer({ ...corps, fenetre })
      expect(réponse.status, JSON.stringify(fenetre)).toBe(400)
    }
    expect(strategie.recevoirLaSynthèse).not.toHaveBeenCalled()
  })

  it('accorde le mode à la période : un trimestre pour le trimestriel, un mois sinon', async () => {
    expect((await envoyer({ ...corps, periode: '2026-T4' })).status).toBe(400)
    expect((await envoyer({ ...corps, synthese: { ...SYNTHÈSE, mode: 'trimestriel' } })).status).toBe(400)
    strategie.recevoirLaSynthèse.mockResolvedValue({ sorte: 'enregistrée', éléments: 4, positions: 2, archivés: 0, avertissements: [] })
    const fenetre = { debut: '2026-10-01', fin: '2026-12-31' }
    expect((await envoyer({ ...corps, periode: '2026-T4', fenetre, synthese: { ...SYNTHÈSE, mode: 'trimestriel' } })).status).toBe(201)
  })

  it('traduit la synthèse dans les noms du domaine, sans rien filtrer : la porte nomme les valeurs inconnues', async () => {
    strategie.recevoirLaSynthèse.mockResolvedValue({ sorte: 'enregistrée', éléments: 4, positions: 2, archivés: 0, avertissements: [] })
    const inconnue = { ...SYNTHÈSE, pestel: [...SYNTHÈSE.pestel, { lettre: 'climat', enonce: 'x', faits: [] }] }
    await envoyer({ ...corps, synthese: inconnue })
    expect(strategie.recevoirLaSynthèse).toHaveBeenCalledWith({
      slug: 'infralliance',
      période: '2026-11',
      fenêtre: { début: '2026-10-01', fin: '2026-10-31' },
      cycle: null,
      synthèse: {
        mode: 'mensuel',
        grilleVersion: 1,
        pestel: [
          { lettre: 'legal', énoncé: 'La loi de finances recadre le crédit d’impôt.', faits: ['f1'] },
          { lettre: 'ecologique', énoncé: null, faits: [] },
          { lettre: 'climat', énoncé: 'x', faits: [] },
        ],
        swot: [
          { id: 'S1', case: 'forces', énoncé: 'Une offre sur les trois couches.', état: 'nouveau', origine: 'declaratif', hypothèse: true, filiation: null, faits: [], référenceFiche: 'fiche §2' },
          { id: 'T1', case: 'menaces', énoncé: 'Le cloud souverain se concentre.', état: 'nouveau', origine: 'faits', hypothèse: false, filiation: null, faits: ['f1'], référenceFiche: null },
        ],
        casesInsuffisantes: [],
        tows: [{ type: 'ST', énoncé: 'Faire valoir les trois couches face à la concentration.', éléments: ['S1', 'T1'], candidate: true }],
        positions: [
          { outil: 'groupes', sujet: 'CISPE', axe: 'couches', cran: 2, nonSuivi: false, tendance: null, faits: ['f1'] },
          { outil: 'mendelow', sujet: 'DGE', axe: 'pouvoir', cran: null, nonSuivi: true, tendance: null, faits: [] },
        ],
        scénarios: [],
        interprétations: [],
      },
    })
  })

  it('transmet les paramètres du cycle du trimestre, départements en capitales', async () => {
    strategie.recevoirLaSynthèse.mockResolvedValue({ sorte: 'enregistrée', éléments: 4, positions: 2, archivés: 0, avertissements: [] })
    const fenetre = { debut: '2026-10-01', fin: '2026-12-31' }
    await envoyer({ ...corps, periode: '2026-T4', fenetre, synthese: { ...SYNTHÈSE, mode: 'trimestriel' }, cycle: { departements: ['2a', '75'], texte: 'formation commerciale' } })
    expect(strategie.recevoirLaSynthèse.mock.calls[0]![0]).toMatchObject({ période: '2026-T4', cycle: { départements: ['2A', '75'], texte: 'formation commerciale' } })
    await envoyer(corps)
    expect(strategie.recevoirLaSynthèse.mock.calls[1]![0]).toMatchObject({ cycle: null })
  })

  it('rend chaque issue avec son statut', async () => {
    const cas: Array<[unknown, number]> = [
      [{ sorte: 'enregistrée', éléments: 4, positions: 2, archivés: 0, avertissements: [] }, 201],
      [{ sorte: 'refusée', refus: [{ code: 'candidate-unique', message: 'une seule candidate' }], message: 'LA SYNTHÈSE N’EST PAS ACCEPTÉE.', avertissements: [] }, 422],
      [{ sorte: 'hors-pilote' }, 200],
      [{ sorte: 'organisation-inconnue' }, 404],
      [{ sorte: 'grille-absente' }, 409],
      [{ sorte: 'grille-périmée' }, 409],
    ]
    for (const [résultat, statut] of cas) {
      strategie.recevoirLaSynthèse.mockResolvedValueOnce(résultat)
      const réponse = await envoyer(corps)
      expect(réponse.status, (résultat as { sorte: string }).sorte).toBe(statut)
      expect((await réponse.json()).état).toBe((résultat as { sorte: string }).sorte)
    }
  })

  it('une panne de la base rend 502 sans détail', async () => {
    strategie.recevoirLaSynthèse.mockRejectedValue(new Error('SQLSTATE 08006'))
    const réponse = await envoyer(corps)
    expect(réponse.status).toBe(502)
    expect(await réponse.json()).toEqual({ état: 'erreur' })
  })
})

describe('GET /api/veille/syntheses', () => {
  it('exige le jeton, un slug et une période', async () => {
    expect((await lire('?slug=infralliance&periode=2026-11', 'mauvais')).status).toBe(401)
    expect((await lire('?slug=infralliance')).status).toBe(400)
    expect((await lire('?slug=infralliance&periode=2026-T5')).status).toBe(400)
    expect(strategie.lireLaSynthèseDuPilote).not.toHaveBeenCalled()
  })

  it('rend la synthèse lue, texte compris', async () => {
    strategie.lireLaSynthèseDuPilote.mockResolvedValue({ sorte: 'lue', période: '2026-11', grilleVersion: 1, éléments: [], positions: [], texte: 'Synthèse stratégique' })
    const réponse = await lire('?slug=infralliance&periode=2026-11')
    expect(réponse.status).toBe(200)
    expect(await réponse.json()).toMatchObject({ état: 'lue', organisation: 'infralliance', texte: 'Synthèse stratégique' })
    expect(strategie.lireLaSynthèseDuPilote).toHaveBeenCalledWith({ slug: 'infralliance', période: '2026-11' })
  })

  it('aucune synthèse et hors pilote répondent en 200, une organisation inconnue en 404', async () => {
    strategie.lireLaSynthèseDuPilote.mockResolvedValueOnce({ sorte: 'aucune' })
    expect(await (await lire('?slug=infralliance&periode=2026-11')).json()).toEqual({ état: 'aucune' })
    strategie.lireLaSynthèseDuPilote.mockResolvedValueOnce({ sorte: 'hors-pilote' })
    expect((await lire('?slug=infralliance&periode=2026-11')).status).toBe(200)
    strategie.lireLaSynthèseDuPilote.mockResolvedValueOnce({ sorte: 'organisation-inconnue' })
    expect((await lire('?slug=inconnue&periode=2026-11')).status).toBe(404)
  })
})

describe('PATCH /api/veille/syntheses', () => {
  const publier = (corps: unknown, jeton?: string) => route.PATCH(new NextRequest(URL, { method: 'PATCH', headers: entêtes(jeton), body: JSON.stringify(corps) }))

  it('exige le jeton et un état connu', async () => {
    expect((await publier({ slug: 'mastora', periode: '2026-10', etat: 'publie' }, 'mauvais')).status).toBe(401)
    expect((await publier({ slug: 'mastora', periode: '2026-10', etat: 'valide' })).status).toBe(400)
    expect(strategie.publierLaSynthèseDuPilote).not.toHaveBeenCalled()
  })

  it('rend chaque issue avec son statut', async () => {
    const cas: Array<[unknown, number]> = [
      [{ sorte: 'publiée', éléments: 22, positions: 18 }, 200],
      [{ sorte: 'retirée', éléments: 22, positions: 18 }, 200],
      [{ sorte: 'hors-pilote' }, 200],
      [{ sorte: 'aucune' }, 404],
      [{ sorte: 'organisation-inconnue' }, 404],
    ]
    for (const [résultat, statut] of cas) {
      strategie.publierLaSynthèseDuPilote.mockResolvedValueOnce(résultat)
      expect((await publier({ slug: 'mastora', periode: '2026-10', etat: 'publie' })).status, (résultat as { sorte: string }).sorte).toBe(statut)
    }
    expect(strategie.publierLaSynthèseDuPilote).toHaveBeenLastCalledWith({ slug: 'mastora', période: '2026-10', état: 'publie' })
  })
})

