
import { describe, expect, it } from 'vitest'
import {
  estUneDateISO,
  libelléDeSemaine,
  lundiDeLaSemaine,
  regrouperParSemaine,
} from '@/lib/domaine/semaines'
import { estVeilleConcurrentielle } from '@/lib/portail/semaine'

describe('lundiDeLaSemaine', () => {
  it('renvoie le lundi lui-même', () => {
    expect(lundiDeLaSemaine('2026-09-07')).toBe('2026-09-07')
  })

  it('ramène un mercredi au lundi précédent', () => {
    expect(lundiDeLaSemaine('2026-09-09')).toBe('2026-09-07')
  })

  it('ramène un dimanche au lundi de la même semaine ISO, pas au lendemain', () => {
    // 2026-07-26 est un dimanche : sa semaine ISO commence le 20 juillet.
    expect(lundiDeLaSemaine('2026-07-26')).toBe('2026-07-20')
  })

  it('franchit un changement de mois', () => {
    expect(lundiDeLaSemaine('2026-09-01')).toBe('2026-08-31')
  })

  it('franchit un changement d’année', () => {
    expect(lundiDeLaSemaine('2027-01-01')).toBe('2026-12-28')
  })

  it('refuse une date inexploitable', () => {
    expect(() => lundiDeLaSemaine('2026-02-30')).toThrow()
    expect(() => lundiDeLaSemaine('pas une date')).toThrow()
  })
})

describe('estUneDateISO', () => {
  it('rejette les dates calendaires impossibles', () => {
    expect(estUneDateISO('2026-13-01')).toBe(false)
    expect(estUneDateISO('2026-02-30')).toBe(false)
    expect(estUneDateISO('2026-9-7')).toBe(false)
    expect(estUneDateISO('2026-09-07')).toBe(true)
  })
})

describe('libelléDeSemaine', () => {
  it('écrit en sentence case, avec « 1er » le premier du mois', () => {
    expect(libelléDeSemaine('2026-09-07')).toBe('semaine du 7 septembre 2026')
    expect(libelléDeSemaine('2026-06-01')).toBe('semaine du 1er juin 2026')
  })
})

describe('regrouperParSemaine', () => {
  it('rassemble les deux veilles d’une même semaine en une seule entrée', () => {
    const semaines = regrouperParSemaine([
      { dateÉdition: '2026-09-07', veille: 'Écosystème' },
      { dateÉdition: '2026-09-07', veille: 'Concurrentiel' },
    ])
    expect(semaines).toHaveLength(1)
    expect(semaines[0]?.éditions).toHaveLength(2)
  })

  it('classe les semaines de la plus récente à la plus ancienne', () => {
    const semaines = regrouperParSemaine([
      { dateÉdition: '2026-07-22' },
      { dateÉdition: '2026-09-07' },
      { dateÉdition: '2026-08-04' },
    ])
    expect(semaines.map((s) => s.clé)).toEqual(['2026-09-07', '2026-08-03', '2026-07-20'])
  })

  it('ne lisse pas les semaines de juillet, où le rythme était quasi quotidien', () => {
    // 22, 24 et 26 juillet 2026 tombent dans la même semaine ISO.
    const semaines = regrouperParSemaine([
      { dateÉdition: '2026-07-22' },
      { dateÉdition: '2026-07-24' },
      { dateÉdition: '2026-07-26' },
    ])
    expect(semaines).toHaveLength(1)
    expect(semaines[0]?.éditions).toHaveLength(3)
  })

  it('écarte une édition dont la date est inexploitable plutôt que de l’attribuer au hasard', () => {
    const semaines = regrouperParSemaine([
      { dateÉdition: '2026-09-07' },
      { dateÉdition: '' },
    ])
    expect(semaines).toHaveLength(1)
    expect(semaines[0]?.éditions).toHaveLength(1)
  })

  it('ne renvoie rien pour une liste vide', () => {
    expect(regrouperParSemaine([])).toEqual([])
  })
})

describe('estVeilleConcurrentielle', () => {
  it('reconnaît la veille concurrentielle, accents et casse compris', () => {
    expect(estVeilleConcurrentielle('Concurrentiel')).toBe(true)
    expect(estVeilleConcurrentielle('concurrentielle')).toBe(true)
    expect(estVeilleConcurrentielle('Concurrentiel — marché')).toBe(true)
  })

  it('ne se laisse pas prendre par les autres veilles', () => {
    expect(estVeilleConcurrentielle('Écosystème')).toBe(false)
    expect(estVeilleConcurrentielle('Positionnement')).toBe(false)
    expect(estVeilleConcurrentielle('Attractivité')).toBe(false)
    // Sans valeur, la vue concurrents se tait plutôt que de montrer la
    // mauvaise lettre.
    expect(estVeilleConcurrentielle(null)).toBe(false)
  })
})
