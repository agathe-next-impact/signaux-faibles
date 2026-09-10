import { describe, expect, it } from 'vitest'
import { regrouperParSemaine } from '@/lib/domaine/semaines'
import { suivreLesAxes, suivreLesDossiers } from '@/lib/domaine/tendances'

const édition = (dateÉdition: string, dossiersOuvertsBruts: string) => ({
  dateÉdition,
  dossiersOuvertsBruts,
})

describe('suivreLesDossiers', () => {
  it('suit un compteur qui monte, semaine après semaine', () => {
    const semaines = regrouperParSemaine([
      édition('2026-09-07', 'CADA (2)'),
      édition('2026-08-31', 'CADA (1)'),
      édition('2026-08-24', 'CADA (0)'),
    ])
    const suivi = suivreLesDossiers(semaines)
    expect(suivi).toHaveLength(1)
    expect(suivi[0]?.points.map((p) => p.compteur)).toEqual([0, 1, 2])
    expect(suivi[0]?.compteurActuel).toBe(2)
    expect(suivi[0]?.aBougé).toBe(false)
  })

  it('repère un dossier qui vient de bouger, compteur retombé', () => {
    const semaines = regrouperParSemaine([
      édition('2026-09-07', 'CADA (0, rapport déposé)'),
      édition('2026-08-31', 'CADA (3)'),
    ])
    const suivi = suivreLesDossiers(semaines)
    expect(suivi[0]?.aBougé).toBe(true)
    expect(suivi[0]?.précisionActuelle).toBe('rapport déposé')
  })

  it('classe les dossiers qui s’enlisent en premier', () => {
    const semaines = regrouperParSemaine([
      édition('2026-09-07', 'Calme (0) · Enlisé (5) · Moyen (2)'),
    ])
    expect(suivreLesDossiers(semaines).map((d) => d.nom)).toEqual(['Enlisé', 'Moyen', 'Calme'])
  })

  it('garde un ordre stable entre dossiers à égalité', () => {
    const semaines = regrouperParSemaine([édition('2026-09-07', 'Zèbre (1) · Abeille (1)')])
    expect(suivreLesDossiers(semaines).map((d) => d.nom)).toEqual(['Abeille', 'Zèbre'])
  })

  it('fusionne les deux notes d’une même semaine sur la mention la plus avancée', () => {
    const semaines = regrouperParSemaine([
      édition('2026-09-07', 'CADA (1)'),
      édition('2026-09-07', 'CADA (4, au Sénat)'),
    ])
    const suivi = suivreLesDossiers(semaines)
    expect(suivi[0]?.points).toHaveLength(1)
    expect(suivi[0]?.compteurActuel).toBe(4)
  })

  it('ne renvoie rien quand aucune édition ne porte de dossier', () => {
    expect(suivreLesDossiers(regrouperParSemaine([édition('2026-09-07', '')]))).toEqual([])
  })
})

/** Un document réduit à ses axes : le reste n'entre pas dans le calcul. */
const doc = (...axes: readonly (readonly [string, 'FORT' | 'MOYEN' | 'RAS' | null])[]) => ({
  préambule: [],
  rubriques: [
    {
      titre: 'Rubrique',
      introduction: [],
      axes: axes.map(([titre, niveau], rang) => ({
        titre,
        numéro: rang + 1,
        niveau,
        blocs: [],
      })),
    },
  ],
})

describe('suivreLesAxes', () => {
  it('trie par impact et signale ce qui monte, baisse ou ne bouge pas', () => {
    const axes = suivreLesAxes(
      [doc(['Financements', 'MOYEN'], ['Cadre', 'FORT'], ['Filière', 'RAS'])],
      [doc(['Financements', 'RAS'], ['Cadre', 'FORT'], ['Filière', 'MOYEN'])],
    )

    expect(axes.map((axe) => axe.titre)).toEqual(['Cadre', 'Financements', 'Filière'])
    expect(axes.map((axe) => axe.mouvement)).toEqual(['stable', 'monté', 'redescendu'])
  })

  it('marque « nouveau » un axe absent de la semaine précédente', () => {
    const axes = suivreLesAxes([doc(['Recrutement', 'FORT'])], [doc(['Cadre', 'FORT'])])

    expect(axes).toHaveLength(1)
    expect(axes[0]?.mouvement).toBe('nouveau')
    expect(axes[0]?.niveauPrécédent).toBeNull()
  })

  it('ne liste pas les axes disparus : l’écran dit ce que la semaine dit', () => {
    const axes = suivreLesAxes([doc(['Cadre', 'MOYEN'])], [doc(['Cadre', 'MOYEN'], ['Parti', 'FORT'])])

    expect(axes.map((axe) => axe.titre)).toEqual(['Cadre'])
  })

  it('retient le niveau le plus fort quand les deux notes portent le même axe', () => {
    const axes = suivreLesAxes([doc(['Cadre', 'RAS']), doc(['Cadre', 'FORT'])], [])

    expect(axes).toHaveLength(1)
    expect(axes[0]?.niveau).toBe('FORT')
  })

  it('sans semaine précédente, tout est nouveau — l’écran s’en sert pour se taire', () => {
    const axes = suivreLesAxes([doc(['Cadre', 'FORT'])], [])

    expect(axes[0]?.mouvement).toBe('nouveau')
  })

  it('un axe sans niveau connu passe en dernier et reste comparable', () => {
    const axes = suivreLesAxes(
      [doc(['Inconnu', null], ['Cadre', 'RAS'])],
      [doc(['Inconnu', null], ['Cadre', 'RAS'])],
    )

    expect(axes.map((axe) => axe.titre)).toEqual(['Cadre', 'Inconnu'])
    expect(axes.map((axe) => axe.mouvement)).toEqual(['stable', 'stable'])
  })
})
