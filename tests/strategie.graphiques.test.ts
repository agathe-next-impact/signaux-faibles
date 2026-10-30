import { describe, expect, it } from 'vitest'
import type { Grille } from '@/lib/domaine/strategie'
import {
  activitéParSemaine,
  enBrefDesIndicateurs,
  segmentDeFamille,
  semainesJusquÀ,
  vueDeLaChaleur,
  vueDeLAxe,
  vueDesIndicateurs,
  type FaitDeLActivité,
  type FaitDeLAxe,
} from '@/lib/domaine/strategie-vues'

/** Les graphiques de l'espace réorganisé (lot 5, 30 octobre 2026) : des comptes, zéro compris, jamais une valeur inventée. */

const GRILLE: Grille = {
  axesGroupes: [],
  familles: [
    { numéro: 1, veille: 'ecosysteme', pestel: 'politique', porter: null, cadence: 'hebdomadaire', libellé: 'Politiques publiques' },
    { numéro: 2, veille: 'ecosysteme', pestel: 'economique', porter: null, cadence: 'mensuelle' },
    { numéro: 1, veille: 'concurrentiel', pestel: null, porter: 'rivalite', cadence: 'hebdomadaire', libellé: 'Lieux concurrents' },
  ],
  entités: [],
  partiesPrenantes: [],
}

const fait = (dateÉdition: string, famille: string | null, axe: number | null, impact = 'MOYEN', rupture = false): FaitDeLActivité => ({ dateÉdition, famille, axe, impact, rupture })

describe('semainesJusquÀ', () => {
  it('rend les lundis, du plus ancien à celui de la semaine de fin', () => {
    // Le 28 octobre 2026 est un mercredi : sa semaine commence le lundi 26.
    expect(semainesJusquÀ('2026-10-28', 3)).toEqual(['2026-10-12', '2026-10-19', '2026-10-26'])
  })
})

describe('activitéParSemaine', () => {
  it('compte les faits par semaine de parution, une semaine sans fait comprise', () => {
    const faits = [fait('2026-10-26', 'Écosystème', 1), fait('2026-10-28', 'Concurrentiel', 1, 'FORT', true), fait('2026-10-12', 'Écosystème', 2)]
    expect(activitéParSemaine(faits, '2026-10-28', 3)).toEqual([
      { lundi: '2026-10-12', faits: 1, ruptures: 0 },
      { lundi: '2026-10-19', faits: 0, ruptures: 0 },
      { lundi: '2026-10-26', faits: 2, ruptures: 1 },
    ])
  })

  it('ignore ce qui sort de la fenêtre', () => {
    expect(activitéParSemaine([fait('2026-01-05', 'Écosystème', 1)], '2026-10-28', 13).every((s) => s.faits === 0)).toBe(true)
  })
})

describe('vueDeLaChaleur', () => {
  it('une ligne par famille de la grille, chaque case au niveau de son fait le plus fort', () => {
    const faits = [
      fait('2026-10-26', 'Écosystème', 1, 'MOYEN'),
      fait('2026-10-26', 'Écosystème', 1, 'FORT'),
      fait('2026-10-19', 'Concurrentiel', 1, 'MOYEN'),
    ]
    const vue = vueDeLaChaleur(faits, GRILLE, '2026-10-28', 2)
    expect(vue.semaines).toEqual(['2026-10-19', '2026-10-26'])
    expect(vue.lignes.map((l) => [l.clé, l.nom, l.cases.map((c) => c.niveau)])).toEqual([
      ['ecosysteme:1', 'Politiques publiques', [null, 'FORT']],
      // Une famille sans nom court garde son numéro, et une famille sans fait reste affichée, vide.
      ['ecosysteme:2', 'Famille 2', [null, null]],
      ['concurrentiel:1', 'Lieux concurrents', ['MOYEN', null]],
    ])
    expect(vue.lignes[0]!.cases[1]!.faits).toBe(2)
  })

  it('un axe que la grille ne nomme pas s’ajoute après elle ; un fait sans axe ne fait pas de ligne', () => {
    const vue = vueDeLaChaleur([fait('2026-10-26', 'Écosystème', 9), fait('2026-10-26', 'Écosystème', null)], GRILLE, '2026-10-28', 1)
    expect(vue.lignes.map((l) => l.clé)).toEqual(['ecosysteme:1', 'ecosysteme:2', 'concurrentiel:1', 'ecosysteme:9'])
    expect(vue.lignes.at(-1)).toMatchObject({ nom: 'Famille 9', cases: [{ niveau: 'MOYEN', faits: 1 }] })
  })
})

