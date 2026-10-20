import { describe, expect, it } from 'vitest'
import { composerCourrierDeParcours, courrierDuParcours } from '@/lib/domaine/courriers-parcours'

describe('courrierDuParcours', () => {
  it('ne déclenche qu’à la dernière parution complète et à la parution réduite', () => {
    expect(courrierDuParcours({ étape: 'essai', parution: 1, parutions: 3 })).toBeNull()
    expect(courrierDuParcours({ étape: 'essai', parution: 2, parutions: 3 })).toBeNull()
    expect(courrierDuParcours({ étape: 'essai', parution: 3, parutions: 3 })).toBe('essai_derniere_parution')
    // Quatre parutions réglées : la troisième n'est plus la dernière.
    expect(courrierDuParcours({ étape: 'essai', parution: 3, parutions: 4 })).toBeNull()
    expect(courrierDuParcours({ étape: 'essai', parution: 4, parutions: 4 })).toBe('essai_derniere_parution')
    expect(courrierDuParcours({ étape: 'tronquee' })).toBe('essai_tronquee')
    expect(courrierDuParcours({ étape: 'suspendue', manuelle: false })).toBeNull()
    expect(courrierDuParcours({ étape: 'abonnee', source: 'stripe', paiementEnRetard: false })).toBeNull()
    expect(courrierDuParcours({ étape: 'hors-parcours', raison: 'x' })).toBeNull()
  })
})

describe('composerCourrierDeParcours', () => {
  const base = {
    prénomOuNom: 'Léa',
    organisation: 'Acme',
    slug: 'acme',
    portailUrl: 'https://www.signauxfaibles.io/',
    parutions: 3,
    offre: 'standard' as const,
  }

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

    it(`${sorte} : le même courriel à la charte, bouton vers l’abonnement et pied client`, () => {
      const { html } = composerCourrierDeParcours({ ...base, sorte, destinataire: 'lea@acme.test', adressePostale: '1 place Exemple' })
      expect(html).toContain('href="https://www.signauxfaibles.io/acme/abonnement"')
      expect(html.match(/class="btn-primary/g)).toHaveLength(1)
      expect(html).toContain('href="https://www.signauxfaibles.io/recevoir-mon-lien"')
      expect(html).toContain('89 € HT par mois')
      expect(html).toContain('lea@acme.test')
      expect(html).toContain('Gérer mon abonnement')
      expect(html).toContain('1 place Exemple')
      expect(html).not.toContain('—')
    })
  }

  it('écrit le nombre de parutions réglé, et le tarif early adopter quand c’est l’offre', () => {
    const quatre = composerCourrierDeParcours({ ...base, sorte: 'essai_derniere_parution', parutions: 4 }).texte
    expect(quatre).toContain('quatre parutions complètes')
    const early = composerCourrierDeParcours({ ...base, sorte: 'essai_tronquee', offre: 'early_adopter' }).texte
    expect(early).toContain('29 € HT par mois')
    expect(early).not.toContain('890 € HT par an')
  })

  it('salue sans nom quand il manque', () => {
    expect(composerCourrierDeParcours({ ...base, prénomOuNom: ' ', sorte: 'essai_tronquee' }).texte.startsWith('Bonjour,')).toBe(true)
  })
})
