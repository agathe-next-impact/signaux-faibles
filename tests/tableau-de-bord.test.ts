import { describe, expect, it } from 'vitest'
import { cartesDesRubriques, casesDeLaRubrique, casesDuTableauDeBord, RUBRIQUES, type DonnéesDuTableau } from '@/lib/domaine/tableau-de-bord'
import {
  enBrefDeLaSwot,
  enBrefDuPestel,
  mouvementsDeLaCarte,
  type ConcurrentVu,
  type SynthèseVue,
  type VueDeLaCarte,
  type VueDuPestel,
} from '@/lib/domaine/strategie-vues'

/** Le tableau de bord en cases et les bandeaux « En bref » (lot 4, 30 octobre 2026) : des comptes, jamais d'invention. */

const élément = (code: string, source: string, édition: string | null) => ({ code, énoncé: 'É.', source, édition })
const SYNTHÈSE: SynthèseVue = {
  mois: {
    période: '2026-09',
    carte: {
      colonnes: { clé: 'a', libellé: 'A', crans: ['1', '2'] },
      lignes: { clé: 'b', libellé: 'B', crans: ['1', '2'] },
      cases: new Map([
        ['1:1', [{ sujet: 'Vous', organisation: true, aBougé: true, venuDe: null, fait: null }]],
        ['2:2', [{ sujet: 'X', organisation: false, aBougé: true, venuDe: { ligne: 1, colonne: 1 }, fait: null }, { sujet: 'Y', organisation: false, aBougé: false, venuDe: null, fait: null }]],
      ]),
      anciennes: new Map(),
      placés: 3,
      déclaratifs: 1,
    },
    mendelow: { cases: new Map(), placés: 4, déclaratifs: 0 },
    swot: {
      forces: [élément('F1', 'Déclaratif · votre fiche', null)],
      faiblesses: [élément('Fa1', 'Fait du 01/10 · lettre n° 16', 'e1')],
      opportunites: [élément('O1', 'Fait du 01/09 · lettre n° 9', 'e2'), élément('O2', 'Fait du 02/09 · lettre n° 9', 'e2')],
      menaces: [élément('M1', 'Fait du 03/09 · lettre n° 9', 'e2')],
    },
    tows: {
      parType: { SO: [{ énoncé: 'Saisir.', croise: ['F1', 'O1'], candidate: true }], WO: [], ST: [{ énoncé: 'Défendre.', croise: ['F1', 'M1'], candidate: false }], WT: [] },
      candidate: { énoncé: 'Saisir.', croise: ['F1', 'O1'], candidate: true, libellé: 'Forces × opportunités' },
    },
  },
  trimestre: {
    période: '2026-T3',
    forces: [
      { force: 'rivalite', libellé: 'Rivalité', lecture: 'Intense · en hausse', nonSuivi: false, cran: 3, tendance: 'hausse' },
      { force: 'nouveaux_entrants', libellé: 'Entrants', lecture: 'Marquée · stable', nonSuivi: false, cran: 2, tendance: 'stable' },
      { force: 'substituts', libellé: 'Substituts', lecture: 'Non suivi', nonSuivi: true, cran: null, tendance: null },
    ],
    scénarios: [
      { titre: 'A', énoncé: 'a', indicateurs: [{ famille: 1, signal: 's' }, { famille: 2, signal: 't' }] },
      { titre: 'B', énoncé: 'b', indicateurs: [{ famille: 1, signal: 'u' }] },
      { titre: 'C', énoncé: 'c', indicateurs: [] },
    ],
  },
}
const DONNÉES: DonnéesDuTableau = {
  slug: 'hermitage',
  lettres: 33,
  dernièreSemaine: 'semaine du 26 octobre 2026',
  archives: 15,
  axes: 12,
  axesForts: 3,
  dossiersHorsConcurrents: 10,
  concurrents: 36,
  synthèse: SYNTHÈSE,
  pestel: [
    { libellé: 'Politique', faits: 2 },
    { libellé: 'Économique', faits: 5 },
  ],
  veille: {
    thèmes: 14,
    concurrents: 36,
    entités: 40,
    partiesPrenantes: 6,
    fiche: { sources: 22, thèmesAvecSources: 12, prochaine: { date: '2026-11-19', libellé: 'Journée régionale des tiers-lieux à Roubaix' } },
  },
}

