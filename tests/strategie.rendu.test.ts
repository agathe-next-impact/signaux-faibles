import { describe, expect, it } from 'vitest'
import { rendreLaSynthèse, type ÉlémentÀRendre, type PositionÀRendre } from '@/lib/domaine/strategie'

const GRILLE = {
  axesGroupes: [
    { clé: 'offre', libellé: 'Offre aux entreprises', crans: ['aucune offre lue', "placement d'alternants", 'école de vente'] },
    { clé: 'distance', libellé: 'Part de la formation à distance', crans: ['campus', 'campus et distance', '100 % à distance'] },
  ],
  familles: [{ numéro: 1, veille: 'concurrentiel' as const, pestel: null, porter: 'rivalite' as const, cadence: 'hebdomadaire' as const }],
  entités: [{ nom: 'ISCOD', veille: 'concurrentiel' as const, siren: null }],
  partiesPrenantes: [{ nom: 'France compétences' }],
}

const élément = (e: Partial<ÉlémentÀRendre> & Pick<ÉlémentÀRendre, 'id' | 'outil' | 'clé'>): ÉlémentÀRendre => ({
  rang: 1,
  énoncé: 'Énoncé.',
  état: null,
  origine: 'faits',
  hypothèse: false,
  faits: [],
  références: {},
  candidateRecommandation: false,
  ...e,
})
const position = (p: Pick<PositionÀRendre, 'outil' | 'sujet' | 'axe' | 'cran' | 'faits'>): PositionÀRendre => ({ nonSuivi: false, tendance: null, ...p })

const rendu = rendreLaSynthèse({
  organisation: 'mastora',
  période: '2026-10',
  fenêtre: { début: '2026-07-20', fin: '2026-10-27' },
  grilleVersion: 1,
  grille: GRILLE,
  éléments: [
    élément({ id: 'w', outil: 'swot', clé: 'faiblesses', état: 'nouveau' }),
    élément({ id: 'o', outil: 'swot', clé: 'opportunites', état: 'nouveau' }),
    élément({ id: 's', outil: 'swot', clé: 'forces', état: 'nouveau' }),
    élément({ id: 't', outil: 'swot', clé: 'menaces', état: 'nouveau' }),
    élément({ id: 'so', outil: 'tows', clé: 'SO', énoncé: 'Option SO.', références: { éléments: ['s', 'o'] } }),
    élément({ id: 'wo', outil: 'tows', clé: 'WO', énoncé: 'Option WO.', références: { éléments: ['w', 'o'] }, candidateRecommandation: true }),
  ],
  positions: [
    position({ outil: 'groupes', sujet: 'ISCOD', axe: 'offre', cran: 2, faits: ['f1'] }),
    position({ outil: 'groupes', sujet: 'ISCOD', axe: 'distance', cran: 3, faits: ['f1'] }),
    position({ outil: 'mendelow', sujet: 'France compétences', axe: 'pouvoir', cran: 3, faits: ['f2', 'f1'] }),
    position({ outil: 'mendelow', sujet: 'France compétences', axe: 'interet', cran: 2, faits: ['f2'] }),
  ],
  faits: new Map([
    ['f1', { date: '2026-10-25', entite: 'ISCOD' }],
    ['f2', { date: '2026-10-19', entite: 'France compétences' }],
  ]),
})

describe('rendreLaSynthèse', () => {
  it('compte une seule fois un fait cité par les deux axes d’un même sujet', () => {
    expect(rendu).toContain("- ISCOD : Offre aux entreprises : placement d'alternants ; Part de la formation à distance : 100 % à distance [1 fait : 2026-10-25, ISCOD]")
    expect(rendu).toContain('- France compétences : pouvoir élevé, intérêt intermédiaire [2 faits : 2026-10-19, France compétences ; 2026-10-25, ISCOD]')
  })

  it('met l’option candidate en tête de la TOWS', () => {
    const tows = rendu.slice(rendu.indexOf('TOWS'))
    expect(tows.indexOf('- WO, candidate à la recommandation : Option WO.')).toBeGreaterThan(0)
    expect(tows.indexOf('- WO, candidate')).toBeLessThan(tows.indexOf('- SO : Option SO.'))
  })
})
