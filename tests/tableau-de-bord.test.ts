import { describe, expect, it } from 'vitest'
import { casesDuTableauDeBord, type DonnéesDuTableau } from '@/lib/domaine/tableau-de-bord'
import {
  enBrefDeLaSwot,
  enBrefDesConcurrents,
  enBrefDesForces,
  enBrefDesScénarios,
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
  étiquettes: {
    total: 9,
    pestel: [
      { clé: 'politique', libellé: 'Politique', faits: 2 },
      { clé: 'economique', libellé: 'Économique', faits: 5 },
    ],
    forces: [],
    mouvements: [],
    ruptures: [],
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
      '/hermitage/perimetre',
      '/hermitage/archives',
    ])
    const par = new Map(cases.map((c) => [c.écran, c]))
    expect(par.get('Concurrents')).toMatchObject({ valeur: '36 suivis', mention: '1 a changé de case' })
    expect(par.get('Acteurs')).toMatchObject({ valeur: '10 dossiers', mention: '4 parties prenantes sur Mendelow' })
    expect(par.get('Forces du marché')).toMatchObject({ valeur: '1 intense', mention: 'trimestre de juillet à septembre 2026' })
    expect(par.get('Les axes')).toMatchObject({ valeur: '12 axes', mention: '3 signaux forts cette semaine' })
    expect(par.get('PESTEL')).toMatchObject({ valeur: 'Économique' })
    expect(par.get('Diagnostic')).toMatchObject({ valeur: '5 éléments', mention: '1 menace, 2 opportunités' })
    expect(par.get('Options')).toMatchObject({ valeur: '2 options', mention: 'retenue : saisir, forces × opportunités' })
    expect(par.get('Scénarios')).toMatchObject({ valeur: '3 scénarios' })
  })

  it('sans synthèse publiée ni étiquettes, les cases le disent au lieu d’inventer un chiffre', () => {
    const par = new Map(casesDuTableauDeBord({ ...DONNÉES, synthèse: null, étiquettes: null }).map((c) => [c.écran, c]))
    for (const écran of ['Forces du marché', 'Diagnostic', 'Options', 'Scénarios', 'PESTEL']) expect(par.get(écran)?.valeur, écran).toBe('n.d.')
    expect(par.get('Concurrents')?.mention).toBe('pas encore publié')
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
    expect(enBrefDesForces(SYNTHÈSE.trimestre!.forces).map((c) => c.valeur)).toEqual(['2 sur 3', 1, 1])
    expect(enBrefDesScénarios(SYNTHÈSE.trimestre!.scénarios).map((c) => c.valeur)).toEqual([3, 3, 2])
  })

  it('les concurrents et le PESTEL', () => {
    const concurrent = (nom: string, c: Partial<ConcurrentVu>): ConcurrentVu => ({ nom, segment: nom, siren: null, crans: [], déclaratif: false, aBougé: false, faits: 0, dernierFait: null, ...c })
    const vue = {
      concurrents: [concurrent('A', { crans: [{ axe: 'x', cran: 1, libellé: 'un' }], aBougé: true, faits: 2 }), concurrent('B', { crans: [{ axe: 'x', cran: 2, libellé: 'deux' }], déclaratif: true }), concurrent('C', {})],
      mouvements: [],
      nonPlacés: 1,
    }
    expect(enBrefDesConcurrents({ ...vue, mouvements: [vue.concurrents[0]!] }).map((c) => [c.valeur, c.mention])).toEqual([
      [3, '2 placés sur la carte'],
      [1, 'depuis la synthèse précédente'],
      [1, '1 position lue dans le corpus'],
    ])
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
    expect(enBrefDuPestel(pestel).map((c) => [c.valeur, c.mention])).toEqual([
      [7, 'sur treize semaines'],
      ['Légal', '5 faits'],
      [1, '1 dimension peu couverte'],
    ])
  })
})
