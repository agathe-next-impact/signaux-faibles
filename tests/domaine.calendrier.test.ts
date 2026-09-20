import { describe, expect, it } from 'vitest'
import {
  aujourdHuiÀParis,
  dater,
  décaler,
  ordonner,
  paraîtLe,
  premièreParutionDuMois,
  prochainesParutions,
  sélectionner,
  type OrganisationÀDater,
} from '@/lib/domaine/calendrier'

const hermitage: OrganisationÀDater = { slug: 'hermitage', jour: 'Lundi', cadence: 'Hebdomadaire', heure: '6 h 30' }
const konica: OrganisationÀDater = { slug: 'konica', jour: 'Jeudi', cadence: 'Hebdomadaire', heure: '6 h 00' }
const dalious: OrganisationÀDater = { slug: 'dalious', jour: 'Jeudi', cadence: 'Hebdomadaire', heure: '7 h 30' }
const quinzaine: OrganisationÀDater = { slug: 'q', jour: 'Jeudi', cadence: 'Quinzaine (semaines paires)' }
const mensuelle: OrganisationÀDater = { slug: 'm', jour: 'Lundi', cadence: 'Mensuelle (1re occurrence du mois)' }

describe('dater', () => {
  it('établit jour, quantième et semaine ISO — le 17 septembre 2026 est un jeudi de la semaine 38', () => {
    expect(dater('2026-09-17')).toEqual({
      date: '2026-09-17',
      jour: 'Jeudi',
      quantième: 17,
      semaineISO: 38,
      annéeISO: 2026,
      semainePaire: true,
    })
  })

  it('place le dimanche en fin de semaine et non à zéro', () => {
    expect(dater('2026-09-20').jour).toBe('Dimanche')
    expect(dater('2026-09-21').jour).toBe('Lundi')
  })

  it('tient les bords d’année ISO — le 1er janvier 2027 est en semaine 53 de 2026', () => {
    const d = dater('2027-01-01')
    expect(d.jour).toBe('Vendredi')
    expect(d.semaineISO).toBe(53)
    expect(d.annéeISO).toBe(2026)
    expect(dater('2027-01-04').semaineISO).toBe(1)
  })

  it('refuse une date impossible', () => {
    expect(() => dater('2026-02-30')).toThrow()
  })
})

describe('règle de parution', () => {
  it('hebdomadaire : le jour, toujours', () => {
    expect(paraîtLe(hermitage, dater('2026-09-14'))).toBe(true)
    expect(paraîtLe(hermitage, dater('2026-09-21'))).toBe(true)
    expect(paraîtLe(hermitage, dater('2026-09-17'))).toBe(false)
  })

  it('quinzaine : le jour, en semaine ISO paire seulement', () => {
    expect(paraîtLe(quinzaine, dater('2026-09-17'))).toBe(true) // semaine 38
    expect(paraîtLe(quinzaine, dater('2026-09-24'))).toBe(false) // semaine 39
  })

  it('mensuelle : le jour, quantième ≤ 7 seulement', () => {
    expect(paraîtLe(mensuelle, dater('2026-10-05'))).toBe(true)
    expect(paraîtLe(mensuelle, dater('2026-10-12'))).toBe(false)
  })
})

