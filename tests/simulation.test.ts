import { describe, expect, it } from 'vitest'
import {
  BORNES_DE_SIMULATION,
  PILIERS,
  cartesDuTirage,
  comparerDeuxStratégies,
  contrôlerLaTableDEffets,
  jouerLaPartie,
  jouerUnTour,
  lireLaPartie,
  partDeLEffort,
  piliersDeDépart,
  prévisionDuTour,
  tirerLesCartes,
  écrireLaPartie,
  étatDeDépart,
  type ContexteDeLaTable,
  type DonnéeDeSimulation,
  type SegmentDeJeu,
  type TableDEffets,
} from '@/lib/domaine/simulation'

const SEGMENTS: SegmentDeJeu[] = [
  { clé: 'seminaires', libellé: 'Séminaires résidentiels', verdict: 'pousser', concurrents: 2 },
  { clé: 'mariages', libellé: 'Mariages', verdict: 'surveiller', concurrents: null },
  { clé: 'retraites', libellé: 'Retraites', verdict: 'disputer', concurrents: 5 },
]

const TABLE: TableDEffets = {
  engagements: [
    { segment: 'seminaires', cran: 2, référence: 'fiche de veille, niches' },
    { segment: 'mariages', cran: 1, référence: 'référentiel §2' },
    { segment: 'retraites', cran: 0, référence: 'référentiel §2' },
  ],
  actions: [
    { clé: 'investir-seminaires', libellé: 'Renforcer l’offre séminaires', geste: 'investir', segment: 'seminaires', coût: 3, effets: { marche: 4 }, référence: 'lettre du 12 octobre 2026' },
    { clé: 'tester-retraites', libellé: 'Tester une offre de retraites', geste: 'tester', segment: 'retraites', coût: 2, effets: { marche: 2, concurrence: -1 }, condition: { sur: 'concurrents', segment: 'retraites', comparaison: 'au-moins', valeur: 4 }, effetsSousCondition: { marche: 1, concurrence: -3 }, référence: 'mesure 2026-T4' },
    { clé: 'retirer-mariages', libellé: 'Se retirer des mariages', geste: 'retirer', segment: 'mariages', coût: 1, effets: { environnement: 2 }, référence: 'référentiel §2' },
    { clé: 'allier-region', libellé: 'Convention avec la Région', geste: 'allier', partiePrenante: 'Région', coût: 2, effets: { alliances: 8 }, référence: 'fiche de veille, sources' },
    { clé: 'veille-renforcee', libellé: 'Renforcer la veille réglementaire', geste: 'option', coût: 1, effets: { environnement: 3 }, référence: 'référentiel §4' },
  ],
  cartes: [
    { clé: 'appel-a-projets', libellé: 'Un appel à projets s’ouvre', famille: 3, veille: 'ecosysteme', effets: { alliances: 3 }, condition: { sur: 'pilier', pilier: 'alliances', comparaison: 'au-moins', valeur: 55 }, effetsSousCondition: { alliances: 6, marche: 2 }, référence: 'fiche de veille, famille 3' },
    { clé: 'nouvel-entrant', libellé: 'Un concurrent ouvre une offre', famille: 1, veille: 'concurrentiel', effets: { concurrence: -5 }, référence: 'lettre du 2 novembre 2026' },
    { clé: 'norme', libellé: 'Une norme se durcit', famille: 5, veille: 'ecosysteme', cadre: 'legal', effets: { environnement: -6 }, référence: 'lettre du 5 octobre 2026' },
    { clé: 'rupture', libellé: 'Une rupture du secteur', rupture: true, effets: { marche: -8, concurrence: -4 }, référence: 'faits marqués en rupture' },
  ],
}

const CONTEXTE: ContexteDeLaTable = {
  segments: SEGMENTS.map((s) => s.clé),
  grille: {
    familles: [
      { numéro: 1, veille: 'concurrentiel' },
      { numéro: 1, veille: 'ecosysteme' },
      { numéro: 3, veille: 'ecosysteme' },
      { numéro: 5, veille: 'ecosysteme' },
    ],
    partiesPrenantes: [{ nom: 'Région' }, { nom: 'Fondation du patrimoine' }],
  } as unknown as ContexteDeLaTable['grille'],
}

