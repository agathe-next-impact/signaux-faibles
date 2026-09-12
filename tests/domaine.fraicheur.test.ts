import { describe, expect, it } from 'vitest'
import {
  fraîcheurDUnAxe,
  fraîcheurDUnDossier,
  rangDeFraîcheur,
  SEMAINES_AVANT_DORMANCE,
} from '@/lib/domaine/fraicheur'

/**
 * La fraîcheur range les deux écrans, et elle n'est pas l'impact.
 *
 * Un axe peut être FORT et sans nouveauté ; un dossier peut dormir depuis un
 * mois et rester ouvert. Les deux lectures se superposent sur la même case,
 * portées par deux signes différents — le badge et la pastille.
 */
describe('fraîcheurDUnAxe', () => {
  it('met en tête un axe nouveau ou qui monte', () => {
    expect(fraîcheurDUnAxe({ niveau: 'FORT', mouvement: 'nouveau' })).toBe('nouveau')
    expect(fraîcheurDUnAxe({ niveau: 'MOYEN', mouvement: 'monté' })).toBe('nouveau')
  })

  it('range en « suivi » un axe stable ou qui redescend', () => {
    expect(fraîcheurDUnAxe({ niveau: 'FORT', mouvement: 'stable' })).toBe('suivi')
    expect(fraîcheurDUnAxe({ niveau: 'MOYEN', mouvement: 'redescendu' })).toBe('suivi')
  })

  it('fait primer RAS sur le mouvement, même pour un axe nouveau', () => {
    // « Rien à signaler » veut dire ce qu'il dit : un axe qui apparaît en RAS
    // est nouveau au sens du suivi, mais il n'apporte rien à lire. Le classer
    // en tête ferait remonter du vide.
    expect(fraîcheurDUnAxe({ niveau: 'RAS', mouvement: 'nouveau' })).toBe('dormant')
    expect(fraîcheurDUnAxe({ niveau: 'RAS', mouvement: 'stable' })).toBe('dormant')
  })

  it('ne classe pas un axe sans niveau comme dormant', () => {
    // Un suffixe inconnu ou absent s'affiche sans badge ; il ne vaut pas RAS.
    expect(fraîcheurDUnAxe({ niveau: null, mouvement: 'stable' })).toBe('suivi')
  })
})

describe('fraîcheurDUnDossier', () => {
  it('met en tête ce qui vient de bouger', () => {
    expect(fraîcheurDUnDossier({ aBougé: true, semainesSansMouvement: 2 })).toBe('nouveau')
    expect(fraîcheurDUnDossier({ aBougé: false, semainesSansMouvement: 0 })).toBe('nouveau')
  })

  it('distingue le silence récent du silence installé', () => {
    expect(fraîcheurDUnDossier({ aBougé: false, semainesSansMouvement: 1 })).toBe('suivi')
    expect(
      fraîcheurDUnDossier({ aBougé: false, semainesSansMouvement: SEMAINES_AVANT_DORMANCE }),
    ).toBe('dormant')
    expect(fraîcheurDUnDossier({ aBougé: false, semainesSansMouvement: 12 })).toBe('dormant')
  })
})

describe('l’ordre d’affichage', () => {
  it('va du neuf au dormant, et permet un tri stable', () => {
    const mêlés = ['dormant', 'nouveau', 'suivi', 'dormant', 'nouveau'] as const
    expect([...mêlés].sort((a, b) => rangDeFraîcheur(a) - rangDeFraîcheur(b))).toEqual([
      'nouveau',
      'nouveau',
      'suivi',
      'dormant',
      'dormant',
    ])
  })
})