describe('règle de la revue mensuelle', () => {
  it('hebdomadaire : première occurrence du jour dans le mois', () => {
    expect(premièreParutionDuMois(hermitage, dater('2026-10-05'))).toBe(true)
    expect(premièreParutionDuMois(hermitage, dater('2026-10-12'))).toBe(false)
  })

  it('quinzaine : la première semaine paire du mois', () => {
    expect(premièreParutionDuMois(quinzaine, dater('2026-10-01'))).toBe(true) // jeudi, semaine 40
    expect(premièreParutionDuMois(quinzaine, dater('2026-10-15'))).toBe(false)
  })

  it('quinzaine, janvier 2027 : deux semaines impaires se suivent (S53 puis S1), la première parution tombe le 15', () => {
    const vendredi: OrganisationÀDater = { slug: 'v', jour: 'Vendredi', cadence: 'Quinzaine (semaines paires)' }
    expect(paraîtLe(vendredi, dater('2026-12-25'))).toBe(true) // semaine 52
    expect(paraîtLe(vendredi, dater('2027-01-01'))).toBe(false) // semaine 53 de 2026
    expect(paraîtLe(vendredi, dater('2027-01-08'))).toBe(false) // semaine 1 de 2027
    expect(paraîtLe(vendredi, dater('2027-01-15'))).toBe(true) // semaine 2
    // L'arithmétique « quantième ≤ 14 » aurait refusé cette revue ; la règle dérivée la trouve.
    expect(premièreParutionDuMois(vendredi, dater('2027-01-15'))).toBe(true)
    expect(premièreParutionDuMois(vendredi, dater('2027-01-29'))).toBe(false)
  })

  it('mensuelle : la seule parution du mois est toujours la première', () => {
    expect(premièreParutionDuMois(mensuelle, dater('2026-10-05'))).toBe(true)
    expect(premièreParutionDuMois(mensuelle, dater('2026-10-12'))).toBe(false)
  })
})

describe('sélectionner', () => {
  const registre = [hermitage, konica, dalious, quinzaine, mensuelle]

  it('le jeudi 17 septembre 2026 : Konica puis Dalious par heure, la quinzaine, pas L’Hermitage', () => {
    const s = sélectionner(registre, '2026-09-17')
    // Sans heure de parution, la quinzaine passe après les deux autres.
    expect(s.parutions.map((o) => o.slug)).toEqual(['konica', 'dalious', 'q'])
    expect(s.revuesDues).toEqual([])
  })

  it('le dimanche 4 octobre 2026 au soir : revue due pour les parutions du lundi 5', () => {
    const s = sélectionner(registre, '2026-10-04')
    expect(s.parutions).toEqual([])
    expect(s.revuesDues.map((o) => o.slug)).toEqual(['hermitage', 'm'])
  })

  it('donne la prochaine parution de chacun, la plus proche d’abord', () => {
    const s = sélectionner([hermitage, konica], '2026-09-17')
    expect(s.prochaines).toEqual([
      { slug: 'hermitage', date: '2026-09-21', jour: 'Lundi' },
      { slug: 'konica', date: '2026-09-24', jour: 'Jeudi' },
    ])
  })

  it('une mensuelle dont l’occurrence vient de passer attend le mois suivant', () => {
    expect(prochainesParutions([mensuelle], '2026-09-08')).toEqual([
      { slug: 'm', date: '2026-10-05', jour: 'Lundi' },
    ])
  })
})

describe('ordonner et décaler', () => {
  it('trie par heure de parution puis par slug, les sans-heure en dernier', () => {
    const sans: OrganisationÀDater = { slug: 'a', jour: 'Jeudi', cadence: 'Hebdomadaire' }
    expect(ordonner([dalious, sans, konica]).map((o) => o.slug)).toEqual(['konica', 'dalious', 'a'])
  })

  it('décale en jours calendaires, en UTC, sans dérive de fuseau', () => {
    expect(décaler('2026-09-30', 1)).toBe('2026-10-01')
    expect(décaler('2026-03-29', 1)).toBe('2026-03-30')
  })

  it('aujourdHuiÀParis rend une date ISO dans le fuseau de Paris', () => {
    // 23 h 30 UTC le 16 → déjà le 17 à Paris (UTC+2 en septembre).
    expect(aujourdHuiÀParis(new Date('2026-09-16T23:30:00Z'))).toBe('2026-09-17')
    expect(aujourdHuiÀParis(new Date('2026-09-17T04:05:00Z'))).toBe('2026-09-17')
  })
})
