import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const strategie = vi.hoisted(() => ({ recevoirLaGrille: vi.fn(), lireLaGrilleDuPilote: vi.fn(), validerLaVersion: vi.fn() }))
const client = vi.hoisted(() => ({ baseConfigurée: vi.fn() }))
vi.mock('@/lib/portail/strategie', () => strategie)
vi.mock('@/lib/base/client', () => client)

const route = await import('@/app/api/veille/grille/route')

const URL = 'https://www.signauxfaibles.io/api/veille/grille'
const RÉFÉRENTIEL = '3d2fe829ce71801eae49fa7fc4a0e76c'
const entêtes = (jeton = 'secret-de-test') => ({ authorization: `Bearer ${jeton}`, 'content-type': 'application/json' })
const envoyer = (méthode: 'POST' | 'PATCH', corps: unknown, jeton?: string) => {
  const requête = new NextRequest(URL, { method: méthode, headers: entêtes(jeton), body: JSON.stringify(corps) })
  return méthode === 'POST' ? route.POST(requête) : route.PATCH(requête)
}
const lire = (requête: string, jeton?: string) => route.GET(new NextRequest(`${URL}${requête}`, { headers: entêtes(jeton) }))

const GRILLE = {
  axes: [
    { cle: 'couches', libelle: 'Couches couvertes', crans: ['usage seul', 'cloud', 'cloud et datacenter', 'trois couches'] },
    { cle: 'production', libelle: 'Production publique', crans: ['aucune', 'occasionnelle', 'régulière'] },
  ],
  familles: [
    { numero: 1, veille: 'ecosysteme', pestel: 'legal', cadence: 'hebdomadaire' },
    { numero: 1, veille: 'concurrentiel', porter: 'rivalite', cadence: 'hebdomadaire' },
  ],
  entites: [
    { nom: 'CISPE', veille: 'concurrentiel', siren: null },
    { nom: 'Cigref', veille: 'concurrentiel', siren: '310785985' },
  ],
  partiesPrenantes: ['DGE', 'Commission européenne', 'Assemblée nationale', 'Sénat', 'ANSSI', 'RTE', 'Cnam', 'France-IX'].map((nom) => ({ nom })),
}
const corps = { slug: 'infralliance', referentiel: RÉFÉRENTIEL, grille: GRILLE }

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

describe('POST /api/veille/grille', () => {
  it('exige le jeton, puis une base, avant de rien lire', async () => {
    expect((await envoyer('POST', corps, 'mauvais')).status).toBe(401)
    client.baseConfigurée.mockReturnValue(false)
    expect((await envoyer('POST', corps)).status).toBe(503)
    expect(strategie.recevoirLaGrille).not.toHaveBeenCalled()
  })

  it('rejette un corps mal formé en nommant le champ', async () => {
    const réponse = await envoyer('POST', { ...corps, grille: { ...GRILLE, familles: [{ ...GRILLE.familles[0], numero: 0 }] } })
    expect(réponse.status).toBe(400)
    expect(await réponse.json()).toEqual({ état: 'invalide', raison: 'champ « grille.familles.0.numero »' })
    expect((await envoyer('POST', { ...corps, referentiel: 'pas-une-page' })).status).toBe(400)
    expect((await envoyer('POST', { ...corps, slug: 'Infralliance' })).status).toBe(400)
    expect(strategie.recevoirLaGrille).not.toHaveBeenCalled()
  })

  it('traduit la grille dans les noms du domaine, sans rien filtrer : la porte nomme les valeurs inconnues', async () => {
    strategie.recevoirLaGrille.mockResolvedValue({ sorte: 'créée', version: 1, empreinte: 'abcd1234', trousDuPestel: [], forcesNonSuivies: [] })
    const inconnue = { ...GRILLE, familles: [...GRILLE.familles, { numero: 2, veille: 'ecosysteme', pestel: 'climat', cadence: 'mensuelle' }] }
    await envoyer('POST', { ...corps, grille: inconnue })
    expect(strategie.recevoirLaGrille).toHaveBeenCalledWith({
      slug: 'infralliance',
      référentiel: RÉFÉRENTIEL,
      grille: {
        axesGroupes: [
          { clé: 'couches', libellé: 'Couches couvertes', crans: GRILLE.axes[0]!.crans },
          { clé: 'production', libellé: 'Production publique', crans: GRILLE.axes[1]!.crans },
        ],
        familles: [
          { numéro: 1, veille: 'ecosysteme', pestel: 'legal', porter: null, cadence: 'hebdomadaire' },
          { numéro: 1, veille: 'concurrentiel', pestel: null, porter: 'rivalite', cadence: 'hebdomadaire' },
          { numéro: 2, veille: 'ecosysteme', pestel: 'climat', porter: null, cadence: 'mensuelle' },
        ],
        entités: [
          { nom: 'CISPE', veille: 'concurrentiel', siren: null },
          { nom: 'Cigref', veille: 'concurrentiel', siren: '310785985' },
        ],
        partiesPrenantes: GRILLE.partiesPrenantes,
        offres: null,
      },
    })
  })

  it('rend chaque issue avec son statut', async () => {
    const cas: Array<[unknown, number]> = [
      [{ sorte: 'créée', version: 1, empreinte: 'abcd1234', trousDuPestel: ['ecologique'], forcesNonSuivies: [] }, 201],
      [{ sorte: 'inchangée', version: 1, empreinte: 'abcd1234', trousDuPestel: [], forcesNonSuivies: [] }, 200],
      [{ sorte: 'refusée', refus: [{ code: 'crans-hors-bornes', message: '3 à 5 crans' }], message: 'LE LOT N’EST PAS ACCEPTÉ.' }, 422],
      [{ sorte: 'hors-pilote' }, 200],
      [{ sorte: 'organisation-inconnue' }, 404],
    ]
    for (const [résultat, statut] of cas) {
      strategie.recevoirLaGrille.mockResolvedValueOnce(résultat)
      const réponse = await envoyer('POST', corps)
      expect(réponse.status).toBe(statut)
      expect((await réponse.json()).état).toBe((résultat as { sorte: string }).sorte)
    }
  })

  it('une panne de la base rend 502 sans détail', async () => {
    strategie.recevoirLaGrille.mockRejectedValue(new Error('SQLSTATE 08006'))
    const réponse = await envoyer('POST', corps)
    expect(réponse.status).toBe(502)
    expect(await réponse.json()).toEqual({ état: 'erreur' })
  })
})

