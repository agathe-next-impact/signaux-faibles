import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import type { Base } from '@/lib/base/client'
import { organisations, runs, veilles } from '@/lib/base/schema'
import { planifierLesLettres, poserUnTravailDeLettre, prendreLeProchainTravail } from '@/lib/base/travaux'
import { baseEnMémoire } from './aide/base-en-memoire'

const notion = vi.hoisted(() => ({
  lireÉditionDeTravail: vi.fn(),
  listerÉditionsDeTravail: vi.fn(),
  lireBlocsDePage: vi.fn(),
  contrôlerLaLettre: vi.fn(),
}))
vi.mock('@/lib/notion/travail', () => ({
  lireÉditionDeTravail: notion.lireÉditionDeTravail,
  listerÉditionsDeTravail: notion.listerÉditionsDeTravail,
}))
vi.mock('@/lib/notion/editions', () => ({ lireBlocsDePage: notion.lireBlocsDePage }))
vi.mock('@/lib/portail/lint', () => ({ contrôlerLaLettre: notion.contrôlerLaLettre }))

const { prendreUnTravail, prendreCeTravail, recevoirUnRésultat, recevoirUneÉdition } = await import('@/lib/portail/file')

const REGISTRE = 'aaaabbbbccccddddeeeeffff00005555'
const PAGE = '11112222-3333-4444-5555-666677778888'
const PAGE_HEX = '11112222333344445555666677778888'

const édition = (surcharge: Record<string, unknown> = {}) => ({
  pageId: PAGE,
  titre: 'Veille Acme — Écosystème — n° 13',
  statut: 'Brouillon',
  famille: 'Écosystème',
  veille: 'Écosystème',
  dateÉdition: '2026-10-23',
  numéro: 13,
  périodeCouverte: '',
  fenêtreÉlargie: false,
  dossiersOuvertsBruts: 'CADA (1)',
  actionDeLaSemaine: '',
  amendements: '',
  livraison: '',
  organisationIds: [REGISTRE],
  ...surcharge,
})

const rapportConforme = { conforme: true, ruptures: [], avertissements: [], aperçu: { titre: 't', rubriques: [], axes: [], dossiers: [], cadrage: { présent: true, clos: true, phraseDeClôture: true } } }

