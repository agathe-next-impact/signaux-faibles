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

const {
  concurrentsDeLEspace,
  faitsRécentsDeLEspace,
  indicateursDeLEspace,
  contrôlerLÉtiquetage,
  espaceDeLOrganisation,
  ficheDuConcurrent,
  lectureStratégiqueDeLEspace,
  lireLaGrilleDuPilote,
  lireLaSynthèseDuPilote,
  lireLesCalculs,
  lireLesFaits,
  pestelDeLEspace,
  publierLaSynthèseDuPilote,
  tableauDesSynthèses,
  synthèseDeLEspace,
  synthèseÀRelire,
  modifierLÉnoncéDuPilote,
  recevoirLaGrille,
  recevoirLaSynthèse,
  recevoirLesÉtiquettes,
  réglerLEspace,
  réglerLePilote,
  validerLaVersion,
} = await import('@/lib/portail/strategie')
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

/**
 * La synthèse (lot 6) : vraie base en mémoire, vraie porte, étiquettes de la
 * lettre d'octobre d'Infralliance. Le pilote et la grille avant la porte, la
 * porte avant l'écriture ; la filiation et le mouvement d'un cran se lisent
 * dans la synthèse précédente de même granularité.
 */
describe('recevoirLaSynthèse et lireLaSynthèseDuPilote', () => {
  let db: Base
  let fermer: () => Promise<void>
  let faits: { id: string; pestel: string | null; porter: string | null; entite: string | null }[]
  const GRILLE = {
    axesGroupes: [
      { clé: 'couches', libellé: 'Couches couvertes', crans: ['usage seul', 'cloud', 'cloud et datacenter', 'trois couches'] },
      { clé: 'production', libellé: 'Production publique', crans: ['aucune', 'occasionnelle', 'régulière'] },
    ],
    familles: [
      { numéro: 1, veille: 'ecosysteme', pestel: 'legal', cadence: 'hebdomadaire' },
      { numéro: 2, veille: 'ecosysteme', pestel: 'politique', cadence: 'hebdomadaire' },
      { numéro: 3, veille: 'ecosysteme', pestel: 'economique', cadence: 'hebdomadaire' },
      { numéro: 4, veille: 'ecosysteme', pestel: 'technologique', cadence: 'mensuelle' },
      { numéro: 1, veille: 'concurrentiel', porter: 'rivalite', cadence: 'hebdomadaire' },
      { numéro: 2, veille: 'concurrentiel', porter: 'pouvoir_clients', cadence: 'hebdomadaire' },
    ],
    entités: [
      { nom: 'CISPE', veille: 'concurrentiel', siren: null },
      { nom: 'Cigref', veille: 'concurrentiel', siren: '310785985' },
    ],
    partiesPrenantes: ['DGE', 'Commission européenne', 'Assemblée nationale', 'Sénat', 'ANSSI', 'RTE', 'Cnam', 'France-IX'].map((nom) => ({ nom })),
  } as const
  const fait = (critère: (f: (typeof faits)[number]) => boolean) => faits.find(critère)!.id
  const FENÊTRE = { début: '2026-10-01', fin: '2026-10-21' }

  /** Une synthèse d'octobre acceptable : trous dits, cases déclarées insuffisantes, une seule candidate. */
  const octobre = (): Parameters<typeof recevoirLaSynthèse>[0]['synthèse'] => ({
    mode: 'mensuel',
    grilleVersion: 1,
    pestel: [
      { lettre: 'legal', énoncé: 'Trois textes européens avancent au Conseil en octobre 2026.', faits: [fait((f) => f.pestel === 'legal')] },
      { lettre: 'politique', énoncé: 'La DGE et le Parlement européen bougent le 19 octobre 2026.', faits: [fait((f) => f.pestel === 'politique')] },
      { lettre: 'economique', énoncé: 'Un module de 3 MW est annoncé le 20 octobre 2026.', faits: [fait((f) => f.pestel === 'economique')] },
      { lettre: 'technologique', énoncé: null, faits: [] },
      { lettre: 'socioculturel', énoncé: null, faits: [] },
      { lettre: 'ecologique', énoncé: null, faits: [] },
    ],
    swot: [
      { id: 'S1', case: 'forces', énoncé: 'La fédération réunit trois couches du numérique.', état: 'nouveau', origine: 'declaratif', hypothèse: true, faits: [], référenceFiche: 'fiche v2.2, §3' },
      { id: 'O1', case: 'opportunites', énoncé: 'Le CISPE ouvre un front sur 2 000 Md€ le 20 octobre 2026.', état: 'nouveau', origine: 'faits', hypothèse: false, faits: [fait((f) => f.entite === 'CISPE')] },
      { id: 'T1', case: 'menaces', énoncé: 'Le Cigref parle de dépendances le 15 octobre 2026.', état: 'nouveau', origine: 'faits', hypothèse: false, faits: [fait((f) => f.entite === 'Cigref')] },
    ],
    casesInsuffisantes: ['forces', 'faiblesses', 'opportunites', 'menaces'],
    tows: [
      { type: 'ST', énoncé: 'Répondre au Cigref par une parole commune des 3 couches.', éléments: ['S1', 'T1'], candidate: true },
      { type: 'SO', énoncé: 'Porter les 3 couches dans le débat ouvert par le CISPE.', éléments: ['S1', 'O1'], candidate: false },
    ],
    positions: [
      { outil: 'groupes', sujet: 'CISPE', axe: 'couches', cran: 3, faits: [fait((f) => f.entite === 'CISPE')] },
      { outil: 'mendelow', sujet: 'DGE', axe: 'pouvoir', cran: 3, faits: [fait((f) => f.pestel === 'politique')] },
      { outil: 'mendelow', sujet: 'DGE', axe: 'interet', cran: 2, faits: [fait((f) => f.pestel === 'politique')] },
    ],
  })
  const recevoir = (synthèse = octobre(), période = '2026-10', fenêtre = FENÊTRE, slug = 'infralliance') =>
    recevoirLaSynthèse({ slug, période, fenêtre, synthèse }, db)

  beforeEach(async () => {
    vi.resetAllMocks()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    ;({ db, fermer } = await baseEnMémoire())
    await ouvrirEnEssai({ slug: 'infralliance', nom: 'Infralliance', registreNotion: REGISTRE }, db)
    notion.lireÉditionDeTravail.mockResolvedValue(édition())
    notion.lireBlocsDePage.mockResolvedValue(BLOCS_OCTOBRE)
  })
  afterEach(async () => {
    vi.restoreAllMocks()
    await fermer()
  })

  it('hors du pilote, organisation inconnue ou sans grille : rien n’est contrôlé ni écrit', async () => {
    faits = []
    expect(await recevoirLaSynthèse({ slug: 'infralliance', période: '2026-10', fenêtre: FENÊTRE, synthèse: { mode: 'mensuel', grilleVersion: 1, pestel: [], swot: [], tows: [], positions: [] } }, db)).toEqual({ sorte: 'hors-pilote' })
    expect(await lireLaSynthèseDuPilote({ slug: 'infralliance', période: '2026-10' }, db)).toEqual({ sorte: 'hors-pilote' })
    expect(await lireLaSynthèseDuPilote({ slug: 'inconnue', période: '2026-10' }, db)).toEqual({ sorte: 'organisation-inconnue' })
    await réglerLesOutilsStratégiques({ slug: 'infralliance', actif: true }, db)
    expect(await recevoirLaSynthèse({ slug: 'infralliance', période: '2026-10', fenêtre: FENÊTRE, synthèse: { mode: 'mensuel', grilleVersion: 1, pestel: [], swot: [], tows: [], positions: [] } }, db)).toEqual({ sorte: 'grille-absente' })
    expect(await lireLaSynthèseDuPilote({ slug: 'infralliance', période: '2026-10' }, db)).toEqual({ sorte: 'aucune' })
  })

  describe('dans le pilote, avec une grille et des faits étiquetés', () => {
    beforeEach(async () => {
      await réglerLesOutilsStratégiques({ slug: 'infralliance', actif: true }, db)
      expect(await recevoirLesÉtiquettes({ slug: 'infralliance', page: PAGE_OCTOBRE, lot: ÉTIQUETTES_OCTOBRE }, db)).toMatchObject({ sorte: 'accepté' })
      expect(await recevoirLaGrille({ slug: 'infralliance', référentiel: '3d2fe829ce71801eae49fa7fc4a0e76c', grille: GRILLE }, db)).toMatchObject({ sorte: 'créée' })
      const lus = await lireLesFaits({ slug: 'infralliance', début: '2026-10-01', fin: '2026-10-31' }, db)
      faits = lus.sorte === 'lu' ? lus.faits.map((f) => ({ id: f.id, pestel: f.pestel, porter: f.porter, entite: f.entite })) : []
      expect(faits).toHaveLength(11)
    })

    it('refuse une synthèse fautive sans rien écrire, avec le message de reprise', async () => {
      const fautive = { ...octobre(), tows: octobre().tows.map((o) => ({ ...o, candidate: true })) }
      const r = await recevoir(fautive)
      expect(r.sorte).toBe('refusée')
      if (r.sorte !== 'refusée') return
      expect(r.refus.map((x) => x.code)).toEqual(['candidate-unique'])
      expect(r.message).toContain('[candidate-unique]')
      expect(await lireLaSynthèseDuPilote({ slug: 'infralliance', période: '2026-10' }, db)).toEqual({ sorte: 'aucune' })
      expect(await recevoir({ ...octobre(), grilleVersion: 2 })).toMatchObject({ sorte: 'refusée', refus: [{ code: 'grille-périmée' }] })
    })

    it('enregistre la synthèse et la rend en texte pour la relecture', async () => {
      const r = await recevoir()
      expect(r).toMatchObject({ sorte: 'enregistrée', éléments: 11, positions: 3, archivés: 0 })
      const lue = await lireLaSynthèseDuPilote({ slug: 'infralliance', période: '2026-10' }, db)
      expect(lue).toMatchObject({ sorte: 'lue', période: '2026-10', fenêtre: FENÊTRE, grilleVersion: 1, éléments: 11, positions: 3 })
      if (lue.sorte !== 'lue') return
      expect(lue.texte).toContain('Synthèse stratégique, infralliance, période 2026-10')
      expect(lue.texte).toContain('- Socioculturel : trou, aucune famille ne couvre cette dimension')
      expect(lue.texte).toContain('- Technologique : aucun fait dans la fenêtre')
      expect(lue.texte).toContain('- Légal : Trois textes européens avancent au Conseil en octobre 2026. [1 fait : 2026-10-')
      expect(lue.texte).toContain('- Forces 1, nouveau : La fédération réunit trois couches du numérique. (déclaratif, hypothèse à valider, fiche v2.2, §3)')
      expect(lue.texte).toContain('- ST, candidate à la recommandation : Répondre au Cigref par une parole commune des 3 couches. (croise Forces 1, Menaces 1)')
      expect(lue.texte).toContain('- CISPE : Couches couvertes : cloud et datacenter [1 fait : 2026-10-20, CISPE]')
      expect(lue.texte).toContain('- DGE : pouvoir élevé, intérêt intermédiaire')
      // Une seconde synthèse de la même période remplace la première.
      expect(await recevoir()).toMatchObject({ sorte: 'enregistrée', archivés: 14 })
    })

    it('le mois suivant : filiation exigée, mouvement de cran justifié par un fait qui nomme l’entité', async () => {
      await recevoir()
      // La revue lit l'identifiant à prolonger dans la lecture du mois précédent, comme `GET /api/veille/syntheses`.
      const précédente = await lireLaSynthèseDuPilote({ slug: 'infralliance', période: '2026-10' }, db)
      if (précédente.sorte !== 'lue') throw new Error(précédente.sorte)
      const t1 = précédente.swot.find((é) => é.case === 'menaces')!
      expect(t1).toMatchObject({ rang: 1, état: 'nouveau' })
      expect(précédente.crans).toContainEqual({ outil: 'groupes', sujet: 'CISPE', axe: 'couches', cran: 3 })
      const novembre = octobre()
      const swot = novembre.swot.map((é) => (é.id === 'T1' ? { ...é, état: 'renforce' as const } : é))
      const sansFiliation = await recevoir({ ...novembre, swot }, '2026-11', { début: '2026-10-14', fin: '2026-10-31' })
      expect(sansFiliation.sorte === 'refusée' && sansFiliation.refus.map((x) => x.code)).toEqual(['filiation-inconnue'])

      const avecFiliation = swot.map((é) => (é.id === 'T1' ? { ...é, filiation: t1.id } : é))
      const déplacé = (preuve: string) =>
        novembre.positions.map((p) => (p.outil === 'groupes' ? { ...p, cran: 2, faits: [preuve] } : p))
      const sansPreuve = await recevoir({ ...novembre, swot: avecFiliation, positions: déplacé(fait((f) => f.entite === 'Cigref')) }, '2026-11', { début: '2026-10-14', fin: '2026-10-31' })
      expect(sansPreuve.sorte === 'refusée' && sansPreuve.refus.map((x) => x.code)).toEqual(['mouvement-sans-fait'])

      const accepté = await recevoir({ ...novembre, swot: avecFiliation, positions: déplacé(fait((f) => f.entite === 'CISPE')) }, '2026-11', { début: '2026-10-14', fin: '2026-10-31' })
      expect(accepté).toMatchObject({ sorte: 'enregistrée', éléments: 11, positions: 3 })
    })

    /** Le trimestre : cinq forces (trois non suivies), trois scénarios, l'interprétation des deux calculs. */
    const trimestre = (): Parameters<typeof recevoirLaSynthèse>[0]['synthèse'] => {
      const base = octobre()
      const indicateurs = [
        { famille: 1, signal: 'Vote du Conseil sur le règlement cloud et IA' },
        { famille: 2, signal: 'Nomination à la DGE' },
      ]
      return {
        ...base,
        mode: 'trimestriel',
        positions: [
          ...base.positions,
          { outil: 'forces', sujet: 'rivalite', axe: 'intensite', cran: 3, tendance: 'hausse', faits: [fait((f) => f.entite === 'CISPE')] },
          { outil: 'forces', sujet: 'pouvoir_clients', axe: 'intensite', cran: 2, tendance: 'stable', faits: [fait((f) => f.entite === 'Cigref')] },
          { outil: 'forces', sujet: 'nouveaux_entrants', axe: 'intensite', cran: null, nonSuivi: true, faits: [] },
          { outil: 'forces', sujet: 'substituts', axe: 'intensite', cran: null, nonSuivi: true, faits: [] },
          { outil: 'forces', sujet: 'pouvoir_fournisseurs', axe: 'intensite', cran: null, nonSuivi: true, faits: [] },
        ],
        scénarios: [1, 2, 3].map((n) => ({
          titre: `Scénario ${n}`,
          énoncé: `Au trimestre ${n}, le texte européen d’octobre 2026 change la donne pour la fédération.`,
          indicateurs,
          faits: [fait((f) => f.pestel === 'legal')],
        })),
        interprétations: [
          { outil: 'indice_cycle', énoncé: 'Un marché qui attire en 2026 : plus d’entrées que de sorties.' },
          { outil: 'benchmark', énoncé: 'Le Cigref publie ses comptes ; le reste du corpus n’en publie pas.' },
        ],
      }
    }
    const json = (corps: unknown) => new Response(JSON.stringify(corps), { status: 200, headers: { 'content-type': 'application/json' } })
    const registres = () =>
      vi.fn(async (url: string) => {
        const u = new URL(url)
        if (u.hostname.startsWith('bodacc')) return json({ total_count: (u.searchParams.get('where') ?? '').includes('collective') ? 3 : 12 })
        return json({ results: [{ siren: u.searchParams.get('q'), nom_complet: 'CIGREF', etat_administratif: 'A', finances: { '2025': { ca: 5_000_000, resultat_net: 100_000 } } }] })
      })

    it('le trimestre : les chiffres calculés après la porte, gardés à côté de l’interprétation', async () => {
      const f = registres()
      const r = await recevoirLaSynthèse(
        { slug: 'infralliance', période: '2026-T4', fenêtre: FENÊTRE, synthèse: trimestre(), cycle: { départements: ['75', '92'], texte: 'centre de données' } },
        db,
        { f: f as unknown as typeof fetch, attente: async () => {} },
      )
      expect(r).toMatchObject({ sorte: 'enregistrée', éléments: 16, positions: 8 })
      expect(f).toHaveBeenCalledTimes(5)
      const lue = await lireLaSynthèseDuPilote({ slug: 'infralliance', période: '2026-T4' }, db)
      if (lue.sorte !== 'lue') throw new Error(lue.sorte)
      expect(lue.texte).toContain('12 entrées (créations et immatriculations), 3 procédures collectives, solde 9, 4 entrées pour une sortie')
      expect(lue.texte).toContain('- Cigref : active, CA 5')
      expect(lue.texte).toContain('- Interprétation : Un marché qui attire en 2026')
      expect(lue.texte).toContain('- Rivalité entre acteurs : intense, tendance hausse')
      expect(lue.texte).toContain('- Substituts : non suivi')
    })

    it('graphiques de l’espace réorganisé : faits récents et indicateurs du trimestre publié, rien ailleurs', async () => {
      vi.stubEnv('DATABASE_URL', 'postgres://base-en-memoire')
      vi.stubEnv('SOURCE_ACCES', 'double')
      try {
        const f = registres()
        await recevoirLaSynthèse(
          { slug: 'infralliance', période: '2026-T4', fenêtre: FENÊTRE, synthèse: trimestre(), cycle: { départements: ['75', '92'], texte: 'centre de données' } },
          db,
          { f: f as unknown as typeof fetch, attente: async () => {} },
        )
        // Hors de l'espace réorganisé : rien, même dans le pilote.
        expect(await faitsRécentsDeLEspace({ registre: REGISTRE, fin: DATE_OCTOBRE }, db)).toBeNull()
        expect(await indicateursDeLEspace({ registre: REGISTRE }, db)).toBeNull()
        expect(await réglerLEspace({ slug: 'infralliance', actif: true }, db)).toBe('réglé')

        const récents = await faitsRécentsDeLEspace({ registre: avecTirets(REGISTRE), fin: DATE_OCTOBRE }, db)
        expect(récents?.activité).toHaveLength(13)
        expect(récents?.activité.reduce((n, s) => n + s.faits, 0)).toBe(11)
        expect(récents?.activité.at(-1)?.faits).toBe(11)
        expect(récents?.chaleur?.semaines).toHaveLength(8)
        // Les six dimensions, zéro compris, comptées comme l'écran « PESTEL » les compte.
        expect(récents?.pestel).toHaveLength(6)
        expect(récents?.pestel.reduce((n, d) => n + d.faits, 0)).toBe(faits.filter((x) => x.pestel).length)
        expect(récents?.chaleur?.lignes.some((l) => l.cases.at(-1)?.niveau === 'FORT')).toBe(true)

        // Le trimestre n'est lu qu'une fois publié.
        expect(await indicateursDeLEspace({ registre: REGISTRE }, db)).toBeNull()
        await publierLaSynthèseDuPilote({ slug: 'infralliance', période: '2026-T4', état: 'publie' }, db)
        const vue = await indicateursDeLEspace({ registre: REGISTRE }, db)
        expect(vue?.période).toBe('2026-T4')
        expect(vue?.indice).toMatchObject({ valeurs: { entrées: 12, sorties: 3, solde: 9 }, interprétation: 'Un marché qui attire en 2026 : plus d’entrées que de sorties.' })
        expect(vue?.benchmark?.valeurs.lignes.some((l) => l.chiffreDAffaires === 5_000_000)).toBe(true)
        const synthèse = await synthèseDeLEspace({ registre: REGISTRE, numéros: new Map() }, db)
        expect(synthèse?.trimestre?.indicateurs?.indice?.valeurs.entrées).toBe(12)

        expect(await faitsRécentsDeLEspace({ registre: AUTRE_REGISTRE, fin: DATE_OCTOBRE }, db)).toBeNull()
        expect(await indicateursDeLEspace({ registre: AUTRE_REGISTRE }, db)).toBeNull()
        vi.stubEnv('SOURCE_ACCES', 'notion')
        expect(await indicateursDeLEspace({ registre: REGISTRE }, db)).toBeNull()
      } finally {
        vi.unstubAllEnvs()
      }
    })

    it('une synthèse refusée ne coûte aucun appel aux registres ; l’indice ne se calcule qu’au trimestre', async () => {
      const f = registres()
      const dépendances = { f: f as unknown as typeof fetch, attente: async () => {} }
      const refusée = await recevoirLaSynthèse(
        { slug: 'infralliance', période: '2026-T4', fenêtre: FENÊTRE, synthèse: trimestre(), cycle: { départements: ['Paris'], texte: 'centre de données' } },
        db,
        dépendances,
      )
      expect(refusée.sorte === 'refusée' && refusée.refus.map((x) => x.code)).toEqual(['département-invalide'])
      const mensuelle = await recevoirLaSynthèse({ slug: 'infralliance', période: '2026-10', fenêtre: FENÊTRE, synthèse: octobre(), cycle: { départements: ['75'], texte: 'centre de données' } }, db, dépendances)
      expect(mensuelle.sorte === 'refusée' && mensuelle.refus.map((x) => x.code)).toEqual(['hors-période'])
      expect(f).not.toHaveBeenCalled()
    })

    it('écrans du client : rien avant la publication, la synthèse publiée seule, rien d’un autre registre', async () => {
      vi.stubEnv('DATABASE_URL', 'postgres://base-en-memoire')
      vi.stubEnv('SOURCE_ACCES', 'double')
      try {
        expect(await publierLaSynthèseDuPilote({ slug: 'infralliance', période: '2026-10', état: 'publie' }, db)).toEqual({ sorte: 'aucune' })
        await recevoir()
        expect(await synthèseDeLEspace({ registre: REGISTRE, numéros: new Map() }, db)).toBeNull()
        expect(await tableauDesSynthèses(db)).toEqual([
          { slug: 'infralliance', nom: 'Infralliance', périodes: [{ période: '2026-10', libellé: 'd’octobre 2026', granularité: 'mois', lignes: 14, état: 'proposée' }] },
        ])
        expect(await publierLaSynthèseDuPilote({ slug: 'infralliance', période: '2026-10', état: 'publie' }, db)).toEqual({ sorte: 'publiée', éléments: 11, positions: 3 })
        expect((await tableauDesSynthèses(db))[0]?.périodes[0]?.état).toBe('publiée')
        const vue = await synthèseDeLEspace({ registre: avecTirets(REGISTRE), numéros: new Map([[PAGE_OCTOBRE, 6]]) }, db)
        expect(vue?.trimestre).toBeNull()
        expect(vue?.mois?.période).toBe('2026-10')
        expect(vue?.mois?.tows.candidate).toMatchObject({ libellé: 'Forces × menaces', croise: ['F1', 'M1'] })
        expect(vue?.mois?.swot.forces).toEqual([{ code: 'F1', énoncé: 'La fédération réunit trois couches du numérique.', source: 'Déclaratif · votre fiche', édition: null }])
        expect(vue?.mois?.swot.menaces[0]?.édition).toMatch(/^[0-9a-f]{32}$/)
        expect(vue?.mois?.swot.menaces[0]?.source).toMatch(/^Fait du \d{2}\/10 · lettre n° 6$/)
        // CISPE n'est placé que sur un axe : il n'entre pas sur la carte. DGE l'est sur les deux de Mendelow.
        expect(vue?.mois?.carte?.placés).toBe(0)
        expect(vue?.mois?.mendelow.cases.get('3:2')).toEqual([{ sujet: 'DGE', aBougé: false, fait: expect.objectContaining({ date: expect.stringMatching(/^2026-10-/) }) }])
        expect(await synthèseDeLEspace({ registre: AUTRE_REGISTRE, numéros: new Map() }, db)).toBeNull()
        vi.stubEnv('SOURCE_ACCES', 'notion')
        expect(await synthèseDeLEspace({ registre: REGISTRE, numéros: new Map() }, db)).toBeNull()
        vi.stubEnv('SOURCE_ACCES', 'double')
        // Une synthèse remplacée après publication repart en proposition : elle n'est plus lue.
        await recevoir()
        expect(await synthèseDeLEspace({ registre: REGISTRE, numéros: new Map() }, db)).toBeNull()
        await publierLaSynthèseDuPilote({ slug: 'infralliance', période: '2026-10', état: 'publie' }, db)
        expect(await publierLaSynthèseDuPilote({ slug: 'infralliance', période: '2026-10', état: 'retire' }, db)).toMatchObject({ sorte: 'retirée' })
        expect(await synthèseDeLEspace({ registre: REGISTRE, numéros: new Map() }, db)).toBeNull()
      } finally {
        vi.unstubAllEnvs()
      }
    })

    it('positions déclaratives : gardées avec leur référence, dites à la relecture, comptées sur la carte publiée', async () => {
      vi.stubEnv('DATABASE_URL', 'postgres://base-en-memoire')
      vi.stubEnv('SOURCE_ACCES', 'double')
      try {
        const déclarée = (sujet: string, axe: string, cran: number) => ({ outil: 'groupes' as const, sujet, axe, cran, faits: [], origine: 'declaratif' as const, référence: '§2, famille 1' })
        const synthèse = { ...octobre(), positions: [...octobre().positions, déclarée('Cigref', 'couches', 1), déclarée('Cigref', 'production', 3)] }
        expect(await recevoir(synthèse)).toMatchObject({ sorte: 'enregistrée', positions: 5 })
        const lue = await lireLaSynthèseDuPilote({ slug: 'infralliance', période: '2026-10' }, db)
        if (lue.sorte !== 'lue') throw new Error(lue.sorte)
        expect(lue.texte).toContain('- Cigref : Couches couvertes : usage seul ; Production publique : régulière (déclaratif, §2, famille 1)')
        await publierLaSynthèseDuPilote({ slug: 'infralliance', période: '2026-10', état: 'publie' }, db)
        const vue = await synthèseDeLEspace({ registre: REGISTRE, numéros: new Map() }, db)
        expect(vue?.mois?.carte).toMatchObject({ placés: 1, déclaratifs: 1 })
        expect(vue?.mois?.carte?.cases.get('3:1')).toEqual([{ sujet: 'Cigref', organisation: false, aBougé: false, venuDe: null, fait: null }])
        expect(vue?.mois?.mendelow).toMatchObject({ placés: 1, déclaratifs: 0 })
      } finally {
        vi.unstubAllEnvs()
      }
    })

    it('espace réorganisé : réglé dans le pilote seulement, puis Concurrents et la fiche, rien d’un autre registre', async () => {
      vi.stubEnv('DATABASE_URL', 'postgres://base-en-memoire')
      vi.stubEnv('SOURCE_ACCES', 'double')
      try {
        expect(await espaceDeLOrganisation(REGISTRE, db)).toEqual({ réorganisé: false, concurrents: [] })
        expect(await concurrentsDeLEspace({ registre: REGISTRE }, db)).toBeNull()
        await réglerLesOutilsStratégiques({ slug: 'infralliance', actif: false }, db)
        expect(await réglerLEspace({ slug: 'infralliance', actif: true }, db)).toBe('hors-pilote')
        await réglerLesOutilsStratégiques({ slug: 'infralliance', actif: true }, db)
        expect(await réglerLEspace({ slug: 'inconnue', actif: true }, db)).toBe('organisation-inconnue')
        expect(await réglerLEspace({ slug: 'infralliance', actif: true }, db)).toBe('réglé')
        expect(await espaceDeLOrganisation(avecTirets(REGISTRE), db)).toEqual({ réorganisé: true, concurrents: ['CISPE', 'Cigref'] })

        // Avant toute synthèse publiée : la liste, sans carte ni position.
        const avant = await concurrentsDeLEspace({ registre: REGISTRE }, db)
        expect(avant).toMatchObject({ période: null, carte: null })
        expect(avant?.vue.concurrents.map((c) => [c.nom, c.crans.length])).toEqual([['Cigref', 0], ['CISPE', 0]])

        const cispe = fait((f) => f.entite === 'CISPE')
        const déclarée = (axe: string, cran: number) => ({ outil: 'groupes' as const, sujet: 'Cigref', axe, cran, faits: [], origine: 'declaratif' as const, référence: '§2, famille 1' })
        await recevoir({
          ...octobre(),
          positions: [...octobre().positions, { outil: 'groupes', sujet: 'CISPE', axe: 'production', cran: 2, faits: [cispe] }, déclarée('couches', 2), déclarée('production', 1)],
        })
        await publierLaSynthèseDuPilote({ slug: 'infralliance', période: '2026-10', état: 'publie' }, db)

        const lus = await concurrentsDeLEspace({ registre: avecTirets(REGISTRE) }, db)
        expect(lus?.période).toBe('2026-10')
        expect(lus?.carte?.placés).toBe(2)
        const parNom = new Map(lus?.vue.concurrents.map((c) => [c.nom, c]))
        expect(parNom.get('CISPE')).toMatchObject({ segment: 'cispe', déclaratif: false, faits: 1 })
        expect(parNom.get('Cigref')).toMatchObject({ segment: 'cigref', déclaratif: true })

        const fiche = await ficheDuConcurrent({ registre: REGISTRE, segment: 'cispe' }, db)
        expect(fiche?.sorte).toBe('fiche')
        if (fiche?.sorte !== 'fiche') return
        expect(fiche.fiche.position).toMatchObject({ période: '2026-10', déclaratif: false })
        expect(fiche.fiche.faits).toHaveLength(1)
        expect(fiche.fiche.faits[0]?.empreinte).toMatch(/^[0-9a-f]{8}$/)
        expect(await ficheDuConcurrent({ registre: REGISTRE, segment: 'dge' }, db)).toEqual({ sorte: 'inconnu' })

        // Rien pour un autre registre ; rien en mode notion ; rien une fois l'espace refermé.
        expect(await concurrentsDeLEspace({ registre: AUTRE_REGISTRE }, db)).toBeNull()
        expect(await ficheDuConcurrent({ registre: AUTRE_REGISTRE, segment: 'cispe' }, db)).toBeNull()
        vi.stubEnv('SOURCE_ACCES', 'notion')
        expect(await espaceDeLOrganisation(REGISTRE, db)).toBeNull()
        vi.stubEnv('SOURCE_ACCES', 'double')
        expect(await réglerLEspace({ slug: 'infralliance', actif: false }, db)).toBe('réglé')
        expect(await concurrentsDeLEspace({ registre: REGISTRE }, db)).toBeNull()
      } finally {
        vi.unstubAllEnvs()
      }
    })

    it('relecture : un énoncé se retouche avant publication, jamais après, et passe la porte', async () => {
      await recevoir()
      const lue = await synthèseÀRelire({ slug: 'infralliance', période: '2026-10' }, db)
      expect(lue.sorte).toBe('lue')
      if (lue.sorte !== 'lue') return
      expect(lue.publiée).toBe(false)
      const force = lue.éléments.find((é) => é.outil === 'swot' && é.clé === 'forces')!
      expect(force).toMatchObject({ énoncé: 'La fédération réunit trois couches du numérique.', origine: 'declaratif', titre: null })

      const énoncé = 'La fédération réunit les trois couches du numérique, du câble au logiciel.'
      expect(await modifierLÉnoncéDuPilote({ slug: 'infralliance', période: '2026-10', élément: force.id, énoncé: `  ${énoncé}  ` }, db)).toEqual({ sorte: 'modifié' })
      const relue = await synthèseÀRelire({ slug: 'infralliance', période: '2026-10' }, db)
      const après = relue.sorte === 'lue' ? relue.éléments.find((é) => é.id === force.id) : undefined
      // Le texte change ; les faits cités, la case et l'origine non.
      expect(après).toMatchObject({ énoncé, clé: 'forces', origine: 'declaratif', faits: force.faits })

      // La porte de l'énoncé : bornes et vocabulaire, rien d'écrit.
      const refus = await modifierLÉnoncéDuPilote({ slug: 'infralliance', période: '2026-10', élément: force.id, énoncé: 'Signal FAIBLE au référentiel.' }, db)
      expect(refus.sorte === 'refusé' && refus.refus.map((r) => r.code)).toEqual(['vocabulaire-interdit'])
      expect((await modifierLÉnoncéDuPilote({ slug: 'infralliance', période: '2026-10', élément: force.id, énoncé: 'x'.repeat(241) }, db)).sorte).toBe('refusé')
      expect((await modifierLÉnoncéDuPilote({ slug: 'infralliance', période: '2026-10', élément: force.id, énoncé: 'Un titre ?', titre: 'Titre' }, db)).sorte).toBe('refusé')
      // Un élément d'une autre période, ou inconnu.
      expect(await modifierLÉnoncéDuPilote({ slug: 'infralliance', période: '2026-09', élément: force.id, énoncé }, db)).toEqual({ sorte: 'introuvable' })
      expect(await modifierLÉnoncéDuPilote({ slug: 'infralliance', période: '2026-10', élément: '00000000-0000-4000-8000-000000000000', énoncé }, db)).toEqual({ sorte: 'introuvable' })

      // Publiée : plus de retouche, il faut retirer d'abord.
      await publierLaSynthèseDuPilote({ slug: 'infralliance', période: '2026-10', état: 'publie' }, db)
      expect(await modifierLÉnoncéDuPilote({ slug: 'infralliance', période: '2026-10', élément: force.id, énoncé: 'Autre texte daté du 3 octobre.' }, db)).toEqual({ sorte: 'déjà-publiée' })
      expect((await synthèseÀRelire({ slug: 'infralliance', période: '2026-10' }, db)).sorte === 'lue').toBe(true)
      await publierLaSynthèseDuPilote({ slug: 'infralliance', période: '2026-10', état: 'retire' }, db)
      expect(await modifierLÉnoncéDuPilote({ slug: 'infralliance', période: '2026-10', élément: force.id, énoncé: 'Autre texte daté du 3 octobre.' }, db)).toEqual({ sorte: 'modifié' })
      expect(await synthèseÀRelire({ slug: 'inconnue', période: '2026-10' }, db)).toEqual({ sorte: 'organisation-inconnue' })
    })

    it('l’onglet PESTEL : les comptes de la fenêtre, les phrases-titres des lettres déjà lues', async () => {
      vi.stubEnv('DATABASE_URL', 'postgres://base-en-memoire')
      vi.stubEnv('SOURCE_ACCES', 'double')
      try {
        const vue = await pestelDeLEspace({ registre: REGISTRE, fin: '2026-10-31', lettres: [{ pageId: PAGE_OCTOBRE, document: construireDocument(BLOCS_OCTOBRE) }] }, db)
        expect(vue).not.toBeNull()
        const avecPestel = faits.filter((f) => f.pestel).length
        expect(vue!.total).toBe(avecPestel)
        expect(vue!.faits).toHaveLength(avecPestel)
        expect(vue!.dimensions.find((d) => d.lettre === 'socioculturel')).toMatchObject({ trou: true })
        expect(vue!.dimensions.find((d) => d.lettre === 'legal')!.suiviePar).toHaveLength(1)
        // Sans la lettre lue, les comptes restent, aucune phrase n'est citée.
        expect((await pestelDeLEspace({ registre: REGISTRE, fin: '2026-10-31', lettres: [] }, db))!.faits).toEqual([])
        expect(await pestelDeLEspace({ registre: REGISTRE, fin: '2026-06-30', lettres: [] }, db)).toBeNull()
      } finally {
        vi.unstubAllEnvs()
      }
    })

    it('lireLesCalculs rend les chiffres sans rien écrire', async () => {
      const f = registres()
      const c = await lireLesCalculs({ slug: 'infralliance', fin: '2026-12-31', cycle: { départements: ['75'], texte: 'centre de données' } }, db, { f: f as unknown as typeof fetch, attente: async () => {} })
      expect(c).toMatchObject({ sorte: 'calculé', grilleVersion: 1, indice: { entrées: 12, sorties: 3 }, benchmark: { avecComptes: 1 } })
      expect(await lireLaSynthèseDuPilote({ slug: 'infralliance', période: '2026-T4' }, db)).toEqual({ sorte: 'aucune' })
      expect(await lireLesCalculs({ slug: 'infralliance', fin: '2026-12-31', cycle: { départements: [], texte: 'x' } }, db)).toMatchObject({ sorte: 'refusée' })
    })
  })
})
