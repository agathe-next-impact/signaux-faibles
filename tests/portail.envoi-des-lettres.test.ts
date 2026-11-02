import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  cléDUneOrganisationÀGérer: vi.fn(),
  destinatairesDUneLettre: vi.fn(),
  semainesDeLEspace: vi.fn(),
  lireBlocsDeLÉdition: vi.fn(),
  contrôlerLaLettre: vi.fn(),
  composerLettre: vi.fn(),
  envoyerCourrier: vi.fn(),
  lireAccèsActifParEmail: vi.fn(),
  déclencherLaPublication: vi.fn(),
}))
vi.mock('@/lib/base/gestion', () => ({ cléDUneOrganisationÀGérer: m.cléDUneOrganisationÀGérer }))
vi.mock('@/lib/base/parution', () => ({ destinatairesDUneLettre: m.destinatairesDUneLettre }))
vi.mock('@/lib/portail/semaine', () => ({ semainesDeLEspace: m.semainesDeLEspace }))
vi.mock('@/lib/documents', () => ({ lireBlocsDeLÉdition: m.lireBlocsDeLÉdition }))
vi.mock('@/lib/portail/lint', () => ({ contrôlerLaLettre: m.contrôlerLaLettre }))
vi.mock('@/lib/email/lettre', () => ({ composerLettre: m.composerLettre }))
vi.mock('@/lib/portail/courriers', () => ({ envoyerCourrier: m.envoyerCourrier }))
vi.mock('@/lib/auth/source-acces', () => ({ lireAccèsActifParEmail: m.lireAccèsActifParEmail }))
vi.mock('@/lib/portail/onboarding', () => ({ déclencherLaPublication: m.déclencherLaPublication }))
vi.mock('@/lib/portail/debit', () => ({ empreinte: () => 'abcd1234' }))

const { envoyerLesLettresÀPublier } = await import('@/lib/portail/envoi-des-lettres')

const CLÉ = '400fe829ce718101b509d5559e3df7d8'
const ÉCO = '40cfe829-ce71-81f1-83d9-c46c4777ce00'
const MOUV = '40cfe829ce71811d919bf29c8c10eecd'
const édition = (pageId: string, plus: Record<string, unknown> = {}) => ({
  pageId,
  titre: `Veille ${pageId}`,
  veille: 'Écosystème',
  dateÉdition: '2026-11-02',
  numéro: 1,
  périodeCouverte: '26/10 – 01/11',
  fenêtreÉlargie: true,
  actionDeLaSemaine: '',
  dossiersOuvertsBruts: '',
  aperçu: true,
  ...plus,
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  m.cléDUneOrganisationÀGérer.mockResolvedValue(CLÉ)
  m.destinatairesDUneLettre.mockResolvedValue({
    organisationId: 'org-1',
    slug: 'cci-cantal',
    nom: 'CCI du Cantal',
    relectureRequise: false,
    emailRelecture: null,
    lecteurs: [
      { id: 'l-1', nom: 'Lydie', email: 'lydie@cci.example' },
      { id: 'l-2', nom: 'Paul', email: 'paul@cci.example' },
    ],
  })
  m.semainesDeLEspace.mockResolvedValue([{ éditions: [édition(ÉCO), édition(MOUV), édition('publiee', { aperçu: undefined })] }])
  m.lireBlocsDeLÉdition.mockResolvedValue([])
  m.contrôlerLaLettre.mockReturnValue({ conforme: true, ruptures: [] })
  m.composerLettre.mockReturnValue({ html: '<p>x</p>', texte: 'x', courriel: { objet: 'Objet' }, axes: 3 })
  m.lireAccèsActifParEmail.mockResolvedValue({ identifiant: 'i', email: 'x' })
  m.envoyerCourrier.mockResolvedValue({ sorte: 'envoyé', journalisé: true })
  m.déclencherLaPublication.mockResolvedValue('publication-lancée')
})

