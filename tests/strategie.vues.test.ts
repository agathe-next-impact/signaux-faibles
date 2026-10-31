import { describe, expect, it } from 'vitest'
import type { Grille } from '@/lib/domaine/strategie'
import {
  libelléDePériode,
  nomsDesConcurrents,
  périodesAPublier,
  vueDeLaCarte,
  vueDeLaFiche,
  vueDesConcurrents,
  vueDeLaSwot,
  vueDeLaTows,
  vueDeMendelow,
  vueDesForces,
  vueDesScénarios,
  vueDuPestel,
  type PositionDatée,
  type ÉlémentLu,
  type PositionLue,
} from '@/lib/domaine/strategie-vues'

const GRILLE: Grille = {
  axesGroupes: [
    { clé: 'specialisation', libellé: 'Spécialisation', crans: ['multisecteur', 'deux secteurs', 'aéronautique dominante', 'aéronautique seule'] },
    { clé: 'capacite', libellé: 'Capacité technique', crans: ['trois axes', 'cinq axes', 'rectification', 'pièces critiques'] },
  ],
  familles: [
    { numéro: 1, veille: 'ecosysteme', pestel: 'economique', porter: null, cadence: 'hebdomadaire' },
    { numéro: 2, veille: 'ecosysteme', pestel: 'legal', porter: null, cadence: 'hebdomadaire' },
    { numéro: 3, veille: 'ecosysteme', pestel: 'legal', porter: null, cadence: 'hebdomadaire' },
    { numéro: 1, veille: 'concurrentiel', pestel: null, porter: 'rivalite', cadence: 'hebdomadaire' },
  ],
  entités: [],
  partiesPrenantes: [],
}

const position = (outil: string, sujet: string, axe: string, cran: number | null, faits: string[] = []): PositionLue => ({ outil, sujet, axe, cran, nonSuivi: cran === null, tendance: null, faits })
const élément = (e: Partial<ÉlémentLu> & Pick<ÉlémentLu, 'id' | 'outil' | 'clé'>): ÉlémentLu => ({ rang: 1, énoncé: 'É.', origine: 'faits', faits: [], références: {}, candidateRecommandation: false, ...e })
const FAITS = new Map([
  ['f1', { date: '2026-10-15', édition: 'page9' }],
  ['f2', { date: '2026-07-02', édition: 'page2' }],
])

describe('libelléDePériode', () => {
  it('nomme un mois et un trimestre en toutes lettres', () => {
    expect(libelléDePériode('2026-10')).toBe('d’octobre 2026')
    expect(libelléDePériode('2026-11')).toBe('de novembre 2026')
    expect(libelléDePériode('2026-T3')).toBe('de juillet à septembre 2026')
  })
})

describe('vueDeLaCarte', () => {
  it('place un sujet par ses deux crans, marque l’organisation, montre le mouvement et l’ancienne case', () => {
    const carte = vueDeLaCarte(
      GRILLE,
      [
        position('groupes', 'Tolmen Mécanique', 'specialisation', 2),
        position('groupes', 'Tolmen Mécanique', 'capacite', 4),
        position('groupes', 'Précimeca', 'specialisation', 3, ['f1']),
        position('groupes', 'Précimeca', 'capacite', 3, ['f1']),
        position('groupes', 'Seul axe', 'capacite', 1),
        position('mendelow', 'DGE', 'pouvoir', 3),
      ],
      [position('groupes', 'Précimeca', 'specialisation', 1), position('groupes', 'Précimeca', 'capacite', 2), position('groupes', 'Tolmen Mécanique', 'specialisation', 2), position('groupes', 'Tolmen Mécanique', 'capacite', 4)],
      'Tolmen Mécanique',
      FAITS,
    )!
    expect(carte.placés).toBe(2)
    expect(carte.cases.get('4:2')).toEqual([{ sujet: 'Tolmen Mécanique', organisation: true, aBougé: false, venuDe: null, fait: null }])
    expect(carte.cases.get('3:3')).toEqual([{ sujet: 'Précimeca', organisation: false, aBougé: true, venuDe: { ligne: 2, colonne: 1 }, fait: { date: '2026-10-15', édition: 'page9' } }])
    expect(carte.anciennes.get('2:1')).toEqual(['Précimeca'])
  })

  it('compte les sujets placés par le seul référentiel ; un fait sur un axe suffit à ne plus les compter', () => {
    const déclarée = (sujet: string, axe: string, cran: number): PositionLue => ({ ...position('groupes', sujet, axe, cran), origine: 'declaratif' })
    const carte = vueDeLaCarte(
      GRILLE,
      [
        déclarée('Précimeca', 'specialisation', 1),
        déclarée('Précimeca', 'capacite', 2),
        déclarée('Usinor', 'specialisation', 3),
        position('groupes', 'Usinor', 'capacite', 3, ['f1']),
      ],
      [],
      'Tolmen Mécanique',
      FAITS,
    )!
    expect(carte.placés).toBe(2)
    expect(carte.déclaratifs).toBe(1)
    const mendelow = vueDeMendelow([{ ...position('mendelow', 'DGE', 'pouvoir', 3), origine: 'declaratif' }, { ...position('mendelow', 'DGE', 'interet', 2), origine: 'declaratif' }], [], FAITS)
    expect(mendelow).toMatchObject({ placés: 1, déclaratifs: 1 })
  })

  it('sans les deux axes de la grille, pas de carte', () => {
    expect(vueDeLaCarte({ ...GRILLE, axesGroupes: [] }, [], [], 'X', FAITS)).toBeNull()
  })
})