const INDICE = {
  calculéLe: '2026-10-05T00:00:00Z',
  période: { du: '2025-10-05', au: '2026-10-04' },
  périodePrécédente: { du: '2024-10-05', au: '2025-10-04' },
  départements: ['60', '02'],
  texte: 'séminaires',
  entrées: 326,
  sorties: 69,
  solde: 257,
  ratio: 4.72,
  entréesAvant: 318,
  sortiesAvant: 55,
  évolutionDesEntrées: 2.5,
  évolutionDesSorties: 25.5,
  limites: ['BODACC seulement.'],
}
const LIGNE = { siren: '111111111', organisation: false, fiche: 'lue' as const, active: true, trancheEffectif: '11', année: '2025', résultatNet: 10 }
const BENCHMARK = {
  calculéLe: '2026-10-05T00:00:00Z',
  lignes: [
    { ...LIGNE, nom: 'Vous', siren: '222222222', organisation: true, chiffreDAffaires: 0 },
    { ...LIGNE, nom: 'Autre', chiffreDAffaires: null, année: null },
  ],
  avecComptes: 1,
  sansComptes: 1,
  médianeDuChiffreDAffaires: 0,
  rangDeLOrganisation: 1,
  limites: [],
}

describe('vueDesIndicateurs', () => {
  it('lit l’indice et le benchmark dans la valeur de leurs éléments, avec leur interprétation', () => {
    const vue = vueDesIndicateurs('2026-T3', [
      { outil: 'scenario', énoncé: 'Sans rapport.' },
      { outil: 'indice_cycle', énoncé: 'Le marché se renouvelle.', valeur: INDICE },
      { outil: 'benchmark', énoncé: 'Rang non interprétable.', valeur: BENCHMARK },
    ])
    expect(vue?.indice).toEqual({ valeurs: INDICE, interprétation: 'Le marché se renouvelle.' })
    expect(vue?.benchmark?.valeurs.lignes).toHaveLength(2)
    expect(enBrefDesIndicateurs(vue!).map((c) => [c.valeur, c.mention])).toEqual([
      ['326', '+2,5 % sur un an'],
      ['69', '+25,5 % sur un an'],
      ['1 sur 2', 'votre rang : 1'],
    ])
  })

  it('une valeur incomplète n’est pas montrée, et sans aucun des deux il n’y a pas de vue', () => {
    expect(vueDesIndicateurs('2026-T3', [{ outil: 'indice_cycle', énoncé: 'x', valeur: { entrées: 3 } }, { outil: 'benchmark', énoncé: 'y', valeur: { lignes: [] } }])).toBeNull()
    const sansIndice = vueDesIndicateurs('2026-T3', [{ outil: 'benchmark', énoncé: null, valeur: BENCHMARK }])
    expect(sansIndice?.indice).toBeNull()
    expect(enBrefDesIndicateurs(sansIndice!).slice(0, 2).map((c) => [c.valeur, c.mention])).toEqual([
      ['n.d.', 'indice non calculé'],
      ['n.d.', 'indice non calculé'],
    ])
  })
})

describe('vueDeLAxe', () => {
  const faitDeLAxe = (date: string, famille: string, axe: number, autres: Partial<FaitDeLAxe> = {}): FaitDeLAxe => ({
    date,
    dateÉdition: date,
    édition: 'e1',
    empreinte: 'abcd1234',
    famille,
    axe,
    pestel: 'politique',
    porter: null,
    impact: 'MOYEN',
    rupture: false,
    ...autres,
  })

  it('le segment vient du nom court de la famille, à défaut de sa veille et de son numéro', () => {
    expect(GRILLE.familles.map(segmentDeFamille)).toEqual(['politiques-publiques', 'famille-ecosysteme-2', 'lieux-concurrents'])
  })

  it('rend les faits de la seule famille désignée, du plus récent au plus ancien, avec leur dimension', () => {
    const faits = [
      faitDeLAxe('2026-10-01', 'Écosystème', 1),
      faitDeLAxe('2026-10-20', 'Écosystème', 1, { impact: 'FORT', rupture: true }),
      // Même numéro, autre veille : un autre axe.
      faitDeLAxe('2026-10-21', 'Concurrentiel', 1, { pestel: null, porter: 'rivalite' }),
      faitDeLAxe('2026-10-22', 'Écosystème', 2),
    ]
    const vue = vueDeLAxe(GRILLE, 'politiques-publiques', faits)
    expect(vue).toMatchObject({ nom: 'Politiques publiques', numéro: 1, suit: 'Politique', forts: 1, ruptures: 1 })
    expect(vue?.faits.map((f) => [f.date, f.dimension])).toEqual([
      ['2026-10-20', 'Politique'],
      ['2026-10-01', 'Politique'],
    ])
    expect(vueDeLAxe(GRILLE, 'lieux-concurrents', faits)?.faits.map((f) => f.dimension)).toEqual(['Rivalité entre acteurs'])
  })

  it('un segment qui n’est pas dans la grille ne mène à rien', () => {
    expect(vueDeLAxe(GRILLE, 'famille-ecosysteme-9', [])).toBeNull()
    expect(vueDeLAxe(GRILLE, '..', [])).toBeNull()
  })
})
