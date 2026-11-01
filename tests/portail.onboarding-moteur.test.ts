import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { OnboardingLu } from '@/lib/base/onboardings'

const base = vi.hoisted(() => ({
  assurerUnOnboarding: vi.fn(),
  onboardingDUnSlug: vi.fn(),
  réserverUnLancement: vi.fn(),
  conclureUnLancement: vi.fn(),
  rapporterUnOnboarding: vi.fn(),
  enregistrerUneDemande: vi.fn(),
  ouvrirUnRunDOnboarding: vi.fn(),
  conclureUnRunDOnboarding: vi.fn(),
  onboardingsPourLeContrôle: vi.fn(),
  demandeÀTransmettre: vi.fn(),
  effacerLesDemandesAnciennes: vi.fn(),
}))
const moteur = vi.hoisted(() => ({ déclencherLOnboarding: vi.fn(), déclencheurConfiguré: vi.fn() }))
const registre = vi.hoisted(() => ({ organisationDuRegistre: vi.fn(), créerDansLeRegistre: vi.fn(), marquerÀOnboarder: vi.fn() }))
const portailPayload = vi.hoisted(() => ({ ouvrirDansLePortail: vi.fn(), cléDeCloisonnement: (id: string) => id.replaceAll('-', '') }))
const github = vi.hoisted(() => ({ configurationGithub: vi.fn(), déclencherLeWorkflow: vi.fn() }))
vi.mock('@/lib/base/onboardings', () => base)
vi.mock('@/lib/moteur/declencher', () => moteur)
vi.mock('@/lib/payload/registre-onboarding', () => registre)
vi.mock('@/lib/payload/portail', () => portailPayload)
vi.mock('@/lib/github/workflow', () => github)

const { enregistrerLaDemande, lancerDepuisLePortail, lancerDepuisLeRegistre } = await import('@/lib/portail/onboarding')

const MAINTENANT = new Date('2026-11-01T12:00:00Z')
const RÉSERVATION = '0b6f2a6e-1c1e-4c4e-9a2a-0d6f5b1e2c3d'
const ORG_PAYLOAD = { id: 'aaaabbbb-cccc-dddd-eeee-ffff00005555', nom: 'Mastora', slug: 'mastora', etat: 'prospect', contact: { nom: 'Camille', email: 'camille@mastora.example' } }

