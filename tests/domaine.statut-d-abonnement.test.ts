import { describe, expect, it } from 'vitest'
import { étapeDuParcours, type ÉtatOrganisation, type Offre } from '@/lib/domaine/parcours'
import { grouperParStatut, ORDRE_DES_STATUTS, statutDAbonnement } from '@/lib/domaine/statut-d-abonnement'

/**
 * Le groupement du tableau des abonnements (12 novembre 2026) : le statut se
 * lit dans l'étape du parcours, jamais dans une donnée de plus.
 */

const AUJOURDHUI = '2026-11-12'

function statut(
  état: ÉtatOrganisation,
  { activéeLe = null, offre = 'standard', abonnement = null }: { activéeLe?: string | null; offre?: Offre; abonnement?: string | null } = {},
) {
  const étape = étapeDuParcours({
    organisation: { état, activéeLe: activéeLe ? new Date(`${activéeLe}T08:00:00Z`) : null, offre, parutionsDEssai: 2 },
    abonnement: abonnement ? { état: abonnement } : null,
    aujourdHui: AUJOURDHUI,
  })
  return statutDAbonnement(étape, état)
}

describe('statutDAbonnement', () => {
  it('range un abonnement Stripe, même en retard de paiement, et un client historique parmi les abonnées', () => {
    expect(statut('abonnee', { abonnement: 'active' })).toBe('abonnee')
    expect(statut('essai', { activéeLe: '2026-09-07', abonnement: 'past_due' })).toBe('abonnee')
    expect(statut('abonnee')).toBe('abonnee')
  })

  it('met l’accès offert à part', () => {
    expect(statut('essai', { offre: 'gratuite' })).toBe('offerte')
    expect(statut('abonnee', { offre: 'gratuite' })).toBe('offerte')
  })

  it('suit le calendrier de l’essai', () => {
    expect(statut('essai', { activéeLe: '2026-11-09' })).toBe('essai')
    expect(statut('essai', { activéeLe: '2026-11-02' })).toBe('essai')
    expect(statut('essai', { activéeLe: '2026-10-26' })).toBe('tronquee')
    expect(statut('essai', { activéeLe: '2026-10-19' })).toBe('suspendue')
  })

  it('range la suspension à la main avec les suspendues, même payante', () => {
    expect(statut('suspendue', { abonnement: 'active' })).toBe('suspendue')
  })

  it('partage le hors parcours par l’état, pas par le libellé de la raison', () => {
    expect(statut('demande')).toBe('avant-parcours')
    expect(statut('generation')).toBe('avant-parcours')
    expect(statut('essai')).toBe('avant-parcours')
    expect(statut('essai', { activéeLe: '2026-11-30' })).toBe('avant-parcours')
    expect(statut('ecartee', { abonnement: 'active' })).toBe('ecartee')
    expect(statut('test')).toBe('test')
  })
})

describe('grouperParStatut', () => {
  it('suit l’ordre des statuts, omet les groupes vides et garde l’ordre d’origine dans chaque groupe', () => {
    const lignes = [
      { nom: 'Alpha', statut: 'essai' },
      { nom: 'Bravo', statut: 'abonnee' },
      { nom: 'Charlie', statut: 'essai' },
      { nom: 'Delta', statut: 'test' },
    ] as const
    const groupes = grouperParStatut(lignes, (l) => l.statut)
    expect(groupes.map((g) => [g.statut, g.libellé, g.éléments.map((l) => l.nom)])).toEqual([
      ['abonnee', 'Abonnées', ['Bravo']],
      ['essai', 'En essai', ['Alpha', 'Charlie']],
      ['test', 'Organisations de test', ['Delta']],
    ])
  })

  it('ne perd ni ne double aucune ligne', () => {
    const lignes = ORDRE_DES_STATUTS.flatMap((s, i) => Array.from({ length: i + 1 }, () => s))
    const groupes = grouperParStatut(lignes, (s) => s)
    expect(groupes.reduce((n, g) => n + g.éléments.length, 0)).toBe(lignes.length)
    expect(groupes.map((g) => g.statut)).toEqual(ORDRE_DES_STATUTS)
  })

  it('rend une liste vide pour aucune ligne', () => {
    expect(grouperParStatut([], () => 'essai')).toEqual([])
  })
})
