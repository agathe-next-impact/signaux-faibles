import { describe, expect, it } from 'vitest'
import { composerCourrierDeParcours, courrierDuParcours } from '@/lib/domaine/courriers-parcours'

describe('courrierDuParcours', () => {
  it('ne déclenche qu’à la dernière parution complète et à la parution réduite', () => {
    expect(courrierDuParcours({ étape: 'essai', parution: 1 })).toBeNull()
    expect(courrierDuParcours({ étape: 'essai', parution: 2 })).toBeNull()
    expect(courrierDuParcours({ étape: 'essai', parution: 3 })).toBe('essai_derniere_parution')
    expect(courrierDuParcours({ étape: 'tronquee' })).toBe('essai_tronquee')
    expect(courrierDuParcours({ étape: 'suspendue', manuelle: false })).toBeNull()
    expect(courrierDuParcours({ étape: 'abonnee', source: 'stripe', paiementEnRetard: false })).toBeNull()
    expect(courrierDuParcours({ étape: 'hors-parcours', raison: 'x' })).toBeNull()
  })
})

describe('composerCourrierDeParcours', () => {
  const base = { prénomOuNom: 'Léa', organisation: 'Acme', slug: 'acme', portailUrl: 'https://www.signauxfaibles.io/' }

  for (const sorte of ['essai_derniere_parution', 'essai_tronquee'] as const) {
    it(`${sorte} : liens, prix, et aucune tournure interdite`, () => {
      const { sujet, texte } = composerCourrierDeParcours({ ...base, sorte })
      expect(texte).toContain('https://www.signauxfaibles.io/acme')
      expect(texte).toContain('https://www.signauxfaibles.io/recevoir-mon-lien')
      expect(texte).toContain('89 € HT par mois')
      expect(texte).toContain('890 € HT par an')
      expect(texte.startsWith('Bonjour Léa,')).toBe(true)
      expect(`${sujet}${texte}`).not.toContain('—')
      expect(sujet).toMatch(/^[A-ZÉ]/u)
      expect(sujet).not.toMatch(/[A-Z]{3,}/)
    })
  }

  it('salue sans nom quand il manque', () => {
    expect(composerCourrierDeParcours({ ...base, prénomOuNom: ' ', sorte: 'essai_tronquee' }).texte.startsWith('Bonjour,')).toBe(true)
  })
})