describe('concurrents (lot 2)', () => {
  const MARCHÉ: Grille = {
    ...GRILLE,
    entités: [
      { nom: 'Tolmen Mécanique', veille: 'concurrentiel', siren: '123456789' },
      { nom: 'Précimeca', veille: 'concurrentiel', siren: null },
      { nom: 'Usinor', veille: 'concurrentiel', siren: null },
      { nom: 'Pôle Aéro', veille: 'ecosysteme', siren: null },
    ],
  }
  const déclarée = (sujet: string, axe: string, cran: number): PositionLue => ({ ...position('groupes', sujet, axe, cran), origine: 'declaratif' })

  it('liste les concurrents de la grille sans l’organisation ni l’écosystème : ce qui a bougé, puis les plus cités', () => {
    const vue = vueDesConcurrents(
      MARCHÉ,
      [
        position('groupes', 'Précimeca', 'specialisation', 3, ['f1']),
        position('groupes', 'Précimeca', 'capacite', 3, ['f1']),
        déclarée('Usinor', 'specialisation', 1),
        déclarée('Usinor', 'capacite', 2),
      ],
      [position('groupes', 'Précimeca', 'specialisation', 2), position('groupes', 'Précimeca', 'capacite', 3)],
      new Map([['Usinor', { nombre: 4, dernier: '2026-10-20' }], ['Précimeca', { nombre: 1, dernier: '2026-10-15' }]]),
      'Tolmen Mécanique',
    )
    expect(vue.concurrents.map((c) => c.nom)).toEqual(['Précimeca', 'Usinor'])
    expect(vue.concurrents[0]).toMatchObject({ segment: 'precimeca', aBougé: true, déclaratif: false, faits: 1 })
    expect(vue.concurrents[0]!.crans).toEqual([
      { axe: 'Spécialisation', cran: 3, libellé: 'aéronautique dominante' },
      { axe: 'Capacité technique', cran: 3, libellé: 'rectification' },
    ])
    expect(vue.concurrents[1]).toMatchObject({ aBougé: false, déclaratif: true, faits: 4, dernierFait: '2026-10-20' })
    expect(vue.mouvements.map((c) => c.nom)).toEqual(['Précimeca'])
    expect(vue.nonPlacés).toBe(0)
    expect(nomsDesConcurrents(MARCHÉ, 'Tolmen Mécanique')).toEqual(['Précimeca', 'Usinor'])
  })

  it('un concurrent sans position n’est pas placé, et compte parmi les non placés', () => {
    const vue = vueDesConcurrents(MARCHÉ, [], [], new Map(), 'Tolmen Mécanique')
    expect(vue.nonPlacés).toBe(2)
    expect(vue.concurrents.every((c) => c.crans.length === 0 && !c.aBougé && !c.déclaratif)).toBe(true)
  })

  it('la fiche : position de la dernière période, historique du plus récent au plus ancien, faits et chiffres', () => {
    const datée = (période: string, p: PositionLue, référence: string | null = null): PositionDatée => ({ ...p, période, référence })
    const fiche = vueDeLaFiche(
      MARCHÉ,
      'precimeca',
      [
        datée('2026-08', déclarée('Précimeca', 'specialisation', 2), '§2, famille 1'),
        datée('2026-08', déclarée('Précimeca', 'capacite', 3), '§2, famille 1'),
        datée('2026-09', position('groupes', 'Précimeca', 'specialisation', 3, ['f1'])),
        datée('2026-09', position('groupes', 'Précimeca', 'capacite', 3, ['f1'])),
        datée('2026-09', position('groupes', 'Usinor', 'capacite', 1)),
      ],
      [{ date: '2026-09-12', édition: 'e1', empreinte: 'abcd1234', pestel: null, porter: 'rivalite', impact: 'FORT', rupture: true }],
      { période: '2026-T3', lignes: [{ nom: 'Précimeca', siren: '987654321', organisation: false, fiche: 'lue', active: true, trancheEffectif: '11', année: '2025', chiffreDAffaires: 1200000, résultatNet: 30000 }] },
    )!
    expect(fiche.nom).toBe('Précimeca')
    expect(fiche.position).toMatchObject({ période: '2026-09', déclaratif: false, référence: null })
    expect(fiche.historique.map((h) => [h.période, h.aBougé, h.déclaratif])).toEqual([
      ['2026-09', true, false],
      ['2026-08', false, true],
    ])
    expect(fiche.faits[0]).toMatchObject({ dimension: 'Rivalité entre acteurs', rupture: true })
    expect(fiche.chiffres).toMatchObject({ période: '2026-T3', chiffreDAffaires: 1200000 })
  })

  it('un segment qui ne désigne pas un concurrent de la grille ne donne pas de fiche', () => {
    expect(vueDeLaFiche(MARCHÉ, 'pole-aero', [], [], null)).toBeNull()
    expect(vueDeLaFiche(MARCHÉ, 'inconnu', [], [], null)).toBeNull()
    expect(vueDeLaFiche(MARCHÉ, 'usinor', [], [], null)).toMatchObject({ position: null, historique: [], chiffres: null })
  })
})

