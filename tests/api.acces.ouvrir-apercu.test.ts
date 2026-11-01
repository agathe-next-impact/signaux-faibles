import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const accès = vi.hoisted(() => ({ lireAccèsActifParEmail: vi.fn() }))
const apercu = vi.hoisted(() => ({ aperçuAvantEnvoi: vi.fn() }))
const courriers = vi.hoisted(() => ({ envoyerCourrier: vi.fn() }))
const documents = vi.hoisted(() => ({ listerÉditionsPubliées: vi.fn() }))
vi.mock('@/lib/auth/source-acces', () => accès)
vi.mock('@/lib/portail/apercu', () => apercu)
vi.mock('@/lib/portail/courriers', () => courriers)
vi.mock('@/lib/documents', () => documents)
vi.mock('@/lib/notion/client', () => ({ sourcesDeDonnées: async () => ({ accès: 'src' }) }))
vi.mock('@/lib/env', () => ({ env: () => ({ ACCES_SECRET_HMAC: 's'.repeat(32), PORTAIL_URL: 'https://www.signauxfaibles.io' }) }))
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }))

const route = await import('@/app/api/acces/ouvrir/route')

const LECTEUR = {
  nom: 'Camille',
  email: 'camille@acme.example',
  identifiant: 'a'.repeat(32),
  organisationId: 'aaaabbbbccccddddeeeeffff00005555',
  organisationLibellé: 'Acme',
  slug: 'acme',
  actif: true,
  tousLesEspaces: false,
}

let origine = 0
const poster = () =>
  route.POST(
    new NextRequest('https://www.signauxfaibles.io/api/acces/ouvrir', {
      method: 'POST',
      // Une origine par appel : la limitation de débit n'entre pas dans ce test.
      headers: { authorization: 'Bearer secret-de-test', 'content-type': 'application/json', 'x-forwarded-for': `10.0.0.${++origine}` },
      body: JSON.stringify({ email: `l${origine}@acme.example` }),
    }),
  )

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('ACTIVATION_SECRET', 'secret-de-test')
  accès.lireAccèsActifParEmail.mockImplementation(async (email: string) => ({ ...LECTEUR, email }))
  courriers.envoyerCourrier.mockResolvedValue({ sorte: 'envoyé' })
  documents.listerÉditionsPubliées.mockResolvedValue([])
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('POST /api/acces/ouvrir et l’aperçu avant envoi', () => {
  it('aperçu actif : 409 apercu-avant-envoi, et aucun courrier ne part', async () => {
    apercu.aperçuAvantEnvoi.mockResolvedValue(true)
    const réponse = await poster()
    expect(réponse.status).toBe(409)
    expect(await réponse.json()).toEqual({ état: 'apercu-avant-envoi', slug: 'acme' })
    expect(apercu.aperçuAvantEnvoi).toHaveBeenCalledWith(LECTEUR.organisationId)
    expect(courriers.envoyerCourrier).not.toHaveBeenCalled()
  })

  it('aperçu levé : le lien part, comme avant', async () => {
    apercu.aperçuAvantEnvoi.mockResolvedValue(false)
    const réponse = await poster()
    expect(réponse.status).toBe(200)
    expect(await réponse.json()).toMatchObject({ état: 'envoyé', slug: 'acme' })
    expect(courriers.envoyerCourrier).toHaveBeenCalledTimes(1)
  })

  it('l’opératrice globale n’a pas d’espace à prévisualiser : son lien part sans lire le réglage', async () => {
    accès.lireAccèsActifParEmail.mockImplementation(async (email: string) => ({ ...LECTEUR, email, tousLesEspaces: true }))
    expect((await poster()).status).toBe(200)
    expect(apercu.aperçuAvantEnvoi).not.toHaveBeenCalled()
  })
})
