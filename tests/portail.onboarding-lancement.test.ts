import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { OnboardingLu, RunLu } from '@/lib/base/onboardings'

const base = vi.hoisted(() => ({
  onboardingDUnSlug: vi.fn(),
  réserverUnLancement: vi.fn(),
  conclureUnLancement: vi.fn(),
  ouvrirUnRunDOnboarding: vi.fn(),
  conclureUnRunDOnboarding: vi.fn(),
  rapporterUnOnboarding: vi.fn(),
  onboardingsPourLeContrôle: vi.fn(),
  enregistrerUneDemande: vi.fn(),
}))
const github = vi.hoisted(() => ({ configurationGithub: vi.fn(), déclencherLeWorkflow: vi.fn() }))
vi.mock('@/lib/base/onboardings', () => base)
vi.mock('@/lib/github/workflow', () => github)

const ouverture = vi.hoisted(() => ({ envoyerLesLiensDeLOrganisation: vi.fn() }))
vi.mock('@/lib/portail/ouverture', () => ouverture)

const { déclencherLaPublication, enregistrerPuisLancer, lancerDepuisLePortail, lancerLOuverture, rattraperLesOnboardings, recevoirUneFin, OPÉRATRICE_DE_L_ENCHAÎNEMENT } = await import('@/lib/portail/onboarding')

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
  crééPar: 'tache',
  demande: null,
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
    base.onboardingDUnSlug.mockResolvedValue(onboarding({ statutRapporté: 1 }))
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
    // Lot 6 : la première lettre part toujours sans attendre la validation, consigne gardée sur le run.
    expect(base.réserverUnLancement).toHaveBeenCalledWith(expect.objectContaining({ consigne: 'sans-validation' }))
    expect(github.déclencherLeWorkflow).toHaveBeenCalledWith(CONF, { tache: 'premiere-lettre', organisation: 'mastora', lancement: RUN, consigne: 'sans-validation' })
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