describe('vueDeMendelow', () => {
  it('range par pouvoir et intérêt ; sans synthèse précédente, rien n’est dit « bougé »', () => {
    const m = vueDeMendelow([position('mendelow', 'DGE', 'pouvoir', 3), position('mendelow', 'DGE', 'interet', 2), position('mendelow', 'ANSSI', 'pouvoir', 1)], [], FAITS)
    expect(m.placés).toBe(1)
    expect(m.cases.get('3:2')).toEqual([{ sujet: 'DGE', aBougé: false, fait: null }])
    const suivant = vueDeMendelow([position('mendelow', 'DGE', 'pouvoir', 3, ['f1']), position('mendelow', 'DGE', 'interet', 3, ['f1'])], [position('mendelow', 'DGE', 'pouvoir', 3), position('mendelow', 'DGE', 'interet', 2)], FAITS)
    expect(suivant.cases.get('3:3')).toEqual([{ sujet: 'DGE', aBougé: true, fait: { date: '2026-10-15', édition: 'page9' } }])
  })
})

describe('SWOT et TOWS', () => {
  const éléments: ÉlémentLu[] = [
    élément({ id: 'a', outil: 'swot', clé: 'forces', origine: 'declaratif' }),
    élément({ id: 'b', outil: 'swot', clé: 'faiblesses', rang: 1 }),
    élément({ id: 'c', outil: 'swot', clé: 'opportunites', faits: ['f2', 'f1'] }),
    élément({ id: 'd', outil: 'swot', clé: 'opportunites', rang: 2, faits: [] }),
    élément({ id: 't1', outil: 'tows', clé: 'WO', énoncé: 'Corriger.', références: { éléments: ['b', 'c'] }, candidateRecommandation: true }),
    élément({ id: 't2', outil: 'tows', clé: 'SO', énoncé: 'Saisir.', références: { éléments: ['a', 'c', 'inconnu'] } }),
  ]

  it('code les éléments par case et les date par le fait le plus récent et sa lettre', () => {
    const { swot, codes } = vueDeLaSwot(éléments, FAITS, new Map([['page9', 9]]))
    expect(swot.forces).toEqual([{ code: 'F1', énoncé: 'É.', source: 'Déclaratif · votre fiche', édition: null, état: null }])
    expect(swot.faiblesses[0]!.code).toBe('Fa1')
    expect(swot.opportunites.map((é) => [é.code, é.source])).toEqual([
      ['O1', 'Fait du 15/10 · lettre n° 9'],
      ['O2', 'Faits de vos lettres'],
    ])
    expect(swot.menaces).toEqual([])
    expect(codes.get('c')).toBe('O1')
  })

  it('la TOWS cite par codes, l’option retenue sortie en tête ; une référence inconnue est tue', () => {
    const { codes } = vueDeLaSwot(éléments, FAITS, new Map())
    const tows = vueDeLaTows(éléments, codes)
    expect(tows.candidate).toEqual({ énoncé: 'Corriger.', croise: ['Fa1', 'O1'], candidate: true, libellé: 'Faiblesses × opportunités' })
    expect(tows.parType.SO).toEqual([{ énoncé: 'Saisir.', croise: ['F1', 'O1'], candidate: false }])
    expect(tows.parType.WT).toEqual([])
  })
})

