import { describe, expect, it } from 'vitest'
import type { Grille, IndicateurDeScénario } from '@/lib/domaine/strategie'
import { trajectoireDesScénarios, type FaitDeTrajectoire, type ScénarioLu } from '@/lib/domaine/strategie-vues'

/**
 * La trajectoire des scénarios (16 novembre 2026, lot 2 des simulations) : des
 * faits comptés contre des règles, semaine par semaine. Rien n'est lu ici.
 */
const GRILLE: Pick<Grille, 'familles'> = {
  familles: [
    { numéro: 1, veille: 'ecosysteme', pestel: 'legal', cadence: 'hebdomadaire', libellé: 'Cadre réglementaire' },
    { numéro: 1, veille: 'concurrentiel', porter: 'rivalite', cadence: 'hebdomadaire', libellé: 'Mouvements des concurrents' },
    { numéro: 3, veille: 'concurrentiel', porter: 'nouveaux_entrants', cadence: 'hebdomadaire' },
  ],
}

// Lundis : 5, 12, 19, 26 octobre, 2 et 9 novembre 2026.
const FENÊTRE = { début: '2026-10-06', fin: '2026-11-10' }

const fait = (dateÉdition: string, plus: Partial<FaitDeTrajectoire> = {}): FaitDeTrajectoire => ({
  date: dateÉdition,
  dateÉdition,
  édition: 'a'.repeat(32),
  source: 'https://www.exemple.example/article',
  famille: 'Concurrentiel',
  axe: 1,
  pestel: null,
  porter: 'rivalite',
  ansoff: null,
  entité: null,
  impact: 'MOYEN',
  rupture: false,
  ...plus,
})

const scénario = (titre: string, ...indicateurs: IndicateurDeScénario[]): ScénarioLu => ({ titre, énoncé: 'É.', indicateurs })
const rivalité = (règle: IndicateurDeScénario['règle']): IndicateurDeScénario => ({ famille: 1, veille: 'concurrentiel', signal: 'un concurrent annonce une offre', règle })
const un = (scénarios: ScénarioLu[], faits: FaitDeTrajectoire[], fenêtre = FENÊTRE) => trajectoireDesScénarios(scénarios, faits, fenêtre, GRILLE)

