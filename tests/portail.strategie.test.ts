import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Base } from '@/lib/base/client'
import { ouvrirEnEssai } from '@/lib/base/organisations'
import type { BlocNotion } from '@/lib/domaine/document'
import { baseEnMémoire } from './aide/base-en-memoire'
import { ÉTIQUETTES_OCTOBRE } from './fixtures/etiquettes-octobre'
import { BLOCS_OCTOBRE, DATE_OCTOBRE, PAGE_OCTOBRE } from './fixtures/lettre-octobre'

/**
 * L'orchestration des étiquettes (lot 3) : vraie base en mémoire, vraie porte,
 * Notion simulé par ses deux lectures cachées. Ce que l'on vérifie, c'est
 * l'ordre : le pilote avant Notion, la règle 2 avant la porte, la porte avant
 * l'écriture.
 */
const notion = vi.hoisted(() => ({ lireÉditionDeTravail: vi.fn(), lireBlocsDePage: vi.fn(), listerÉditionsPubliées: vi.fn() }))
vi.mock('@/lib/notion/travail', () => ({ lireÉditionDeTravail: notion.lireÉditionDeTravail }))
vi.mock('@/lib/notion/editions', () => ({ lireBlocsDePage: notion.lireBlocsDePage, listerÉditionsPubliées: notion.listerÉditionsPubliées }))

const { contrôlerLÉtiquetage, lectureStratégiqueDeLEspace, lireLaGrilleDuPilote, lireLesFaits, recevoirLaGrille, recevoirLesÉtiquettes, réglerLePilote, validerLaVersion } =
  await import('@/lib/portail/strategie')
const { construireDocument } = await import('@/lib/domaine/document')
const { organisationPourLesOutils, posterLaGrille, réglerLesOutilsStratégiques } = await import('@/lib/base/strategie')

const REGISTRE = '1f2fe829ce71802a9c3bd1f4e8a7b6c5'
const AUTRE_REGISTRE = '2f2fe829ce71802a9c3bd1f4e8a7b6c5'
const avecTirets = (id: string) => `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`

const édition = (organisationIds: readonly string[] = [avecTirets(REGISTRE)]) => ({
  pageId: avecTirets(PAGE_OCTOBRE),
  titre: 'Veille écosystème n°6',
  statut: 'Envoyé',
  famille: 'Écosystème',
  veille: 'Écosystème',
  dateÉdition: DATE_OCTOBRE,
  numéro: 6,
  périodeCouverte: '14 au 20 octobre 2026',
  fenêtreÉlargie: false,
  dossiersOuvertsBruts: '',
  actionDeLaSemaine: '',
  amendements: '',
  livraison: '',
  organisationIds,
})

