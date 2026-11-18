import { describe, expect, it } from 'vitest'
import {
  ÉCRANS_DE_L_ESPACE,
  LIBELLÉ_COURT_MAX,
  NOM_D_ÉCRAN_MAX,
  casesRenommées,
  libelléCourtDe,
  nomDÉcranValide,
  nomsDesÉcransConnus,
  nomsDuFormulaire,
  estÉcranDésactivable,
  libellésDesÉcrans,
  masquésDuFormulaire,
  sansLesÉcransMasqués,
  écranDeLAdresse,
  écransMasquésConnus,
} from '@/lib/domaine/ecrans-de-l-espace'
import { ongletsDe } from '@/lib/portail/semaine'
import { casesDuTableauDeBord } from '@/lib/domaine/tableau-de-bord'

const COMPTES = { lettres: 2, recommandations: 1, archives: 5 }

describe('les écrans de l’espace que l’opératrice active ou désactive', () => {
  it('la vue d’ensemble ne se masque pas ; les clés sont uniques', () => {
    expect(estÉcranDésactivable('vue-d-ensemble')).toBe(false)
    expect(estÉcranDésactivable('marches')).toBe(true)
    expect(estÉcranDésactivable('inconnu')).toBe(false)
    const clés = ÉCRANS_DE_L_ESPACE.map((é) => é.clé)
    expect(new Set(clés).size).toBe(clés.length)
    expect(ÉCRANS_DE_L_ESPACE.filter((é) => é.classique).map((é) => é.clé)).toEqual([
      'vue-d-ensemble',
      'lettres',
      'acteurs',
      'axes',
      'recommandations',
      'perimetre',
      'archives',
    ])
  })

  it('chaque onglet du rail, réorganisé ou non, désigne un écran connu', () => {
    for (const réorganisé of [true, false]) {
      for (const onglet of ongletsDe('hermitage', COMPTES, 'complète', { réorganisé, appels: true })) {
        expect(écranDeLAdresse('hermitage', onglet.href), onglet.href).not.toBeNull()
      }
    }
  })

  it('l’adresse d’un détail désigne l’écran de sa liste, le segment le plus long gagne', () => {
    expect(écranDeLAdresse('cci', '/cci')).toBe('vue-d-ensemble')
    expect(écranDeLAdresse('cci', '/cci/veille/calendrier')).toBe('calendrier')
    expect(écranDeLAdresse('cci', '/cci/veille/corpus/kyocera')).toBe('corpus')
    expect(écranDeLAdresse('cci', '/cci/acteurs/cada')).toBe('acteurs')
    expect(écranDeLAdresse('cci', '/cci/marches?x=1')).toBe('marches')
    expect(écranDeLAdresse('cci', '/cci/abonnement')).toBeNull()
    expect(écranDeLAdresse('cci', '/autre/marches')).toBeNull()
    expect(écranDeLAdresse('cci', '/ccicantal/marches')).toBeNull()
  })

  it('rien de masqué : le rail est celui d’avant, réorganisé ou non, en lecture complète comme en fin d’essai', () => {
    for (const réorganisé of [true, false]) {
      for (const lecture of ['complète', 'essentiel', 'aucune'] as const) {
        expect(ongletsDe('hermitage', COMPTES, lecture, { réorganisé }, [])).toEqual(ongletsDe('hermitage', COMPTES, lecture, { réorganisé }))
      }
    }
    expect(ongletsDe('hermitage', COMPTES, 'complète', { réorganisé: true })).toHaveLength(18)
    expect(ongletsDe('hermitage', COMPTES, 'complète', { réorganisé: true, appels: true })).toHaveLength(ÉCRANS_DE_L_ESPACE.length)
  })

  it('un écran masqué quitte le rail, et lui seul', () => {
    const avant = ongletsDe('cci', COMPTES, 'complète', { réorganisé: true })
    const après = ongletsDe('cci', COMPTES, 'complète', { réorganisé: true }, ['marches', 'indicateurs'])
    expect(après.map((o) => o.href)).toEqual(avant.map((o) => o.href).filter((h) => h !== '/cci/marches' && h !== '/cci/indicateurs'))
    // Espace à sept écrans : un écran qu'il n'a pas ne change rien, un qu'il a disparaît.
    expect(ongletsDe('cci', COMPTES, 'complète', { réorganisé: false }, ['marches', 'axes']).map((o) => o.href)).toEqual([
      '/cci',
      '/cci/lettres',
      '/cci/acteurs',
      '/cci/recommandations',
      '/cci/archives',
      '/cci/perimetre',
    ])
  })

  it('les cases de la vue d’ensemble perdent les écrans masqués', () => {
    const cases = casesDuTableauDeBord({
      slug: 'cci',
      lettres: 3,
      dernièreSemaine: null,
      archives: 2,
      axes: null,
      axesForts: 0,
      dossiersHorsConcurrents: 0,
      concurrents: 0,
      synthèse: null,
      pestel: null,
      veille: null,
    })
    const restent = sansLesÉcransMasqués('cci', cases, ['marches', 'indicateurs'])
    expect(restent.length).toBeLessThan(cases.length)
    expect(restent.some((c) => c.href === '/cci/marches' || c.href === '/cci/indicateurs')).toBe(false)
    expect(sansLesÉcransMasqués('cci', cases, [])).toEqual(cases)
  })

  it('le formulaire envoie les cochés ; le reste des désactivables est masqué', () => {
    const tousSaufDeux = ÉCRANS_DE_L_ESPACE.map((é) => é.clé).filter((c) => c !== 'marches' && c !== 'indicateurs')
    expect(masquésDuFormulaire(tousSaufDeux)).toEqual(['marches', 'indicateurs'])
    expect(masquésDuFormulaire([...tousSaufDeux, 'marches', 'indicateurs', 'pirate'])).toEqual([])
    // Une case de la vue d'ensemble, désactivée, n'est jamais envoyée : elle ne se masque pas pour autant.
    expect(masquésDuFormulaire([])).not.toContain('vue-d-ensemble')
  })

  it('la lecture ignore les clés inconnues, les doublons et la vue d’ensemble, et suit l’ordre du rail', () => {
    expect(écransMasquésConnus(['indicateurs', 'pirate', 'marches', 'marches', 'vue-d-ensemble'])).toEqual(['marches', 'indicateurs'])
    expect(écransMasquésConnus(null)).toEqual([])
    expect(libellésDesÉcrans(['indicateurs', 'marches'])).toEqual(['Marchés et niches', 'Indicateurs'])
  })
})

