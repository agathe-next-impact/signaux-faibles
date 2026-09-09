import { describe, expect, it } from 'vitest'
import { lireDossiersOuverts } from '@/lib/domaine/dossiers'

describe('lireDossiersOuverts', () => {
  it('lit le format du contrat', () => {
    expect(
      lireDossiersOuverts('Loi Résilience (0) · CADA (2, rapporteurs identifiés)'),
    ).toEqual([
      { nom: 'Loi Résilience', compteur: 0, précision: null },
      { nom: 'CADA', compteur: 2, précision: 'rapporteurs identifiés' },
    ])
  })

  it('accepte la barre verticale, employée par certaines éditions', () => {
    const dossiers = lireDossiersOuverts('Budget 2027 (1) | Comptes de la CC (0, source fermée)')
    expect(dossiers).toHaveLength(2)
    expect(dossiers[1]?.précision).toBe('source fermée')
  })

  it('ne se laisse pas piéger par une parenthèse dans le nom', () => {
    expect(lireDossiersOuverts('Loi Résilience (volet 2) (1, au Sénat)')).toEqual([
      { nom: 'Loi Résilience (volet 2)', compteur: 1, précision: 'au Sénat' },
    ])
  })

  it('garde telle quelle une entrée hors format plutôt que de deviner', () => {
    expect(lireDossiersOuverts('Un dossier sans compteur')).toEqual([
      { nom: 'Un dossier sans compteur', compteur: null, précision: null },
    ])
    expect(lireDossiersOuverts('Dossier (en cours)')).toEqual([
      { nom: 'Dossier (en cours)', compteur: null, précision: null },
    ])
  })

  it('renvoie une liste vide pour une propriété absente ou vide', () => {
    expect(lireDossiersOuverts(null)).toEqual([])
    expect(lireDossiersOuverts(undefined)).toEqual([])
    expect(lireDossiersOuverts('   ')).toEqual([])
  })

  it('ignore les séparateurs surnuméraires', () => {
    expect(lireDossiersOuverts('A (1) ·  · B (2)')).toHaveLength(2)
  })
})
