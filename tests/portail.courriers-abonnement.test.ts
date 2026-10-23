import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const organisationEtSesLecteurs = vi.fn()
const abonnementsAnnuelsÀÉchéance = vi.fn()
const envoyerCourrier = vi.fn()
const lireAccès = vi.fn()

vi.mock('@/lib/base/courriers', () => ({ organisationEtSesLecteurs, abonnementsAnnuelsÀÉchéance, organisationsEnEssai: vi.fn() }))
vi.mock('@/lib/portail/courriers', () => ({ envoyerCourrier }))
vi.mock('@/lib/auth/source-acces', () => ({ lireAccèsActifParEmail: lireAccès }))
vi.mock('@/lib/base/organisations', () => ({ fixerJ0: vi.fn() }))
vi.mock('@/lib/documents', () => ({ listerÉditionsPubliées: vi.fn() }))

const { préparerLeCourrierDuChangement, préparerLesRappelsDeRenouvellement } = await import('@/lib/portail/courriers-abonnement')

const REGISTRE = 'aaaabbbbccccddddeeeeffff00005555'
const organisation = {
  id: 'o1', slug: 'acme', nom: 'Acme', registreNotion: REGISTRE, offre: 'standard',
  lecteurs: [{ id: 'l1', nom: 'Léa', email: 'lea@acme.fr' }],
}
const changement = (étatPrécédent: string | null, état: string) =>
  préparerLeCourrierDuChangement({
    organisationId: 'o1', abonnementStripe: 'sub_1', étatPrécédent, état, formule: 'mensuelle',
    périodeFin: new Date('2026-11-23T00:00:00Z'), portailUrl: 'https://www.signauxfaibles.io',
  })

describe('courriers de l’abonnement', () => {
  beforeEach(() => {
    organisationEtSesLecteurs.mockReset().mockResolvedValue(organisation)
    abonnementsAnnuelsÀÉchéance.mockReset().mockResolvedValue([])
    envoyerCourrier.mockReset().mockResolvedValue({ sorte: 'brouillon' })
    lireAccès.mockReset().mockResolvedValue({ organisationId: REGISTRE, tousLesEspaces: false })
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => vi.restoreAllMocks())

  it('un abonnement qui s’ouvre : un brouillon de confirmation par lecteur, clé à l’abonnement', async () => {
    const préparés = await changement(null, 'active')
    expect(préparés.map((c) => [c.sorte, c.issue])).toEqual([['abonnement_confirme', 'brouillon']])
    const appel = envoyerCourrier.mock.calls[0]![0]
    expect(appel).toMatchObject({ brouillon: true, unique: true, clé: 'sub_1', déclencheur: 'stripe', lecteurId: 'l1' })
    expect(appel.message.destinataire).toBe('lea@acme.fr')
    expect(appel.message.sujet).toBe('Votre abonnement signauxfaibles est actif')
  })

  it('un paiement refusé : la clé porte l’échéance, pour un brouillon par période', async () => {
    await changement('active', 'past_due')
    expect(envoyerCourrier.mock.calls[0]![0]).toMatchObject({ sorte: 'paiement_echec', clé: 'sub_1:2026-11-23' })
  })

  it('un changement sans courrier ne lit rien', async () => {
    expect(await changement('active', 'active')).toEqual([])
    expect(organisationEtSesLecteurs).not.toHaveBeenCalled()
    expect(envoyerCourrier).not.toHaveBeenCalled()
  })

  it('un lecteur dont l’accès n’est plus actif ne reçoit pas de brouillon', async () => {
    lireAccès.mockResolvedValue(null)
    expect((await changement(null, 'canceled')).map((c) => c.issue)).toEqual(['accès-inactif'])
    expect(envoyerCourrier).not.toHaveBeenCalled()
  })

  it('le rappel de renouvellement : fenêtre de trente jours, clé à l’échéance', async () => {
    const périodeFin = new Date('2026-11-10T00:00:00Z')
    abonnementsAnnuelsÀÉchéance.mockResolvedValue([{ abonnementStripe: 'sub_an', périodeFin, organisation }])
    const maintenant = new Date('2026-10-23T08:00:00Z')
    await préparerLesRappelsDeRenouvellement({ maintenant, portailUrl: 'https://www.signauxfaibles.io' })
    const fenêtre = abonnementsAnnuelsÀÉchéance.mock.calls[0]![0]
    expect(fenêtre.depuis).toEqual(maintenant)
    expect(fenêtre.jusquÀ).toEqual(new Date('2026-11-22T08:00:00Z'))
    const appel = envoyerCourrier.mock.calls[0]![0]
    expect(appel).toMatchObject({ sorte: 'abonnement_renouvellement', clé: 'sub_an:2026-11-10', brouillon: true })
    expect(appel.message.sujet).toContain('10 novembre 2026')
  })
})
