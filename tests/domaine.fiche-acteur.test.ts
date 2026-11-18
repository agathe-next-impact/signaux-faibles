import { describe, expect, it } from 'vitest'
import {
  acteurDuSegment,
  faitsDeLActeur,
  historiqueDeLActeur,
  nomsDesActeurs,
  vueDeLActeur,
  énoncésQuiLeConcernent,
} from '@/lib/domaine/fiche-acteur'
import type { Grille } from '@/lib/domaine/strategie'
import type { PositionDatée, ÉlémentLu } from '@/lib/domaine/strategie-vues'

const position = (période: string, sujet: string, axe: string, cran: number, faits: string[] = [], outil = 'mendelow', origine?: string): PositionDatée => ({
  outil,
  sujet,
  axe,
  cran,
  nonSuivi: false,
  tendance: null,
  faits,
  période,
  ...(origine ? { origine } : {}),
})

const GRILLE: Grille = {
  axesGroupes: [
    { clé: 'taille', libellé: 'Taille', crans: ['petite', 'moyenne', 'grande'] },
    { clé: 'offre', libellé: 'Offre', crans: ['étroite', 'mixte', 'large'] },
  ] as unknown as Grille['axesGroupes'],
  familles: [],
  entités: [
    { nom: "L'Hermitage", veille: 'ecosysteme', organisation: true },
    { nom: 'Les Amanins', veille: 'concurrentiel', siren: '123456789' },
    { nom: 'ANCT', veille: 'ecosysteme' },
  ],
  partiesPrenantes: [{ nom: 'ANCT' }, { nom: 'RTES' }],
}

const POSITIONS = [
  position('2026-09', 'Sénat, examen du PLF 2027', 'pouvoir', 3, ['f1']),
  position('2026-09', 'Sénat, examen du PLF 2027', 'interet', 1, ['f1']),
  position('2026-10', 'Sénat, examen du PLF 2027', 'pouvoir', 3, ['f2']),
  position('2026-10', 'Sénat, examen du PLF 2027', 'interet', 2, ['f2', 'f3']),
  position('2026-10', 'ANCT', 'pouvoir', 3, [], 'mendelow', 'declaratif'),
  position('2026-10', 'ANCT', 'interet', 1, [], 'mendelow', 'declaratif'),
  position('2026-10', 'Les Amanins', 'taille', 2, ['f4'], 'groupes'),
  position('2026-10', 'Les Amanins', 'offre', 3, ['f4'], 'groupes'),
  position('2026-10', "L'Hermitage", 'taille', 1, [], 'groupes'),
]

describe('nomsDesActeurs et acteurDuSegment', () => {
  it('réunit les sujets placés et les noms de la grille, sans l’organisation ni doublon', () => {
    const noms = nomsDesActeurs({ positions: POSITIONS, grille: GRILLE, organisation: "L'Hermitage" })
    expect(noms).toEqual(['Sénat, examen du PLF 2027', 'ANCT', 'Les Amanins', 'RTES'])
  })

  it('ne retrouve un acteur que par le segment de son nom', () => {
    const noms = nomsDesActeurs({ positions: POSITIONS, grille: GRILLE, organisation: "L'Hermitage" })
    expect(acteurDuSegment(noms, 'senat-examen-du-plf-2027')).toBe('Sénat, examen du PLF 2027')
    expect(acteurDuSegment(noms, 'l-hermitage')).toBeNull()
    expect(acteurDuSegment(noms, 'inconnu')).toBeNull()
  })
})

describe('historiqueDeLActeur', () => {
  it('une ligne par période publiée, la plus récente d’abord, et le changement de case', () => {
    const [octobre, septembre] = historiqueDeLActeur('Sénat, examen du PLF 2027', POSITIONS, GRILLE)
    expect(octobre).toMatchObject({ période: '2026-10', mendelow: { pouvoir: 'élevé', intérêt: 'intermédiaire', coin: null }, aBougé: true })
    expect(septembre).toMatchObject({ période: '2026-09', mendelow: { pouvoir: 'élevé', intérêt: 'bas', coin: 'Tenir satisfait' }, aBougé: false })
  })

  it('nomme les crans de la carte par la grille, et dit une position déclarative', () => {
    expect(historiqueDeLActeur('Les Amanins', POSITIONS, GRILLE)[0]?.crans).toEqual([
      { axe: 'Taille', cran: 2, libellé: 'moyenne' },
      { axe: 'Offre', cran: 3, libellé: 'large' },
    ])
    expect(historiqueDeLActeur('ANCT', POSITIONS, GRILLE)[0]).toMatchObject({ déclaratif: true, mendelow: { coin: 'Tenir satisfait' } })
  })
})

