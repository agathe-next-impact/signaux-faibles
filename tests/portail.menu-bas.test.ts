import { describe, expect, it } from 'vitest'
import { ongletsDe } from '@/lib/portail/semaine'
import { ÉLÉMENTS_DU_MENU_BAS, groupeCourant, grouperParRubrique, répartirLeMenuBas } from '@/lib/portail/onglet'

const COMPTES = { lettres: 4, recommandations: 2, archives: 3 }

describe('menu de pied mobile : trois éléments au plus (25 octobre 2026)', () => {
  it('en lecture complète, la vue d’ensemble et les lettres sont directes, « Plus » porte les cinq autres dans l’ordre du rail', () => {
    const { directs, autres } = répartirLeMenuBas(ongletsDe('client', COMPTES))
    expect(directs.map((o) => o.href)).toEqual(['/client', '/client/lettres'])
    expect(autres.map((o) => o.href)).toEqual([
      '/client/axes',
      '/client/acteurs',
      '/client/recommandations',
      '/client/archives',
      '/client/perimetre',
    ])
    // Deux liens et le bouton « Plus » : trois éléments, aucun écran perdu.
    expect(directs.length + (autres.length > 0 ? 1 : 0)).toBe(ÉLÉMENTS_DU_MENU_BAS)
  })

  it('hors lecture complète, les écrans restants sont tous directs, sans « Plus »', () => {
    for (const lecture of ['essentiel', 'aucune'] as const) {
      const onglets = ongletsDe('client', COMPTES, lecture)
      const { directs, autres } = répartirLeMenuBas(onglets)
      expect(directs).toEqual(onglets)
      expect(autres).toEqual([])
    }
  })

  it('trois écrans tiennent sans « Plus », quatre en demandent un', () => {
    const quatre = ongletsDe('client', COMPTES).slice(0, 4)
    expect(répartirLeMenuBas(quatre.slice(0, 3)).autres).toEqual([])
    const { directs, autres } = répartirLeMenuBas(quatre)
    expect(directs).toHaveLength(2)
    expect(autres).toHaveLength(2)
  })
})

describe('rubriques en accordéons, rail et menu de pied (30 octobre 2026)', () => {
  it('l’espace réorganisé : un groupe par rubrique, dans l’ordre du rail', () => {
    const groupes = grouperParRubrique(ongletsDe('client', COMPTES, 'complète', { réorganisé: true }))
    expect(groupes.map((g) => g.rubrique)).toEqual(['Cette semaine', 'Le marché', 'L’environnement', 'Stratégie', 'Votre veille'])
    expect(groupes.flatMap((g) => g.onglets)).toEqual(ongletsDe('client', COMPTES, 'complète', { réorganisé: true }))
  })

  it('ouvre d’office la rubrique de l’écran courant', () => {
    const groupes = grouperParRubrique(ongletsDe('client', COMPTES, 'complète', { réorganisé: true }))
    const ouverts = (chemin: string) => groupes.filter((g) => groupeCourant(g, chemin)).map((g) => g.rubrique)
    expect(ouverts('/client')).toEqual(['Cette semaine'])
    expect(ouverts('/client/forces')).toEqual(['Le marché'])
    expect(ouverts('/client/scenarios')).toEqual(['Stratégie'])
    // Plus d'écran de rubrique (31 octobre 2026) : son ancienne adresse n'ouvre rien.
    expect(ouverts('/client/strategie')).toEqual([])
    expect(ouverts('/client/lettres/abc')).toEqual(['Cette semaine'])
  })

  it('sans rubrique, un seul groupe sans nom : le rail reste une liste simple', () => {
    const groupes = grouperParRubrique(ongletsDe('client', COMPTES))
    expect(groupes).toHaveLength(1)
    expect(groupes[0]?.rubrique).toBeNull()
  })
})
