import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const sdk = vi.hoisted(() => ({ tasks: { trigger: vi.fn() } }))
vi.mock('@trigger.dev/sdk', () => sdk)

const { déclencherLeBlocPersonnalisé, déclencherLÉditionDeDécouverte, déclencherLOnboarding, déclencheurConfiguré } = await import('@/lib/moteur/declencher')

beforeEach(() => {
  vi.clearAllMocks()
  sdk.tasks.trigger.mockResolvedValue({ id: 'run_abc123def' })
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('le déclencheur Trigger.dev', () => {
  it('sans clé, rien ne part, et le dit', async () => {
    vi.stubEnv('TRIGGER_SECRET_KEY', '')
    expect(déclencheurConfiguré()).toBe(false)
    expect(await déclencherLOnboarding('org-1')).toEqual({ déclenché: false })
    expect(sdk.tasks.trigger).not.toHaveBeenCalled()
  })

  it('envoie les clés que les tâches lisent : organisation, prospect, et la réservation', async () => {
    vi.stubEnv('TRIGGER_SECRET_KEY', 'tr_dev_x')
    expect(await déclencherLOnboarding('org-1', { lancement: 'res-1' })).toEqual({ déclenché: true, run: 'run_abc123def' })
    expect(sdk.tasks.trigger).toHaveBeenLastCalledWith('onboarding', { organisation: 'org-1', lancement: 'res-1' })
    await déclencherLÉditionDeDécouverte('org-2')
    expect(sdk.tasks.trigger).toHaveBeenLastCalledWith('edition-de-decouverte', { organisation: 'org-2' })
    await déclencherLeBlocPersonnalisé('pro-3')
    expect(sdk.tasks.trigger).toHaveBeenLastCalledWith('bloc-personnalise', { prospect: 'pro-3' })
  })

  it('les tâches lisent bien ces clés (accord des deux côtés)', () => {
    const tâches = readFileSync('trigger/onboarding.ts', 'utf8')
    expect(tâches).toMatch(/payload: \{ organisation: string; lancement\?: string; ouvrirLEspace\?: boolean \}/)
    expect(tâches).toMatch(/payload: \{ organisation: string \}/)
    expect(tâches).toMatch(/payload: \{ prospect: string \}/)
  })
})
