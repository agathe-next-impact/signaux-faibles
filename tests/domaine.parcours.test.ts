import { describe, expect, it } from 'vitest'
import { dateDeParis, étapeDuParcours, lectureAutorisée, semainesÉcoulées, type EntréeDuParcours } from '@/lib/domaine/parcours'

/**
 * Le parcours d'essai de l'offre du 17 octobre 2026 : trois parutions
 * complètes (J0, J+7, J+14), « L'essentiel » seul à J+21, suspension au-delà.
 */

// Activée le lundi 5 octobre 2026 à 9 h, heure de Paris.
const LUNDI_5_OCTOBRE = new Date('2026-10-05T07:00:00Z')

const entrée = (aujourdHui: string, extras: Partial<EntréeDuParcours> = {}): EntréeDuParcours => ({
  organisation: { état: 'essai', activéeLe: LUNDI_5_OCTOBRE },
  abonnement: null,
  aujourdHui,
  ...extras,
})

describe('semainesÉcoulées', () => {
  it('compte des semaines ISO, pas des tranches de sept jours', () => {
    expect(semainesÉcoulées('2026-10-09', '2026-10-11')).toBe(0) // vendredi → dimanche
    expect(semainesÉcoulées('2026-10-09', '2026-10-12')).toBe(1) // vendredi → lundi suivant
    expect(semainesÉcoulées('2026-10-05', '2026-10-26')).toBe(3)
  })

  it('franchit le changement d’année ISO', () => {
    expect(semainesÉcoulées('2026-12-28', '2027-01-04')).toBe(1)
  })
})

describe('dateDeParis', () => {
  it('prend la date de Paris, pas celle d’UTC', () => {
    // 23 h 30 UTC le dimanche est déjà lundi à Paris.
    expect(dateDeParis(new Date('2026-10-11T23:30:00Z'))).toBe('2026-10-12')
  })
})

describe('étapeDuParcours', () => {
  it('trois parutions complètes, puis « L’essentiel », puis la suspension', () => {
    expect(étapeDuParcours(entrée('2026-10-05'))).toEqual({ étape: 'essai', parution: 1 })
    expect(étapeDuParcours(entrée('2026-10-11'))).toEqual({ étape: 'essai', parution: 1 })
    expect(étapeDuParcours(entrée('2026-10-12'))).toEqual({ étape: 'essai', parution: 2 })
    expect(étapeDuParcours(entrée('2026-10-19'))).toEqual({ étape: 'essai', parution: 3 })
    expect(étapeDuParcours(entrée('2026-10-26'))).toEqual({ étape: 'tronquee' })
    expect(étapeDuParcours(entrée('2026-11-02'))).toEqual({ étape: 'suspendue', manuelle: false })
  })

  it('l’activation un vendredi soir compte dans la semaine de ce vendredi', () => {
    const vendredi = new Date('2026-10-09T20:00:00Z') // 22 h à Paris
    const e = (jour: string) => entrée(jour, { organisation: { état: 'essai', activéeLe: vendredi } })
    expect(étapeDuParcours(e('2026-10-12'))).toEqual({ étape: 'essai', parution: 2 })
  })

  it('un abonnement Stripe ouvert l’emporte sur le calendrier, à toute date', () => {
    for (const état of ['trialing', 'active']) {
      expect(étapeDuParcours(entrée('2027-03-01', { abonnement: { état } }))).toEqual({
        étape: 'abonnee',
        source: 'stripe',
        paiementEnRetard: false,
      })
    }
  })

  it('un paiement en retard ne coupe pas l’espace, mais se dit', () => {
    expect(étapeDuParcours(entrée('2027-03-01', { abonnement: { état: 'past_due' } }))).toEqual({
      étape: 'abonnee',
      source: 'stripe',
      paiementEnRetard: true,
    })
  })

  it('un abonnement résilié rend la main au calendrier', () => {
    expect(étapeDuParcours(entrée('2026-10-26', { abonnement: { état: 'canceled' } }))).toEqual({ étape: 'tronquee' })
    expect(
      étapeDuParcours(
        entrée('2027-03-01', { organisation: { état: 'abonnee', activéeLe: LUNDI_5_OCTOBRE }, abonnement: { état: 'canceled' } }),
      ),
    ).toEqual({ étape: 'suspendue', manuelle: false })
  })

  it('un client historique, abonné sans ligne Stripe, reste abonné', () => {
    expect(
      étapeDuParcours(entrée('2027-03-01', { organisation: { état: 'abonnee', activéeLe: null }, abonnement: null })),
    ).toEqual({ étape: 'abonnee', source: 'hors-stripe', paiementEnRetard: false })
  })

  it('hors parcours : demande, génération, écartée, test, ou essai sans date', () => {
    for (const état of ['demande', 'generation', 'ecartee', 'test'] as const) {
      expect(étapeDuParcours(entrée('2026-10-05', { organisation: { état, activéeLe: LUNDI_5_OCTOBRE } })).étape).toBe(
        'hors-parcours',
      )
    }
    expect(étapeDuParcours(entrée('2026-10-05', { organisation: { état: 'essai', activéeLe: null } }))).toEqual({
      étape: 'hors-parcours',
      raison: 'aucune date d’activation',
    })
  })

  it('une suspension posée à la main est respectée sans abonnement', () => {
    expect(étapeDuParcours(entrée('2026-10-05', { organisation: { état: 'suspendue', activéeLe: LUNDI_5_OCTOBRE } }))).toEqual({
      étape: 'suspendue',
      manuelle: true,
    })
  })
})

describe('lectureAutorisée', () => {
  it('tout pendant l’essai et l’abonnement, l’essentiel à J+21, rien après', () => {
    expect(lectureAutorisée({ étape: 'essai', parution: 2 })).toBe('complète')
    expect(lectureAutorisée({ étape: 'abonnee', source: 'stripe', paiementEnRetard: false })).toBe('complète')
    expect(lectureAutorisée({ étape: 'tronquee' })).toBe('essentiel')
    expect(lectureAutorisée({ étape: 'suspendue', manuelle: false })).toBe('aucune')
  })
})