describe('GET /api/veille/grille', () => {
  it('exige le jeton et un slug', async () => {
    expect((await lire('?slug=infralliance', 'mauvais')).status).toBe(401)
    expect((await lire('?slug=Infra lliance')).status).toBe(400)
    expect(strategie.lireLaGrilleDuPilote).not.toHaveBeenCalled()
  })

  it('rend la dernière version dans les noms de la route', async () => {
    strategie.lireLaGrilleDuPilote.mockResolvedValue({
      sorte: 'lue',
      version: 2,
      empreinte: 'abcd1234',
      référentielNotion: RÉFÉRENTIEL,
      validéeLe: new Date('2026-10-27T09:00:00Z'),
      grille: {
        axesGroupes: [{ clé: 'couches', libellé: 'Couches couvertes', crans: ['a', 'b', 'c'] }],
        familles: [{ numéro: 1, veille: 'ecosysteme', pestel: 'legal', cadence: 'hebdomadaire' }],
        entités: [{ nom: 'CISPE', veille: 'concurrentiel' }],
        partiesPrenantes: [{ nom: 'DGE' }],
      },
      trousDuPestel: ['politique'],
      forcesNonSuivies: ['substituts'],
    })
    const réponse = await lire('?slug=infralliance')
    expect(réponse.status).toBe(200)
    expect(await réponse.json()).toEqual({
      état: 'lue',
      organisation: 'infralliance',
      version: 2,
      empreinte: 'abcd1234',
      referentiel: RÉFÉRENTIEL,
      validéeLe: '2026-10-27T09:00:00.000Z',
      grille: {
        axes: [{ cle: 'couches', libelle: 'Couches couvertes', crans: ['a', 'b', 'c'] }],
        familles: [{ numero: 1, veille: 'ecosysteme', pestel: 'legal', porter: null, cadence: 'hebdomadaire' }],
        entites: [{ nom: 'CISPE', veille: 'concurrentiel', siren: null }],
        partiesPrenantes: [{ nom: 'DGE' }],
        offres: null,
      },
      trousDuPestel: ['politique'],
      forcesNonSuivies: ['substituts'],
    })
  })

  it('aucune grille et hors pilote répondent en 200, une organisation inconnue en 404', async () => {
    strategie.lireLaGrilleDuPilote.mockResolvedValueOnce({ sorte: 'aucune' })
    expect(await (await lire('?slug=infralliance')).json()).toEqual({ état: 'aucune' })
    strategie.lireLaGrilleDuPilote.mockResolvedValueOnce({ sorte: 'hors-pilote' })
    expect((await lire('?slug=infralliance')).status).toBe(200)
    strategie.lireLaGrilleDuPilote.mockResolvedValueOnce({ sorte: 'organisation-inconnue' })
    expect((await lire('?slug=inconnue')).status).toBe(404)
  })
})

describe('PATCH /api/veille/grille', () => {
  it('exige le jeton et une version entière', async () => {
    expect((await envoyer('PATCH', { slug: 'infralliance', version: 1 }, 'mauvais')).status).toBe(401)
    expect((await envoyer('PATCH', { slug: 'infralliance', version: 0 })).status).toBe(400)
    expect(strategie.validerLaVersion).not.toHaveBeenCalled()
  })

  it('rend chaque issue avec son statut', async () => {
    const cas: Array<[string, number]> = [
      ['validée', 200],
      ['déjà-validée', 200],
      ['hors-pilote', 200],
      ['version-dépassée', 409],
      ['aucune', 404],
      ['organisation-inconnue', 404],
    ]
    for (const [résultat, statut] of cas) {
      strategie.validerLaVersion.mockResolvedValueOnce(résultat)
      const réponse = await envoyer('PATCH', { slug: 'infralliance', version: 2 })
      expect(réponse.status, résultat).toBe(statut)
      expect(await réponse.json()).toEqual({ état: résultat, version: 2 })
    }
    expect(strategie.validerLaVersion).toHaveBeenCalledWith({ slug: 'infralliance', version: 2 })
  })
})
