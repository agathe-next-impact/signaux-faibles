import { describe, expect, it } from 'vitest'
import {
  libelléDImpact,
  lireTitreDAxe,
  rangDImpact,
  trierParImpact,
} from '@/lib/domaine/impact'

describe('lireTitreDAxe', () => {
  it('lit les trois niveaux de la charte', () => {
    expect(lireTitreDAxe('② Cadre français — FORT')).toEqual({
      axe: 'Cadre français',
      numéro: 2,
      niveau: 'FORT',
    })
    expect(lireTitreDAxe('③ Financements — MOYEN')).toEqual({
      axe: 'Financements',
      numéro: 3,
      niveau: 'MOYEN',
    })
    expect(lireTitreDAxe('⑤ Filière et financement — RAS')).toEqual({
      axe: 'Filière et financement',
      numéro: 5,
      niveau: 'RAS',
    })
  })

  it('ne convertit jamais FAIBLE : suffixe inconnu, titre intact, aucun badge', () => {
    // Le numéro se détache quand même : c'est de la mise en forme, elle ne
    // dépend pas de la reconnaissance du suffixe.
    expect(lireTitreDAxe('⑤ Filière — FAIBLE')).toEqual({
      axe: 'Filière — FAIBLE',
      numéro: 5,
      niveau: null,
    })
  })

  it('laisse intact un titre sans suffixe', () => {
    expect(lireTitreDAxe('Actualités par axe')).toEqual({
      axe: 'Actualités par axe',
      numéro: null,
      niveau: null,
    })
  })

  it('détache les numérotations écrites exprès, jamais un chiffre nu', () => {
    expect(lireTitreDAxe('❸ Recrutement — FORT')).toMatchObject({ axe: 'Recrutement', numéro: 3 })
    expect(lireTitreDAxe('4. Financements — RAS')).toMatchObject({ axe: 'Financements', numéro: 4 })
    expect(lireTitreDAxe('12) Territoires — RAS')).toMatchObject({ axe: 'Territoires', numéro: 12 })
    // « 5G » n'est pas un axe numéroté : le titre reste entier.
    expect(lireTitreDAxe('5G et réseaux — MOYEN')).toMatchObject({
      axe: '5G et réseaux',
      numéro: null,
    })
  })

  it('garde le titre entier quand il se réduit à son numéro', () => {
    expect(lireTitreDAxe('②')).toEqual({ axe: '②', numéro: null, niveau: null })
  })

  it('tolère le tiret demi-cadratin et le trait d’union', () => {
    expect(lireTitreDAxe('Cadre – MOYEN').niveau).toBe('MOYEN')
    expect(lireTitreDAxe('Cadre - RAS').niveau).toBe('RAS')
  })

  it('ne coupe que sur le dernier séparateur', () => {
    expect(lireTitreDAxe('Emploi — formation — FORT')).toEqual({
      axe: 'Emploi — formation',
      numéro: null,
      niveau: 'FORT',
    })
  })

  it('ne produit pas d’axe anonyme quand le titre se réduit au suffixe', () => {
    expect(lireTitreDAxe('— FORT')).toEqual({ axe: '— FORT', numéro: null, niveau: null })
  })

  it('accepte une casse relâchée sur le mot, jamais un autre mot', () => {
    expect(lireTitreDAxe('Cadre — fort').niveau).toBe('FORT')
    expect(lireTitreDAxe('Cadre — FORTE').niveau).toBeNull()
    expect(lireTitreDAxe('Cadre — TRÈS FORT').niveau).toBeNull()
  })
})

describe('trierParImpact', () => {
  it('classe fort, moyen, RAS, puis les suffixes inconnus', () => {
    const axes = [
      { axe: 'd', niveau: null },
      { axe: 'c', niveau: 'RAS' as const },
      { axe: 'a', niveau: 'FORT' as const },
      { axe: 'b', niveau: 'MOYEN' as const },
    ]
    expect(trierParImpact(axes).map((f) => f.axe)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('conserve l’ordre de la note à niveau égal', () => {
    const axes = [
      { axe: 'premier', niveau: 'FORT' as const },
      { axe: 'second', niveau: 'FORT' as const },
    ]
    expect(trierParImpact(axes).map((f) => f.axe)).toEqual(['premier', 'second'])
  })

  it('range un niveau inconnu après les trois niveaux connus', () => {
    expect(rangDImpact(null)).toBeGreaterThan(rangDImpact('RAS'))
  })
})

describe('libelléDImpact', () => {
  it('affiche les libellés de la charte, pas les suffixes de Notion', () => {
    expect(libelléDImpact('FORT')).toBe('signal fort')
    expect(libelléDImpact('MOYEN')).toBe('à surveiller')
    expect(libelléDImpact('RAS')).toBe('RAS')
  })

  it('couvre les trois niveaux et rien d’autre', () => {
    const niveaux = ['FORT', 'MOYEN', 'RAS'] as const
    expect(new Set(niveaux.map(libelléDImpact)).size).toBe(3)
  })
})