describe('faitsDeLActeur', () => {
  it('réunit un fait cité et le même fait étiqueté à son nom, du plus récent au plus ancien', () => {
    const faits = faitsDeLActeur({
      cités: [
        { date: '2026-10-01', édition: 'a', empreinte: 'x' },
        { date: '2026-10-19', édition: 'b', empreinte: 'y' },
      ],
      nommés: [{ date: '2026-10-19', édition: 'b', empreinte: 'y' }, { date: '2026-11-02', édition: 'c', empreinte: 'z' }],
      numéros: new Map([['b', 9]]),
    })
    expect(faits.map((f) => [f.date, f.numéro, f.raisons])).toEqual([
      ['2026-11-02', null, ['nommé']],
      ['2026-10-19', 9, ['position', 'nommé']],
      ['2026-10-01', null, ['position']],
    ])
  })
})

describe('énoncésQuiLeConcernent', () => {
  const élément = (id: string, outil: string, clé: string, énoncé: string, faits: string[] = [], références: unknown = {}): ÉlémentLu =>
    ({ id, outil, clé, rang: 1, énoncé, origine: 'faits', faits, références, candidateRecommandation: false, état: null }) as ÉlémentLu

  it('retient un énoncé qui le nomme sous une forme courte, ou qui cite un de ses faits ; jamais par le sens', () => {
    const énoncés = énoncésQuiLeConcernent(
      'Sénat, examen du PLF 2027',
      [
        {
          période: '2026-10',
          codes: new Map([['s1', 'M1']]),
          éléments: [
            élément('s1', 'swot', 'menaces', 'Le Sénat rabote les crédits des tiers-lieux.'),
            élément('s2', 'swot', 'opportunites', 'Un budget favorable aux associations.', ['f2']),
            élément('s3', 'swot', 'forces', 'Le Parlement examine la loi de finances.'),
            élément('t1', 'tows', 'ST', 'Défendre la ligne budgétaire auprès des sénateurs.'),
          ],
        },
        { période: '2026-T4', codes: new Map(), éléments: [élément('c1', 'scenario', 'A', 'Coupe nette.', [], { titre: 'Vote conforme du Sénat' })] },
      ],
      new Set(['f2']),
    )
    expect(énoncés.map((é) => [é.rubrique, é.par])).toEqual([
      ['Menaces · M1', 'nom'],
      ['Opportunités', 'fait'],
      ['Scénario : Vote conforme du Sénat', 'nom'],
    ])
    expect(énoncés[0]).toMatchObject({ code: 'M1', outil: 'swot', libellé: 'd’octobre 2026' })
  })
})

describe('vueDeLActeur', () => {
  it('assemble présentation, position, faits et énoncés ; un segment inconnu ne mène à rien', () => {
    const entrée = {
      grille: GRILLE,
      organisation: "L'Hermitage",
      fiche: { présentations: [{ nom: 'les amanins', texte: 'Écosite de la Drôme.' }] } as never,
      positions: POSITIONS,
      faitsCités: new Map([['f4', { date: '2026-10-05', édition: 'a', empreinte: 'e4' }]]),
      faitsNommés: [{ id: 'f5', date: '2026-11-01', édition: 'b', empreinte: 'e5' }],
      numéros: new Map([['a', 4]]),
      synthèses: [],
    }
    const fiche = vueDeLActeur({ ...entrée, segment: 'les-amanins' })
    expect(fiche).toMatchObject({ nom: 'Les Amanins', sorte: 'concurrent', siren: '123456789', présentation: 'Écosite de la Drôme.' })
    expect(fiche?.faits.map((f) => [f.date, f.numéro])).toEqual([
      ['2026-11-01', null],
      ['2026-10-05', 4],
    ])
    expect(vueDeLActeur({ ...entrée, faitsNommés: [], segment: 'rtes' })).toMatchObject({ sorte: 'partie-prenante', historique: [], faits: [] })
    expect(vueDeLActeur({ ...entrée, segment: 'senat-examen-du-plf-2027' })?.sorte).toBe('placé')
    expect(vueDeLActeur({ ...entrée, segment: 'personne' })).toBeNull()
  })
})
