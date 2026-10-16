import { describe, expect, it } from 'vitest'
import { estTitreDeCadrage, sansAccent } from '@/lib/domaine/texte'

describe('sansAccent', () => {
  it('retire accents et casse, et ramène l’apostrophe typographique', () => {
    expect(sansAccent('L’Essentiel — À LIRE')).toBe("l'essentiel — a lire")
    expect(sansAccent('Événement')).toBe('evenement')
  })
})

describe('estTitreDeCadrage', () => {
  it('reconnaît le mot quel que soit l’habillage', () => {
    for (const titre of [
      'Ajustements du cadrage de cette veille',
      'CADRAGE',
      'Le cadrage, à ajuster',
      'Cadrage : propositions',
    ]) {
      expect(estTitreDeCadrage(titre), titre).toBe(true)
    }
  })

  it('ne confond pas un titre d’actualité qui contient le mot dans un autre', () => {
    for (const titre of ['Recadrage du marché', 'Encadrage des loyers', 'Actualité acteurs']) {
      expect(estTitreDeCadrage(titre), titre).toBe(false)
    }
  })
})