const DÉPART = piliersDeDépart({
  segments: SEGMENTS,
  engagements: TABLE.engagements,
  forces: [
    { force: 'rivalite', cran: 2 },
    { force: 'nouveaux_entrants', cran: 1 },
    { force: 'substituts', cran: 3 },
  ],
  dimensionsExposées: ['legal', 'economique', 'legal'],
})

const DONNÉE: DonnéeDeSimulation = {
  segments: SEGMENTS,
  table: TABLE,
  historique: 15,
  observations: [
    { clé: 'appel-a-projets', semaines: 9, faits: 22, dernier: { date: '2026-11-09', source: 'region.example', édition: 'e1' } },
    { clé: 'nouvel-entrant', semaines: 6, faits: 8, dernier: { date: '2026-11-02', source: 'presse.example', édition: 'e2' } },
    { clé: 'norme', semaines: 3, faits: 3, dernier: null },
    { clé: 'rupture', semaines: 1, faits: 1, dernier: null },
  ],
  départ: DÉPART,
}

const codes = (table: TableDEffets) => contrôlerLaTableDEffets(table, CONTEXTE).map((r) => r.code)

describe('la porte de la table d’effets', () => {
  it('accepte une table bien formée', () => {
    expect(contrôlerLaTableDEffets(TABLE, CONTEXTE)).toEqual([])
  })

  it('refuse un effet hors bornes, un pilier inconnu et une ligne qui ne bouge rien', () => {
    const [a, ...reste] = TABLE.actions
    expect(codes({ ...TABLE, actions: [{ ...a!, effets: { marche: 11 } }, ...reste] })).toContain('effet-hors-bornes')
    expect(codes({ ...TABLE, actions: [{ ...a!, effets: { marche: 1.5 } }, ...reste] })).toContain('effet-hors-bornes')
    expect(codes({ ...TABLE, actions: [{ ...a!, effets: {} }, ...reste] })).toContain('effet-hors-bornes')
    expect(codes({ ...TABLE, actions: [{ ...a!, effets: { tresorerie: 2 } as never }, ...reste] })).toContain('pilier-inconnu')
  })

  it('refuse une condition sur un état que le jeu ne connaît pas', () => {
    const [a, ...reste] = TABLE.actions
    expect(codes({ ...TABLE, actions: [{ ...a!, condition: { sur: 'meteo' as never, comparaison: 'au-moins', valeur: 1 }, effetsSousCondition: { marche: 1 } }, ...reste] })).toContain('condition-inconnue')
    expect(codes({ ...TABLE, actions: [{ ...a!, condition: { sur: 'engagement', segment: 'inconnu', comparaison: 'au-moins', valeur: 1 }, effetsSousCondition: { marche: 1 } }, ...reste] })).toContain('segment-inconnu')
    expect(codes({ ...TABLE, actions: [{ ...a!, condition: { sur: 'pilier', pilier: 'marche', comparaison: 'au-plus', valeur: 140 }, effetsSousCondition: { marche: 1 } }, ...reste] })).toContain('condition-inconnue')
    expect(codes({ ...TABLE, actions: [{ ...a!, effetsSousCondition: { marche: 1 } }, ...reste] })).toContain('condition-inconnue')
  })

  it('refuse ce que l’arbre et la grille ne portent pas', () => {
    const [a, b, c, d, ...reste] = TABLE.actions
    expect(codes({ ...TABLE, actions: [{ ...a!, segment: 'croisieres' }, b!, c!, d!, ...reste] })).toContain('segment-inconnu')
    expect(codes({ ...TABLE, actions: [a!, b!, c!, { ...d!, partiePrenante: 'Mairie' }, ...reste] })).toContain('partie-prenante-inconnue')
    expect(codes({ ...TABLE, actions: [{ ...a!, coût: 4 }, b!, c!, d!, ...reste] })).toContain('coût-hors-bornes')
    expect(codes({ ...TABLE, actions: [{ ...a!, geste: 'racheter' as never }, b!, c!, d!, ...reste] })).toContain('geste-inconnu')
    expect(codes({ ...TABLE, actions: [a!, { ...b!, clé: a!.clé }, c!, d!, ...reste] })).toContain('doublon')
    expect(codes({ ...TABLE, actions: [{ ...a!, référence: ' ' }, b!, c!, d!, ...reste] })).toContain('référence-manquante')
  })

  it('refuse une carte sans famille, d’une famille inconnue ou ambiguë', () => {
    const [x, y, ...reste] = TABLE.cartes
    expect(codes({ ...TABLE, cartes: [{ ...x!, famille: null }, y!, ...reste] })).toContain('carte-mal-formée')
    expect(codes({ ...TABLE, cartes: [{ ...x!, famille: 9 }, y!, ...reste] })).toContain('famille-inconnue')
    expect(codes({ ...TABLE, cartes: [x!, { ...y!, veille: null }, ...reste] })).toContain('famille-ambiguë')
    expect(codes({ ...TABLE, cartes: [{ ...x!, cadre: 'meteo' as never }, y!, ...reste] })).toContain('étiquette-inconnue')
    expect(codes({ ...TABLE, cartes: [] })).toContain('table-hors-bornes')
  })

  it('refuse un engagement hors de 0 à 3, en double ou sans référence', () => {
    const [e, ...reste] = TABLE.engagements
    expect(codes({ ...TABLE, engagements: [{ ...e!, cran: 4 }, ...reste] })).toContain('cran-hors-bornes')
    expect(codes({ ...TABLE, engagements: [e!, e!, ...reste] })).toContain('doublon')
    expect(codes({ ...TABLE, engagements: [{ ...e!, référence: '' }, ...reste] })).toContain('référence-manquante')
  })
})

