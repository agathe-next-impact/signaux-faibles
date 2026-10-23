import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const prévoir = vi.fn()
const conclure = vi.fn()
const envoyer = vi.fn()
const brouillonner = vi.fn()
const état = { configurée: true, source: 'double' as 'notion' | 'double' | 'postgres' }

vi.mock('@/lib/base/client', () => ({ baseConfigurée: () => état.configurée }))
vi.mock('@/lib/auth/source-acces', () => ({ sourceAccès: () => état.source }))
vi.mock('@/lib/base/courriers', () => ({ prévoirCourrier: prévoir, conclureCourrier: conclure }))
vi.mock('@/lib/email/gmail', async () => {
  class ErreurDEnvoi extends Error {
    constructor(readonly statut: number) {
      super(`refus ${statut}`)
    }
  }
  return { envoyerMessage: envoyer, créerBrouillon: brouillonner, ErreurDEnvoi }
})

const { envoyerCourrier } = await import('@/lib/portail/courriers')
const { ErreurDEnvoi } = (await import('@/lib/email/gmail')) as unknown as { ErreurDEnvoi: new (s: number) => Error }

const message = { destinataire: 'lea@x.fr', sujet: 's', texte: 't' }
const lien = { message, sorte: 'lien_acces' as const, déclencheur: 'x', organisation: null, lecteurId: null, unique: false }
const parcours = { ...lien, sorte: 'essai_tronquee' as const, unique: true }

describe('envoyerCourrier', () => {
  beforeEach(() => {
    état.configurée = true
    état.source = 'double'
    prévoir.mockReset().mockResolvedValue('c1')
    conclure.mockReset().mockResolvedValue(undefined)
    envoyer.mockReset().mockResolvedValue({ idMessage: 'gm1' })
    brouillonner.mockReset().mockResolvedValue({ idMessage: 'gb1' })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => vi.restoreAllMocks())

  it('réserve, envoie, puis conclut avec l’identifiant Gmail ; l’adresse ne va jamais au journal', async () => {
    expect(await envoyerCourrier(lien)).toEqual({ sorte: 'envoyé', journalisé: true })
    expect(prévoir.mock.invocationCallOrder[0]!).toBeLessThan(envoyer.mock.invocationCallOrder[0]!)
    expect(JSON.stringify(prévoir.mock.calls)).not.toContain('lea@x.fr')
    expect(prévoir.mock.calls[0]![0].destinataireEmpreinte).toMatch(/^[0-9a-f]{8}$/)
    expect(conclure).toHaveBeenCalledWith('c1', { état: 'envoye', messageGmail: 'gm1' })
  })

  it('un courrier commercial est déposé en brouillon, jamais envoyé, et sa clé va au journal', async () => {
    expect(await envoyerCourrier({ ...parcours, brouillon: true, clé: 'sub_1' })).toEqual({ sorte: 'brouillon' })
    expect(envoyer).not.toHaveBeenCalled()
    expect(prévoir.mock.invocationCallOrder[0]!).toBeLessThan(brouillonner.mock.invocationCallOrder[0]!)
    expect(prévoir.mock.calls[0]![0].clé).toBe('sub_1')
    expect(conclure).toHaveBeenCalledWith('c1', { état: 'brouillon', messageGmail: 'gb1' })
  })

  it('un brouillon hors des courriers uniques est refusé', async () => {
    await expect(envoyerCourrier({ ...lien, brouillon: true })).rejects.toThrow()
    expect(brouillonner).not.toHaveBeenCalled()
  })

  it('un courrier de parcours déjà réservé ne part pas', async () => {
    prévoir.mockResolvedValue(null)
    expect(await envoyerCourrier(parcours)).toEqual({ sorte: 'déjà-envoyé' })
    expect(envoyer).not.toHaveBeenCalled()
  })

  it('sans journal possible, le lien part et le courrier de parcours non', async () => {
    état.source = 'notion'
    expect(await envoyerCourrier(lien)).toEqual({ sorte: 'envoyé', journalisé: false })
    expect(prévoir).not.toHaveBeenCalled()
    envoyer.mockClear()
    expect((await envoyerCourrier(parcours)).sorte).toBe('non-journalisable')
    expect(envoyer).not.toHaveBeenCalled()
  })

  it('une base en panne ne prive pas un lecteur de son lien, mais bloque un courrier de parcours', async () => {
    prévoir.mockRejectedValue(new Error('[base] réservation en échec (SQLSTATE 08006).'))
    expect(await envoyerCourrier(lien)).toEqual({ sorte: 'envoyé', journalisé: false })
    envoyer.mockClear()
    expect((await envoyerCourrier(parcours)).sorte).toBe('non-journalisable')
    expect(envoyer).not.toHaveBeenCalled()
  })

  it('la réservation d’un lien est bornée ; celle d’un courrier de parcours est attendue jusqu’au bout', async () => {
    vi.useFakeTimers()
    try {
      let libérer: (v: string) => void = () => {}
      prévoir.mockImplementation(() => new Promise<string>((r) => (libérer = r)))
      const lienEnCours = envoyerCourrier(lien)
      await vi.advanceTimersByTimeAsync(400)
      expect(await lienEnCours).toEqual({ sorte: 'envoyé', journalisé: false })

      envoyer.mockClear()
      const parcoursEnCours = envoyerCourrier(parcours)
      await vi.advanceTimersByTimeAsync(5_000)
      expect(envoyer).not.toHaveBeenCalled()
      libérer('c2')
      expect(await parcoursEnCours).toEqual({ sorte: 'envoyé', journalisé: true })
    } finally {
      vi.useRealTimers()
    }
  })

  it('la conclusion peut être confiée à after()', async () => {
    const tâches: Array<() => Promise<void>> = []
    await envoyerCourrier({ ...lien, planifier: (t) => tâches.push(t) })
    expect(conclure).not.toHaveBeenCalled()
    await tâches[0]!()
    expect(conclure).toHaveBeenCalledWith('c1', { état: 'envoye', messageGmail: 'gm1' })
  })

  it('un refus de Gmail conclut en échec avec le seul statut, et remonte', async () => {
    envoyer.mockRejectedValue(new ErreurDEnvoi(403))
    await expect(envoyerCourrier(lien)).rejects.toThrow()
    expect(conclure).toHaveBeenCalledWith('c1', { état: 'echec', erreur: 'gmail-403' })
  })
})
