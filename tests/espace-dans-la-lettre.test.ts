import { describe, expect, it } from 'vitest'
import { liensDeLEspace } from '@/lib/domaine/espace-dans-la-lettre'
import { vueDesMarchés, type MesureDeSegment } from '@/lib/domaine/marches'
import type { SynthèseVue } from '@/lib/domaine/strategie-vues'
import { composerLettre } from '@/lib/email/lettre'
import { BLOCS_CONCURRENTIELS } from './fixtures/lettre-concurrentielle'

/**
 * Le pied « Dans votre espace » du courriel d'une lettre (12 novembre 2026) :
 * trois liens au plus, chacun sur une période publiée, comptés et jamais rédigés.
 */
const élément = (code: string) => ({ code, énoncé: 'É.', source: 'Fait du 01/10', édition: null, état: null })
const SYNTHÈSE: SynthèseVue = {
  mois: {
    période: '2026-10',
    carte: null,
    mendelow: { cases: new Map(), placés: 0, déclaratifs: 0 },
    swot: { forces: [élément('F1')], faiblesses: [], opportunites: [élément('O1'), élément('O2')], menaces: [élément('M1')] },
    tows: { parType: { SO: [], WO: [], ST: [], WT: [] }, candidate: null },
  },
  trimestre: {
    période: '2026-T4',
    forces: [],
    scénarios: [
      { titre: 'A', énoncé: 'a', indicateurs: [] },
      { titre: 'B', énoncé: 'b', indicateurs: [] },
      { titre: 'C', énoncé: 'c', indicateurs: [] },
    ],
  },
}
const mesure = (plus: Partial<MesureDeSegment>): MesureDeSegment => ({
  clé: 'x',
  libellé: 'X',
  parent: 'marche',
  niveau: 'offre',
  périmètre: 'aaaaaaaa',
  cibles: 1000,
  ciblesPlafonnées: false,
  ciblesOrigine: 'registre',
  potentiel: null,
  offreurs: null,
  offreursPlafonnés: false,
  entrées: null,
  sorties: null,
  présents: null,
  chiffreDAffairesDesPrésents: null,
  présentsAvecComptes: 0,
  faits: 4,
  faitsForts: 0,
  sources: [],
  limites: [],
  ...plus,
})
const MARCHÉS = vueDesMarchés([
  {
    période: '2026-T4',
    mesures: [
      mesure({ clé: 'marche', niveau: 'marche', parent: null, faits: 40 }),
      mesure({ clé: 'a', faits: 12, présents: ['A'] }),
      mesure({ clé: 'b', niveau: 'niche', faits: 20, présents: [] }),
      mesure({ clé: 'c', faits: 2, présents: null }),
    ],
  },
])

describe('les liens de l’espace', () => {
  it('diagnostic, scénarios, marchés : un chiffre et sa période, dans cet ordre', () => {
    expect(liensDeLEspace({ slug: 'konica', synthèse: SYNTHÈSE, marchés: MARCHÉS })).toEqual([
      { écran: 'Diagnostic', chemin: '/konica/diagnostic', valeur: '1 menace', mention: 'et 2 opportunités, pour octobre 2026' },
      { écran: 'Scénarios', chemin: '/konica/scenarios', valeur: '3 scénarios', mention: 'et leurs indicateurs, pour octobre à décembre 2026' },
      { écran: 'Marchés et niches', chemin: '/konica/marches', valeur: '2 segments à pousser', mention: 'sur 3 offres et niches, pour octobre à décembre 2026' },
    ])
  })

  it('rien de publié, aucun lien ; un écran sans période n’a pas de ligne', () => {
    expect(liensDeLEspace({ slug: 'konica', synthèse: null, marchés: null })).toEqual([])
    const sansTrimestre = liensDeLEspace({ slug: 'konica', synthèse: { ...SYNTHÈSE, trimestre: null }, marchés: null })
    expect(sansTrimestre.map((l) => l.écran)).toEqual(['Diagnostic'])
  })
})

describe('le pied du courriel', () => {
  const édition = {
    pageId: '3d5fe829-ce71-8107-af65-f4fccf8089ab',
    titre: 'Konica Minolta : veille concurrentielle n° 7',
    veille: 'Concurrentiel',
    numéro: 7,
    dateÉdition: '2026-10-19',
    périodeCouverte: 'du 12 au 18 octobre 2026',
  }
  const composer = (espace?: ReturnType<typeof liensDeLEspace>) =>
    composerLettre({ édition, blocs: BLOCS_CONCURRENTIELS, slug: 'konica', organisation: 'Konica Minolta France', portailUrl: 'https://www.signauxfaibles.io/', adressePostale: null, espace })

  it('après la lettre, en liens à l’encre, en HTML et en texte', () => {
    const { html, texte } = composer(liensDeLEspace({ slug: 'konica', synthèse: SYNTHÈSE, marchés: MARCHÉS }))
    expect(html).toContain('Dans votre espace')
    expect(html).toContain('href="https://www.signauxfaibles.io/konica/diagnostic"')
    expect(html).toContain('href="https://www.signauxfaibles.io/konica/marches"')
    expect(html.indexOf('Dans votre espace')).toBeGreaterThan(html.indexOf('Ajustements du cadrage de cette veille'))
    expect(texte).toContain('DANS VOTRE ESPACE')
    expect(texte).toContain('- Scénarios : 3 scénarios et leurs indicateurs, pour octobre à décembre 2026 (https://www.signauxfaibles.io/konica/scenarios)')
  })

  it('sans lien, le courriel est celui d’avant', () => {
    expect(composer([]).html).toBe(composer().html)
    expect(composer().html).not.toContain('Dans votre espace')
  })
})
