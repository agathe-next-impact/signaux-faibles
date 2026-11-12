import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * `/api/veille/marches` : la garde avant tout, la forme avant l'orchestration,
 * et aucune mesure acceptée de l'appelant.
 */
const marchés = vi.hoisted(() => ({
  recevoirLesSegments: vi.fn(),
  lireLesMarchésDuPilote: vi.fn(),
  mesurerLesMarchésDuPilote: vi.fn(),
  publierLesMarchésDuPilote: vi.fn(),
}))
vi.mock('@/lib/portail/marches', () => marchés)
vi.mock('@/lib/base/client', () => ({ baseConfigurée: () => true }))

const { GET, PATCH, POST } = await import('@/app/api/veille/marches/route')

const requête = (méthode: string, corps?: unknown, jeton: string | null = 'secret', url = 'https://portail.example/api/veille/marches') =>
  new NextRequest(url, {
    method: méthode,
    headers: { ...(jeton ? { authorization: `Bearer ${jeton}` } : {}), 'content-type': 'application/json' },
    ...(corps !== undefined ? { body: JSON.stringify(corps) } : {}),
  })

const SEGMENT = {
  cle: 'impression',
  libelle: 'Parc d’impression',
  parent: 'marche',
  cibles: { sorte: 'registre', naf: ['18.12Z'], departements: ['69'], collectivites: false },
  offre: { naf: ['46.66Z'] },
  depense: { basse: 1000, haute: 3000, source: 'https://exemple.example/etude' },
  entites: ['Ricoh France'],
  presents: ['Ricoh France'],
  familles: [{ veille: 'concurrentiel', numero: 1 }],
}

describe('/api/veille/marches', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubEnv('ACTIVATION_SECRET', 'secret')
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('refuse sans jeton, avant toute lecture', async () => {
    for (const réponse of [await POST(requête('POST', {}, null)), await GET(requête('GET', undefined, 'faux')), await PATCH(requête('PATCH', {}, null))]) {
      expect(réponse.status).toBe(401)
    }
    expect(marchés.recevoirLesSegments).not.toHaveBeenCalled()
    expect(marchés.lireLesMarchésDuPilote).not.toHaveBeenCalled()
  })

  it('POST : traduit les segments vers le domaine et rend le verdict de la porte', async () => {
    marchés.recevoirLesSegments.mockResolvedValue({ sorte: 'créée', version: 1, segments: 2 })
    const réponse = await POST(requête('POST', { slug: 'konica', segments: [{ cle: 'marche', libelle: 'Marché', parent: null }, SEGMENT] }))
    expect(réponse.status).toBe(201)
    expect(await réponse.json()).toMatchObject({ état: 'créée', version: 1 })
    expect(marchés.recevoirLesSegments).toHaveBeenCalledWith({
      slug: 'konica',
      segments: [
        { clé: 'marche', libellé: 'Marché', parent: null, cibles: null, offre: null, dépense: null, entités: [], présents: null, familles: [] },
        {
          clé: 'impression',
          libellé: 'Parc d’impression',
          parent: 'marche',
          cibles: { sorte: 'registre', naf: ['18.12Z'], départements: ['69'] },
          offre: { naf: ['46.66Z'] },
          dépense: SEGMENT.depense,
          entités: ['Ricoh France'],
          présents: ['Ricoh France'],
          familles: [{ veille: 'concurrentiel', numéro: 1 }],
        },
      ],
    })

    marchés.recevoirLesSegments.mockResolvedValue({ sorte: 'refusée', refus: [{ code: 'racine', message: 'une seule racine' }], message: 'LES SEGMENTS…' })
    expect((await POST(requête('POST', { slug: 'konica', segments: [SEGMENT] }))).status).toBe(422)
    expect((await POST(requête('POST', { slug: 'Konica', segments: [] }))).status).toBe(400)
    expect((await POST(requête('POST', { slug: 'konica' }))).status).toBe(400)
  })

  it('GET : rend les segments dans le format où ils se postent', async () => {
    marchés.lireLesMarchésDuPilote.mockResolvedValue({
      sorte: 'lus',
      version: 2,
      grilleVersion: 5,
      segments: [{ clé: 'impression', libellé: 'Parc', parent: 'marche', cibles: { sorte: 'registre', naf: ['18.12Z'], départements: ['69'] }, offre: null, dépense: null, entités: [], familles: [{ veille: 'concurrentiel', numéro: 1 }] }],
      périodes: [{ période: '2026-T4', état: 'propose', mesures: 1 }],
      vue: null,
    })
    const réponse = await GET(requête('GET', undefined, 'secret', 'https://portail.example/api/veille/marches?slug=konica'))
    expect(await réponse.json()).toMatchObject({
      état: 'lus',
      version: 2,
      segments: [{ cle: 'impression', libelle: 'Parc', cibles: { sorte: 'registre', naf: ['18.12Z'], departements: ['69'] }, familles: [{ veille: 'concurrentiel', numero: 1 }] }],
      périodes: [{ période: '2026-T4', état: 'propose' }],
    })
    expect((await GET(requête('GET'))).status).toBe(400)
    marchés.lireLesMarchésDuPilote.mockResolvedValue({ sorte: 'organisation-inconnue' })
    expect((await GET(requête('GET', undefined, 'secret', 'https://portail.example/api/veille/marches?slug=inconnue'))).status).toBe(404)
  })

  it('PATCH : mesurer ou régler la publication, jamais les deux, jamais un chiffre', async () => {
    marchés.mesurerLesMarchésDuPilote.mockResolvedValue({ sorte: 'enregistrées', période: '2026-T4', version: 1, mesures: 3, archivées: 0, vue: null })
    expect((await PATCH(requête('PATCH', { slug: 'konica', periode: '2026-T4', action: 'mesurer' }))).status).toBe(200)
    expect(marchés.mesurerLesMarchésDuPilote).toHaveBeenCalledWith({ slug: 'konica', période: '2026-T4' })

    marchés.mesurerLesMarchésDuPilote.mockResolvedValue({ sorte: 'période-publiée' })
    expect((await PATCH(requête('PATCH', { slug: 'konica', periode: '2026-T4', action: 'mesurer' }))).status).toBe(409)

    marchés.publierLesMarchésDuPilote.mockResolvedValue({ sorte: 'réglée', période: '2026-T4', état: 'publie', mesures: 3 })
    expect((await PATCH(requête('PATCH', { slug: 'konica', periode: '2026-T4', etat: 'publie' }))).status).toBe(200)
    expect(marchés.publierLesMarchésDuPilote).toHaveBeenCalledWith({ slug: 'konica', période: '2026-T4', état: 'publie' })
    marchés.publierLesMarchésDuPilote.mockResolvedValue({ sorte: 'aucune' })
    expect((await PATCH(requête('PATCH', { slug: 'konica', periode: '2026-T4', etat: 'retire' }))).status).toBe(404)

    for (const corps of [{ slug: 'konica', periode: '2026-11', action: 'mesurer' }, { slug: 'konica', periode: '2026-T4' }, { slug: 'konica', periode: '2026-T4', etat: 'visible' }]) {
      expect((await PATCH(requête('PATCH', corps))).status).toBe(400)
    }
  })
})