describe('l’enchaînement, l’ouverture et la publication depuis l’admin (lot 6)', () => {
  const lancé = () => {
    base.réserverUnLancement.mockResolvedValue({ sorte: 'réservé', runId: RUN, budget: { sorte: 'sans-budget' } })
    github.déclencherLeWorkflow.mockResolvedValue({ sorte: 'déclenché', runGithub: 9, lien: null })
  }

  const runLu = (plus: Partial<RunLu> = {}): RunLu => ({
    id: RUN,
    tâche: 'balayage',
    état: 'reussi',
    runGithub: 9,
    lien: null,
    runTrigger: null,
    plafondUsd: 30,
    coûtUsd: 12,
    début: MAINTENANT,
    fin: MAINTENANT,
    crééLe: MAINTENANT,
    codeHttp: null,
    lancéPar: 'Agathe',
    consigne: 'referentiels',
    ...plus,
  })

  it('un run de référentiels réussi, lancé du portail, enchaîne la première lettre sans validation', async () => {
    lancé()
    base.conclureUnRunDOnboarding.mockResolvedValue({ sorte: 'conclu', état: 'reussi', tâche: 'balayage', consigne: 'referentiels', lancéParLePortail: true })
    base.onboardingDUnSlug.mockResolvedValue(onboarding({ statutRapporté: 2, runs: [runLu()] }))
    vi.spyOn(console, 'info').mockImplementation(() => {})
    expect(await recevoirUneFin({ slug: 'mastora', runId: RUN, issue: 'reussi', coûtUsd: 12 }, MAINTENANT)).toBe('conclu')
    expect(base.réserverUnLancement).toHaveBeenCalledWith(expect.objectContaining({ tâche: 'premiere_lettre', consigne: 'sans-validation', opératrice: OPÉRATRICE_DE_L_ENCHAÎNEMENT }))
    expect(github.déclencherLeWorkflow).toHaveBeenCalledWith(CONF, expect.objectContaining({ tache: 'premiere-lettre', consigne: 'sans-validation' }))
  })

  it('lot 7 : l’enchaînement ne dépend plus du statut rapporté', async () => {
    lancé()
    base.conclureUnRunDOnboarding.mockResolvedValue({ sorte: 'conclu', état: 'reussi', tâche: 'balayage', consigne: 'referentiels', lancéParLePortail: true })
    // La tâche n'a pas rapporté le statut 2 : l'étape reste « demande ».
    base.onboardingDUnSlug.mockResolvedValue(onboarding({ statutRapporté: 1, runs: [runLu()] }))
    vi.spyOn(console, 'info').mockImplementation(() => {})
    expect(await recevoirUneFin({ slug: 'mastora', runId: RUN, issue: 'reussi', coûtUsd: 12 }, MAINTENANT)).toBe('conclu')
    expect(github.déclencherLeWorkflow).toHaveBeenCalledWith(CONF, expect.objectContaining({ tache: 'premiere-lettre', consigne: 'sans-validation' }))
    // Avec ONBOARDING_AUTONOME=non, l'enchaînement du lot 6 seul : il attend le statut 2.
    vi.clearAllMocks()
    github.configurationGithub.mockReturnValue(CONF)
    vi.stubEnv('ONBOARDING_AUTONOME', 'non')
    base.conclureUnRunDOnboarding.mockResolvedValue({ sorte: 'conclu', état: 'reussi', tâche: 'balayage', consigne: 'referentiels', lancéParLePortail: true })
    base.onboardingDUnSlug.mockResolvedValue(onboarding({ statutRapporté: 1, runs: [runLu()] }))
    await recevoirUneFin({ slug: 'mastora', runId: RUN, issue: 'reussi', coûtUsd: 12 }, MAINTENANT)
    expect(base.réserverUnLancement).not.toHaveBeenCalled()
  })

  it('lot 7 : un premier échec est relancé une fois, avec sa consigne ; un second ne l’est pas', async () => {
    lancé()
    vi.spyOn(console, 'info').mockImplementation(() => {})
    base.conclureUnRunDOnboarding.mockResolvedValue({ sorte: 'conclu', état: 'echec', tâche: 'premiere_lettre', consigne: 'sans-validation', lancéParLePortail: true })
    base.onboardingDUnSlug.mockResolvedValueOnce(
      onboarding({ statutRapporté: 2, runs: [runLu({ tâche: 'premiere_lettre', état: 'echec', consigne: 'sans-validation', plafondUsd: 40, coûtUsd: 8 }), runLu()] }),
    )
    await recevoirUneFin({ slug: 'mastora', runId: RUN, issue: 'echec', coûtUsd: 8 }, MAINTENANT)
    expect(base.réserverUnLancement).toHaveBeenCalledWith(expect.objectContaining({ tâche: 'premiere_lettre', consigne: 'sans-validation', opératrice: 'relance automatique du portail' }))
    base.réserverUnLancement.mockClear()
    const échec = runLu({ tâche: 'premiere_lettre', état: 'echec', consigne: 'sans-validation', plafondUsd: 40, coûtUsd: 8 })
    base.onboardingDUnSlug.mockResolvedValueOnce(onboarding({ statutRapporté: 2, runs: [échec, échec, runLu()] }))
    await recevoirUneFin({ slug: 'mastora', runId: RUN, issue: 'echec', coûtUsd: 8 }, MAINTENANT)
    expect(base.réserverUnLancement).not.toHaveBeenCalled()
  })

  it('rien ne suit un blocage, un run lancé à la main, un échec au plafond ou une première lettre produite', async () => {
    for (const [conclusion, lu] of [
      // Un blocage (motif d'une garde) n'est même pas relu : il attend un humain.
      [{ sorte: 'conclu', état: 'bloque', tâche: 'balayage', consigne: 'referentiels', lancéParLePortail: true }, null],
      // Un run lancé à la main dans GitHub n'est même pas relu.
      [{ sorte: 'conclu', état: 'reussi', tâche: 'balayage', consigne: null, lancéParLePortail: false }, null],
      [{ sorte: 'conclu', état: 'echec', tâche: 'balayage', consigne: 'referentiels', lancéParLePortail: true }, onboarding({ statutRapporté: 1, runs: [runLu({ état: 'echec', coûtUsd: 29.5 })] })],
      [
        { sorte: 'conclu', état: 'reussi', tâche: 'premiere_lettre', consigne: 'sans-validation', lancéParLePortail: true },
        onboarding({ statutRapporté: 4, organisation: { nom: 'Mastora', état: 'essai', activéeLe: null, essaiOuvertLe: MAINTENANT }, runs: [runLu({ tâche: 'premiere_lettre', consigne: 'sans-validation' })] }),
      ],
    ] as const) {
      base.conclureUnRunDOnboarding.mockResolvedValueOnce(conclusion)
      if (lu) base.onboardingDUnSlug.mockResolvedValueOnce(lu)
      expect(await recevoirUneFin({ slug: 'mastora', runId: RUN, issue: 'reussi', coûtUsd: 1 }, MAINTENANT)).toBe('conclu')
    }
    base.conclureUnRunDOnboarding.mockResolvedValueOnce({ sorte: 'déjà-conclu' })
    expect(await recevoirUneFin({ slug: 'mastora', runId: RUN, issue: 'reussi', coûtUsd: 1 }, MAINTENANT)).toBe('déjà-conclu')
    expect(base.réserverUnLancement).not.toHaveBeenCalled()
    expect(ouverture.envoyerLesLiensDeLOrganisation).not.toHaveBeenCalled()
    expect(base.onboardingDUnSlug).toHaveBeenCalledTimes(2)
  })

  it('lot 7 : la demande enregistrée lance les référentiels aussitôt, avec leur consigne', async () => {
    lancé()
    base.enregistrerUneDemande.mockResolvedValue({ sorte: 'enregistrée', onboardingId: 'o-1' })
    base.onboardingDUnSlug.mockResolvedValue(onboarding({ statutRapporté: null, runs: [] }))
    const issue = await enregistrerPuisLancer({ champs: { nom: 'Mastora', site: 'mastora.fr' }, opératrice: 'Agathe' }, MAINTENANT)
    expect(issue).toEqual({ sorte: 'enregistrée', onboardingId: 'o-1', slug: 'mastora', lancement: 'lancé' })
    expect(base.réserverUnLancement).toHaveBeenCalledWith(expect.objectContaining({ tâche: 'balayage', consigne: 'referentiels', opératrice: 'Agathe', plafondUsd: 30 }))
    expect(github.déclencherLeWorkflow).toHaveBeenCalledWith(CONF, { tache: 'balayage', organisation: 'mastora', lancement: RUN, consigne: 'referentiels' })
  })

  it('lot 7 : une demande Cowork est enregistrée sans rien lancer', async () => {
    base.enregistrerUneDemande.mockResolvedValue({ sorte: 'enregistrée', onboardingId: 'o-1' })
    base.onboardingDUnSlug.mockResolvedValue(onboarding({ exécuteur: 'cowork', statutRapporté: null, runs: [] }))
    const issue = await enregistrerPuisLancer({ champs: { nom: 'Mastora', site: 'mastora.fr', exécuteur: 'cowork' }, opératrice: 'Agathe' }, MAINTENANT)
    expect(issue).toEqual({ sorte: 'enregistrée', onboardingId: 'o-1', slug: 'mastora', lancement: 'non-lancé' })
    expect(base.réserverUnLancement).not.toHaveBeenCalled()
  })

  it('lot 7 : le rattrapage reprend une demande jamais lancée, et laisse Cowork', async () => {
    lancé()
    vi.spyOn(console, 'info').mockImplementation(() => {})
    const jamaisLancée = onboarding({ slug: 'mastora', statutRapporté: 1, runs: [] })
    base.onboardingsPourLeContrôle.mockResolvedValue([jamaisLancée, onboarding({ slug: 'cowork-sa', exécuteur: 'cowork', statutRapporté: 1 })])
    base.onboardingDUnSlug.mockResolvedValue(jamaisLancée)
    expect(await rattraperLesOnboardings(MAINTENANT)).toEqual({ lancés: 1, examinés: 1 })
    expect(base.réserverUnLancement).toHaveBeenCalledWith(expect.objectContaining({ slug: 'mastora', tâche: 'balayage', consigne: 'referentiels', opératrice: 'rattrapage du portail' }))
  })

  it('l’activation réussie fait partir le lien d’accès par le portail', async () => {
    base.conclureUnRunDOnboarding.mockResolvedValue({ sorte: 'conclu', état: 'reussi', tâche: 'balayage', consigne: 'activation', lancéParLePortail: true })
    ouverture.envoyerLesLiensDeLOrganisation.mockResolvedValue('espace-ouvert')
    vi.spyOn(console, 'info').mockImplementation(() => {})
    expect(await recevoirUneFin({ slug: 'mastora', runId: RUN, issue: 'reussi', coûtUsd: 3 }, MAINTENANT)).toBe('conclu')
    expect(ouverture.envoyerLesLiensDeLOrganisation).toHaveBeenCalledWith({ slug: 'mastora', déclencheur: 'onboarding', origine: null })
    expect(base.réserverUnLancement).not.toHaveBeenCalled()
  })

  it('« Ouvrir l’espace » réserve un balayage d’activation, à l’étape de la publication seulement', async () => {
    lancé()
    base.onboardingDUnSlug.mockResolvedValueOnce(onboarding({ statutRapporté: 4 }))
    expect(await lancerLOuverture({ slug: 'mastora', opératrice: 'Agathe' }, MAINTENANT)).toBe('geste-périmé')
    base.onboardingDUnSlug.mockResolvedValueOnce(onboarding({ statutRapporté: 4, organisation: { nom: 'Mastora', état: 'essai', activéeLe: MAINTENANT, essaiOuvertLe: MAINTENANT } }))
    expect(await lancerLOuverture({ slug: 'mastora', opératrice: 'Agathe' }, MAINTENANT)).toBe('lancé')
    expect(base.réserverUnLancement).toHaveBeenCalledWith(expect.objectContaining({ tâche: 'balayage', consigne: 'activation', plafondUsd: 30 }))
    expect(github.déclencherLeWorkflow).toHaveBeenCalledWith(CONF, { tache: 'balayage', organisation: 'mastora', lancement: RUN, consigne: 'activation' })
  })

  it('la publication lance la réconciliation sur les éditions envoyées, sans réservation', async () => {
    const id = '40cfe829ce7181f183d9c46c4777ce00'
    github.déclencherLeWorkflow.mockResolvedValue({ sorte: 'déclenché', runGithub: 3, lien: null })
    expect(await déclencherLaPublication({ slug: 'mastora', éditions: [id, id] })).toBe('publication-lancée')
    expect(github.déclencherLeWorkflow).toHaveBeenCalledWith(CONF, { tache: 'reconciliation', organisation: 'mastora', consigne: `publication:${id}` })
    expect(base.réserverUnLancement).not.toHaveBeenCalled()
    github.configurationGithub.mockReturnValue(null)
    expect(await déclencherLaPublication({ slug: 'mastora', éditions: [id] })).toBe('publication-indisponible')
  })
})
