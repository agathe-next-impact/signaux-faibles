import { describe, expect, it, vi } from 'vitest'
import {
  benchmarkDesFiches,
  contrôlerLesParamètresDuCycle,
  entitésDuBenchmark,
  indiceDeCycle,
  périodesDuCycle,
  rendreLaSynthèse,
  type Grille,
} from '@/lib/domaine/strategie'
import { calculer } from '@/lib/portail/calculs'
import { clauseBodacc, compterLesAnnonces, ficheChiffrée, fichesChiffrées } from '@/lib/registres'

const GRILLE: Grille = {
  axesGroupes: [],
  familles: [{ numéro: 5, veille: 'concurrentiel', pestel: null, porter: 'nouveaux_entrants', cadence: 'hebdomadaire' }],
  entités: [
    { nom: 'ISCOD', veille: 'concurrentiel', siren: '888777265' },
    { nom: 'Studi', veille: 'concurrentiel', siren: '911148369' },
    { nom: 'Excellence Business School', veille: 'concurrentiel', siren: null },
    { nom: 'Mastora', veille: 'concurrentiel', siren: '984299941' },
    { nom: 'Doublon ISCOD', veille: 'ecosysteme', siren: '888777265' },
  ],
  partiesPrenantes: [],
}

const json = (corps: unknown, statut = 200) => new Response(JSON.stringify(corps), { status: statut, headers: { 'content-type': 'application/json' } })

describe('périodes et paramètres de l’indice de cycle de vie', () => {
  it('compare les douze mois qui finissent à la fin de la fenêtre aux douze précédents, bornes de fin exclues', () => {
    expect(périodesDuCycle('2026-12-31')).toEqual({
      courante: { du: '2026-01-01', au: '2027-01-01' },
      précédente: { du: '2025-01-01', au: '2026-01-01' },
    })
    // Le 29 février 2028 moins un an tombe le 1er mars 2027 : douze mois pleins, pas un jour de plus.
    expect(périodesDuCycle('2028-02-28').courante).toEqual({ du: '2027-03-01', au: '2028-02-29' })
  })

  it('refuse des départements ou un texte hors des bornes', () => {
    expect(contrôlerLesParamètresDuCycle({ départements: ['75', '2A', '974'], texte: 'formation commerciale' })).toEqual([])
    const codes = contrôlerLesParamètresDuCycle({ départements: ['750', 'Paris'], texte: 'ab' }).map((r) => r.code)
    expect(codes).toEqual(['département-invalide', 'département-invalide', 'texte-hors-bornes'])
    expect(contrôlerLesParamètresDuCycle({ départements: [], texte: 'formation' }).map((r) => r.code)).toEqual(['départements-hors-bornes'])
  })
})

describe('indiceDeCycle', () => {
  const p = { départements: ['75'], texte: 'école de vente' }
  it('compte, sans juger : solde, ratio, évolution sur un an', () => {
    const i = indiceDeCycle(p, '2026-12-31', { entrées: 30, sorties: 12, entréesAvant: 25, sortiesAvant: 8 }, '2027-01-04T17:00:00.000Z')
    expect(i).toMatchObject({
      période: { du: '2026-01-01', au: '2026-12-31' },
      périodePrécédente: { du: '2025-01-01', au: '2025-12-31' },
      entrées: 30,
      sorties: 12,
      solde: 18,
      ratio: 2.5,
      évolutionDesEntrées: 20,
      évolutionDesSorties: 50,
    })
    expect(i.limites).toHaveLength(2)
  })

  it('un compte qui n’a pas répondu vaut n.d., jamais zéro, et le dit', () => {
    const i = indiceDeCycle(p, '2026-12-31', { entrées: null, sorties: 0, entréesAvant: 0, sortiesAvant: null }, 'x')
    expect(i).toMatchObject({ solde: null, ratio: null, évolutionDesEntrées: null, évolutionDesSorties: null })
    expect(i.limites.at(-1)).toContain('n.d.')
  })
})

describe('benchmark', () => {
  it('l’organisation d’abord, une entité par SIREN, sans SIREN écartée, au plus quinze', () => {
    expect(entitésDuBenchmark(GRILLE, 'Mastora').map((e) => e.nom)).toEqual(['Mastora', 'ISCOD', 'Studi'])
    expect(entitésDuBenchmark(GRILLE, 'Mastora', 2)).toHaveLength(2)
  })

  it('médiane et rang sur les seuls chiffres publiés ; une fiche absente vaut n.d.', () => {
    const entités = entitésDuBenchmark(GRILLE, 'Mastora')
    const fiches = new Map([
      ['984299941', { active: true, trancheEffectif: '01', année: '2025', chiffreDAffaires: 400_000, résultatNet: 20_000 }],
      ['888777265', { active: true, trancheEffectif: '42', année: '2024', chiffreDAffaires: 9_000_000, résultatNet: null }],
      ['911148369', null],
    ])
    const b = benchmarkDesFiches(entités, fiches, 'Mastora', 'x')
    expect(b).toMatchObject({ avecComptes: 2, sansComptes: 1, médianeDuChiffreDAffaires: 4_700_000, rangDeLOrganisation: 2 })
    expect(b.lignes.find((l) => l.siren === '911148369')).toMatchObject({ fiche: 'n.d.', chiffreDAffaires: null })
    expect(b.limites.join(' ')).toContain('Exercices différents')
    expect(b.limites.join(' ')).toContain('fiches n.d.')
  })
})