describe('l’état de départ', () => {
  it('lit chaque pilier dans ce qui est mesuré, et dit sa base', () => {
    // Trois crans d'effort, deux sur un segment « à pousser » : 67.
    expect(DÉPART.valeurs.marche).toBe(67)
    // Rivalité au cran 2 (50), nouveaux entrants au cran 1 (0) : 100 − 25.
    expect(DÉPART.valeurs.concurrence).toBe(75)
    // Deux dimensions exposées sur six.
    expect(DÉPART.valeurs.environnement).toBe(67)
    expect(DÉPART.valeurs.alliances).toBe(50)
    for (const p of PILIERS) expect(DÉPART.bases[p].length).toBeGreaterThan(0)
  })

  it('reste neutre sans force mesurée et à zéro sans engagement', () => {
    const vide = piliersDeDépart({ segments: SEGMENTS, engagements: [], forces: [], dimensionsExposées: [] })
    expect(vide.valeurs).toEqual({ marche: 0, concurrence: 50, environnement: 100, alliances: 50 })
    expect(partDeLEffort(SEGMENTS, {})).toBe(0)
  })
})

describe('le tirage', () => {
  it('pèse chaque carte par la part des semaines où la veille l’a vue', () => {
    const cartes = cartesDuTirage(DONNÉE)
    expect(cartes.map((c) => c.poids)).toEqual([9 / 15, 6 / 15, 3 / 15, 1 / 15])
    expect(cartes.reduce((n, c) => n + c.part, 0)).toBeCloseTo(1, 10)
  })

  it('n’ouvre aucune carte sous douze semaines d’historique, ni une carte jamais observée', () => {
    expect(cartesDuTirage({ ...DONNÉE, historique: 11 }).every((c) => c.écartée === 'historique-court' && c.poids === 0)).toBe(true)
    const sans = cartesDuTirage({ ...DONNÉE, observations: DONNÉE.observations.slice(0, 3) })
    expect(sans[3]!.écartée).toBe('jamais-observée')
    expect(tirerLesCartes(cartesDuTirage({ ...DONNÉE, historique: 11 }), 7, 0)).toEqual([])
  })

  it('sur 10 000 tirages, la première carte tirée suit sa probabilité à deux points près', () => {
    const cartes = cartesDuTirage(DONNÉE)
    const comptes = new Map<string, number>()
    const tirages = 10_000
    for (let graine = 1; graine <= tirages; graine++) {
      const première = tirerLesCartes(cartes, graine, graine % 4)[0]!
      comptes.set(première.carte.clé, (comptes.get(première.carte.clé) ?? 0) + 1)
    }
    for (const c of cartes) {
      expect(Math.abs((comptes.get(c.carte.clé) ?? 0) / tirages - c.part)).toBeLessThan(0.02)
    }
  })

  it('ne dépend que de la graine et du tour', () => {
    const cartes = cartesDuTirage(DONNÉE)
    expect(tirerLesCartes(cartes, 4821, 2)).toEqual(tirerLesCartes(cartes, 4821, 2))
    const tirées = tirerLesCartes(cartes, 4821, 2)
    expect(tirées.length).toBeGreaterThanOrEqual(1)
    expect(tirées.length).toBeLessThanOrEqual(BORNES_DE_SIMULATION.cartesParTour)
    expect(new Set(tirées.map((c) => c.carte.clé)).size).toBe(tirées.length)
  })
})

