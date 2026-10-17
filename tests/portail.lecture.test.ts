import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Le droit de lecture d'un espace (palier 1c) : restreint seulement sur une
 * étape calculée à partir de données lues ; complet dans le doute.
 */
const base = vi.hoisted(() => ({ lireEntréeDuParcours: vi.fn(), baseConfigurée: vi.fn() }))
vi.mock('@/lib/base/parcours', () => ({ lireEntréeDuParcours: base.lireEntréeDuParcours }))
vi.mock('@/lib/base/client', () => ({ baseConfigurée: base.baseConfigurée }))

const { lectureDeLEspace } = await import('@/lib/portail/lecture')

const ESPACE = { organisationId: '3d5fe829ce71810da651f3783a725bd8', enOpérateur: false }
const ACTIVÉE_IL_Y_A = (semaines: number) => new Date(Date.now() - semaines * 7 * 24 * 3600 * 1000)

beforeEach(() => {
  vi.resetAllMocks()
  base.baseConfigurée.mockReturnValue(true)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

describe('lectureDeLEspace', () => {
  it('complète pendant l’essai, l’essentiel la semaine suivante, rien au-delà', async () => {
    base.lireEntréeDuParcours.mockResolvedValue({ organisation: { état: 'essai', activéeLe: ACTIVÉE_IL_Y_A(1) }, abonnement: null })
    expect((await lectureDeLEspace(ESPACE)).lecture).toBe('complète')
    base.lireEntréeDuParcours.mockResolvedValue({ organisation: { état: 'essai', activéeLe: ACTIVÉE_IL_Y_A(3) }, abonnement: null })
    expect((await lectureDeLEspace(ESPACE)).lecture).toBe('essentiel')
    base.lireEntréeDuParcours.mockResolvedValue({ organisation: { état: 'essai', activéeLe: ACTIVÉE_IL_Y_A(6) }, abonnement: null })
    expect((await lectureDeLEspace(ESPACE)).lecture).toBe('aucune')
  })

  it('un abonnement ouvert rend la lecture complète', async () => {
    base.lireEntréeDuParcours.mockResolvedValue({
      organisation: { état: 'essai', activéeLe: ACTIVÉE_IL_Y_A(6) },
      abonnement: { état: 'active' },
    })
    expect((await lectureDeLEspace(ESPACE)).lecture).toBe('complète')
  })

  it('un client historique garde la lecture complète', async () => {
    base.lireEntréeDuParcours.mockResolvedValue({ organisation: { état: 'abonnee', activéeLe: null }, abonnement: null })
    expect((await lectureDeLEspace(ESPACE)).lecture).toBe('complète')
  })

  it('dans le doute, la lecture reste complète : base absente, injoignable, organisation inconnue', async () => {
    base.baseConfigurée.mockReturnValue(false)
    expect(await lectureDeLEspace(ESPACE)).toEqual({ lecture: 'complète', étape: null })
    expect(base.lireEntréeDuParcours).not.toHaveBeenCalled()

    base.baseConfigurée.mockReturnValue(true)
    base.lireEntréeDuParcours.mockRejectedValue(new Error('[base] en échec (SQLSTATE 08006).'))
    expect((await lectureDeLEspace(ESPACE)).lecture).toBe('complète')

    base.lireEntréeDuParcours.mockResolvedValue(null)
    expect((await lectureDeLEspace(ESPACE)).lecture).toBe('complète')
  })

  it('l’opérateur lit toujours tout, sans même interroger la base', async () => {
    expect(await lectureDeLEspace({ ...ESPACE, enOpérateur: true })).toEqual({ lecture: 'complète', étape: null })
    expect(base.lireEntréeDuParcours).not.toHaveBeenCalled()
  })
})