describe('envoyer les lettres de la première parution depuis l’admin (lot 6)', () => {
  it('lit l’aperçu par la clé de l’organisation, n’envoie que les lettres non publiées, une fois par lettre et par lecteur', async () => {
    const bilan = await envoyerLesLettresÀPublier({ slug: 'cci-cantal' })
    expect(m.semainesDeLEspace).toHaveBeenCalledWith({ organisationId: CLÉ, aperçu: true })
    expect(m.envoyerCourrier).toHaveBeenCalledTimes(4)
    expect(m.envoyerCourrier).toHaveBeenCalledWith(
      expect.objectContaining({ sorte: 'lettre', déclencheur: 'operatrice', organisation: { id: 'org-1' }, lecteurId: 'l-1', unique: true, clé: 'lettre:40cfe829ce7181f183d9c46c4777ce00' }),
    )
    expect(m.déclencherLaPublication).toHaveBeenCalledWith({ slug: 'cci-cantal', éditions: ['40cfe829ce7181f183d9c46c4777ce00', MOUV] })
    expect(bilan).toEqual({ sorte: 'envoyées', publiées: 2, nonConformes: 0, envoyés: 4, déjàEnvoyés: 0, incomplètes: 0, publication: 'publication-lancée' })
  })

  it('un second clic ne renvoie rien et publie quand même ce qui est déjà parti', async () => {
    m.envoyerCourrier.mockResolvedValue({ sorte: 'déjà-envoyé' })
    const bilan = await envoyerLesLettresÀPublier({ slug: 'cci-cantal' })
    expect(bilan).toMatchObject({ sorte: 'envoyées', publiées: 2, envoyés: 0, déjàEnvoyés: 4 })
    expect(m.déclencherLaPublication).toHaveBeenCalled()
  })

  it('une lettre non conforme au lint ne part pas et n’est pas publiée', async () => {
    m.contrôlerLaLettre.mockReturnValueOnce({ conforme: false, ruptures: [{ code: 'x' }] })
    const bilan = await envoyerLesLettresÀPublier({ slug: 'cci-cantal' })
    expect(bilan).toMatchObject({ publiées: 1, nonConformes: 1, envoyés: 2 })
    expect(m.déclencherLaPublication).toHaveBeenCalledWith({ slug: 'cci-cantal', éditions: [MOUV] })
  })

  it('un lecteur révoqué entre-temps n’a pas la lettre, et la lettre n’est pas publiée tant qu’elle n’est pas partie à tous', async () => {
    m.lireAccèsActifParEmail.mockImplementation(async (email: string) => (email === 'paul@cci.example' ? null : { identifiant: 'i', email }))
    const bilan = await envoyerLesLettresÀPublier({ slug: 'cci-cantal' })
    expect(m.envoyerCourrier).toHaveBeenCalledTimes(2)
    expect(bilan).toMatchObject({ publiées: 0, incomplètes: 2, publication: 'rien-à-publier' })
    expect(m.déclencherLaPublication).not.toHaveBeenCalled()
  })

  it('tant que la relecture est requise, la lettre va à la relecture seulement', async () => {
    m.destinatairesDUneLettre.mockResolvedValueOnce({ organisationId: 'org-1', slug: 'cci-cantal', nom: 'CCI du Cantal', relectureRequise: true, emailRelecture: 'relecture@example.org', lecteurs: [{ id: 'l-1', nom: 'Lydie', email: 'lydie@cci.example' }] })
    await envoyerLesLettresÀPublier({ slug: 'cci-cantal' })
    expect(m.envoyerCourrier).toHaveBeenCalledTimes(2)
    expect(m.envoyerCourrier).toHaveBeenCalledWith(expect.objectContaining({ lecteurId: null, message: expect.objectContaining({ destinataire: 'relecture@example.org', sujet: '[Relecture, pour cci-cantal] Objet' }) }))
    expect(m.lireAccèsActifParEmail).not.toHaveBeenCalled()
  })

  it('sans registre, sans lettre à envoyer ou sans destinataire, rien ne part', async () => {
    m.cléDUneOrganisationÀGérer.mockResolvedValueOnce(null)
    expect(await envoyerLesLettresÀPublier({ slug: 'cci-cantal' })).toEqual({ sorte: 'sans-registre' })
    m.semainesDeLEspace.mockResolvedValueOnce([{ éditions: [édition('publiee', { aperçu: undefined })] }])
    expect(await envoyerLesLettresÀPublier({ slug: 'cci-cantal' })).toEqual({ sorte: 'sans-lettre' })
    m.destinatairesDUneLettre.mockResolvedValueOnce({ organisationId: 'org-1', slug: 'cci-cantal', nom: 'CCI du Cantal', relectureRequise: false, emailRelecture: null, lecteurs: [] })
    expect(await envoyerLesLettresÀPublier({ slug: 'cci-cantal' })).toEqual({ sorte: 'sans-destinataire' })
    expect(m.envoyerCourrier).not.toHaveBeenCalled()
    expect(m.déclencherLaPublication).not.toHaveBeenCalled()
  })
})
