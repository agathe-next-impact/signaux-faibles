import { describe, expect, it } from 'vitest'
import {
  composerCourrierDAbonnement,
  composerCourrierDeParcours,
  courrierDuChangementDAbonnement,
  courrierDuParcours,
} from '@/lib/domaine/courriers-parcours'

describe('courrierDuParcours', () => {
  it('déclenche au rappel J+7, à la dernière parution complète, à la parution réduite et à la première semaine de suspension', () => {
    expect(courrierDuParcours({ étape: 'essai', parution: 1, parutions: 3 })).toBeNull()
    expect(courrierDuParcours({ étape: 'essai', parution: 2, parutions: 3 })).toBe('essai_rappel_j7')
    expect(courrierDuParcours({ étape: 'essai', parution: 2, parutions: 4 })).toBe('essai_rappel_j7')
    // Deux parutions réglées : la deuxième est la dernière, pas un rappel.
    expect(courrierDuParcours({ étape: 'essai', parution: 2, parutions: 2 })).toBe('essai_derniere_parution')
    expect(courrierDuParcours({ étape: 'essai', parution: 3, parutions: 3 })).toBe('essai_derniere_parution')
    // Quatre parutions réglées : la troisième n'est plus la dernière.
    expect(courrierDuParcours({ étape: 'essai', parution: 3, parutions: 4 })).toBeNull()
    expect(courrierDuParcours({ étape: 'essai', parution: 4, parutions: 4 })).toBe('essai_derniere_parution')
    expect(courrierDuParcours({ étape: 'tronquee' })).toBe('essai_tronquee')
    expect(courrierDuParcours({ étape: 'suspendue', manuelle: false })).toBeNull()
    expect(courrierDuParcours({ étape: 'suspendue', manuelle: false }, true)).toBe('essai_suspendu')
    expect(courrierDuParcours({ étape: 'suspendue', manuelle: true }, true)).toBeNull()
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

  for (const sorte of ['essai_rappel_j7', 'essai_derniere_parution', 'essai_tronquee', 'essai_suspendu'] as const) {
    it(`${sorte} : liens, prix, et aucune tournure interdite`, () => {
      const { sujet, texte } = composerCourrierDeParcours({ ...base, sorte })
      expect(texte).toContain('https://www.signauxfaibles.io/acme')
      expect(texte).toContain('https://www.signauxfaibles.io/recevoir-mon-lien')
      expect(texte).toContain('149 € HT par mois')
      expect(texte).toContain('1 490 € HT par an')
      expect(texte.startsWith('Bonjour Léa,')).toBe(true)
      expect(`${sujet}${texte}`).not.toContain('—')
      expect(sujet).toMatch(/^[A-ZÉ]/u)
      expect(sujet).not.toMatch(/[A-Z]{3,}/)
    })

    it(`${sorte} : le même courriel à la charte, bouton vers l’abonnement et pied client`, () => {
      const { html } = composerCourrierDeParcours({ ...base, sorte, destinataire: 'lea@acme.test', adressePostale: '1 place Exemple' })
      expect(html).toContain('href="https://www.signauxfaibles.io/acme/abonnement"')
      expect(html).toContain(sorte === 'essai_rappel_j7' ? 'Ouvrir mon espace' : 'M’abonner')
      expect(html.match(/class="btn-primary/g)).toHaveLength(1)
      expect(html).toContain('href="https://www.signauxfaibles.io/recevoir-mon-lien"')
      expect(html).toContain('149 € HT par mois')
      expect(html).toContain('lea@acme.test')
      expect(html).toContain('Gérer mon abonnement')
      expect(html).toContain('1 place Exemple')
      expect(html).not.toContain('—')
    })
  }

  it('écrit le nombre de parutions réglé, et le tarif fondateur quand c’est l’offre', () => {
    const quatre = composerCourrierDeParcours({ ...base, sorte: 'essai_derniere_parution', parutions: 4 }).texte
    expect(quatre).toContain('quatre parutions complètes')
    const early = composerCourrierDeParcours({ ...base, sorte: 'essai_tronquee', offre: 'fondateur' }).texte
    expect(early).toContain('29 € HT par mois')
    expect(early).not.toContain('1 490 € HT par an')
  })

  it('salue sans nom quand il manque', () => {
    expect(composerCourrierDeParcours({ ...base, prénomOuNom: ' ', sorte: 'essai_tronquee' }).texte.startsWith('Bonjour,')).toBe(true)
  })
})

describe('courrierDuChangementDAbonnement', () => {
  it('confirme un abonnement ouvert, signale un paiement refusé et une résiliation, et rien d’autre', () => {
    expect(courrierDuChangementDAbonnement(null, 'active')).toBe('abonnement_confirme')
    expect(courrierDuChangementDAbonnement(null, 'trialing')).toBe('abonnement_confirme')
    expect(courrierDuChangementDAbonnement('incomplete', 'active')).toBe('abonnement_confirme')
    expect(courrierDuChangementDAbonnement('trialing', 'active')).toBeNull()
    // Un paiement régularisé n'est pas un abonnement neuf.
    expect(courrierDuChangementDAbonnement('past_due', 'active')).toBeNull()
    expect(courrierDuChangementDAbonnement('active', 'past_due')).toBe('paiement_echec')
    expect(courrierDuChangementDAbonnement('past_due', 'canceled')).toBe('abonnement_resilie')
    expect(courrierDuChangementDAbonnement('active', 'active')).toBeNull()
    expect(courrierDuChangementDAbonnement('canceled', 'canceled')).toBeNull()
    expect(courrierDuChangementDAbonnement(null, 'incomplete')).toBeNull()
    expect(courrierDuChangementDAbonnement('past_due', 'unpaid')).toBeNull()
  })
})

describe('composerCourrierDAbonnement', () => {
  const base = {
    prénomOuNom: 'Léa',
    organisation: 'Acme',
    slug: 'acme',
    portailUrl: 'https://www.signauxfaibles.io/',
    formule: 'annuelle' as const,
    périodeFin: new Date('2026-11-20T10:00:00Z'),
  }

  for (const sorte of ['abonnement_confirme', 'paiement_echec', 'abonnement_renouvellement', 'abonnement_resilie'] as const) {
    it(`${sorte} : à la charte, un seul bouton, la page d’abonnement, sans tiret cadratin`, () => {
      const { sujet, texte, html } = composerCourrierDAbonnement({ ...base, sorte, destinataire: 'lea@acme.test' })
      expect(texte.startsWith('Bonjour Léa,')).toBe(true)
      expect(`${texte}${html}`).toContain('https://www.signauxfaibles.io/acme/abonnement')
      expect(html.match(/class="btn-primary/g)).toHaveLength(1)
      expect(html).toContain('lea@acme.test')
      expect(`${sujet}${texte}${html}`).not.toContain('—')
      expect(sujet).toMatch(/^[A-ZÉ]/u)
      expect(sujet).not.toMatch(/[A-Z]{3,}/)
    })
  }

  it('le renouvellement écrit l’échéance en toutes lettres et le tarif annuel', () => {
    const { sujet, texte } = composerCourrierDAbonnement({ ...base, sorte: 'abonnement_renouvellement' })
    expect(sujet).toContain('20 novembre 2026')
    expect(texte).toContain('1 490 € HT par an')
  })

  it('la confirmation nomme la formule que Stripe donne, et rien quand il ne la donne pas', () => {
    expect(composerCourrierDAbonnement({ ...base, sorte: 'abonnement_confirme', formule: 'mensuelle' }).texte).toContain('formule mensuelle')
    expect(composerCourrierDAbonnement({ ...base, sorte: 'abonnement_confirme', formule: null }).texte).not.toContain('formule')
  })
})