describe('recevoirLesÉtiquettes et lireLesFaits', () => {
  let db: Base
  let fermer: () => Promise<void>
  const recevoir = (lot = ÉTIQUETTES_OCTOBRE, slug = 'infralliance') => recevoirLesÉtiquettes({ slug, page: PAGE_OCTOBRE, lot }, db)

  beforeEach(async () => {
    vi.resetAllMocks()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    ;({ db, fermer } = await baseEnMémoire())
    await ouvrirEnEssai({ slug: 'infralliance', nom: 'Infralliance', registreNotion: REGISTRE }, db)
    await ouvrirEnEssai({ slug: 'autre', nom: 'Autre', registreNotion: AUTRE_REGISTRE }, db)
    notion.lireÉditionDeTravail.mockResolvedValue(édition())
    notion.lireBlocsDePage.mockResolvedValue(BLOCS_OCTOBRE)
  })
  afterEach(async () => {
    vi.restoreAllMocks()
    await fermer()
  })

  it('hors du pilote ou pour une organisation inconnue, ne lit pas Notion', async () => {
    expect(await recevoir()).toEqual({ sorte: 'hors-pilote' })
    expect(await recevoir(ÉTIQUETTES_OCTOBRE, 'inconnue')).toEqual({ sorte: 'organisation-inconnue' })
    expect(await lireLesFaits({ slug: 'infralliance', début: '2026-10-01', fin: '2026-10-31' }, db)).toEqual({ sorte: 'hors-pilote' })
    expect(notion.lireÉditionDeTravail).not.toHaveBeenCalled()
    expect(notion.lireBlocsDePage).not.toHaveBeenCalled()
  })

  describe('dans le pilote', () => {
    beforeEach(async () => {
      await réglerLesOutilsStratégiques({ slug: 'infralliance', actif: true }, db)
      await réglerLesOutilsStratégiques({ slug: 'autre', actif: true }, db)
    })

    it('lit l’édition par l’identifiant avec tirets, celui des tags de cache', async () => {
      await recevoir()
      expect(notion.lireÉditionDeTravail).toHaveBeenCalledWith(avecTirets(PAGE_OCTOBRE))
      expect(notion.lireBlocsDePage).toHaveBeenCalledWith(avecTirets(PAGE_OCTOBRE))
    })

    it('règle 2 : refuse l’édition d’un autre client, et une édition à plusieurs organisations, avant de lire son corps', async () => {
      expect(await recevoir(ÉTIQUETTES_OCTOBRE, 'autre')).toEqual({ sorte: 'organisation-différente' })
      notion.lireÉditionDeTravail.mockResolvedValue(édition([]))
      expect(await recevoir()).toEqual({ sorte: 'organisation-différente' })
      notion.lireÉditionDeTravail.mockResolvedValue(édition([avecTirets(REGISTRE), avecTirets(AUTRE_REGISTRE)]))
      expect(await recevoir()).toEqual({ sorte: 'organisations-multiples' })
      notion.lireÉditionDeTravail.mockResolvedValue(null)
      expect(await recevoir()).toEqual({ sorte: 'édition-introuvable' })
      notion.lireÉditionDeTravail.mockResolvedValue({ ...édition(), dateÉdition: null })
      expect(await recevoir()).toEqual({ sorte: 'édition-sans-date' })
      expect(notion.lireBlocsDePage).not.toHaveBeenCalled()
    })

    it('refuse un lot fautif sans rien écrire, puis accepte le lot corrigé', async () => {
      const fautif = ÉTIQUETTES_OCTOBRE.map((é, i) => (i === 0 ? { ...é, porter: 'rivalite' as const } : é)).slice(0, 10)
      const refus = await recevoir(fautif)
      expect(refus.sorte).toBe('refusé')
      if (refus.sorte !== 'refusé') return
      expect(refus.refus.map((r) => r.code).sort()).toEqual(['cadre-ambigu', 'lot-incomplet'])
      expect(refus.message).toContain('[cadre-ambigu] axe 1, fait 1 :')
      expect(refus.faits).toBe(11)
      const vide = await lireLesFaits({ slug: 'infralliance', début: '2026-10-01', fin: '2026-10-31' }, db)
      expect(vide.sorte === 'lu' && vide.faits).toEqual([])

      expect(await recevoir()).toEqual({ sorte: 'accepté', édition: PAGE_OCTOBRE, faits: 11, insérées: 11, archivées: 0 })
    })

    it('un second lot remplace le premier', async () => {
      await recevoir()
      expect(await recevoir()).toMatchObject({ sorte: 'accepté', insérées: 11, archivées: 11 })
      const lu = await lireLesFaits({ slug: 'infralliance', début: DATE_OCTOBRE, fin: DATE_OCTOBRE }, db)
      expect(lu.sorte === 'lu' && lu.faits.length).toBe(11)
    })

    it('une entité hors de la grille est refusée une fois la grille postée', async () => {
      await posterLaGrille(
        {
          organisationId: (await organisationPourLesOutils({ slug: 'infralliance' }, db))!.id,
          référentielNotion: '3d2fe829ce71801eae49fa7fc4a0e76c',
          grille: {
            axesGroupes: [
              { clé: 'couches', libellé: 'Couches couvertes', crans: ['usage', 'cloud', 'trois couches'] },
              { clé: 'production', libellé: 'Production publique', crans: ['aucune', 'occasionnelle', 'régulière'] },
            ],
            familles: [{ numéro: 1, veille: 'ecosysteme', pestel: 'legal', cadence: 'hebdomadaire' }],
            entités: [{ nom: 'CISPE', veille: 'concurrentiel', siren: null }],
            partiesPrenantes: ['DGE', 'ANSSI', 'RTE', 'Cnam', 'Sénat', 'CNIL', 'Arcep', 'Cigref'].map((nom) => ({ nom })),
          },
        },
        db,
      )
      const r = await recevoir()
      expect(r.sorte === 'refusé' && r.refus.map((x) => `${x.code} ${x.cible}`)).toEqual(['entité-hors-grille axe 5, fait 1'])
    })

    it('rend les faits de la fenêtre avec leur phrase-titre relue, une lecture de corps par édition', async () => {
      await recevoir()
      notion.lireBlocsDePage.mockClear()
      const lu = await lireLesFaits({ slug: 'infralliance', début: '2026-10-19', fin: '2026-10-25' }, db)
      expect(lu.sorte).toBe('lu')
      if (lu.sorte !== 'lu') return
      expect(notion.lireBlocsDePage).toHaveBeenCalledTimes(1)
      expect(lu.titresIntrouvables).toBe(0)
      expect(lu.faits).toHaveLength(11)
      const telehouse = lu.faits.find((f) => f.axe === 4 && f.rang === 1)!
      expect(telehouse).toMatchObject({ famille: 'ecosysteme', pestel: 'economique', rupture: true, impact: 'FORT', date: '2026-10-20' })
      expect(telehouse.titre).toMatch(/^Telehouse a annoncé le 20 octobre 2026/)
      const autre = await lireLesFaits({ slug: 'autre', début: '2026-10-01', fin: '2026-10-31' }, db)
      expect(autre.sorte === 'lu' && autre.faits).toEqual([])
    })

    it('une lettre modifiée depuis l’étiquetage rend les étiquettes sans titre, et le compte', async () => {
      await recevoir()
      notion.lireBlocsDePage.mockResolvedValue([] as BlocNotion[])
      const lu = await lireLesFaits({ slug: 'infralliance', début: DATE_OCTOBRE, fin: DATE_OCTOBRE }, db)
      expect(lu.sorte === 'lu' && lu.titresIntrouvables).toBe(11)
      expect(lu.sorte === 'lu' && lu.faits.every((f) => f.titre === null)).toBe(true)
      notion.lireBlocsDePage.mockRejectedValue(new Error('Notion indisponible'))
      const enPanne = await lireLesFaits({ slug: 'infralliance', début: DATE_OCTOBRE, fin: DATE_OCTOBRE }, db)
      expect(enPanne.sorte === 'lu' && enPanne.titresIntrouvables).toBe(11)
    })

    it('le contrôle du soir signale les éditions publiées depuis la première étiquetée, et elles seules', async () => {
      const lettre = (pageId: string, dateÉdition: string) => ({ pageId: avecTirets(pageId), dateÉdition })
      const AVANT = 'aaaabbbbccccddddeeeeffff00000001'
      const APRÈS = 'aaaabbbbccccddddeeeeffff00000002'
      const publiées = [lettre(APRÈS, '2026-10-28'), lettre(PAGE_OCTOBRE, DATE_OCTOBRE), lettre(AVANT, '2026-10-14')]

      // Avant toute étiquette, rien n'est dû.
      expect(await contrôlerLÉtiquetage(new Map([[REGISTRE, publiées]]), db)).toEqual([])

      await recevoir()
      const défauts = await contrôlerLÉtiquetage(new Map([[REGISTRE, publiées]]), db)
      expect(défauts).toHaveLength(1)
      expect(défauts[0]).toMatchObject({ slug: 'infralliance', code: 'étiquettes-manquantes' })
      expect(défauts[0]!.message).toMatch(/^une édition publiée n’a pas d’étiquettes \(du 2026-10-28 au 2026-10-28\)/)
      expect(défauts[0]!.message).toContain('pnpm tache etiquetage --organisation infralliance')

      // Sans la liste de la route, les éditions sont lues par la clé de cloisonnement de l'organisation.
      notion.listerÉditionsPubliées.mockResolvedValue([lettre(PAGE_OCTOBRE, DATE_OCTOBRE)])
      expect(await contrôlerLÉtiquetage(new Map(), db)).toEqual([])
      expect(notion.listerÉditionsPubliées).toHaveBeenCalledWith(REGISTRE)

      // Une organisation sortie du pilote n'est plus contrôlée.
      expect(await réglerLePilote({ slug: 'infralliance', actif: false }, db)).toBe('réglé')
      expect(await contrôlerLÉtiquetage(new Map([[REGISTRE, publiées]]), db)).toEqual([])
    })

    describe('la lecture stratégique de la vue d’ensemble', () => {
      const lettres = () => [{ pageId: avecTirets(PAGE_OCTOBRE), document: construireDocument(BLOCS_OCTOBRE) }]
      beforeEach(() => {
        vi.stubEnv('DATABASE_URL', 'postgres://base-en-memoire')
        vi.stubEnv('SOURCE_ACCES', 'double')
      })
      afterEach(() => vi.unstubAllEnvs())

      it('agrège les étiquettes des lettres lues, ruptures relues par leur empreinte, sans lire Notion', async () => {
        await recevoir()
        notion.lireBlocsDePage.mockClear()
        notion.lireÉditionDeTravail.mockClear()
        const lecture = await lectureStratégiqueDeLEspace({ registre: avecTirets(REGISTRE), lettres: lettres() }, db)
        expect(notion.lireBlocsDePage).not.toHaveBeenCalled()
        expect(notion.lireÉditionDeTravail).not.toHaveBeenCalled()
        expect(lecture?.total).toBe(11)
        expect(lecture?.pestel.map((d) => `${d.libellé} ${d.faits}`)).toEqual([
          'Politique 2',
          'Économique 2',
          'Socioculturel 0',
          'Technologique 1',
          'Écologique 0',
          'Légal 4',
        ])
        expect(lecture?.forces.find((f) => f.clé === 'rivalite')).toMatchObject({ faits: 1, entités: ['CISPE'] })
        expect(lecture?.forces.find((f) => f.clé === 'pouvoir_clients')).toMatchObject({ faits: 1, entités: ['Cigref'] })
        expect(lecture?.mouvements).toEqual([{ libellé: 'pénétration', faits: 1 }])
        expect(lecture?.ruptures).toHaveLength(1)
        expect(lecture?.ruptures[0]).toMatchObject({ date: '2026-10-20' })
        expect(lecture?.ruptures[0]?.titre).toMatch(/^Telehouse a annoncé le 20 octobre 2026/)
      })

      it('ne montre rien hors du pilote, sans faits, en mode notion, sans base, ni pour une autre organisation', async () => {
        expect(await lectureStratégiqueDeLEspace({ registre: REGISTRE, lettres: lettres() }, db)).toBeNull()
        await recevoir()
        expect(await lectureStratégiqueDeLEspace({ registre: AUTRE_REGISTRE, lettres: lettres() }, db)).toBeNull()
        expect(await lectureStratégiqueDeLEspace({ registre: REGISTRE, lettres: [] }, db)).toBeNull()
        vi.stubEnv('SOURCE_ACCES', 'notion')
        expect(await lectureStratégiqueDeLEspace({ registre: REGISTRE, lettres: lettres() }, db)).toBeNull()
        vi.stubEnv('SOURCE_ACCES', 'double')
        vi.stubEnv('DATABASE_URL', '')
        expect(await lectureStratégiqueDeLEspace({ registre: REGISTRE, lettres: lettres() }, db)).toBeNull()
        vi.stubEnv('DATABASE_URL', 'postgres://base-en-memoire')
        await réglerLePilote({ slug: 'infralliance', actif: false }, db)
        expect(await lectureStratégiqueDeLEspace({ registre: REGISTRE, lettres: lettres() }, db)).toBeNull()
      })
    })
  })
})