describe('casesDuTableauDeBord', () => {
  it('une case par écran hors vue d’ensemble, dans l’ordre du rail, chacune avec son chiffre', () => {
    const cases = casesDuTableauDeBord(DONNÉES)
    expect(cases.map((c) => c.href)).toEqual([
      '/hermitage/lettres',
      '/hermitage/concurrents',
      '/hermitage/acteurs',
      '/hermitage/forces',
      '/hermitage/axes',
      '/hermitage/pestel',
      '/hermitage/diagnostic',
      '/hermitage/recommandations',
      '/hermitage/scenarios',
      '/hermitage/indicateurs',
      '/hermitage/veille/themes',
      '/hermitage/veille/sources',
      '/hermitage/veille/corpus',
      '/hermitage/veille/calendrier',
      '/hermitage/perimetre',
      '/hermitage/archives',
    ])
    const par = new Map(cases.map((c) => [c.écran, c]))
    expect(par.get('Concurrents')).toMatchObject({ valeur: '36 suivis', mention: '1 a changé de case' })
    expect(par.get('Acteurs')).toMatchObject({ valeur: '10 dossiers', mention: '4 parties prenantes sur Mendelow' })
    expect(par.get('Forces du marché')).toMatchObject({ valeur: '1 intense', mention: 'trimestre de juillet à septembre 2026' })
    expect(par.get('Les axes')).toMatchObject({ valeur: '12 axes', mention: '3 signaux forts cette semaine' })
    expect(par.get('PESTEL')).toMatchObject({ valeur: 'Économique', mention: 'la plus citée, 5 faits en treize semaines' })
    expect(par.get('Diagnostic')).toMatchObject({ valeur: '5 éléments', mention: '1 menace, 2 opportunités' })
    expect(par.get('Options')).toMatchObject({ valeur: '2 options', mention: 'retenue : saisir, forces × opportunités' })
    expect(par.get('Scénarios')).toMatchObject({ valeur: '3 scénarios' })
    expect(par.get('Thèmes suivis')).toMatchObject({ valeur: '14 thèmes' })
    expect(par.get('Sources')).toMatchObject({ valeur: '22 sources', mention: 'pour 12 thèmes' })
    expect(par.get('Corpus')).toMatchObject({ valeur: '40 entités', mention: '36 concurrents, 6 parties prenantes' })
    expect(par.get('Calendrier')).toMatchObject({ valeur: 'le 19/11', mention: 'Journée régionale des tiers-lieux à Roubaix' })
    // Le trimestre ne porte pas d'indicateurs : la case le dit.
    expect(par.get('Indicateurs')).toMatchObject({ valeur: 'n.d.', mention: 'indice non calculé' })
  })

  it('la case des indicateurs reprend l’indice du trimestre publié', () => {
    const indice = {
      calculéLe: '2026-10-05T00:00:00Z',
      période: { du: '2025-10-05', au: '2026-10-04' },
      périodePrécédente: { du: '2024-10-05', au: '2025-10-04' },
      départements: ['60'],
      texte: 'séminaires',
      entrées: 326,
      sorties: 69,
      solde: 257,
      ratio: 4.72,
      entréesAvant: 318,
      sortiesAvant: 55,
      évolutionDesEntrées: 2.5,
      évolutionDesSorties: 25.5,
      limites: [],
    }
    const synthèse = { ...SYNTHÈSE, trimestre: { ...SYNTHÈSE.trimestre!, indicateurs: { période: '2026-T3', indice: { valeurs: indice, interprétation: null }, benchmark: null } } }
    const par = new Map(casesDuTableauDeBord({ ...DONNÉES, synthèse }).map((c) => [c.écran, c]))
    expect(par.get('Indicateurs')).toMatchObject({ valeur: '326 entrées', mention: '69 procédures au registre' })
  })

  it('sans synthèse publiée ni étiquettes, les cases le disent au lieu d’inventer un chiffre', () => {
    const par = new Map(casesDuTableauDeBord({ ...DONNÉES, synthèse: null, pestel: null, axes: null, veille: { ...DONNÉES.veille!, fiche: null } }).map((c) => [c.écran, c]))
    for (const écran of ['Forces du marché', 'Diagnostic', 'Options', 'Scénarios', 'Indicateurs', 'PESTEL', 'Les axes']) expect(par.get(écran)?.valeur, écran).toBe('n.d.')
    expect(par.get('Concurrents')?.mention).toBe('pas encore publié')
    // Sans fiche publiée, les thèmes se comptent dans la grille, le reste attend la publication.
    expect(par.get('Thèmes suivis')).toMatchObject({ valeur: '14 thèmes', mention: 'pas encore publié' })
    for (const écran of ['Sources', 'Calendrier']) expect(par.get(écran), écran).toMatchObject({ valeur: 'n.d.', mention: 'pas encore publié' })
  })
})

