import { describe, expect, it } from 'vitest'
import { étatDeLaPériode, étatDesLignes, PHRASES_DE_PUBLICATION, rendreLaSynthèse, type ÉlémentÀRendre, type ÉtatDeLaPériode, type PositionÀRendre } from '@/lib/domaine/strategie'

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
  publication: 'proposée',
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
    position({ outil: 'ge', sujet: 'Bachelor vente', axe: 'attractivite', cran: 3, faits: ['f2'] }),
    position({ outil: 'ge', sujet: 'Bachelor vente', axe: 'atouts', cran: 1, faits: ['f2'] }),
  ],
  faits: new Map([
    ['f1', { date: '2026-10-25', entite: 'ISCOD' }],
    ['f2', { date: '2026-10-19', entite: 'France compétences' }],
  ]),
})

describe('rendreLaSynthèse', () => {
  it('rend la matrice GE par offre, en mots et non en crans', () => {
    expect(rendu).toContain('Matrice GE (attractivité du marché et atouts, par offre)')
    expect(rendu).toContain('- Bachelor vente : attractivité haute, atouts limités [1 fait : 2026-10-19, France compétences]')
  })

  it('compte une seule fois un fait cité par les deux axes d’un même sujet', () => {
    expect(rendu).toContain("- ISCOD : Offre aux entreprises : placement d'alternants ; Part de la formation à distance : 100 % à distance [1 fait : 2026-10-25, ISCOD]")
    expect(rendu).toContain('- France compétences : pouvoir élevé, intérêt intermédiaire [2 faits : 2026-10-19, France compétences ; 2026-10-25, ISCOD]')
  })

  it('dit d’une position déclarative qu’elle est lue dans le référentiel, et où', () => {
    const texte = rendreLaSynthèse({
      organisation: 'mastora',
      période: '2026-10',
      fenêtre: { début: '2026-10-01', fin: '2026-10-31' },
      grilleVersion: 1,
      publication: 'proposée',
      grille: GRILLE,
      éléments: [],
      positions: [
        { ...position({ outil: 'groupes', sujet: 'ISCOD', axe: 'offre', cran: 1, faits: [] }), origine: 'declaratif', référence: '§2, famille 1' },
        { ...position({ outil: 'groupes', sujet: 'ISCOD', axe: 'distance', cran: 3, faits: [] }), origine: 'declaratif', référence: '§2, famille 1' },
      ],
      faits: new Map(),
    })
    expect(texte).toContain('- ISCOD : Offre aux entreprises : aucune offre lue ; Part de la formation à distance : 100 % à distance (déclaratif, §2, famille 1)')
  })

  it('met l’option candidate en tête de la TOWS', () => {
    const tows = rendu.slice(rendu.indexOf('TOWS'))
    expect(tows.indexOf('- WO, candidate à la recommandation : Option WO.')).toBeGreaterThan(0)
    expect(tows.indexOf('- WO, candidate')).toBeLessThan(tows.indexOf('- SO : Option SO.'))
  })
})

describe('rendreLaSynthèse, état de publication', () => {
  const rendre = (publication: ÉtatDeLaPériode) =>
    rendreLaSynthèse({
      organisation: 'mastora',
      période: '2026-T4',
      fenêtre: { début: '2026-08-03', fin: '2026-11-10' },
      grilleVersion: 4,
      publication,
      grille: GRILLE,
      éléments: [],
      positions: [],
      faits: new Map(),
    }).split('\n')[1]

  it('dit l’état réel de la période, jamais une formule fixe', () => {
    expect(rendre('publiée')).toBe('Fenêtre du 2026-08-03 au 2026-11-10, grille v4. Publiée : le client la lit dans son espace.')
    expect(rendre('proposée')).toBe("Fenêtre du 2026-08-03 au 2026-11-10, grille v4. Proposée : rien n'est montré au client.")
    expect(rendre('retirée')).toBe("Fenêtre du 2026-08-03 au 2026-11-10, grille v4. Retirée par l'opératrice : rien n'est montré au client.")
    expect(rendre('mêlée')).toBe("Fenêtre du 2026-08-03 au 2026-11-10, grille v4. Publication incomplète, des lignes publiées et d'autres non : rien n'est montré au client.")
  })

  it('seule une période entièrement publiée est dite lue par le client', () => {
    for (const [état, phrase] of Object.entries(PHRASES_DE_PUBLICATION)) {
      expect(phrase.includes('le client la lit'), état).toBe(état === 'publiée')
      expect(phrase.includes("rien n'est montré au client"), état).toBe(état !== 'publiée')
      expect(phrase).not.toContain('\u2014')
    }
  })

  it('lit l’état dans celui des lignes', () => {
    expect(étatDesLignes(['publie', 'publie'])).toBe('publiée')
    expect(étatDesLignes(['propose', 'propose'])).toBe('proposée')
    expect(étatDesLignes(['retire', 'retire'])).toBe('retirée')
    // Une partie seulement publiée : les écrans du client ne lisent pas la période.
    expect(étatDesLignes(['publie', 'propose'])).toBe('mêlée')
    expect(étatDesLignes(['publie', 'retire'])).toBe('mêlée')
    expect(étatDesLignes(['propose', 'retire'])).toBe('mêlée')
    // Une période sans ligne n'est pas publiée.
    expect(étatDesLignes([])).toBe('proposée')
    expect(étatDeLaPériode({ lignes: 14, publiées: 14, retirées: 0 })).toBe('publiée')
    expect(étatDeLaPériode({ lignes: 14, publiées: 0, retirées: 0 })).toBe('proposée')
  })
})

describe('rendreLaSynthèse, benchmark', () => {
  it('écrit « n.d. » sans unité, et l’euro derrière un montant seulement', () => {
    const texte = rendreLaSynthèse({
      organisation: 'hermitage',
      période: '2026-T3',
      fenêtre: { début: '2026-07-22', fin: '2026-10-04' },
      grilleVersion: 1,
      publication: 'proposée',
      grille: GRILLE,
      éléments: [
        élément({
          id: 'b',
          outil: 'benchmark',
          clé: 'benchmark',
          énoncé: 'Lecture.',
          valeur: {
            lignes: [
              { nom: 'Coopérative Oasis', siren: '835189002', organisation: false, fiche: 'lue', active: true, trancheEffectif: '11', année: '2025', chiffreDAffaires: 540167, résultatNet: 21125 },
              { nom: 'Campus de la Transition', siren: '838270098', organisation: false, fiche: 'lue', active: true, trancheEffectif: '11', année: null, chiffreDAffaires: null, résultatNet: null },
            ],
            avecComptes: 1,
            médianeDuChiffreDAffaires: null,
            rangDeLOrganisation: null,
            limites: [],
          },
        }),
      ],
      positions: [],
      faits: new Map(),
    })
    expect(texte).toContain('médiane n.d. ;')
    const fr = (n: number) => n.toLocaleString('fr-FR')
    expect(texte).toContain(`- Coopérative Oasis : active, CA ${fr(540167)} €, résultat ${fr(21125)} € (2025)`)
    expect(texte).toContain('- Campus de la Transition : active, CA n.d., résultat n.d., effectif')
    expect(texte).not.toContain('n.d. €')
  })
})
