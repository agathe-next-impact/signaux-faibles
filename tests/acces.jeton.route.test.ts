import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { signerJeton } from '@/lib/auth/jeton'

/**
 * Où mène le lien d'accès. L'opérateur va au sélecteur des espaces, même quand
 * sa ligne Notion porte encore le slug d'un client : la lecture Notion exige un
 * slug et un identifiant d'organisation, le privilège, lui, est global.
 */
const SECRET = 'un-secret-de-test-suffisamment-long-pour-etre-realiste'

const source = vi.hoisted(() => ({ lireAccèsParIdentifiant: vi.fn() }))
const prospection = vi.hoisted(() => ({ signalerVisite: vi.fn(async () => undefined) }))
vi.mock('@/lib/auth/source-acces', () => source)
vi.mock('@/lib/env', () => ({ env: () => ({ ACCES_SECRET_HMAC: SECRET }) }))
vi.mock('@/lib/portail/prospection', () => prospection)

const { GET } = await import('@/app/(portail)/acces/[jeton]/route')

const ouvrir = (identifiant: string) => {
  const jeton = signerJeton(identifiant, SECRET)
  return GET(new NextRequest(`https://www.signauxfaibles.io/acces/${jeton}`), {
    params: Promise.resolve({ jeton }),
  })
}

const accès = (extras: Record<string, unknown> = {}) => ({
  nom: 'Jean',
  email: 'jean@hermitage.fr',
  organisationLibellé: 'L’Hermitage',
  organisationId: '3d5fe829ce71810da651f3783a725bd8',
  slug: 'hermitage',
  actif: true,
  tousLesEspaces: false,
  ...extras,
})

beforeEach(() => vi.resetAllMocks())
afterEach(() => vi.restoreAllMocks())

describe('GET /acces/[jeton]', () => {
  it('mène un lecteur à son espace, et signale la visite à la prospection', async () => {
    source.lireAccèsParIdentifiant.mockResolvedValue(accès())
    const réponse = await ouvrir('a'.repeat(32))
    expect(new URL(réponse.headers.get('location') ?? '').pathname).toBe('/hermitage')
    expect(prospection.signalerVisite).toHaveBeenCalledWith('a'.repeat(32))
  })

  it('mène l’opérateur au sélecteur, même avec le slug d’un client sur sa ligne', async () => {
    source.lireAccèsParIdentifiant.mockResolvedValue(accès({ tousLesEspaces: true }))
    const réponse = await ouvrir('b'.repeat(32))
    expect(new URL(réponse.headers.get('location') ?? '').pathname).toBe('/espaces')
  })

  it('mène l’opérateur sans slug au sélecteur', async () => {
    source.lireAccèsParIdentifiant.mockResolvedValue(accès({ tousLesEspaces: true, slug: '', organisationId: '' }))
    const réponse = await ouvrir('c'.repeat(32))
    expect(new URL(réponse.headers.get('location') ?? '').pathname).toBe('/espaces')
  })

  it('refuse un accès révoqué, opérateur compris', async () => {
    source.lireAccèsParIdentifiant.mockResolvedValue(accès({ tousLesEspaces: true, actif: false }))
    const réponse = await ouvrir('d'.repeat(32))
    expect(new URL(réponse.headers.get('location') ?? '').pathname).toBe('/recevoir-mon-lien')
  })
})

describe('la visite n’est signalée qu’après une ouverture réussie', () => {
  it('un jeton invalide ne signale rien', async () => {
    source.lireAccèsParIdentifiant.mockResolvedValue(null)
    await ouvrir('e'.repeat(32))
    expect(prospection.signalerVisite).not.toHaveBeenCalled()
  })
})