/**
 * La grille (lot 5) : vraie base en mémoire et vraie porte. Le pilote avant la
 * porte, la porte avant l'écriture, une version par grille réellement nouvelle,
 * et la validation réservée à la dernière version.
 */
describe('recevoirLaGrille, lireLaGrilleDuPilote et validerLaVersion', () => {
  let db: Base
  let fermer: () => Promise<void>
  const RÉFÉRENTIEL = '3d2fe829-ce71-801e-ae49-fa7fc4a0e76c'
  const GRILLE = {
    axesGroupes: [
      { clé: 'couches', libellé: 'Couches couvertes', crans: ['usage seul', 'cloud', 'cloud et datacenter', 'trois couches'] },
      { clé: 'production', libellé: 'Production publique', crans: ['aucune', 'occasionnelle', 'régulière'] },
    ],
    familles: [
      { numéro: 1, veille: 'ecosysteme', pestel: 'legal', cadence: 'hebdomadaire' },
      { numéro: 2, veille: 'ecosysteme', pestel: 'economique', cadence: 'mensuelle' },
      { numéro: 1, veille: 'concurrentiel', porter: 'rivalite', cadence: 'hebdomadaire' },
    ],
    entités: [
      { nom: 'CISPE', veille: 'concurrentiel', siren: null },
      { nom: 'Cigref', veille: 'concurrentiel', siren: '310785985' },
    ],
    partiesPrenantes: ['DGE', 'Commission européenne', 'Assemblée nationale', 'Sénat', 'ANSSI', 'RTE', 'Cnam', 'France-IX'].map((nom) => ({ nom })),
  } as const
  const poster = (grille: Parameters<typeof recevoirLaGrille>[0]['grille'] = GRILLE, slug = 'infralliance') =>
    recevoirLaGrille({ slug, référentiel: RÉFÉRENTIEL, grille }, db)

  beforeEach(async () => {
    vi.resetAllMocks()
    ;({ db, fermer } = await baseEnMémoire())
    await ouvrirEnEssai({ slug: 'infralliance', nom: 'Infralliance', registreNotion: REGISTRE }, db)
  })
  afterEach(async () => {
    await fermer()
  })

  it('hors du pilote ou pour une organisation inconnue, ne contrôle ni n’écrit rien', async () => {
    expect(await poster()).toEqual({ sorte: 'hors-pilote' })
    expect(await poster(GRILLE, 'inconnue')).toEqual({ sorte: 'organisation-inconnue' })
    expect(await lireLaGrilleDuPilote({ slug: 'infralliance' }, db)).toEqual({ sorte: 'hors-pilote' })
    expect(await validerLaVersion({ slug: 'infralliance', version: 1 }, db)).toBe('hors-pilote')
    await réglerLesOutilsStratégiques({ slug: 'infralliance', actif: true }, db)
    expect(await lireLaGrilleDuPilote({ slug: 'infralliance' }, db)).toEqual({ sorte: 'aucune' })
  })

  describe('dans le pilote', () => {
    beforeEach(async () => {
      await réglerLesOutilsStratégiques({ slug: 'infralliance', actif: true }, db)
    })

    it('refuse une grille hors contrat sans rien écrire, avec le message de reprise', async () => {
      const r = await poster({ ...GRILLE, axesGroupes: [{ ...GRILLE.axesGroupes[0], crans: ['seul', 'deux'] }, GRILLE.axesGroupes[1]] })
      expect(r.sorte).toBe('refusée')
      if (r.sorte !== 'refusée') return
      expect(r.refus.map((x) => x.code)).toEqual(['crans-hors-bornes'])
      expect(r.message).toContain('[crans-hors-bornes]')
      expect(await lireLaGrilleDuPilote({ slug: 'infralliance' }, db)).toEqual({ sorte: 'aucune' })
    })

    it('crée la version 1, ne crée rien pour la même grille re-postée, puis la version 2 quand elle change', async () => {
      const première = await poster()
      expect(première).toMatchObject({ sorte: 'créée', version: 1, trousDuPestel: ['politique', 'socioculturel', 'technologique', 'ecologique'] })
      if (première.sorte !== 'créée') return
      expect(première.forcesNonSuivies).toEqual(['nouveaux_entrants', 'substituts', 'pouvoir_clients', 'pouvoir_fournisseurs'])
      expect(première.empreinte).toMatch(/^[0-9a-f]{8}$/)

      const réordonnée = { ...GRILLE, familles: [...GRILLE.familles].reverse(), entités: [...GRILLE.entités].reverse() }
      expect(await poster(réordonnée)).toMatchObject({ sorte: 'inchangée', version: 1, empreinte: première.empreinte })

      const élargie = { ...GRILLE, entités: [...GRILLE.entités, { nom: 'Hexatrust', veille: 'concurrentiel' as const, siren: '810490052' }] }
      expect(await poster(élargie)).toMatchObject({ sorte: 'créée', version: 2 })

      const lue = await lireLaGrilleDuPilote({ slug: 'infralliance' }, db)
      expect(lue).toMatchObject({ sorte: 'lue', version: 2, référentielNotion: '3d2fe829ce71801eae49fa7fc4a0e76c', validéeLe: null })
      if (lue.sorte !== 'lue') return
      expect(lue.grille.entités.map((e) => e.nom)).toEqual(['CISPE', 'Cigref', 'Hexatrust'])
      expect(lue.trousDuPestel).toEqual(première.trousDuPestel)
    })

    it('ne valide que la dernière version, une fois', async () => {
      expect(await validerLaVersion({ slug: 'infralliance', version: 1 }, db)).toBe('aucune')
      await poster()
      await poster({ ...GRILLE, partiesPrenantes: [...GRILLE.partiesPrenantes, { nom: 'Arcep' }] })
      expect(await validerLaVersion({ slug: 'infralliance', version: 1 }, db)).toBe('version-dépassée')
      expect(await validerLaVersion({ slug: 'infralliance', version: 2 }, db)).toBe('validée')
      expect(await validerLaVersion({ slug: 'infralliance', version: 2 }, db)).toBe('déjà-validée')
      const lue = await lireLaGrilleDuPilote({ slug: 'infralliance' }, db)
      expect(lue.sorte === 'lue' && lue.validéeLe).toBeInstanceOf(Date)
    })
  })
})
