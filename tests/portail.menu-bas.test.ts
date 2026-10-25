import { describe, expect, it } from 'vitest'
import { ongletsDe } from '@/lib/portail/semaine'
import { ÉLÉMENTS_DU_MENU_BAS, répartirLeMenuBas } from '@/lib/portail/onglet'

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