describe('trajectoireDesScénarios', () => {
  it('un indicateur à seuil 3 s’allume au troisième fait, pas au deuxième, et dit la semaine', () => {
    const s = [scénario('A', rivalité({ seuil: 3 }))]
    const deux = un(s, [fait('2026-10-13'), fait('2026-10-20')]).scénarios[0]!
    expect(deux.indicateurs[0]).toMatchObject({ état: 'approche', compte: 2, seuil: 3, alluméLe: null })
    expect(deux).toMatchObject({ comptables: 1, allumés: 0, réunisDepuis: null })

    const trois = un(s, [fait('2026-10-13'), fait('2026-10-20'), fait('2026-11-03')]).scénarios[0]!
    expect(trois.indicateurs[0]).toMatchObject({ état: 'allume', compte: 3, alluméLe: '2026-11-02' })
    expect(trois).toMatchObject({ allumés: 1, réunisDepuis: '2026-11-02' })
    expect(trois.indicateurs[0]!.semaines.map((x) => x.faits)).toEqual([0, 1, 1, 0, 1, 0])

    const unSeul = un([scénario('A', rivalité({ seuil: 4 }))], [fait('2026-10-13')]).scénarios[0]!
    expect(unSeul.indicateurs[0]!.état).toBe('eteint')
  })

  it('le sens « quand ils manquent » s’allume après la fenêtre vide et s’éteint au premier fait', () => {
    const s = [scénario('A', rivalité({ seuil: 4, sens: 'absence' }))]
    const vide = un(s, []).scénarios[0]!.indicateurs[0]!
    // Six semaines sans fait : allumé depuis la quatrième, celle du 26 octobre.
    expect(vide).toMatchObject({ état: 'allume', compte: 6, alluméLe: '2026-10-26', sens: 'absence' })

    const interrompu = un(s, [fait('2026-11-03')]).scénarios[0]!.indicateurs[0]!
    expect(interrompu).toMatchObject({ état: 'eteint', compte: 1, alluméLe: null })
    const repris = un(s, [fait('2026-10-20')]).scénarios[0]!.indicateurs[0]!
    expect(repris).toMatchObject({ état: 'approche', compte: 3 })
    // Une fenêtre plus courte que le seuil ne peut pas l'allumer.
    expect(un(s, [], { début: '2026-10-27', fin: '2026-11-10' }).scénarios[0]!.indicateurs[0]!.état).toBe('approche')
  })

  it('la règle filtre : veille de la famille, exigence, cadre, entités, mouvement', () => {
    const faits = [
      fait('2026-10-13', { entité: 'Aérolys', ansoff: 'diversification', impact: 'FORT' }),
      fait('2026-10-13', { entité: 'Autre', rupture: true }),
      fait('2026-10-20', { famille: 'Écosystème', pestel: 'legal', porter: null }),
      fait('2026-10-20', { axe: 3, porter: 'nouveaux_entrants' }),
    ]
    const compte = (règle: IndicateurDeScénario['règle']) => un([scénario('A', rivalité(règle))], faits).scénarios[0]!.indicateurs[0]!.compte
    expect(compte({ seuil: 1 })).toBe(2)
    expect(compte({ seuil: 1, exigence: 'fort' })).toBe(1)
    expect(compte({ seuil: 1, exigence: 'rupture' })).toBe(1)
    expect(compte({ seuil: 1, entités: ['aérolys'] })).toBe(1)
    expect(compte({ seuil: 1, mouvement: 'diversification' })).toBe(1)
    expect(compte({ seuil: 1, cadre: 'rivalite' })).toBe(2)
    expect(compte({ seuil: 1, cadre: 'legal' })).toBe(0)
  })

  it('sans règle, comptage large ; famille ambiguë ou inconnue, rien n’est compté', () => {
    const t = un(
      [scénario('A', { famille: 1, veille: 'concurrentiel', signal: 'large' }, { famille: 1, signal: 'ambigu', règle: { seuil: 1 } }, { famille: 3, signal: 'déduit', règle: { seuil: 1 } })],
      [fait('2026-10-13'), fait('2026-10-20', { axe: 3, porter: 'nouveaux_entrants' })],
    ).scénarios[0]!
    expect(t.indicateurs.map((i) => [i.état, i.compte])).toEqual([['large', 1], ['non-compte', 0], ['allume', 1]])
    expect(t.indicateurs[0]).toMatchObject({ nomDeFamille: 'Mouvements des concurrents', règle: null, seuil: null })
    // Seul l'indicateur à règle et à famille reconnue entre dans « signaux réunis ».
    expect(t).toMatchObject({ comptables: 1, allumés: 1 })
  })

  it('ne compte que les faits parus depuis le dépôt, treize semaines au plus, et montre à part les faits partagés', () => {
    const s = [scénario('A', rivalité({ seuil: 1 })), scénario('B', rivalité({ seuil: 2 })), scénario('C', { famille: 3, signal: 'entrant', règle: { seuil: 1 } })]
    const t = un(s, [fait('2026-10-05'), fait('2026-10-13'), fait('2026-11-11')])
    expect(t.semaines).toEqual(['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26', '2026-11-02', '2026-11-09'])
    expect(t.scénarios.map((x) => x.indicateurs[0]!.compte)).toEqual([1, 1, 0])
    expect(t.partagés).toHaveLength(1)
    expect(t.partagés[0]).toMatchObject({ scénarios: ['A', 'B'], fait: { dateÉdition: '2026-10-13' } })

    expect(un(s, [], { début: '2026-01-06', fin: '2026-11-10' }).semaines).toHaveLength(13)
    // Scénarios déposés après la dernière lettre : aucune semaine, tout éteint.
    const avant = un(s, [fait('2026-10-13')], { début: '2026-11-12', fin: '2026-11-10' })
    expect(avant.semaines).toEqual([])
    expect(avant.scénarios[0]!.indicateurs[0]).toMatchObject({ état: 'eteint', compte: 0 })
  })

  it('une lettre unique, sans veille, revient à la famille quand son numéro n’existe qu’une fois', () => {
    const s = [scénario('A', { famille: 3, signal: 'entrant', règle: { seuil: 1 } }, rivalité({ seuil: 1 }))]
    const t = un(s, [fait('2026-10-13', { famille: null, axe: 3 }), fait('2026-10-13', { famille: null, axe: 1 })]).scénarios[0]!
    expect(t.indicateurs.map((i) => i.compte)).toEqual([1, 0])
  })
})
