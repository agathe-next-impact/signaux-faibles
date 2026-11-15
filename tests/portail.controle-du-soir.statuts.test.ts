import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const source = vi.hoisted(() => ({ sourceAccès: vi.fn() }))
const client = vi.hoisted(() => ({ baseConfigurée: vi.fn() }))
const base = vi.hoisted(() => ({
  courriersDeParcoursEnSouffrance: vi.fn(),
  migrationsEnAttente: vi.fn(),
  étatsDesOrganisations: vi.fn(),
  organisationsArchivées: vi.fn(),
  sonderLaBase: vi.fn(),
}))
const notion = vi.hoisted(() => ({
  lignesDAccèsPourContrôle: vi.fn(),
  listerÉditionsPubliées: vi.fn(),
  lireBlocsDePage: vi.fn(),
}))
const portail = vi.hoisted(() => ({ alertesDesOnboardings: vi.fn(), contrôlerLÉtiquetage: vi.fn() }))

vi.mock('@/lib/auth/source-acces', () => source)
vi.mock('@/lib/base/client', () => client)
vi.mock('@/lib/base/courriers', () => ({ courriersDeParcoursEnSouffrance: base.courriersDeParcoursEnSouffrance }))
vi.mock('@/lib/base/migrer', () => ({ migrationsEnAttente: base.migrationsEnAttente }))
vi.mock('@/lib/base/organisations', () => ({
  étatsDesOrganisations: base.étatsDesOrganisations,
  organisationsArchivées: base.organisationsArchivées,
}))
vi.mock('@/lib/base/ecriture-lecteurs', () => ({ sonderLaBase: base.sonderLaBase }))
vi.mock('@/lib/notion/acces', () => ({ lignesDAccèsPourContrôle: notion.lignesDAccèsPourContrôle }))
vi.mock('@/lib/notion/editions', () => ({
  listerÉditionsPubliées: notion.listerÉditionsPubliées,
  lireBlocsDePage: notion.lireBlocsDePage,
}))
vi.mock('@/lib/portail/onboarding', () => ({ alertesDesOnboardings: portail.alertesDesOnboardings }))
vi.mock('@/lib/portail/strategie', () => ({ contrôlerLÉtiquetage: portail.contrôlerLÉtiquetage }))

const { contrôlerLeDispositif } = await import('@/lib/portail/controle-du-soir')

const registre = [
  { slug: 'acme', statut: '0 · Écartée' },
  { slug: 'eclairion', statut: '4 · Première lettre produite — à valider' },
  { slug: 'sain', statut: '6 · Veille active' },
]

