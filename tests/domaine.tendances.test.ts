import { describe, expect, it } from 'vitest'
import { regrouperParSemaine } from '@/lib/domaine/semaines'
import { suivreLesDossiers } from '@/lib/domaine/tendances'

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