describe('registres : compter et chiffrer', () => {
  it('borne la période par une date de fin exclue', () => {
    expect(clauseBodacc({ depuis: '2026-01-01', jusqua: '2027-01-01', departements: ['75'], familles: ['collective'] })).toBe(
      `dateparution >= date'2026-01-01' and dateparution < date'2027-01-01' and familleavis in ("collective") and numerodepartement in ("75")`,
    )
    expect(() => clauseBodacc({ depuis: '2026-01-01', jusqua: '2027', departements: ['75'] })).toThrow()
  })

  it('compte par total_count, sans lire les annonces', async () => {
    const f = vi.fn(async (_url: string) => json({ total_count: 42, results: [{}] }))
    expect(await compterLesAnnonces({ depuis: '2026-01-01', departements: ['75'] }, f as unknown as typeof fetch)).toBe(42)
    expect(new URL(f.mock.calls[0]![0]).searchParams.get('limit')).toBe('1')
    await expect(compterLesAnnonces({ depuis: '2026-01-01', departements: ['75'] }, (async () => json({}, 500)) as unknown as typeof fetch)).rejects.toThrow('HTTP 500')
  })

  it('une fiche réduite à ses chiffres : le dernier exercice, n.d. sans comptes', () => {
    expect(
      ficheChiffrée({ siren: '984299941', nom_complet: 'MASTORA', etat_administratif: 'A', tranche_effectif_salarie: '01', finances: { '2024': { ca: 1, resultat_net: 2 }, '2025': { ca: 300, resultat_net: -5 } } }),
    ).toEqual({ siren: '984299941', nom: 'MASTORA', active: true, trancheEffectif: '01', année: '2025', chiffreDAffaires: 300, résultatNet: -5 })
    expect(ficheChiffrée({ siren: '1', etat_administratif: 'C' })).toMatchObject({ active: false, année: null, chiffreDAffaires: null })
  })

  it('au-delà de l’échéance, les fiches restantes valent n.d. sans appel', async () => {
    let t = 0
    const f = vi.fn(async (url: string) => {
      t += 3_000
      return json({ results: [{ siren: new URL(url).searchParams.get('q'), nom_complet: 'X', etat_administratif: 'A' }] })
    })
    const fiches = await fichesChiffrées(['888777265', '911148369', '984299941'], { f: f as unknown as typeof fetch, attente: async () => {}, échéance: 5_000, maintenant: () => t })
    expect(f).toHaveBeenCalledTimes(2)
    expect(fiches.get('888777265')).toMatchObject({ nom: 'X' })
    expect(fiches.get('984299941')).toBeNull()
  })
})

describe('calculer', () => {
  it('quatre comptes BODACC et les fiches de la grille ; une API muette vaut n.d.', async () => {
    const f = vi.fn(async (url: string) => {
      const u = new URL(url)
      if (u.hostname.startsWith('bodacc')) {
        const where = u.searchParams.get('where') ?? ''
        if (where.includes('2025-01-01')) return json({}, 503)
        return json({ total_count: where.includes('collective') ? 4 : 10 })
      }
      return json({ results: [{ siren: u.searchParams.get('q'), nom_complet: 'Y', etat_administratif: 'A', finances: { '2025': { ca: 100 } } }] })
    })
    const c = await calculer(
      { grille: GRILLE, organisation: 'Mastora', fin: '2026-12-31', cycle: { départements: ['75'], texte: 'école de vente' } },
      { f: f as unknown as typeof fetch, attente: async () => {}, maintenant: () => Date.parse('2027-01-04T17:00:00Z') },
    )
    expect(c.indice).toMatchObject({ entrées: 10, sorties: 4, entréesAvant: null, sortiesAvant: null, solde: 6, ratio: 2.5 })
    expect(c.benchmark).toMatchObject({ avecComptes: 3, rangDeLOrganisation: 1 })
    expect(f).toHaveBeenCalledTimes(7)
  })

  it('sans paramètres du cycle, pas d’indice et aucun appel au BODACC', async () => {
    const f = vi.fn(async (_url: string) => json({ results: [] }))
    const c = await calculer({ grille: GRILLE, organisation: 'Mastora', fin: '2026-12-31', cycle: null }, { f: f as unknown as typeof fetch, attente: async () => {} })
    expect(c.indice).toBeNull()
    expect(f.mock.calls.every(([url]) => !String(url).includes('bodacc'))).toBe(true)
  })
})

describe('rendu des chiffres', () => {
  it('l’indice et le benchmark sont rendus à côté de leur interprétation', () => {
    const indice = indiceDeCycle({ départements: ['75'], texte: 'école de vente' }, '2026-12-31', { entrées: 30, sorties: 12, entréesAvant: 25, sortiesAvant: 8 }, 'x')
    const texte = rendreLaSynthèse({
      organisation: 'mastora',
      période: '2026-T4',
      fenêtre: { début: '2026-10-01', fin: '2026-12-31' },
      grilleVersion: 1,
      grille: GRILLE,
      éléments: [
        { id: 'a', outil: 'indice_cycle', clé: 'indice_cycle', rang: 1, énoncé: 'Le marché attire encore.', état: null, origine: 'faits', hypothèse: false, faits: [], références: {}, candidateRecommandation: false, valeur: indice },
        { id: 'b', outil: 'benchmark', clé: 'benchmark', rang: 1, énoncé: null, état: null, origine: 'faits', hypothèse: false, faits: [], références: {}, candidateRecommandation: false, valeur: null },
      ],
      positions: [],
      faits: new Map(),
    })
    expect(texte).toContain('30 entrées (créations et immatriculations), 12 procédures collectives, solde 18, 2,5 entrées pour une sortie')
    expect(texte).toContain('entrées +20 % (25 l’année précédente)')
    expect(texte).toContain('- Interprétation : Le marché attire encore.')
    expect(texte).toContain('- Interprétation : aucune, le chiffre seul est gardé')
  })
})