describe('les noms des écrans que l’opératrice choisit', () => {
  it('un nom propre, ou rien : vide, trop long, contrôle', () => {
    expect(nomDÉcranValide('  Nos   marchés ')).toBe('Nos marchés')
    expect(nomDÉcranValide('')).toBeNull()
    expect(nomDÉcranValide('x'.repeat(NOM_D_ÉCRAN_MAX))).toHaveLength(NOM_D_ÉCRAN_MAX)
    expect(nomDÉcranValide('x'.repeat(NOM_D_ÉCRAN_MAX + 1))).toBeNull()
    expect(nomDÉcranValide('a\u0001b')).toBeNull()
    expect(nomDÉcranValide(3)).toBeNull()
  })

  it('la lecture garde les clés connues et les noms valides, et rien d’autre', () => {
    expect(nomsDesÉcransConnus({ marches: 'Nos marchés', pirate: 'x', pestel: '', forces: 'y'.repeat(41), 'vue-d-ensemble': 'Accueil' })).toEqual({
      marches: 'Nos marchés',
      'vue-d-ensemble': 'Accueil',
    })
    expect(nomsDesÉcransConnus(null)).toEqual({})
    expect(nomsDesÉcransConnus(['marches'])).toEqual({})
  })

  it('le formulaire : un champ vide garde le nom par défaut, un nom trop long refuse tout', () => {
    expect(nomsDuFormulaire([['slug', 'cci'], ['ecran', 'marches'], ['nom:marches', ' Nos marchés '], ['nom:pestel', ''], ['nom:pirate', 'x']])).toEqual({
      sorte: 'noms',
      noms: { marches: 'Nos marchés' },
    })
    expect(nomsDuFormulaire([['nom:forces', 'y'.repeat(41)]])).toEqual({ sorte: 'trop-long', écran: 'forces' })
  })

  it('le libellé court tient dans le menu de pied', () => {
    expect(libelléCourtDe('Marchés')).toBe('Marchés')
    expect(libelléCourtDe('Nos marchés publics')).toBe('Nos')
    expect(libelléCourtDe('Concurrence directe')).toBe('Concurre.')
    expect(libelléCourtDe('Concurrence directe').length).toBeLessThanOrEqual(LIBELLÉ_COURT_MAX)
  })

  it('le rail et les cartes prennent le nom ; sans nom, rien ne change', () => {
    const avant = ongletsDe('cci', COMPTES, 'complète', { réorganisé: true })
    expect(ongletsDe('cci', COMPTES, 'complète', { réorganisé: true }, [], {})).toEqual(avant)
    const après = ongletsDe('cci', COMPTES, 'complète', { réorganisé: true }, ['pestel'], { marches: 'Nos marchés publics', 'vue-d-ensemble': 'Accueil' })
    expect(après.find((o) => o.href === '/cci/marches')).toMatchObject({ libellé: 'Nos marchés publics', libelléCourt: 'Nos' })
    expect(après.find((o) => o.href === '/cci')).toMatchObject({ libellé: 'Accueil', libelléCourt: 'Accueil', exact: true })
    expect(après.find((o) => o.href === '/cci/pestel')).toBeUndefined()
    expect(après.find((o) => o.href === '/cci/forces')).toEqual(avant.find((o) => o.href === '/cci/forces'))

    const cases = [
      { href: '/cci/marches', écran: 'Marchés et niches', valeur: '3' },
      { href: '/cci/forces', écran: 'Forces du marché', valeur: '2' },
    ]
    expect(casesRenommées('cci', cases, { marches: 'Nos marchés' }).map((c) => c.écran)).toEqual(['Nos marchés', 'Forces du marché'])
    // Dans l'ordre du rail : « Forces du marché » précède « Marchés et niches ».
    expect(libellésDesÉcrans(['marches', 'forces'], { marches: 'Nos marchés' })).toEqual(['Forces du marché', 'Nos marchés'])
  })
})