describe('le tour et la partie', () => {
  const PARTIE = { graine: 4821, tours: [['investir-seminaires', 'allier-region'], ['tester-retraites'], ['veille-renforcee', 'retirer-mariages'], []] }

  it('même graine, mêmes actions : même partie, à l’octet', () => {
    expect(JSON.stringify(jouerLaPartie(DONNÉE, PARTIE))).toBe(JSON.stringify(jouerLaPartie(DONNÉE, PARTIE)))
  })

  it('deux stratégies sur la même graine subissent les mêmes cartes', () => {
    const a = jouerLaPartie(DONNÉE, PARTIE).bilans.map((b) => b.cartes.map((c) => c.carte.clé))
    const b = jouerLaPartie(DONNÉE, { graine: 4821, tours: [[], [], [], []] }).bilans.map((x) => x.cartes.map((c) => c.carte.clé))
    expect(a).toEqual(b)
  })

  it('chaque mouvement cite la ligne qui l’a causé, et leur somme fait le bilan', () => {
    const { bilans } = jouerLaPartie(DONNÉE, PARTIE)
    expect(bilans).toHaveLength(4)
    const clés = new Set([...TABLE.actions, ...TABLE.cartes].map((l) => l.clé))
    for (const bilan of bilans) {
      for (const m of bilan.mouvements) expect(clés.has(m.clé)).toBe(true)
      for (const p of PILIERS) {
        const somme = bilan.mouvements.filter((m) => m.pilier === p).reduce((n, m) => n + m.delta, 0)
        expect(bilan.avant[p] + somme).toBe(bilan.après[p])
      }
    }
  })

  it('joue les effets sous condition quand la condition est vraie, et le dit', () => {
    const { bilan } = jouerUnTour({ ...DONNÉE, observations: [] }, étatDeDépart(DONNÉE), ['tester-retraites'], 1)
    const m = bilan.mouvements.filter((x) => x.cause === 'action')
    expect(m.every((x) => x.sousCondition)).toBe(true)
    expect(m.find((x) => x.pilier === 'concurrence')?.delta).toBe(-3)
    // Sans concurrence mesurée, la condition n'est jamais vraie : rien n'est deviné.
    const sansMesure = { ...DONNÉE, observations: [], segments: SEGMENTS.map((s) => ({ ...s, concurrents: null })) }
    const autre = jouerUnTour(sansMesure, étatDeDépart(DONNÉE), ['tester-retraites'], 1).bilan.mouvements.filter((x) => x.cause === 'action')
    expect(autre.every((x) => !x.sousCondition)).toBe(true)
  })

  it('déplace l’effort avec l’engagement, et le pilier Marché le dit à part', () => {
    const { état, bilan } = jouerUnTour({ ...DONNÉE, observations: [] }, étatDeDépart(DONNÉE), ['retirer-mariages'], 1)
    expect(état.engagements.mariages).toBe(0)
    const effort = bilan.mouvements.find((m) => m.cause === 'effort')
    expect(effort?.pilier).toBe('marche')
    expect(effort?.delta).toBe(33)
  })

  it('écarte une action impossible et dit pourquoi, sans la jouer à moitié', () => {
    const état = étatDeDépart(DONNÉE)
    const { bilan } = jouerUnTour(DONNÉE, état, ['investir-seminaires', 'investir-seminaires', 'allier-region', 'tester-retraites', 'inconnue', 'retirer-mariages'], 3)
    expect(bilan.jouées).toEqual(['investir-seminaires', 'allier-region', 'retirer-mariages'])
    expect(bilan.écartées.map((e) => e.raison)).toEqual(['déjà jouée ce trimestre', 'budget du trimestre dépassé', 'action absente de la table'])
    expect(bilan.budgetDépensé).toBe(6)
    const tester = jouerUnTour(DONNÉE, état, ['retirer-mariages', 'retirer-mariages'], 3)
    expect(tester.bilan.jouées).toEqual(['retirer-mariages'])
    const investir = prévisionDuTour(DONNÉE, état, [TABLE.actions[1]!.clé, 'investir-seminaires'])
    expect(investir.jouées).toHaveLength(2)
    expect(prévisionDuTour(DONNÉE, { ...état, engagements: { ...état.engagements, seminaires: 3 } }, ['investir-seminaires']).écartées[0]?.raison).toBe('déjà offre de référence')
  })

  it('la prévision ne tire aucune carte', () => {
    const p = prévisionDuTour(DONNÉE, étatDeDépart(DONNÉE), ['veille-renforcee'])
    expect(p.mouvements.every((m) => m.cause !== 'carte')).toBe(true)
    expect(p.après.environnement).toBe(DÉPART.valeurs.environnement + 3)
  })

  it('aucun pilier ne sort de 0 à 100, quelles que soient les actions', () => {
    const extrême: TableDEffets = {
      ...TABLE,
      actions: TABLE.actions.map((a) => ({ ...a, coût: 1, effets: { marche: 10, concurrence: 10, environnement: 10, alliances: 10 }, condition: null, effetsSousCondition: null })),
      cartes: TABLE.cartes.map((c) => ({ ...c, effets: { marche: -10, concurrence: -10, environnement: -10, alliances: -10 }, condition: null, effetsSousCondition: null })),
    }
    const donnée = { ...DONNÉE, table: extrême }
    const clés = extrême.actions.map((a) => a.clé)
    for (let graine = 1; graine <= 300; graine++) {
      const tours = [0, 1, 2, 3].map((t) => (graine % 2 === 0 ? [] : [clés[(graine + t) % clés.length]!, clés[(graine + t + 1) % clés.length]!]))
      const { bilans } = jouerLaPartie(donnée, { graine, tours })
      for (const b of bilans) for (const p of PILIERS) {
        expect(b.après[p]).toBeGreaterThanOrEqual(0)
        expect(b.après[p]).toBeLessThanOrEqual(100)
      }
    }
  })
})

