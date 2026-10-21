import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import type { Base } from '@/lib/base/client'
import { organisations, runs, veilles } from '@/lib/base/schema'
import { planifierLesLettres, prendreLeProchainTravail } from '@/lib/base/travaux'
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

const { prendreUnTravail, recevoirUnRésultat } = await import('@/lib/portail/file')

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
})
