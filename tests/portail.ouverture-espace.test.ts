import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  exigerOpérateur: vi.fn(),
  lecteursModifiables: vi.fn(),
  vueDeLOnboarding: vi.fn(),
  organisationÀGérer: vi.fn(),
  lecteursÀGérer: vi.fn(),
  adresseDUnLecteur: vi.fn(),
  lireAccèsActifParEmail: vi.fn(),
  autoriserLEnvoi: vi.fn(),
  envoyerCourrier: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`)
  }),
}))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
vi.mock('next/navigation', () => ({ redirect: m.redirect, notFound: () => { throw new Error('NOT_FOUND') } }))
vi.mock('@/lib/auth/appartenance', () => ({ exigerOpérateur: m.exigerOpérateur }))
vi.mock('@/lib/auth/jeton', () => ({ composerLienDAccès: () => 'https://www.signauxfaibles.io/acces/jeton' }))
vi.mock('@/lib/auth/source-acces', () => ({ lireAccèsActifParEmail: m.lireAccèsActifParEmail }))
vi.mock('@/lib/base/ecriture-lecteurs', () => ({ changerActivation: vi.fn(), créerLecteur: vi.fn(), révoquerLecteurParId: vi.fn() }))
vi.mock('@/lib/base/gestion', () => ({ adresseDUnLecteur: m.adresseDUnLecteur, lecteursÀGérer: m.lecteursÀGérer, organisationÀGérer: m.organisationÀGérer }))
vi.mock('@/lib/email/gmail', () => ({ composerCourrierDAccès: () => ({ sujet: 'x', texte: 'x' }) }))
vi.mock('@/lib/env', () => ({ env: () => ({ ACCES_SECRET_HMAC: 's', PORTAIL_URL: 'https://www.signauxfaibles.io' }) }))
vi.mock('@/lib/portail/courriers', () => ({ envoyerCourrier: m.envoyerCourrier }))
vi.mock('@/lib/portail/debit', () => ({ autoriserLEnvoi: m.autoriserLEnvoi, empreinte: () => 'abcd1234', origineDe: () => 'ip' }))
vi.mock('@/lib/portail/fiche-veille', () => ({ publierLaFicheDuPilote: vi.fn() }))
vi.mock('@/lib/portail/onboarding', () => ({ vueDeLOnboarding: m.vueDeLOnboarding }))
vi.mock('@/lib/portail/situation', () => ({ lecteursModifiables: m.lecteursModifiables }))
vi.mock('@/lib/portail/strategie', () => ({ réglerLEspace: vi.fn(), réglerLePilote: vi.fn(), validerLaVersion: vi.fn() }))

const { ouvrirLEspaceDepuisLOnboarding } = await import('@/lib/portail/gestion-actions')

const formulaire = (slug = 'mastora', retour = 'liste') => {
  const d = new FormData()
  d.set('slug', slug)
  d.set('retour', retour)
  return d
}
const issue = async (d = formulaire()) => {
  try {
    await ouvrirLEspaceDepuisLOnboarding(d)
  } catch (e) {
    const url = String((e as Error).message).replace('REDIRECT ', '')
    return new URL(url, 'https://x').searchParams.get('lancement') ?? new URL(url, 'https://x').searchParams.get('onboarding')
  }
  return null
}

beforeEach(() => {
  vi.clearAllMocks()
  m.exigerOpérateur.mockResolvedValue({ nom: 'Agathe' })
  m.lecteursModifiables.mockReturnValue(true)
  m.vueDeLOnboarding.mockResolvedValue({ geste: { sorte: 'ouvrir', libellé: 'Ouvrir l’espace' } })
  m.organisationÀGérer.mockResolvedValue({ id: 'org-1', avecRegistre: true })
  m.lecteursÀGérer.mockResolvedValue([
    { id: 'l-1', nom: 'Camille', actif: true },
    { id: 'l-2', nom: 'Ancien', actif: false },
  ])
  m.adresseDUnLecteur.mockResolvedValue('camille@mastora.example')
  m.lireAccèsActifParEmail.mockResolvedValue({ identifiant: 'i', nom: 'Camille', email: 'camille@mastora.example' })
  m.autoriserLEnvoi.mockReturnValue({ autorisé: true })
  m.envoyerCourrier.mockResolvedValue(undefined)
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

describe('ouvrir l’espace depuis l’onboarding (lot 4)', () => {
  it('la garde passe avant toute lecture', async () => {
    m.exigerOpérateur.mockRejectedValue(new Error('NOT_FOUND'))
    await expect(ouvrirLEspaceDepuisLOnboarding(formulaire())).rejects.toThrow('NOT_FOUND')
    expect(m.vueDeLOnboarding).not.toHaveBeenCalled()
    expect(m.envoyerCourrier).not.toHaveBeenCalled()
  })

  it('envoie le lien à chaque lecteur actif, et à lui seul, déclencheur « onboarding »', async () => {
    expect(await issue()).toBe('espace-ouvert')
    expect(m.adresseDUnLecteur).toHaveBeenCalledTimes(1)
    expect(m.adresseDUnLecteur).toHaveBeenCalledWith({ organisationId: 'org-1', lecteurId: 'l-1' })
    expect(m.envoyerCourrier).toHaveBeenCalledTimes(1)
    expect(m.envoyerCourrier).toHaveBeenCalledWith(expect.objectContaining({ sorte: 'lien_acces', déclencheur: 'onboarding', organisation: { id: 'org-1' } }))
  })

  it('ne fait rien tant que Notion fait foi pour les accès', async () => {
    m.lecteursModifiables.mockReturnValue(false)
    expect(await issue()).toBe('notion-fait-foi')
    expect(m.vueDeLOnboarding).not.toHaveBeenCalled()
  })

  it('refuse hors de l’étape, sans registre, sans lecteur actif', async () => {
    m.vueDeLOnboarding.mockResolvedValueOnce({ geste: { sorte: 'aucun', raison: 'attente' } })
    expect(await issue()).toBe('geste-périmé')
    m.organisationÀGérer.mockResolvedValueOnce({ id: 'org-1', avecRegistre: false })
    expect(await issue()).toBe('sans-registre')
    m.lecteursÀGérer.mockResolvedValueOnce([{ id: 'l-2', nom: 'Ancien', actif: false }])
    expect(await issue()).toBe('sans-lecteur')
    expect(m.envoyerCourrier).not.toHaveBeenCalled()
  })

  it('un lecteur révoqué entre-temps ou la limitation de débit ne font pas partir de lien', async () => {
    m.lireAccèsActifParEmail.mockResolvedValueOnce(null)
    expect(await issue()).toBe('lien-non-envoyé')
    m.autoriserLEnvoi.mockReturnValueOnce({ autorisé: false, motif: 'adresse' })
    expect(await issue()).toBe('débit')
    expect(m.envoyerCourrier).not.toHaveBeenCalled()
  })

  it('revient à la fiche quand le geste en vient', async () => {
    try {
      await ouvrirLEspaceDepuisLOnboarding(formulaire('mastora', 'fiche'))
    } catch (e) {
      expect(String((e as Error).message)).toContain('/espaces/abonnements/mastora?onboarding=espace-ouvert')
    }
  })
})