beforeEach(() => {
  vi.resetAllMocks()
  source.sourceAccès.mockReturnValue('postgres')
  client.baseConfigurée.mockReturnValue(true)
  base.sonderLaBase.mockResolvedValue({ joignable: true, lecteursActifs: 3 })
  base.migrationsEnAttente.mockResolvedValue([])
  base.courriersDeParcoursEnSouffrance.mockResolvedValue([])
  base.étatsDesOrganisations.mockResolvedValue(
    new Map([
      ['acme', { état: 'essai', archivée: false }],
      ['sain', { état: 'abonnee', archivée: false }],
    ]),
  )
  base.organisationsArchivées.mockResolvedValue([])
  notion.lignesDAccèsPourContrôle.mockResolvedValue([])
  notion.listerÉditionsPubliées.mockResolvedValue([])
  portail.alertesDesOnboardings.mockResolvedValue([])
  portail.contrôlerLÉtiquetage.mockResolvedValue([])
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('contrôlerLeDispositif : les écarts de statut avec le registre', () => {
  it('sans lignes données, rien n’est comparé et Postgres n’est pas interrogé pour cela', async () => {
    const { état, statuts } = await contrôlerLeDispositif()
    expect(statuts).toBeNull()
    expect(base.étatsDesOrganisations).not.toHaveBeenCalled()
    expect(état.défauts).toEqual([])
  })

  it('compare les lignes données aux états du portail et signale les deux écarts', async () => {
    const { état, statuts } = await contrôlerLeDispositif({ registre })
    expect(statuts).toEqual({ lignes: 3, contrôlé: true })
    expect(base.étatsDesOrganisations).toHaveBeenCalledWith(['acme', 'eclairion', 'sain'])
    expect(état.défauts.map((d) => [d.slug, d.code])).toEqual([
      ['acme', 'statut-ecartee-registre'],
      ['eclairion', 'organisation-absente-du-portail'],
    ])
  })

  it('une organisation archivée n’est plus contrôlée ailleurs, mais ses écarts de statut restent dits', async () => {
    // Le contrôle laisse de côté les archivées (13 novembre 2026) : un défaut
    // d'étiquetage sur elle disparaît, l'écart de statut jamais, puisqu'il dit
    // justement que les tâches la traitent encore.
    base.organisationsArchivées.mockResolvedValue([{ slug: 'vieille', nom: 'Vieille', archivéeLe: new Date('2026-11-13') }])
    base.étatsDesOrganisations.mockResolvedValue(new Map([['vieille', { état: 'essai', archivée: true }]]))
    portail.contrôlerLÉtiquetage.mockResolvedValue([{ slug: 'vieille', code: 'étiquettes-manquantes', message: 'x' }])
    const { état } = await contrôlerLeDispositif({ registre: [{ slug: 'vieille', statut: '6 · Veille active' }] })
    expect(état.défauts.map((d) => [d.slug, d.code])).toEqual([['vieille', 'statut-archivee-portail']])
  })

  it('les écarts de statut s’ajoutent aux autres défauts sans les masquer', async () => {
    base.migrationsEnAttente.mockResolvedValue(['0030_exemple'])
    const { état } = await contrôlerLeDispositif({ registre })
    expect(état.défauts.map((d) => d.code)).toEqual(['migrations-en-attente', 'statut-ecartee-registre', 'organisation-absente-du-portail'])
  })

  it('SOURCE_ACCES=notion : Postgres reste fermé, et le contrôle dit qu’il n’a pas eu lieu', async () => {
    source.sourceAccès.mockReturnValue('notion')
    const { état, statuts } = await contrôlerLeDispositif({ registre })
    expect(statuts).toMatchObject({ lignes: 3, contrôlé: false })
    expect(statuts?.raison).toContain('SOURCE_ACCES vaut notion')
    expect(base.étatsDesOrganisations).not.toHaveBeenCalled()
    expect(état.défauts).toEqual([])
  })

  it('base injoignable : pas de comparaison, et le contrôle le dit', async () => {
    base.sonderLaBase.mockResolvedValue({ joignable: false, code: '57P01' })
    const { statuts } = await contrôlerLeDispositif({ registre })
    expect(statuts).toMatchObject({ lignes: 3, contrôlé: false })
    expect(statuts?.raison).toContain('la base ne répond pas')
    expect(base.étatsDesOrganisations).not.toHaveBeenCalled()
  })

  it('base absente : pas de comparaison non plus', async () => {
    client.baseConfigurée.mockReturnValue(false)
    const { statuts } = await contrôlerLeDispositif({ registre })
    expect(statuts).toMatchObject({ contrôlé: false })
    expect(base.sonderLaBase).not.toHaveBeenCalled()
  })

  it('une lecture des états qui échoue n’abat pas le contrôle : il le dit et garde les autres défauts', async () => {
    base.étatsDesOrganisations.mockRejectedValue(new Error('SQLSTATE 42P01'))
    base.migrationsEnAttente.mockResolvedValue(['0030_exemple'])
    const { état, statuts } = await contrôlerLeDispositif({ registre })
    expect(statuts).toEqual({ lignes: 3, contrôlé: false, raison: 'les états du portail sont illisibles.' })
    expect(état.défauts.map((d) => d.code)).toEqual(['migrations-en-attente'])
  })

  it('un registre vide est un contrôle qui a eu lieu sur zéro ligne', async () => {
    const { statuts } = await contrôlerLeDispositif({ registre: [] })
    expect(statuts).toEqual({ lignes: 0, contrôlé: true })
    expect(base.étatsDesOrganisations).toHaveBeenCalledWith([])
  })
})