describe('lecture du trimestre', () => {
  it('les forces dans l’ordre du cadre, « non suivi » jamais « faible »', () => {
    const forces = vueDesForces([
      { ...position('forces', 'pouvoir_clients', 'intensite', 3), tendance: 'stable' },
      { ...position('forces', 'rivalite', 'intensite', 3), tendance: 'hausse' },
      position('forces', 'substituts', 'intensite', null),
    ])
    expect(forces.map((f) => [f.libellé, f.lecture])).toEqual([
      ['Rivalité entre acteurs', 'Intense · en hausse'],
      ['Substituts', 'Non suivi'],
      ['Pouvoir des clients', 'Intense · stable'],
    ])
  })

  it('les scénarios dans leur ordre, avec leurs indicateurs', () => {
    const s = vueDesScénarios([
      élément({ id: 'b', outil: 'scenario', clé: 'scenario-2', références: { titre: 'B', indicateurs: [] } }),
      élément({ id: 'a', outil: 'scenario', clé: 'scenario-1', énoncé: 'Aérolys tire la filière.', références: { titre: 'A', indicateurs: [{ famille: 1, signal: 'Liste des sous-traitants' }] } }),
    ])
    expect(s).toEqual([
      { titre: 'A', énoncé: 'Aérolys tire la filière.', indicateurs: [{ famille: 1, signal: 'Liste des sous-traitants' }] },
      { titre: 'B', énoncé: 'É.', indicateurs: [] },
    ])
  })
})

