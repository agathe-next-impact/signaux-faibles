import { describe, expect, it } from 'vitest'
import { consignesDuHarnais } from '@/scripts/taches/executer'
import { annoncerLaFin, annoncerLeDébut, estUnOnboarding, runDeGithub } from '@/scripts/taches/onboarding'
import { serveursDesOutils, visLeSuivi, type ConfigurationDesOutils } from '@/scripts/taches/outils'
import { SERVEURS } from '@/scripts/taches/garde'

type Appel = { url: string; corps: unknown }

function configuration(réponse: (corps: Record<string, unknown>) => Response, plus: Partial<ConfigurationDesOutils> = {}) {
  const appels: Appel[] = []
  const journal: string[] = []
  const conf: ConfigurationDesOutils = {
    portail: 'https://www.signauxfaibles.io',
    jetonPortail: 'jeton-du-portail',
    compteGoogle: null,
    boîte: null,
    nomExpéditeur: 'Signaux faibles',
    journal: (l) => journal.push(l),
    relevé: { organisations: new Set() },
    fetch: (async (url: string | URL, init?: RequestInit) => {
      const corps = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
      appels.push({ url: String(url), corps })
      return réponse(corps)
    }) as typeof fetch,
    ...plus,
  }
  return { conf, appels, journal }
}

const json = (corps: unknown, statut = 200) => new Response(JSON.stringify(corps), { status: statut })

describe('le suivi d’un onboarding par le harnais', () => {
  it('ne suit que balayage et premiere-lettre ciblés sur une organisation', () => {
    expect(estUnOnboarding('balayage', 'mastora')).toBe(true)
    expect(estUnOnboarding('premiere-lettre', 'mastora')).toBe(true)
    expect(estUnOnboarding('balayage', null)).toBe(false)
    expect(estUnOnboarding('lettres', 'mastora')).toBe(false)
    expect(estUnOnboarding('revue', 'mastora')).toBe(false)
  })

  it('lit le run GitHub dans l’environnement, et n’en fabrique pas hors de GitHub', () => {
    expect(
      runDeGithub({ GITHUB_RUN_ID: '123', GITHUB_RUN_ATTEMPT: '2', GITHUB_SERVER_URL: 'https://github.com', GITHUB_REPOSITORY: 'agathe-next-impact/signaux-faibles' }),
    ).toEqual({ id: 123, tentative: 2, lien: 'https://github.com/agathe-next-impact/signaux-faibles/actions/runs/123' })
    expect(runDeGithub({})).toBeNull()
    expect(runDeGithub({ GITHUB_RUN_ID: '123', GITHUB_SERVER_URL: 'https://ghe.exemple.example', GITHUB_REPOSITORY: 'a/b' })).toEqual({ id: 123, tentative: null, lien: null })
  })

  it('annonce le début et rend l’identifiant du run', async () => {
    const { conf, appels } = configuration(() => json({ état: 'ouvert', run: 'r-1', budget: { sorte: 'sans-budget' } }, 201))
    const début = await annoncerLeDébut(conf, { slug: 'mastora', tâche: 'balayage', plafondUsd: 30, run: { id: 9, tentative: 1, lien: null } })
    expect(début).toEqual({ sorte: 'suivi', runId: 'r-1' })
    expect(appels[0]).toMatchObject({ url: 'https://www.signauxfaibles.io/api/veille/onboardings', corps: { evenement: 'debut', slug: 'mastora', tache: 'balayage', plafondUsd: 30 } })
  })

  it('un refus de budget arrête le run et dit pourquoi', async () => {
    const { conf } = configuration(() => json({ état: 'budget-atteint', run: 'r-2', budget: { sorte: 'refusé', dépenséUsd: 44.82, plafondUsd: 30, budgetUsd: 50 } }, 409))
    const début = await annoncerLeDébut(conf, { slug: 'mastora', tâche: 'balayage', plafondUsd: 30, run: null })
    expect(début.sorte).toBe('refusé')
    expect(début.sorte === 'refusé' && début.message).toContain('44.82 $')
    expect(début.sorte === 'refusé' && début.message).toContain('ONBOARDING_BUDGET_MENSUEL_USD')
  })

  it('un portail fermé (mode notion, panne, jeton absent) n’arrête rien : le run part sans suivi', async () => {
    const notion = configuration(() => json({ état: 'refusé', raison: 'SOURCE_ACCES vaut notion' }, 409))
    expect((await annoncerLeDébut(notion.conf, { slug: 'mastora', tâche: 'balayage', plafondUsd: 30, run: null })).sorte).toBe('non-suivi')
    const panne = configuration(() => {
      throw new Error('ECONNRESET')
    })
    expect((await annoncerLeDébut(panne.conf, { slug: 'mastora', tâche: 'balayage', plafondUsd: 30, run: null })).sorte).toBe('non-suivi')
    const sansJeton = configuration(() => json({}), { jetonPortail: null })
    expect((await annoncerLeDébut(sansJeton.conf, { slug: 'mastora', tâche: 'balayage', plafondUsd: 30, run: null })).sorte).toBe('non-suivi')
  })

  it('annonce la fin avec l’issue et le coût, sans jamais lever', async () => {
    const { conf, appels } = configuration(() => json({ état: 'conclu' }))
    await annoncerLaFin(conf, { slug: 'mastora', runId: 'r-1', réussi: true, coûtUsd: 4.82 })
    expect(appels[0]!.corps).toEqual({ evenement: 'fin', slug: 'mastora', run: 'r-1', issue: 'reussi', coutUsd: 4.82 })
    const panne = configuration(() => {
      throw new Error('ECONNRESET')
    })
    await expect(annoncerLaFin(panne.conf, { slug: 'mastora', runId: 'r-1', réussi: false, coûtUsd: null })).resolves.toBeUndefined()
    expect(panne.journal.join('\n')).toContain('fin non rapportée')
  })
})

