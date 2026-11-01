import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { OnboardingLu } from '@/lib/base/onboardings'

const base = vi.hoisted(() => ({
  onboardingDUnSlug: vi.fn(),
  réserverUnLancement: vi.fn(),
  conclureUnLancement: vi.fn(),
  ouvrirUnRunDOnboarding: vi.fn(),
  conclureUnRunDOnboarding: vi.fn(),
  rapporterUnOnboarding: vi.fn(),
  onboardingsPourLeContrôle: vi.fn(),
}))
const github = vi.hoisted(() => ({ configurationGithub: vi.fn(), déclencherLeWorkflow: vi.fn() }))
vi.mock('@/lib/base/onboardings', () => base)
vi.mock('@/lib/github/workflow', () => github)

const { lancerDepuisLePortail } = await import('@/lib/portail/onboarding')

const MAINTENANT = new Date('2026-11-01T12:00:00Z')
const RUN = '0b6f2a6e-1c1e-4c4e-9a2a-0d6f5b1e2c3d'
const CONF = { jeton: 'x', dépôt: 'a/b', branche: 'main' }

const onboarding = (plus: Partial<OnboardingLu> = {}): OnboardingLu => ({
  id: 'o-1',
  slug: 'mastora',
  nom: 'Mastora',
  site: null,
  exécuteur: 'api',
  registreNotion: null,
  statutRapporté: 3,
  statutRapportéLe: MAINTENANT,
  motifDeBlocage: null,
  crééLe: MAINTENANT,
  misÀJourLe: MAINTENANT,
  organisation: null,
  lecteursActifs: 0,
  dernierLienEnvoyéLe: null,
  runs: [],
  ...plus,
})

beforeEach(() => {
  vi.clearAllMocks()
  github.configurationGithub.mockReturnValue(CONF)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('lancer un onboarding depuis le portail', () => {
  it('sans jeton GitHub, rien n’est lu ni réservé', async () => {
    github.configurationGithub.mockReturnValue(null)
    expect(await lancerDepuisLePortail({ slug: 'mastora', geste: 'premiere-lettre', opératrice: 'Agathe' }, MAINTENANT)).toBe('indisponible')
    expect(base.onboardingDUnSlug).not.toHaveBeenCalled()
    expect(base.réserverUnLancement).not.toHaveBeenCalled()
  })

  it('un geste qui n’est plus celui de l’étape ne relance rien', async () => {
    base.onboardingDUnSlug.mockResolvedValue(onboarding({ statutRapporté: 2 }))
    expect(await lancerDepuisLePortail({ slug: 'mastora', geste: 'premiere-lettre', opératrice: 'Agathe' }, MAINTENANT)).toBe('geste-périmé')
    expect(base.réserverUnLancement).not.toHaveBeenCalled()
  })

  it('réserve avant GitHub, avec le plafond de la tâche, puis conclut « lancé » avec le run', async () => {
    vi.stubEnv('ONBOARDING_BUDGET_MENSUEL_USD', '150')
    base.onboardingDUnSlug.mockResolvedValue(onboarding())
    const ordre: string[] = []
    base.réserverUnLancement.mockImplementation(async () => {
      ordre.push('réserver')
      return { sorte: 'réservé', runId: RUN, budget: { sorte: 'accepté' } }
    })
    github.déclencherLeWorkflow.mockImplementation(async () => {
      ordre.push('github')
      return { sorte: 'déclenché', runGithub: 77, lien: 'https://github.com/a/b/actions/runs/77' }
    })
    expect(await lancerDepuisLePortail({ slug: 'mastora', geste: 'premiere-lettre', opératrice: 'Agathe' }, MAINTENANT)).toBe('lancé')
    expect(ordre).toEqual(['réserver', 'github'])
    expect(base.réserverUnLancement).toHaveBeenCalledWith(expect.objectContaining({ slug: 'mastora', tâche: 'premiere_lettre', plafondUsd: 40, budgetUsd: 150, opératrice: 'Agathe' }))
    expect(github.déclencherLeWorkflow).toHaveBeenCalledWith(CONF, { tache: 'premiere-lettre', organisation: 'mastora', lancement: RUN })
    expect(base.conclureUnLancement).toHaveBeenCalledWith({ runId: RUN, sorte: 'lancé', runGithub: 77, lien: 'https://github.com/a/b/actions/runs/77', maintenant: MAINTENANT })
  })

  it('un budget atteint ou un run en cours arrêtent avant GitHub', async () => {
    base.onboardingDUnSlug.mockResolvedValue(onboarding())
    base.réserverUnLancement.mockResolvedValueOnce({ sorte: 'budget-atteint', budget: { sorte: 'refusé' } })
    expect(await lancerDepuisLePortail({ slug: 'mastora', geste: 'premiere-lettre', opératrice: 'Agathe' }, MAINTENANT)).toBe('budget-atteint')
    base.réserverUnLancement.mockResolvedValueOnce({ sorte: 'en-cours' })
    expect(await lancerDepuisLePortail({ slug: 'mastora', geste: 'premiere-lettre', opératrice: 'Agathe' }, MAINTENANT)).toBe('en-cours')
    expect(github.déclencherLeWorkflow).not.toHaveBeenCalled()
  })

  it('un refus de GitHub conclut la réservation en échec, avec le code', async () => {
    base.onboardingDUnSlug.mockResolvedValue(onboarding({ statutRapporté: 1 }))
    base.réserverUnLancement.mockResolvedValue({ sorte: 'réservé', runId: RUN, budget: { sorte: 'sans-budget' } })
    github.déclencherLeWorkflow.mockResolvedValue({ sorte: 'échec', codeHttp: 403 })
    expect(await lancerDepuisLePortail({ slug: 'mastora', geste: 'referentiels', opératrice: 'Agathe' }, MAINTENANT)).toBe('échec-github')
    expect(base.conclureUnLancement).toHaveBeenCalledWith({ runId: RUN, sorte: 'échec', codeHttp: 403, maintenant: MAINTENANT })
  })

  it('un onboarding Cowork ne se lance pas d’ici', async () => {
    base.onboardingDUnSlug.mockResolvedValue(onboarding({ exécuteur: 'cowork' }))
    expect(await lancerDepuisLePortail({ slug: 'mastora', geste: 'premiere-lettre', opératrice: 'Agathe' }, MAINTENANT)).toBe('cowork')
  })
})
