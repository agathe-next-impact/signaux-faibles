import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const organisationsEnEssai = vi.fn()
const envoyerCourrier = vi.fn()
const lireAccès = vi.fn()
const fixerJ0 = vi.fn()
const listerÉditionsPubliées = vi.fn()

vi.mock('@/lib/base/courriers', () => ({ organisationsEnEssai }))
vi.mock('@/lib/portail/courriers', () => ({ envoyerCourrier }))
vi.mock('@/lib/auth/source-acces', () => ({ lireAccèsActifParEmail: lireAccès }))
vi.mock('@/lib/base/organisations', () => ({ fixerJ0 }))
vi.mock('@/lib/notion/editions', () => ({ listerÉditionsPubliées }))

const { envoyerLesCourriersDeParcours, j0DesÉditions } = await import('@/lib/portail/parcours-courriers')

const REGISTRE = 'aaaabbbbccccddddeeeeffff00004444'
// Un lundi : J0 au 28/09 → troisième semaine le 12/10, quatrième le 19/10.
const activéeLe = new Date('2026-09-28T08:00:00Z')

function org(sur: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'o1', slug: 'acme', nom: 'Acme', activéeLe, relectureRequise: false, emailRelecture: null, offre: 'standard', parutionsDEssai: 3,
    registreNotion: REGISTRE, abonnement: null,
    lecteurs: [{ id: 'l1', nom: 'Léa', email: 'lea@acme.fr' }, { id: 'l2', nom: 'Paul', email: 'paul@acme.fr' }],
    ...sur,
  }
}
const appel = (aujourdHui: string) =>
  envoyerLesCourriersDeParcours({ aujourdHui, portailUrl: 'https://www.signauxfaibles.io', relecteurParDéfaut: 'relecture@sf.io' })