describe('comparer deux stratégies', () => {
  it('rend des fourchettes ordonnées par pilier, jamais une moyenne seule', () => {
    const r = comparerDeuxStratégies(DONNÉE, [['investir-seminaires', 'allier-region']], [[], ['veille-renforcee']], 200)
    expect(r.parties).toBe(200)
    for (const s of [r.a, r.b]) {
      for (const p of PILIERS) {
        const f = s[p]
        expect(f.min).toBeLessThanOrEqual(f.bas)
        expect(f.bas).toBeLessThanOrEqual(f.médiane)
        expect(f.médiane).toBeLessThanOrEqual(f.haut)
        expect(f.haut).toBeLessThanOrEqual(f.max)
      }
    }
    // L'alliance nouée par A se lit dans sa médiane, à aléas égaux.
    expect(r.a.alliances.médiane).toBeGreaterThan(r.b.alliances.médiane)
    expect(comparerDeuxStratégies(DONNÉE, [['investir-seminaires']], [['investir-seminaires']], 50)).toEqual(comparerDeuxStratégies(DONNÉE, [['investir-seminaires']], [['investir-seminaires']], 50))
  })
})

describe('la partie dans l’adresse', () => {
  it('s’écrit et se relit sans perte', () => {
    const partie = { graine: 4821, tours: [['investir-seminaires', 'allier-region'], ['tester-retraites'], [], ['veille-renforcee']] }
    const texte = écrireLaPartie(partie, TABLE)
    expect(texte).toBe('4821;0.3;1;;4')
    expect(lireLaPartie(texte, TABLE)).toEqual(partie)
  })

  it('ignore ce qu’elle ne reconnaît pas', () => {
    expect(lireLaPartie(null, TABLE)).toBeNull()
    expect(lireLaPartie('abc;0', TABLE)).toBeNull()
    expect(lireLaPartie('12;0.99.x.1;;;;;7', TABLE)).toEqual({ graine: 12, tours: [['investir-seminaires', 'tester-retraites'], [], [], []] })
    expect(lireLaPartie('1;' + '0.'.repeat(300), TABLE)).toBeNull()
  })
})
