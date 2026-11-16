import { describe, expect, it } from 'vitest'
import {
  aRéussi,
  bornesDuMois,
  dollars,
  duréeLisible,
  estUnMois,
  libelléDeTâche,
  libelléDuMois,
  moisDeParis,
  moisVoisins,
  organisationsDuRun,
  slugsDUnRun,
  totauxDuMois,
  type RunMesuré,
} from '@/lib/domaine/couts'

const run = (plus: Partial<RunMesuré> = {}): RunMesuré => ({
  tâche: 'lettres',
  organisation: null,
  organisations: [],
  issue: 'success',
  coûtUsd: 10,
  plafondUsd: 60,
  duréeMs: 600_000,
  tours: 100,
  runGithub: 1,
  lien: null,
  origine: 'harnais',
  mesuréLe: new Date('2026-11-16T05:00:00Z'),
  ...plus,
})

describe('le mois de Paris', () => {
  it('reconnaît AAAA-MM et rien d’autre', () => {
    expect(estUnMois('2026-11')).toBe(true)
    expect(estUnMois('2026-13')).toBe(false)
    expect(estUnMois('2026-1')).toBe(false)
    expect(estUnMois(undefined)).toBe(false)
    expect(estUnMois('2026-11-01')).toBe(false)
  })

  it('range un instant dans son mois de Paris, pas dans son mois UTC', () => {
    // 31 octobre, 23 h 30 UTC : déjà le 1er novembre à Paris (heure d'hiver, UTC+1).
    expect(moisDeParis(new Date('2026-10-31T23:30:00Z'))).toBe('2026-11')
    expect(moisDeParis(new Date('2026-10-31T22:30:00Z'))).toBe('2026-10')
    // 30 juin, 22 h 30 UTC : déjà le 1er juillet à Paris (heure d'été, UTC+2).
    expect(moisDeParis(new Date('2026-06-30T22:30:00Z'))).toBe('2026-07')
  })

  it('borne un mois de minuit de Paris à minuit de Paris, hiver comme été', () => {
    expect(bornesDuMois('2026-11')).toEqual({ début: new Date('2026-10-31T23:00:00Z'), fin: new Date('2026-11-30T23:00:00Z') })
    expect(bornesDuMois('2026-07')).toEqual({ début: new Date('2026-06-30T22:00:00Z'), fin: new Date('2026-07-31T22:00:00Z') })
    // Le mois du changement d'heure : début à UTC+2, fin à UTC+1.
    expect(bornesDuMois('2026-10')).toEqual({ début: new Date('2026-09-30T22:00:00Z'), fin: new Date('2026-10-31T23:00:00Z') })
    expect(bornesDuMois('2026-12').fin).toEqual(new Date('2026-12-31T23:00:00Z'))
    expect(() => bornesDuMois('novembre')).toThrow()
  })

  it('tout instant tombe dans les bornes de son propre mois', () => {
    for (const iso of ['2026-10-31T23:00:00Z', '2026-11-30T22:59:59Z', '2026-03-29T01:30:00Z', '2026-12-31T23:30:00Z', '2027-01-01T00:00:00Z']) {
      const instant = new Date(iso)
      const { début, fin } = bornesDuMois(moisDeParis(instant))
      expect(instant.getTime(), iso).toBeGreaterThanOrEqual(début.getTime())
      expect(instant.getTime(), iso).toBeLessThan(fin.getTime())
    }
  })

  it('donne les mois voisins et le libellé', () => {
    expect(moisVoisins('2026-11')).toEqual({ précédent: '2026-10', suivant: '2026-12' })
    expect(moisVoisins('2026-01')).toEqual({ précédent: '2025-12', suivant: '2026-02' })
    expect(moisVoisins('2026-12')).toEqual({ précédent: '2026-11', suivant: '2027-01' })
    expect(libelléDuMois('2026-11')).toBe('novembre 2026')
    expect(libelléDuMois('2026-01')).toBe('janvier 2026')
  })
})

describe('les libellés', () => {
  it('nomme les tâches connues et laisse les autres telles quelles', () => {
    expect(libelléDeTâche('premiere-lettre')).toBe('première lettre')
    expect(libelléDeTâche('tache-inconnue')).toBe('tache-inconnue')
  })

  it('écrit les dollars et les durées', () => {
    expect(dollars(15.172).replace(/\s/g, ' ')).toBe('15,17 $')
    expect(dollars(0).replace(/\s/g, ' ')).toBe('0,00 $')
    expect(duréeLisible(null)).toBe('·')
    expect(duréeLisible(45_000)).toBe('45 s')
    expect(duréeLisible(33 * 60_000)).toBe('33 min')
    expect(duréeLisible(65 * 60_000)).toBe('1 h 05')
  })
})

