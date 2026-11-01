import { describe, expect, it } from 'vitest'
import { configurationGithub, déclencherLeWorkflow, VERSION_DE_L_API } from '@/lib/github/workflow'

const CONF = { jeton: 'jeton-github-secret', dépôt: 'agathe-next-impact/signaux-faibles', branche: 'main' }
const ENTRÉES = { tache: 'balayage' as const, organisation: 'mastora', lancement: '0b6f2a6e-1c1e-4c4e-9a2a-0d6f5b1e2c3d' }

function faux(réponse: () => Response) {
  const appels: { url: string; init: RequestInit }[] = []
  const faire = (async (url: string | URL, init?: RequestInit) => {
    appels.push({ url: String(url), init: init ?? {} })
    return réponse()
  }) as typeof fetch
  return { faire, appels }
}

describe('la configuration GitHub', () => {
  it('sans jeton, rien ; un jeton vide vaut absent ; dépôt et branche par défaut', () => {
    expect(configurationGithub({})).toBeNull()
    expect(configurationGithub({ GITHUB_JETON_ACTIONS: '  ' })).toBeNull()
    expect(configurationGithub({ GITHUB_JETON_ACTIONS: 'x' })).toEqual({ jeton: 'x', dépôt: 'agathe-next-impact/signaux-faibles', branche: 'main' })
    expect(configurationGithub({ GITHUB_JETON_ACTIONS: 'x', GITHUB_DEPOT_DES_TACHES: 'a/b', GITHUB_BRANCHE_DES_TACHES: 'essai' })).toEqual({ jeton: 'x', dépôt: 'a/b', branche: 'essai' })
    expect(configurationGithub({ GITHUB_JETON_ACTIONS: 'x', GITHUB_DEPOT_DES_TACHES: 'a/b/../c d' })).toBeNull()
  })
})

describe('le déclenchement du workflow', () => {
  it('appelle la seule route des dispatches, avec la branche et les trois entrées', async () => {
    const { faire, appels } = faux(() => new Response(JSON.stringify({ workflow_run_id: 4242, html_url: 'https://github.com/agathe-next-impact/signaux-faibles/actions/runs/4242' }), { status: 200 }))
    const r = await déclencherLeWorkflow(CONF, ENTRÉES, faire)
    expect(r).toEqual({ sorte: 'déclenché', runGithub: 4242, lien: 'https://github.com/agathe-next-impact/signaux-faibles/actions/runs/4242' })
    expect(appels).toHaveLength(1)
    expect(appels[0]!.url).toBe('https://api.github.com/repos/agathe-next-impact/signaux-faibles/actions/workflows/taches.yml/dispatches')
    const entêtes = appels[0]!.init.headers as Record<string, string>
    expect(entêtes['authorization']).toBe('Bearer jeton-github-secret')
    expect(entêtes['x-github-api-version']).toBe(VERSION_DE_L_API)
    expect(JSON.parse(String(appels[0]!.init.body))).toEqual({ ref: 'main', inputs: ENTRÉES })
  })

  it('un 204 sans corps vaut déclenchement sans identifiant', async () => {
    const { faire } = faux(() => new Response(null, { status: 204 }))
    expect(await déclencherLeWorkflow(CONF, ENTRÉES, faire)).toEqual({ sorte: 'déclenché', runGithub: null, lien: null })
  })

  it('un refus ou une panne est un échec, rendu par son seul code, sans le jeton', async () => {
    const refus = faux(() => new Response('{"message":"Resource not accessible by personal access token jeton-github-secret"}', { status: 403 }))
    const r = await déclencherLeWorkflow(CONF, ENTRÉES, refus.faire)
    expect(r).toEqual({ sorte: 'échec', codeHttp: 403 })
    expect(JSON.stringify(r)).not.toContain('jeton')
    const panne = faux(() => {
      throw new Error('ECONNRESET')
    })
    expect(await déclencherLeWorkflow(CONF, ENTRÉES, panne.faire)).toEqual({ sorte: 'échec', codeHttp: null })
  })

  it('un lien hors de GitHub n’est pas repris', async () => {
    const { faire } = faux(() => new Response(JSON.stringify({ workflow_run_id: 1, html_url: 'https://exemple.example/1' }), { status: 200 }))
    expect(await déclencherLeWorkflow(CONF, ENTRÉES, faire)).toEqual({ sorte: 'déclenché', runGithub: 1, lien: null })
  })
})
