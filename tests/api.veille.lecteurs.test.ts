import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const écriture = vi.hoisted(() => ({ créerLecteur: vi.fn(), changerActivation: vi.fn() }))
vi.mock('@/lib/base/ecriture-lecteurs', () => écriture)

const { POST } = await import('@/app/api/veille/lecteurs/route')

const appel = (corps: unknown, jeton = 'secret-de-test') =>
  POST(
    new NextRequest('https://www.signauxfaibles.io/api/veille/lecteurs', {
      method: 'POST',
      headers: { authorization: `Bearer ${jeton}`, 'content-type': 'application/json' },
      body: JSON.stringify(corps),
    }),
  )

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('ACTIVATION_SECRET', 'secret-de-test')
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('POST /api/veille/lecteurs', () => {
  it('exige le jeton', async () => {
    vi.stubEnv('SOURCE_ACCES', 'postgres')
    expect((await appel({}, 'mauvais')).status).toBe(401)
  })

  it('refuse tant que Notion fait foi, en notion comme en double', async () => {
    for (const source of ['notion', 'double']) {
      vi.stubEnv('SOURCE_ACCES', source)
      const réponse = await appel({ action: 'creer', slug: 'hermitage', nom: 'Claire', email: 'c@h.fr' })
      expect(réponse.status).toBe(409)
    }
    expect(écriture.créerLecteur).not.toHaveBeenCalled()
  })

  it('rejette une demande mal formée', async () => {
    vi.stubEnv('SOURCE_ACCES', 'postgres')
    expect((await appel({ action: 'creer', slug: 'hermitage' })).status).toBe(400)
    expect((await appel({ action: 'supprimer', slug: 'h', email: 'c@h.fr' })).status).toBe(400)
  })

  it('crée, sans jamais rendre l’identifiant d’accès', async () => {
    vi.stubEnv('SOURCE_ACCES', 'postgres')
    écriture.créerLecteur.mockResolvedValue({ sorte: 'créé' })
    const réponse = await appel({ action: 'creer', slug: 'hermitage', nom: 'Claire', email: 'c@h.fr' })
    expect(réponse.status).toBe(201)
    expect(await réponse.json()).toEqual({ état: 'créé' })
  })

  it('révoque et réactive par slug et adresse', async () => {
    vi.stubEnv('SOURCE_ACCES', 'postgres')
    écriture.changerActivation.mockResolvedValue({ sorte: 'révoqué' })
    expect((await appel({ action: 'revoquer', slug: 'hermitage', email: 'c@h.fr' })).status).toBe(200)
    expect(écriture.changerActivation).toHaveBeenCalledWith({ slug: 'hermitage', email: 'c@h.fr', actif: false })
  })
})