describe('les organisations d’un run', () => {
  it('ramène un nom à son slug, dédoublonne et écarte ce qui ne donne rien', () => {
    expect(slugsDUnRun(['Aquitaine Robotics', 'aquitaine-robotics', 'Éclairion', '  ', '—'])).toEqual(['aquitaine-robotics', 'eclairion'])
    expect(slugsDUnRun(['x'.repeat(121)])).toEqual([])
  })

  it('impute aux organisations traitées, à défaut à celle que le run visait', () => {
    expect(organisationsDuRun({ organisation: null, organisations: ['mastora', 'hermitage', 'mastora'] })).toEqual(['hermitage', 'mastora'])
    expect(organisationsDuRun({ organisation: 'suneido', organisations: [] })).toEqual(['suneido'])
    expect(organisationsDuRun({ organisation: null, organisations: [] })).toEqual([])
  })
})

describe('les totaux du mois', () => {
  it('ne compte comme réussite que l’issue « success »', () => {
    expect(aRéussi({ issue: 'success' })).toBe(true)
    expect(aRéussi({ issue: 'error_max_budget_usd' })).toBe(false)
    expect(aRéussi({ issue: 'echec' })).toBe(false)
  })

  it('somme par tâche, échecs compris, du plus coûteux au moins coûteux', () => {
    const totaux = totauxDuMois([
      run({ tâche: 'lettres', coûtUsd: 18.5, organisations: ['mastora', 'hermitage'] }),
      run({ tâche: 'lettres', coûtUsd: 60, issue: 'error_max_budget_usd', organisations: ['mastora', 'hermitage'] }),
      run({ tâche: 'reconciliation', coûtUsd: 1.2, plafondUsd: 5, duréeMs: 120_000 }),
      run({ tâche: 'premiere-lettre', coûtUsd: 15.172, plafondUsd: 40, organisation: 'aquitaine-robotics', organisations: ['aquitaine-robotics'] }),
    ])
    expect(totaux.runs).toBe(4)
    expect(totaux.échecs).toBe(1)
    expect(totaux.coûtUsd).toBe(94.872)
    expect(totaux.parTâche).toEqual([
      { tâche: 'lettres', runs: 2, échecs: 1, coûtUsd: 78.5, plafondUsd: 120, duréeMs: 1_200_000 },
      { tâche: 'premiere-lettre', runs: 1, échecs: 0, coûtUsd: 15.172, plafondUsd: 40, duréeMs: 600_000 },
      { tâche: 'reconciliation', runs: 1, échecs: 0, coûtUsd: 1.2, plafondUsd: 5, duréeMs: 120_000 },
    ])
  })

  it('impute en entier un run à une organisation, répartit à parts égales un run à plusieurs, et n’attribue pas le reste', () => {
    const totaux = totauxDuMois([
      run({ tâche: 'lettres', coûtUsd: 18, organisations: ['mastora', 'hermitage', 'suneido'] }),
      run({ tâche: 'premiere-lettre', coûtUsd: 15, organisation: 'mastora', organisations: ['mastora'] }),
      run({ tâche: 'etiquetage', coûtUsd: 2, organisation: 'hermitage', organisations: [] }),
      run({ tâche: 'reconciliation', coûtUsd: 1.5 }),
    ])
    expect(totaux.parOrganisation).toEqual([
      { slug: 'mastora', runs: 2, exactUsd: 15, estiméUsd: 6, coûtUsd: 21 },
      { slug: 'hermitage', runs: 2, exactUsd: 2, estiméUsd: 6, coûtUsd: 8 },
      { slug: 'suneido', runs: 1, exactUsd: 0, estiméUsd: 6, coûtUsd: 6 },
    ])
    expect(totaux.répartiUsd).toBe(18)
    expect(totaux.nonAttribuéUsd).toBe(1.5)
    // Rien ne se perd : attribué + non attribué = total.
    const attribué = totaux.parOrganisation.reduce((t, o) => t + o.coûtUsd, 0)
    expect(Math.round((attribué + totaux.nonAttribuéUsd) * 100) / 100).toBe(totaux.coûtUsd)
  })

  it('un mois sans run donne des totaux à zéro', () => {
    expect(totauxDuMois([])).toEqual({ runs: 0, échecs: 0, coûtUsd: 0, parTâche: [], parOrganisation: [], nonAttribuéUsd: 0, répartiUsd: 0 })
  })
})
