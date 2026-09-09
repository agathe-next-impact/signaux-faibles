import { describe, expect, it } from 'vitest'
import {
  lireTitreDeFamille,
  rangDImpact,
  trierParImpact,
} from '@/lib/domaine/impact'

describe('lireTitreDeFamille', () => {
  it('lit les trois niveaux de la charte', () => {
    expect(lireTitreDeFamille('② Cadre français — FORT')).toEqual({
      famille: '② Cadre français',
      niveau: 'FORT',
    })
    expect(lireTitreDeFamille('③ Financements — MOYEN')).toEqual({
      famille: '③ Financements',
      niveau: 'MOYEN',
    })
    expect(lireTitreDeFamille('⑤ Filière et financement — RAS')).toEqual({
      famille: '⑤ Filière et financement',
      niveau: 'RAS',
    })
  })

  it('ne convertit jamais FAIBLE : suffixe inconnu, titre intact, aucun badge', () => {
    expect(lireTitreDeFamille('⑤ Filière — FAIBLE')).toEqual({
      famille: '⑤ Filière — FAIBLE',
      niveau: null,
    })
  })

  it('laisse intact un titre sans suffixe', () => {
    expect(lireTitreDeFamille('Actualités par famille')).toEqual({
      famille: 'Actualités par famille',
      niveau: null,
    })
  })

  it('tolère le tiret demi-cadratin et le trait d’union', () => {
    expect(lireTitreDeFamille('Cadre – MOYEN').niveau).toBe('MOYEN')
    expect(lireTitreDeFamille('Cadre - RAS').niveau).toBe('RAS')
  })

  it('ne coupe que sur le dernier séparateur', () => {
    expect(lireTitreDeFamille('Emploi — formation — FORT')).toEqual({
      famille: 'Emploi — formation',
      niveau: 'FORT',
    })
  })

  it('ne produit pas de famille anonyme quand le titre se réduit au suffixe', () => {
    expect(lireTitreDeFamille('— FORT')).toEqual({ famille: '— FORT', niveau: null })
  })

  it('accepte une casse relâchée sur le mot, jamais un autre mot', () => {
    expect(lireTitreDeFamille('Cadre — fort').niveau).toBe('FORT')
    expect(lireTitreDeFamille('Cadre — FORTE').niveau).toBeNull()
    expect(lireTitreDeFamille('Cadre — TRÈS FORT').niveau).toBeNull()
  })
})

describe('trierParImpact', () => {
  it('classe fort, moyen, RAS, puis les suffixes inconnus', () => {
    const familles = [
      { famille: 'd', niveau: null },
      { famille: 'c', niveau: 'RAS' as const },
      { famille: 'a', niveau: 'FORT' as const },
      { famille: 'b', niveau: 'MOYEN' as const },
    ]
    expect(trierParImpact(familles).map((f) => f.famille)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('conserve l’ordre de la note à niveau égal', () => {
    const familles = [
      { famille: 'premier', niveau: 'FORT' as const },
      { famille: 'second', niveau: 'FORT' as const },
    ]
    expect(trierParImpact(familles).map((f) => f.famille)).toEqual(['premier', 'second'])
  })

  it('range un niveau inconnu après les trois niveaux connus', () => {
    expect(rangDImpact(null)).toBeGreaterThan(rangDImpact('RAS'))
  })
})
