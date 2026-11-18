import { describe, expect, it } from 'vitest'
import { acteursPlacés, formesDuNom, rattacherAuxActeurs, suiviDesActeurs } from '@/lib/domaine/dossiers-des-acteurs'
import type { PositionLue, VueDeLaCarte, VueDeMendelow } from '@/lib/domaine/strategie-vues'

const dossier = (nom: string, précisionActuelle: string | null = null) => ({ nom, précisionActuelle })

// Les dossiers et les parties prenantes de L'Hermitage au 18 novembre 2026,
// tels que la propriété « Dossiers ouverts suivis » et la synthèse d'octobre
// les portent : c'est l'écart qui a fait reprendre la section.
const DOSSIERS_HERMITAGE = [
  dossier("Budget de l'État pour 2027", 'amendements de la commission des finances du Sénat adoptés le 12 novembre'),
  dossier('Livre blanc nourriciers', 'toujours sans porteur'),
  dossier('Après-GIP', 'aucune reprise annoncée à deux semaines de la fin de la liquidation'),
  dossier('Licence IV rurale', "deuxième lecture à l'Assemblée sans date"),
  dossier('Programme Airbnb et Fondation du patrimoine', "date limite au 13 février 2027 et session d'automne sans date"),
  dossier('Guichet régional patrimoine rural', 'guide au 16 novembre et fiche au 23 inchangés'),
]
const MENDELOW_HERMITAGE = [
  'ANCT',
  'ANTL',
  'Conseil régional Hauts-de-France',
  'La Coopérative Tiers-Lieux',
  'Le Mouvement associatif',
  'RTES',
  'Sénat, examen du PLF 2027',
]

describe('formesDuNom', () => {
  it('garde le nom, sa tête avant la virgule ou la parenthèse, et les noms entre parenthèses', () => {
    expect(formesDuNom('Sénat, examen du PLF 2027')).toEqual(['Sénat, examen du PLF 2027', 'Sénat'])
    expect(formesDuNom('Instituts monétaires clients (US Mint, Royal Mint, Monnaie de Paris)')).toEqual([
      'Instituts monétaires clients (US Mint, Royal Mint, Monnaie de Paris)',
      'Instituts monétaires clients',
      'US Mint',
      'Royal Mint',
      'Monnaie de Paris',
    ])
  })

  it('ne découpe jamais sur « et », et écarte une forme de moins de trois caractères', () => {
    expect(formesDuNom("Ville et Métiers d'Art")).toEqual(["Ville et Métiers d'Art"])
    expect(formesDuNom('X (A, Bpifrance)')).toEqual(['X (A, Bpifrance)', 'Bpifrance'])
  })
})

describe('rattacherAuxActeurs', () => {
  it('rattache un dossier par son nom ou sa précision, bornée aux mots', () => {
    const { rattachés, autres, sansDossier } = rattacherAuxActeurs(DOSSIERS_HERMITAGE, MENDELOW_HERMITAGE)
    expect(rattachés.map((r) => [r.dossier.nom, r.acteurs])).toEqual([["Budget de l'État pour 2027", ['Sénat, examen du PLF 2027']]])
    expect(autres).toHaveLength(5)
    expect(sansDossier).not.toContain('Sénat, examen du PLF 2027')
    expect(sansDossier).toContain('ANCT')
  })

  it('ne rapproche pas deux noms voisins : « RTE » ne se trouve pas dans « RTES »', () => {
    const { rattachés } = rattacherAuxActeurs([dossier('Réseau RTES', null), dossier("File d'attente de RTE", null)], ['RTE'])
    expect(rattachés.map((r) => r.dossier.nom)).toEqual(["File d'attente de RTE"])
  })

  it('un dossier qui nomme deux acteurs va sous les deux', () => {
    const { rattachés } = rattacherAuxActeurs([dossier('Marché CAIH et Resah')], ['CAIH', 'Resah'])
    expect(rattachés[0]?.acteurs).toEqual(['CAIH', 'Resah'])
  })
})

