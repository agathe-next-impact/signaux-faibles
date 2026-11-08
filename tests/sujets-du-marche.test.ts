import { describe, expect, it } from 'vitest'
import { VOCABULAIRES_DU_MARCHÉ, vocabulaireDuMarché } from '@/lib/domaine/sujets-du-marche'
import { ongletsDe } from '@/lib/portail/semaine'

/**
 * Les sujets du marché (7 novembre 2026) : la CCI du Cantal suit les mouvements
 * des entreprises de son territoire dans sa veille concurrentielle, et son écran
 * « Concurrents » lui montrait ses ressortissants comme des concurrents.
 */
describe('les sujets du marché', () => {
  it('concurrents par défaut, et pour toute valeur inconnue', () => {
    expect(vocabulaireDuMarché(null)).toBe(VOCABULAIRES_DU_MARCHÉ.concurrents)
    expect(vocabulaireDuMarché('clients')).toBe(VOCABULAIRES_DU_MARCHÉ.concurrents)
    expect(vocabulaireDuMarché('entreprises').écran).toBe('Entreprises suivies')
  })

  it('accorde les comptes au féminin pour les entreprises', () => {
    expect(VOCABULAIRES_DU_MARCHÉ.entreprises.suivis(1)).toBe('1 entreprise suivie')
    expect(VOCABULAIRES_DU_MARCHÉ.entreprises.suivis(28)).toBe('28 entreprises suivies')
    expect(VOCABULAIRES_DU_MARCHÉ.concurrents.suivis(2)).toBe('2 concurrents suivis')
  })

  it('ne parle jamais de concurrents quand l’écran montre des entreprises', () => {
    for (const [clé, valeur] of Object.entries(VOCABULAIRES_DU_MARCHÉ.entreprises)) {
      const texte = typeof valeur === 'function' ? valeur(3) : valeur
      expect(texte, clé).not.toMatch(/concurren/i)
    }
  })

  it('renomme l’onglet du rail sans changer son adresse', () => {
    const comptes = { lettres: 0, recommandations: 0, archives: 0 }
    const onglet = ongletsDe('cci-cantal', comptes, 'complète', { réorganisé: true, marché: VOCABULAIRES_DU_MARCHÉ.entreprises }).find(
      (o) => o.href === '/cci-cantal/concurrents',
    )
    expect(onglet).toMatchObject({ libellé: 'Entreprises suivies', libelléCourt: 'Entrepr.' })
    expect(ongletsDe('acme', comptes, 'complète', { réorganisé: true }).find((o) => o.href === '/acme/concurrents')?.libellé).toBe('Concurrents')
  })
})