describe('l’outil de rapport', () => {
  const outilsDeVeille = (conf: ConfigurationDesOutils) => {
    const serveur = serveursDesOutils(conf)[SERVEURS.veille] as unknown as { instance: { _registeredTools: Record<string, { handler?: (a: unknown, extra: unknown) => Promise<unknown>; callback?: (a: unknown, extra: unknown) => Promise<unknown> }> } }
    return serveur.instance._registeredTools
  }

  it('n’existe que pour un run suivi', () => {
    const { conf } = configuration(() => json({}))
    expect(Object.keys(outilsDeVeille(conf))).not.toContain('rapporter_onboarding')
    expect(Object.keys(outilsDeVeille({ ...conf, onboarding: { slug: 'mastora' } }))).toContain('rapporter_onboarding')
  })

  it('n’écrit que sur le slug du run, quoi que le modèle passe', async () => {
    const { conf, appels } = configuration(() => json({ état: 'rapporté' }))
    const outil = outilsDeVeille({ ...conf, onboarding: { slug: 'mastora' } })['rapporter_onboarding']!
    const appeler = outil.handler ?? outil.callback
    await appeler!({ statut: 2, registre: 'aaaabbbbccccddddeeeeffff00005555', slug: 'autre' } as unknown, {})
    expect(appels[0]!.corps).toMatchObject({ evenement: 'rapport', slug: 'mastora', statut: 2 })
  })

  it('appeler_portail refuse la route du suivi, en relatif comme en adresse complète', () => {
    expect(visLeSuivi('/api/veille/onboardings')).toBe(true)
    expect(visLeSuivi('https://www.signauxfaibles.io/api/veille/onboardings?slug=x')).toBe(true)
    expect(visLeSuivi('/api/veille/onboardings/')).toBe(true)
    expect(visLeSuivi('/api/veille/organisations')).toBe(false)
  })

  it('la consigne du suivi n’apparaît que pour un run suivi', () => {
    const maintenant = new Date('2026-11-01T08:00:00Z')
    expect(consignesDuHarnais(maintenant, 'https://www.signauxfaibles.io')).not.toContain('SUIVI DE L’ONBOARDING')
    const suivi = consignesDuHarnais(maintenant, 'https://www.signauxfaibles.io', 'mastora')
    expect(suivi).toContain('SUIVI DE L’ONBOARDING')
    expect(suivi).toContain('« mastora »')
    expect(suivi).toContain(`mcp__${SERVEURS.veille}__rapporter_onboarding`)
  })
})