const onboarding = (plus: Partial<OnboardingLu> = {}): OnboardingLu => ({
  id: 'o-1',
  slug: 'mastora',
  nom: 'Mastora',
  site: null,
  exécuteur: 'api',
  registreNotion: null,
  statutRapporté: null,
  statutRapportéLe: null,
  motifDeBlocage: null,
  crééLe: MAINTENANT,
  misÀJourLe: MAINTENANT,
  crééPar: 'Agathe',
  demande: null,
  organisation: null,
  lecteursActifs: 0,
  dernierLienEnvoyéLe: null,
  runs: [],
  ...plus,
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('SOURCE_DOCUMENTS', 'payload')
  moteur.déclencheurConfiguré.mockReturnValue(true)
  moteur.déclencherLOnboarding.mockResolvedValue({ déclenché: true, run: 'run_abc123def' })
  registre.organisationDuRegistre.mockResolvedValue(ORG_PAYLOAD)
  base.onboardingDUnSlug.mockResolvedValue(onboarding())
  base.réserverUnLancement.mockResolvedValue({ sorte: 'réservé', runId: RÉSERVATION, budget: { sorte: 'sans-budget' } })
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('le lancement par le moteur (lot 5)', () => {
  it('le bouton : réservation au plafond du moteur, ouverture dans le portail, déclenchement, puis « à onboarder » sans relance', async () => {
    const ordre: string[] = []
    base.réserverUnLancement.mockImplementation(async () => (ordre.push('réserver'), { sorte: 'réservé', runId: RÉSERVATION, budget: { sorte: 'sans-budget' } }))
    portailPayload.ouvrirDansLePortail.mockImplementation(async () => (ordre.push('ouvrir'), {}))
    moteur.déclencherLOnboarding.mockImplementation(async () => (ordre.push('déclencher'), { déclenché: true, run: 'run_abc123def' }))
    registre.marquerÀOnboarder.mockImplementation(async () => void ordre.push('marquer'))

    expect(await lancerDepuisLePortail({ slug: 'mastora', geste: 'onboarding', opératrice: 'Agathe' }, MAINTENANT)).toBe('lancé')
    expect(ordre).toEqual(['réserver', 'ouvrir', 'déclencher', 'marquer'])
    expect(base.réserverUnLancement).toHaveBeenCalledWith(expect.objectContaining({ tâche: 'onboarding', plafondUsd: 40, opératrice: 'Agathe' }))
    expect(moteur.déclencherLOnboarding).toHaveBeenCalledWith(ORG_PAYLOAD.id, { lancement: RÉSERVATION })
    expect(base.conclureUnLancement).toHaveBeenCalledWith(expect.objectContaining({ sorte: 'lancé', runTrigger: 'run_abc123def' }))
    // La ligne du registre est connue : la copie de la demande s'efface.
    expect(base.rapporterUnOnboarding).toHaveBeenCalledWith(expect.objectContaining({ slug: 'mastora', registre: 'aaaabbbbccccddddeeeeffff00005555' }))
    expect(github.déclencherLeWorkflow).not.toHaveBeenCalled()
  })

  it('le geste des tâches GitHub ne passe pas en mode Payload, ni l’inverse', async () => {
    expect(await lancerDepuisLePortail({ slug: 'mastora', geste: 'referentiels', opératrice: 'Agathe' }, MAINTENANT)).toBe('geste-périmé')
    vi.stubEnv('SOURCE_DOCUMENTS', 'notion')
    github.configurationGithub.mockReturnValue({ jeton: 'x', dépôt: 'a/b', branche: 'main' })
    expect(await lancerDepuisLePortail({ slug: 'mastora', geste: 'onboarding', opératrice: 'Agathe' }, MAINTENANT)).toBe('geste-périmé')
    expect(moteur.déclencherLOnboarding).not.toHaveBeenCalled()
  })

  it('sans clé Trigger.dev ou hors du registre, rien n’est réservé', async () => {
    moteur.déclencheurConfiguré.mockReturnValueOnce(false)
    expect(await lancerDepuisLePortail({ slug: 'mastora', geste: 'onboarding', opératrice: 'Agathe' }, MAINTENANT)).toBe('indisponible')
    registre.organisationDuRegistre.mockResolvedValueOnce(null)
    expect(await lancerDepuisLePortail({ slug: 'mastora', geste: 'onboarding', opératrice: 'Agathe' }, MAINTENANT)).toBe('hors-registre')
    expect(base.réserverUnLancement).not.toHaveBeenCalled()
  })

  it('un refus de Trigger.dev clôt la réservation en échec, et l’organisation n’est pas marquée', async () => {
    moteur.déclencherLOnboarding.mockRejectedValueOnce(new Error('401 Unauthorized'))
    expect(await lancerDepuisLePortail({ slug: 'mastora', geste: 'onboarding', opératrice: 'Agathe' }, MAINTENANT)).toBe('échec-moteur')
    expect(base.conclureUnLancement).toHaveBeenCalledWith(expect.objectContaining({ runId: RÉSERVATION, sorte: 'échec' }))
    expect(registre.marquerÀOnboarder).not.toHaveBeenCalled()
  })

  it('le crochet du registre crée l’onboarding qui manque, passe par le budget, et ne remarque pas l’organisation', async () => {
    base.réserverUnLancement.mockResolvedValueOnce({ sorte: 'budget-atteint', budget: { sorte: 'refusé' } })
    expect(await lancerDepuisLeRegistre({ slug: 'mastora' }, MAINTENANT)).toBe('budget-atteint')
    expect(base.assurerUnOnboarding).toHaveBeenCalledWith(expect.objectContaining({ slug: 'mastora', nom: 'Mastora', crééPar: 'admin Payload' }))
    expect(moteur.déclencherLOnboarding).not.toHaveBeenCalled()
    expect(await lancerDepuisLeRegistre({ slug: 'mastora' }, MAINTENANT)).toBe('lancé')
    expect(registre.marquerÀOnboarder).not.toHaveBeenCalled()
  })
})

describe('le formulaire en mode Payload (lot 5)', () => {
  const champs = { nom: 'Mastora', site: 'mastora.example', lecteurNom: 'Camille', lecteurEmail: 'camille@mastora.example' }

  it('crée l’organisation au registre avec le contact, puis efface la copie du portail', async () => {
    registre.organisationDuRegistre.mockResolvedValueOnce(null)
    base.enregistrerUneDemande.mockResolvedValue({ sorte: 'enregistrée', onboardingId: 'o-1' })
    registre.créerDansLeRegistre.mockResolvedValue({ sorte: 'créée', id: ORG_PAYLOAD.id })
    expect(await enregistrerLaDemande({ champs, opératrice: 'Agathe' }, MAINTENANT)).toEqual({ sorte: 'enregistrée', onboardingId: 'o-1', slug: 'mastora' })
    expect(registre.créerDansLeRegistre).toHaveBeenCalledWith({ nom: 'Mastora', slug: 'mastora', site: 'https://mastora.example/', contact: { nom: 'Camille', email: 'camille@mastora.example' } })
    expect(base.rapporterUnOnboarding).toHaveBeenCalledWith(expect.objectContaining({ slug: 'mastora', statut: 1, registre: 'aaaabbbbccccddddeeeeffff00005555' }))
  })

  it('refuse un slug déjà au registre, et Cowork, sans rien écrire', async () => {
    expect(await enregistrerLaDemande({ champs, opératrice: 'Agathe' }, MAINTENANT)).toEqual({ sorte: 'doublon', par: 'slug', slug: 'mastora', où: 'organisation' })
    expect(await enregistrerLaDemande({ champs: { ...champs, exécuteur: 'cowork' }, opératrice: 'Agathe' }, MAINTENANT)).toEqual({ sorte: 'invalide', champs: ['exécuteur'] })
    expect(base.enregistrerUneDemande).not.toHaveBeenCalled()
    expect(registre.créerDansLeRegistre).not.toHaveBeenCalled()
  })
})
