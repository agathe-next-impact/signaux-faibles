import { describe, expect, it } from 'vitest'
import { instantÀParis } from '@/lib/domaine/calendrier'
import { familleDuType, jourDeParution, parutionsÀPlanifier, type VeilleÀPlanifier } from '@/lib/domaine/file'

const hebdo: VeilleÀPlanifier = { id: 'h', type: 'ecosysteme', jourParution: 5, heureParution: '06:30:00', cadence: 'hebdomadaire' }
const quinzaine: VeilleÀPlanifier = { id: 'q', type: 'concurrentielle', jourParution: 4, heureParution: '07:00', cadence: 'bimensuelle' }
const mensuelle: VeilleÀPlanifier = { id: 'm', type: 'ecosysteme', jourParution: 1, heureParution: '08:00', cadence: 'mensuelle' }

describe('parutionsÀPlanifier', () => {
  it('une parution hebdomadaire par semaine, dans l’horizon de sept jours, aujourd’hui compris', () => {
    // Le 21 octobre 2026 est un mercredi : le vendredi 23 tombe dans l'horizon, le vendredi 30 non.
    expect(parutionsÀPlanifier([hebdo], '2026-10-21')).toEqual([{ veilleId: 'h', date: '2026-10-23', semaine: '2026-10-19' }])
    // Un vendredi : la parution du jour est planifiée, pas celle de la semaine suivante.
    expect(parutionsÀPlanifier([hebdo], '2026-10-23').map((p) => p.date)).toEqual(['2026-10-23'])
    expect(parutionsÀPlanifier([hebdo], '2026-10-24').map((p) => p.date)).toEqual(['2026-10-30'])
  })

  it('suit la cadence : quinzaine en semaine paire, mensuelle à la première occurrence', () => {
    // Jeudi 22 octobre 2026 : semaine ISO 43, impaire. Jeudi 29 : semaine 44, paire.
    expect(parutionsÀPlanifier([quinzaine], '2026-10-22').map((p) => p.date)).toEqual([])
    expect(parutionsÀPlanifier([quinzaine], '2026-10-29').map((p) => p.date)).toEqual(['2026-10-29'])
    // Lundi 2 novembre 2026 : première occurrence du mois. Lundi 9 : non.
    expect(parutionsÀPlanifier([mensuelle], '2026-11-02').map((p) => p.date)).toEqual(['2026-11-02'])
    expect(parutionsÀPlanifier([mensuelle], '2026-11-09').map((p) => p.date)).toEqual([])
  })

  it('ordonne par date, puis par veille', () => {
    const dates = parutionsÀPlanifier([hebdo, quinzaine, mensuelle], '2026-10-26', 14).map((p) => `${p.date} ${p.veilleId}`)
    expect(dates).toEqual(['2026-10-29 q', '2026-10-30 h', '2026-11-02 m', '2026-11-06 h'])
  })

  it('refuse un jour hors de 1 à 7', () => {
    expect(() => jourDeParution({ jourParution: 8 })).toThrow()
    expect(jourDeParution({ jourParution: 7 })).toBe('Dimanche')
  })
})

describe('familleDuType', () => {
  it('traduit les deux types connus, et rien d’autre', () => {
    expect(familleDuType('ecosysteme')).toBe('Écosystème')
    expect(familleDuType('concurrentielle')).toBe('Concurrentiel')
    expect(familleDuType('reglementaire')).toBeNull()
  })
})

describe('instantÀParis', () => {
  it('heure d’été : 06:30 à Paris est 04:30 UTC', () => {
    expect(instantÀParis('2026-10-23', '06:30').toISOString()).toBe('2026-10-23T04:30:00.000Z')
  })
  it('heure d’hiver : 06:30 à Paris est 05:30 UTC', () => {
    expect(instantÀParis('2026-10-30', '06:30:00').toISOString()).toBe('2026-10-30T05:30:00.000Z')
  })
  it('le jour du changement d’heure (25 octobre 2026), l’après-midi est déjà à l’heure d’hiver', () => {
    expect(instantÀParis('2026-10-25', '01:30').toISOString()).toBe('2026-10-24T23:30:00.000Z')
    expect(instantÀParis('2026-10-25', '15:00').toISOString()).toBe('2026-10-25T14:00:00.000Z')
  })
  it('refuse une date ou une heure inexploitable', () => {
    expect(() => instantÀParis('2026-13-01', '06:30')).toThrow()
    expect(() => instantÀParis('2026-10-23', 'six heures')).toThrow()
  })
})