describe('acteursPlacés', () => {
  it('réunit les sujets de Mendelow et de la carte, sans l’organisation', () => {
    const mendelow: VueDeMendelow = {
      cases: new Map([['3:1', [{ sujet: 'ANCT', aBougé: false, fait: null }]]]),
      placés: 1,
      déclaratifs: 0,
    }
    const carte = {
      cases: new Map([
        [
          '1:1',
          [
            { sujet: "L'Hermitage", organisation: true, aBougé: false, venuDe: null, fait: null },
            { sujet: 'Les Amanins', organisation: false, aBougé: false, venuDe: null, fait: null },
          ],
        ],
      ]),
    } as unknown as VueDeLaCarte
    expect(acteursPlacés(mendelow, carte)).toEqual(['ANCT', 'Les Amanins'])
    expect(acteursPlacés(mendelow, null)).toEqual(['ANCT'])
  })
})

describe('suiviDesActeurs', () => {
  const position = (sujet: string, axe: string, cran: number, faits: string[] = [], origine?: string): PositionLue => ({
    outil: 'mendelow',
    sujet,
    axe,
    cran,
    nonSuivi: false,
    tendance: null,
    faits,
    ...(origine ? { origine } : {}),
  })

  it('une ligne par acteur : position, faits datés sans doublon, dossiers qui le nomment, qui a bougé d’abord', () => {
    const lignes = suiviDesActeurs({
      acteurs: ['ANCT', 'Sénat, examen du PLF 2027', 'RTES'],
      outils: ['mendelow'],
      positions: [
        position('ANCT', 'pouvoir', 3, ['f1']),
        position('ANCT', 'interet', 1, ['f1', 'f2']),
        position('Sénat, examen du PLF 2027', 'pouvoir', 3, ['f3']),
        position('Sénat, examen du PLF 2027', 'interet', 2, ['f3']),
        position('RTES', 'pouvoir', 2, [], 'declaratif'),
        position('RTES', 'interet', 2, [], 'declaratif'),
      ],
      précédentes: [
        position('ANCT', 'pouvoir', 3),
        position('ANCT', 'interet', 1),
        position('Sénat, examen du PLF 2027', 'pouvoir', 3),
        position('Sénat, examen du PLF 2027', 'interet', 1),
        position('RTES', 'pouvoir', 2),
        position('RTES', 'interet', 2),
      ],
      faits: new Map([
        ['f1', { date: '2026-10-01', édition: 'a' }],
        ['f2', { date: '2026-10-19', édition: 'b' }],
        ['f3', { date: '2026-10-19', édition: 'b' }],
      ]),
      numéros: new Map([['b', 9]]),
      dossiers: DOSSIERS_HERMITAGE,
    })
    expect(lignes.map((l) => l.sujet)).toEqual(['Sénat, examen du PLF 2027', 'ANCT', 'RTES'])
    const [sénat, anct, rtes] = lignes
    expect(sénat).toMatchObject({ aBougé: true, position: 'pouvoir élevé · intérêt intermédiaire' })
    expect(sénat?.dossiers.map((d) => d.nom)).toEqual(["Budget de l'État pour 2027"])
    expect(anct?.faits).toEqual([
      { date: '2026-10-19', édition: 'b', numéro: 9 },
      { date: '2026-10-01', édition: 'a', numéro: null },
    ])
    expect(anct).toMatchObject({ aBougé: false, déclaratif: false, dossiers: [] })
    expect(rtes).toMatchObject({ aBougé: false, déclaratif: true, faits: [] })
  })

  it('sans synthèse précédente, personne n’a bougé', () => {
    const [ligne] = suiviDesActeurs({
      acteurs: ['ANCT'],
      outils: ['mendelow'],
      positions: [position('ANCT', 'pouvoir', 3), position('ANCT', 'interet', 1)],
      précédentes: [],
      faits: new Map(),
      numéros: new Map(),
      dossiers: [],
    })
    expect(ligne?.aBougé).toBe(false)
  })
})