describe('envoyerLesCourriersDeParcours', () => {
  beforeEach(() => {
    organisationsEnEssai.mockReset()
    envoyerCourrier.mockReset().mockResolvedValue({ sorte: 'envoyé', journalisé: true })
    fixerJ0.mockReset().mockResolvedValue(true)
    listerÉditionsPubliées.mockReset().mockResolvedValue([])
    lireAccès.mockReset().mockImplementation(async () => ({ organisationId: REGISTRE, tousLesEspaces: false }))
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => vi.restoreAllMocks())

  it('rien les deux premières semaines, un courrier par lecteur la troisième, unique et journalisé', async () => {
    organisationsEnEssai.mockResolvedValue([org()])
    expect((await appel('2026-10-07')).courriers).toEqual([])
    const rapport = await appel('2026-10-14')
    expect(rapport.courriers.map((c) => c.sorte)).toEqual(['essai_derniere_parution', 'essai_derniere_parution'])
    expect(envoyerCourrier).toHaveBeenCalledTimes(2)
    const premier = envoyerCourrier.mock.calls[0]![0]
    expect(premier).toMatchObject({ unique: true, sorte: 'essai_derniere_parution', lecteurId: 'l1', organisation: { id: 'o1' } })
    expect(premier.message.destinataire).toBe('lea@acme.fr')
    expect(JSON.stringify(rapport)).not.toContain('@')
  })

  it('la quatrième semaine annonce la réduction ; une organisation abonnée chez Stripe ne reçoit rien', async () => {
    organisationsEnEssai.mockResolvedValue([org(), org({ id: 'o2', slug: 'payee', abonnement: { état: 'active' } })])
    const rapport = await appel('2026-10-21')
    expect(rapport.courriers.every((c) => c.slug === 'acme' && c.sorte === 'essai_tronquee')).toBe(true)
  })

  it('en relecture, un seul courrier à l’adresse de relecture, objet préfixé, sans lecteur', async () => {
    organisationsEnEssai.mockResolvedValue([org({ relectureRequise: true })])
    await appel('2026-10-14')
    expect(envoyerCourrier).toHaveBeenCalledTimes(1)
    const c = envoyerCourrier.mock.calls[0]![0]
    expect(c.lecteurId).toBeNull()
    expect(c.message.destinataire).toBe('relecture@sf.io')
    expect(c.message.sujet.startsWith('[Relecture, pour acme]')).toBe(true)
    expect(lireAccès).not.toHaveBeenCalled()
  })

  it('un lecteur révoqué ou rattaché ailleurs dans la source qui fait foi ne reçoit rien', async () => {
    organisationsEnEssai.mockResolvedValue([org()])
    lireAccès.mockImplementation(async (email: string) =>
      email === 'lea@acme.fr' ? null : { organisationId: 'ffffffffffffffffffffffffffffffff', tousLesEspaces: false },
    )
    const rapport = await appel('2026-10-14')
    expect(envoyerCourrier).not.toHaveBeenCalled()
    expect(rapport.courriers.map((c) => c.issue)).toEqual(['accès-inactif', 'accès-inactif'])
  })

  it('un échec n’arrête pas les autres destinataires', async () => {
    organisationsEnEssai.mockResolvedValue([org()])
    envoyerCourrier.mockRejectedValueOnce(new Error('gmail')).mockResolvedValueOnce({ sorte: 'envoyé', journalisé: true })
    const rapport = await appel('2026-10-14')
    expect(rapport.courriers.map((c) => c.issue)).toEqual(['échec', 'envoyé'])
  })

  it('sans J0 ni lettre publiée : rien, et J0 n’est pas posé', async () => {
    organisationsEnEssai.mockResolvedValue([org({ activéeLe: null })])
    const rapport = await appel('2026-10-14')
    expect(rapport.courriers).toEqual([])
    expect(rapport.j0Fixés).toEqual([])
    expect(fixerJ0).not.toHaveBeenCalled()
    expect(listerÉditionsPubliées).toHaveBeenCalledWith(REGISTRE)
  })

  it('sans J0, la première lettre publiée le fixe, et l’étape du jour en découle', async () => {
    organisationsEnEssai.mockResolvedValue([org({ activéeLe: null })])
    listerÉditionsPubliées.mockResolvedValue([{ dateÉdition: '2026-10-05' }, { dateÉdition: '2026-09-28' }, { dateÉdition: 'n/a' }])
    const rapport = await appel('2026-10-14')
    expect(fixerJ0).toHaveBeenCalledWith('o1', new Date('2026-09-28T12:00:00Z'))
    expect(rapport.j0Fixés).toEqual(['acme'])
    expect(rapport.courriers.map((c) => c.sorte)).toEqual(['essai_derniere_parution', 'essai_derniere_parution'])
  })

  it('une lecture Notion en échec saute l’organisation sans arrêter le passage', async () => {
    organisationsEnEssai.mockResolvedValue([org({ activéeLe: null }), org({ id: 'o2', slug: 'autre' })])
    listerÉditionsPubliées.mockRejectedValue(new Error('notion'))
    const rapport = await appel('2026-10-14')
    expect(fixerJ0).not.toHaveBeenCalled()
    expect(rapport.courriers.every((c) => c.slug === 'autre')).toBe(true)
  })

  it('j0DesÉditions prend la plus ancienne date valide, à midi UTC', () => {
    expect(j0DesÉditions([])).toBeNull()
    expect(j0DesÉditions([{ dateÉdition: '2026-10-12' }, { dateÉdition: '2026-10-05' }, { dateÉdition: 'n/a' }])?.toISOString()).toBe('2026-10-05T12:00:00.000Z')
    expect(j0DesÉditions([{ dateÉdition: '2026-10-05' }], new Date('2026-10-20T08:00:00Z'))).toBeNull()
  })

  it('une lettre antérieure à la semaine d’entrée en essai ne fixe pas J0', async () => {
    organisationsEnEssai.mockResolvedValue([org({ activéeLe: null, essaiOuvertLe: new Date('2026-10-14T09:00:00Z') })])
    listerÉditionsPubliées.mockResolvedValue([{ dateÉdition: '2026-09-07' }, { dateÉdition: '2026-10-12' }])
    await appel('2026-10-14')
    // Plancher : lundi 12/10, semaine de l'entrée en essai.
    expect(fixerJ0).toHaveBeenCalledWith('o1', new Date('2026-10-12T12:00:00Z'))
  })

  it('une fixation refusée n’envoie rien : l’étape n’est pas calculée sur une date absente de la base', async () => {
    organisationsEnEssai.mockResolvedValue([org({ activéeLe: null })])
    listerÉditionsPubliées.mockResolvedValue([{ dateÉdition: '2026-09-28' }])
    fixerJ0.mockResolvedValue(false)
    const rapport = await appel('2026-10-14')
    expect(rapport.j0Fixés).toEqual([])
    expect(envoyerCourrier).not.toHaveBeenCalled()
  })
})