describe('vueDuPestel', () => {
  const fait = (pestel: string | null, dateÉdition: string, titre: string | null = null, rupture = false, axe = 1) => ({
    pestel: pestel as never,
    rupture,
    dateÉdition,
    dateFait: dateÉdition,
    édition: 'p',
    famille: 'Écosystème',
    axe,
    titre,
  })

  it('compte par dimension et par mois, zéro compris ; nomme les axes qui suivent chaque dimension', () => {
    const vue = vueDuPestel(
      [fait('economique', '2026-08-04'), fait('economique', '2026-10-15', 'Aérolys relève ses cadences.', true), fait('legal', '2026-10-15', 'Norme révisée.', false, 2), fait(null, '2026-10-15')],
      GRILLE,
      new Map([['ecosysteme:1', 'Donneurs d’ordre'], ['ecosysteme:2', 'Qualité']]),
      { début: '2026-07-21', fin: '2026-10-19' },
    )
    expect(vue.total).toBe(3)
    const éco = vue.dimensions.find((d) => d.lettre === 'economique')!
    expect(éco).toMatchObject({ faits: 2, ruptures: 1, suiviePar: [{ numéro: 1, nom: 'Donneurs d’ordre' }], trou: false })
    expect(éco.parMois).toEqual([
      { mois: 'juil.', faits: 0 },
      { mois: 'août', faits: 1 },
      { mois: 'sept.', faits: 0 },
      { mois: 'oct.', faits: 1 },
    ])
    expect(vue.dimensions.find((d) => d.lettre === 'legal')!.suiviePar.map((a) => a.nom)).toEqual(['Qualité', 'Famille 3'])
    expect(vue.dimensions.find((d) => d.lettre === 'politique')).toMatchObject({ faits: 0, trou: true })
    // Sans lettre qui porte l'axe, le libellé de la grille ; le titre de la lettre l'emporte quand il existe.
    const nommée: Grille = { ...GRILLE, familles: GRILLE.familles.map((f) => (f.veille === 'ecosysteme' && f.numéro !== 2 ? { ...f, libellé: `Grille ${f.numéro}` } : f)) }
    const avecLaGrille = vueDuPestel([fait('legal', '2026-10-15')], nommée, new Map([['ecosysteme:1', 'Donneurs d’ordre']]), { début: '2026-07-21', fin: '2026-10-19' })
    expect(avecLaGrille.dimensions.find((d) => d.lettre === 'legal')!.suiviePar.map((a) => a.nom)).toEqual(['Famille 2', 'Grille 3'])
    expect(avecLaGrille.dimensions.find((d) => d.lettre === 'economique')!.suiviePar.map((a) => a.nom)).toEqual(['Donneurs d’ordre'])
    // Une seule famille ou aucune : un trou de couverture.
    expect(vue.trous.map((t) => [t.libellé, t.familles])).toEqual([
      ['Politique', 0],
      ['Économique', 1],
      ['Socioculturel', 0],
      ['Technologique', 0],
      ['Écologique', 0],
    ])
    // Seuls les faits dont la phrase-titre est relue sont cités.
    expect(vue.faits).toEqual([
      { date: '2026-10-15', dimension: 'Économique', titre: 'Aérolys relève ses cadences.', rupture: true, axe: '1 Donneurs d’ordre' },
      { date: '2026-10-15', dimension: 'Légal', titre: 'Norme révisée.', rupture: false, axe: '2 Qualité' },
    ])
  })

  it('une ligne par événement : même source, même date, même dimension, avec les axes des deux lettres', () => {
    const budget = 'https://www.assemblee-nationale.fr/dyn/contenu/PAP%202027%20-%20Coh%C3%A9sion.pdf'
    const vue = vueDuPestel(
      [
        { ...fait('economique', '2026-10-19', 'Le document budgétaire ne nomme pas les Fabriques.', false, 1), source: budget },
        { ...fait('economique', '2026-10-19', 'Le document budgétaire ne porte aucune ligne pour les Fabriques.', true, 2), famille: 'Concurrentiel', source: 'http://assemblee-nationale.fr/dyn/contenu/PAP 2027 - Cohésion.pdf/' },
        // Même source et même date, autre dimension : un autre fait.
        { ...fait('legal', '2026-10-19', 'Le texte renvoie à un décret.', false, 2), source: budget },
        // Même date, autre source : un autre fait.
        { ...fait('economique', '2026-10-19', 'La Région vote 3,2 millions.', false, 1), source: 'https://www.hautsdefrance.fr/patrimoine' },
      ],
      GRILLE,
      new Map([['ecosysteme:1', 'Donneurs d’ordre'], ['ecosysteme:2', 'Qualité'], ['concurrentiel:2', 'Prix']]),
      { début: '2026-07-21', fin: '2026-10-19' },
    )
    expect(vue.faits).toEqual([
      { date: '2026-10-19', dimension: 'Économique', titre: 'Le document budgétaire ne nomme pas les Fabriques.', rupture: true, axe: '1 Donneurs d’ordre · 2 Prix' },
      { date: '2026-10-19', dimension: 'Légal', titre: 'Le texte renvoie à un décret.', rupture: false, axe: '2 Qualité' },
      { date: '2026-10-19', dimension: 'Économique', titre: 'La Région vote 3,2 millions.', rupture: false, axe: '1 Donneurs d’ordre' },
    ])
    // Les comptes restent ceux des faits étiquetés.
    expect(vue.total).toBe(4)
  })
})

describe('périodesAPublier', () => {
  const c = (slug: string, nom: string, période: string, lignes: number, publiées = 0, retirées = 0) => ({ slug, nom, période, lignes, publiées, retirées })
  it('une entrée par organisation, par nom ; le trimestre après les mois qu’il couvre ; l’état de la période entière', () => {
    const t = périodesAPublier([
      c('mastora', 'Mastora', '2026-10', 40),
      c('hermitage', 'L’Hermitage', '2026-08', 39, 39),
      c('hermitage', 'L’Hermitage', '2026-T3', 52, 52),
      c('hermitage', 'L’Hermitage', '2026-10', 40, 10),
      c('hermitage', 'L’Hermitage', '2026-09', 40, 0, 40),
    ])
    expect(t.map((o) => o.slug)).toEqual(['hermitage', 'mastora'])
    expect(t[0]!.périodes.map((p) => [p.période, p.état])).toEqual([
      ['2026-10', 'mêlée'],
      ['2026-T3', 'publiée'],
      ['2026-09', 'retirée'],
      ['2026-08', 'publiée'],
    ])
    expect(t[0]!.périodes[1]).toMatchObject({ granularité: 'trimestre', libellé: 'de juillet à septembre 2026' })
    expect(t[1]!.périodes[0]).toMatchObject({ état: 'proposée', granularité: 'mois' })
  })
})