describe('les rubriques', () => {
  it('une carte par rubrique, Cette semaine exceptée, avec les chiffres de ses écrans', () => {
    const cases = casesDuTableauDeBord(DONNÉES)
    const cartes = cartesDesRubriques('hermitage', cases)
    expect(cartes.map((c) => [c.titre, c.href, c.écrans.map((é) => é.écran)])).toEqual([
      ['Le marché', '/hermitage/marche', ['Concurrents', 'Acteurs', 'Forces du marché']],
      ['L’environnement', '/hermitage/environnement', ['Les axes', 'PESTEL']],
      ['Stratégie', '/hermitage/strategie', ['Diagnostic', 'Options', 'Scénarios', 'Indicateurs']],
      ['Votre veille', '/hermitage/veille', ['Thèmes suivis', 'Sources', 'Corpus', 'Calendrier', 'Périmètre', 'Archives']],
    ])
    expect(cartes[0]!.écrans[0]).toEqual({ écran: 'Concurrents', valeur: '36 suivis' })
    // Chaque écran hors « Cette semaine » est dans une rubrique, et une seule.
    const rangés = RUBRIQUES.flatMap((r) => casesDeLaRubrique(cases, r.clé))
    expect(rangés.map((c) => c.href).sort()).toEqual(cases.filter((c) => c.rubrique !== 'Cette semaine').map((c) => c.href).sort())
  })
})

describe('en bref', () => {
  it('compte les mouvements de la carte sans l’organisation', () => {
    expect(mouvementsDeLaCarte(SYNTHÈSE.mois!.carte as VueDeLaCarte)).toBe(1)
    expect(mouvementsDeLaCarte(null)).toBe(0)
  })

  it('la SWOT, les forces et les scénarios : trois chiffres chacun, comptés sur ce que l’écran montre', () => {
    expect(enBrefDeLaSwot(SYNTHÈSE.mois!.swot).map((c) => [c.intitulé, c.valeur, c.mention])).toEqual([
      ['Éléments de la SWOT', 5, '1 déclaratif, 4 datés'],
      ['Opportunités', 2, 'tirées des faits de vos lettres'],
      ['Menaces', 1, 'tirées des faits de vos lettres'],
    ])
    // Opportunités et menaces mènent à leur case de la matrice.
    expect(enBrefDeLaSwot(SYNTHÈSE.mois!.swot).map((c) => c.ancre ?? null)).toEqual([null, 'swot-opportunites', 'swot-menaces'])
  })

  it('les concurrents et le PESTEL', () => {
    const concurrent = (nom: string, c: Partial<ConcurrentVu>): ConcurrentVu => ({ nom, segment: nom, siren: null, crans: [], déclaratif: false, aBougé: false, faits: 0, dernierFait: null, ...c })
    const vue = {
      concurrents: [concurrent('A', { crans: [{ axe: 'x', cran: 1, libellé: 'un' }], aBougé: true, faits: 2 }), concurrent('B', { crans: [{ axe: 'x', cran: 2, libellé: 'deux' }], déclaratif: true }), concurrent('C', {})],
      mouvements: [],
      nonPlacés: 1,
    }
    const pestel = {
      fenêtre: { début: '2026-07-01', fin: '2026-10-01' },
      total: 7,
      dimensions: [
        { lettre: 'politique', initiale: 'P', libellé: 'Politique', faits: 2, ruptures: 1, parMois: [], suiviePar: [] },
        { lettre: 'legal', initiale: 'L', libellé: 'Légal', faits: 5, ruptures: 0, parMois: [], suiviePar: [] },
      ],
      trous: [{ libellé: 'Écologique', familles: 0, nom: null }],
      faits: [],
    } as unknown as VueDuPestel
    expect(enBrefDuPestel(pestel).map((c) => [c.intitulé, c.valeur, c.mention])).toEqual([
      ['Dimension la plus citée', 'Légal', '5 faits'],
      ['Deuxième dimension citée', 'Politique', '2 faits'],
    ])
  })
})