describe('l’orchestration de la file', () => {
  let db: Base
  let fermer: () => Promise<void>
  let ecoId: string

  beforeEach(async () => {
    vi.resetAllMocks()
    ;({ db, fermer } = await baseEnMémoire())
    const [acme] = await db.insert(organisations).values({ slug: 'acme', nom: 'Acme', état: 'essai', registreNotion: REGISTRE }).returning()
    const [eco] = await db
      .insert(veilles)
      .values({ organisationId: acme!.id, type: 'ecosysteme', libellé: 'Écosystème', jourParution: 5, heureParution: '06:30', cadence: 'hebdomadaire', numéroCourant: 12 })
      .returning()
    ecoId = eco!.id
    await planifierLesLettres({ aujourdHui: '2026-10-23' }, db)
    notion.lireBlocsDePage.mockResolvedValue([])
    notion.contrôlerLaLettre.mockReturnValue(rapportConforme)
  })
  afterEach(async () => {
    await fermer()
  })

  const maintenant = new Date('2026-10-23T06:00:00Z')

  describe('prendreUnTravail', () => {
    it('complète le travail par le contexte Notion de sa famille, lu par la clé de cloisonnement', async () => {
      notion.listerÉditionsDeTravail.mockResolvedValue([
        édition({ pageId: 'p12', numéro: 12, dateÉdition: '2026-10-16', statut: 'Envoyé' }),
        édition({ pageId: 'c3', numéro: 3, famille: 'Concurrentiel' }),
      ])
      const pris = await prendreUnTravail({ session: 's1', maintenant }, db)
      expect(pris?.travail.contexte.numéro).toBe(13)
      expect(notion.listerÉditionsDeTravail).toHaveBeenCalledWith(REGISTRE)
      expect(pris?.notion).toMatchObject({ éditions: 1, dernierNuméro: 12, prochainNuméro: 13, dernièreDate: '2026-10-16' })
      expect(pris?.notion?.dernières[0]).toMatchObject({ pageId: 'p12', dossiers: [{ nom: 'CADA', compteur: 1 }] })
    })

    it('file vide : null, sans lire Notion', async () => {
      notion.listerÉditionsDeTravail.mockResolvedValue([])
      await prendreUnTravail({ session: 's1', maintenant }, db)
      expect(await prendreUnTravail({ session: 's2', maintenant }, db)).toBeNull()
      expect(notion.listerÉditionsDeTravail).toHaveBeenCalledTimes(1)
    })
  })

  describe('recevoirUnRésultat', () => {
    const recevoir = async (session = 's1', surcharge: Record<string, unknown> = {}) => {
      notion.listerÉditionsDeTravail.mockResolvedValue([])
      const pris = (await prendreUnTravail({ session: 's1', maintenant }, db))!
      return recevoirUnRésultat({ travailId: pris.travail.id, session, page: PAGE, exécuteur: 'cowork:s1', ...surcharge }, db)
    }

    it('accepte une page de l’organisation, de la famille et du numéro attendus, conforme au lint', async () => {
      notion.lireÉditionDeTravail.mockResolvedValue(édition())
      const réception = await recevoir()
      expect(réception).toMatchObject({ sorte: 'accepté', conclusion: { sorte: 'accepté', numéro: 13 }, portes: { portail: [], ruptures: [] } })
      expect(notion.lireÉditionDeTravail).toHaveBeenCalledWith(PAGE)
      expect(notion.contrôlerLaLettre).toHaveBeenCalledWith(expect.objectContaining({ titre: édition().titre, dossiersBruts: 'CADA (1)', numéro: 13 }))
      const [veille] = await db.select().from(veilles).where(eq(veilles.id, ecoId))
      expect(veille?.numéroCourant).toBe(13)
      const [run] = await db.select().from(runs)
      expect(run).toMatchObject({ accepté: true, pageNotion: PAGE_HEX })
    })

    it('refuse une page d’une autre organisation, avant même de lire ses blocs', async () => {
      notion.lireÉditionDeTravail.mockResolvedValue(édition({ organisationIds: ['ffffffffffffffffffffffffffffffff'] }))
      const réception = await recevoir()
      expect(réception.sorte).toBe('refusé')
      if (réception.sorte !== 'refusé') throw new Error(réception.sorte)
      expect(réception.portes.portail.map((p) => p.code)).toEqual(['organisation-différente'])
      expect((await db.select().from(veilles).where(eq(veilles.id, ecoId)))[0]?.numéroCourant).toBe(12)
    })

    it('refuse une famille ou un numéro différents de ceux du travail, et une page introuvable', async () => {
      notion.lireÉditionDeTravail.mockResolvedValue(édition({ famille: 'Concurrentiel', numéro: 14 }))
      const r1 = await recevoir()
      if (r1.sorte !== 'refusé') throw new Error(r1.sorte)
      expect(r1.portes.portail.map((p) => p.code)).toEqual(['famille-différente', 'numéro-différent'])

      notion.lireÉditionDeTravail.mockResolvedValue(null)
      const r2 = await recevoir()
      if (r2.sorte !== 'refusé') throw new Error(r2.sorte)
      expect(r2.portes.portail.map((p) => p.code)).toEqual(['page-introuvable'])
      expect(r2.conclusion).toMatchObject({ tentatives: 2 })
    })

    it('refuse une lettre que le lint refuse, et garde le rapport dans le run', async () => {
      notion.lireÉditionDeTravail.mockResolvedValue(édition())
      notion.contrôlerLaLettre.mockReturnValue({
        ...rapportConforme,
        conforme: false,
        ruptures: [{ code: 'aucun-axe', portée: 'portail', message: 'aucun axe' }],
        avertissements: [{ code: 'aucun-dossier', message: 'aucun dossier' }],
      })
      const réception = await recevoir()
      if (réception.sorte !== 'refusé') throw new Error(réception.sorte)
      expect(réception.portes.ruptures[0]?.code).toBe('aucun-axe')
      const [run] = await db.select().from(runs)
      expect(run?.portes).toMatchObject({ ruptures: [{ code: 'aucun-axe' }], avertissements: [{ code: 'aucun-dossier' }] })
    })

    it('refuse de conclure pour une autre session ou un travail inconnu, sans lire Notion', async () => {
      expect(await recevoir('autre')).toEqual({ sorte: 'autre-session' })
      expect(await recevoirUnRésultat({ travailId: '00000000-0000-0000-0000-000000000000', session: 's1', page: PAGE, exécuteur: 'x' }, db)).toEqual({ sorte: 'inconnu' })
      expect(notion.lireÉditionDeTravail).not.toHaveBeenCalled()
    })
  })

  describe('la lettre unique du moteur : prendreCeTravail et recevoirUneÉdition', () => {
    const ORGANISATION_PAYLOAD = 'aaaabbbb-cccc-dddd-eeee-ffff00005555'
    const MARKDOWN = '# L’essentiel\n\n- Un fait daté (source).\n\n## ① Marché — FORT\n\n- Le 20 octobre, un fait (https://exemple.fr).\n'

    const poserLaPremièreLettre = async () => {
      await db.insert(veilles).values({ organisationId: (await db.select({ id: organisations.id }).from(organisations).where(eq(organisations.slug, 'acme')))[0]!.id, type: 'unique', libellé: 'Veille', jourParution: 1, heureParution: '06:00', cadence: 'hebdomadaire', numéroCourant: 0 })
      const posé = await poserUnTravailDeLettre({ slug: 'acme', veille: 'unique', type: 'premiere_lettre', dateDeParution: '2026-10-28' }, db)
      if (posé.sorte !== 'créé') throw new Error(posé.sorte)
      return posé.travailId
    }

    const remise = (travailId: string, surcharge: Record<string, unknown> = {}) => ({
      travailId,
      session: 'run-1',
      organisationPayload: ORGANISATION_PAYLOAD,
      titre: 'Veille Acme n° 1',
      numéro: 1,
      dateÉdition: '2026-10-28',
      markdown: MARKDOWN,
      dossiersBruts: 'CADA (1)',
      acceptéeParLeMoteur: true,
      exécuteur: 'trigger:run-1',
      maintenant,
      ...surcharge,
    })

    it('prend le travail désigné avant son échéance, sans contexte Notion pour une veille unique', async () => {
      const travailId = await poserLaPremièreLettre()
      const pris = await prendreCeTravail({ travailId, session: 'run-1', maintenant }, db)
      expect(pris).toMatchObject({ travail: { id: travailId, type: 'premiere_lettre', état: 'pris', prisPar: 'run-1', contexte: { numéro: 1 } }, notion: null })
      expect(notion.listerÉditionsDeTravail).not.toHaveBeenCalled()
      expect(await prendreCeTravail({ travailId, session: 'run-2', maintenant }, db)).toBeNull()
      expect(await prendreCeTravail({ travailId: 'pas-un-uuid', session: 'run-2', maintenant }, db)).toBeNull()
    })

    it('accepte l’édition de l’organisation et du numéro attendus, conforme en forme unique, et attribue le numéro', async () => {
      const travailId = await poserLaPremièreLettre()
      await prendreCeTravail({ travailId, session: 'run-1', maintenant }, db)
      const réception = await recevoirUneÉdition(remise(travailId), db)
      expect(réception).toMatchObject({ sorte: 'accepté', conclusion: { sorte: 'accepté', numéro: 1 }, portes: { portail: [], ruptures: [] } })
      expect(notion.contrôlerLaLettre).toHaveBeenCalledWith(expect.objectContaining({ titre: 'Veille Acme n° 1', numéro: 1, dossiersBruts: 'CADA (1)', forme: 'unique' }))
      expect(notion.lireBlocsDePage).not.toHaveBeenCalled()
      const [veille] = await db.select().from(veilles).where(eq(veilles.type, 'unique'))
      expect(veille?.numéroCourant).toBe(1)
      const [run] = await db.select().from(runs)
      expect(run).toMatchObject({ accepté: true, pageNotion: null, exécuteur: 'trigger:run-1' })
      expect(run?.résultat).toMatchObject({ sorte: 'edition', acceptéeParLeMoteur: true })
    })

    it('refuse une édition d’une autre organisation ou d’un autre numéro, et remet le travail en file', async () => {
      const travailId = await poserLaPremièreLettre()
      await prendreCeTravail({ travailId, session: 'run-1', maintenant }, db)
      const réception = await recevoirUneÉdition(remise(travailId, { organisationPayload: 'ffffffff-ffff-ffff-ffff-ffffffffffff', numéro: 2 }), db)
      if (réception.sorte !== 'refusé') throw new Error(réception.sorte)
      expect(réception.portes.portail.map((p) => p.code)).toEqual(['organisation-différente', 'numéro-différent'])
      expect((await db.select().from(veilles).where(eq(veilles.type, 'unique')))[0]?.numéroCourant).toBe(0)
      expect(await prendreCeTravail({ travailId, session: 'run-2', maintenant }, db)).not.toBeNull()
    })

    it('ne publie jamais ce que le moteur a refusé, même si les portes du portail passent', async () => {
      const travailId = await poserLaPremièreLettre()
      await prendreCeTravail({ travailId, session: 'run-1', maintenant }, db)
      const réception = await recevoirUneÉdition(remise(travailId, { acceptéeParLeMoteur: false }), db)
      expect(réception.sorte).toBe('refusé')
      if (réception.sorte !== 'refusé') throw new Error(réception.sorte)
      expect(réception.portes.portail).toEqual([])
      const [run] = await db.select().from(runs)
      expect(run).toMatchObject({ accepté: false })
    })

    it('refuse pour une autre session, un travail non pris ou inconnu', async () => {
      const travailId = await poserLaPremièreLettre()
      expect(await recevoirUneÉdition(remise(travailId), db)).toEqual({ sorte: 'pas-pris', état: 'a_faire' })
      await prendreCeTravail({ travailId, session: 'run-1', maintenant }, db)
      expect(await recevoirUneÉdition(remise(travailId, { session: 'autre' }), db)).toEqual({ sorte: 'autre-session' })
      expect(await recevoirUneÉdition(remise('00000000-0000-0000-0000-000000000000'), db)).toEqual({ sorte: 'inconnu' })
      expect(notion.contrôlerLaLettre).not.toHaveBeenCalled()
    })
  })
})
