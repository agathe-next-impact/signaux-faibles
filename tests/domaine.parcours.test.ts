import { describe, expect, it } from 'vitest'
import {
  dateDeParis,
  dateLongueDeParis,
  libelléDÉtape,
  étapeDuParcours,
  lectureAutorisée,
  semainesÉcoulées,
  type EntréeDuParcours,
} from '@/lib/domaine/parcours'

/**
 * Le parcours d'essai de l'offre du 17 octobre 2026 : trois parutions
 * complètes (J0, J+7, J+14), « L'essentiel » seul à J+21, suspension au-delà.
 */

// Activée le lundi 5 octobre 2026 à 9 h, heure de Paris.
const LUNDI_5_OCTOBRE = new Date('2026-10-05T07:00:00Z')

const entrée = (aujourdHui: string, extras: Partial<EntréeDuParcours> = {}): EntréeDuParcours => ({
  organisation: { état: 'essai', activéeLe: LUNDI_5_OCTOBRE, offre: 'standard', parutionsDEssai: 3 },
  abonnement: null,
  aujourdHui,
  ...extras,
})

/** Une organisation standard à trois parutions, avec ce qui change. */
const org = (extras: Partial<EntréeDuParcours['organisation']>): EntréeDuParcours['organisation'] => ({
  état: 'essai',
  activéeLe: LUNDI_5_OCTOBRE,
  offre: 'standard',
  parutionsDEssai: 3,
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
    expect(étapeDuParcours(entrée('2026-10-05'))).toEqual({ étape: 'essai', parution: 1, parutions: 3 })
    expect(étapeDuParcours(entrée('2026-10-11'))).toEqual({ étape: 'essai', parution: 1, parutions: 3 })
    expect(étapeDuParcours(entrée('2026-10-12'))).toEqual({ étape: 'essai', parution: 2, parutions: 3 })
    expect(étapeDuParcours(entrée('2026-10-19'))).toEqual({ étape: 'essai', parution: 3, parutions: 3 })
    expect(étapeDuParcours(entrée('2026-10-26'))).toEqual({ étape: 'tronquee' })
    expect(étapeDuParcours(entrée('2026-11-02'))).toEqual({ étape: 'suspendue', manuelle: false })
  })

  it('l’activation un vendredi soir compte dans la semaine de ce vendredi', () => {
    const vendredi = new Date('2026-10-09T20:00:00Z') // 22 h à Paris
    const e = (jour: string) => entrée(jour, { organisation: org({ activéeLe: vendredi }) })
    expect(étapeDuParcours(e('2026-10-12'))).toEqual({ étape: 'essai', parution: 2, parutions: 3 })
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
        entrée('2027-03-01', { organisation: org({ état: 'abonnee' }), abonnement: { état: 'canceled' } }),
      ),
    ).toEqual({ étape: 'suspendue', manuelle: false })
  })

  it('un client historique, abonné sans ligne Stripe, reste abonné', () => {
    expect(
      étapeDuParcours(entrée('2027-03-01', { organisation: org({ état: 'abonnee', activéeLe: null }), abonnement: null })),
    ).toEqual({ étape: 'abonnee', source: 'hors-stripe', paiementEnRetard: false })
  })

  it('hors parcours : demande, génération, écartée, test, ou essai sans date', () => {
    for (const état of ['demande', 'generation', 'ecartee', 'test'] as const) {
      expect(étapeDuParcours(entrée('2026-10-05', { organisation: org({ état }) })).étape).toBe(
        'hors-parcours',
      )
    }
    expect(étapeDuParcours(entrée('2026-10-05', { organisation: org({ activéeLe: null }) }))).toEqual({
      étape: 'hors-parcours',
      raison: 'aucune date d’activation',
    })
  })

  it('une suspension posée à la main est respectée sans abonnement', () => {
    expect(étapeDuParcours(entrée('2026-10-05', { organisation: org({ état: 'suspendue' }) }))).toEqual({
      étape: 'suspendue',
      manuelle: true,
    })
  })
})

describe('lectureAutorisée', () => {
  it('tout pendant l’essai et l’abonnement, l’essentiel à J+21, rien après', () => {
    expect(lectureAutorisée({ étape: 'essai', parution: 2, parutions: 3 })).toBe('complète')
    expect(lectureAutorisée({ étape: 'abonnee', source: 'stripe', paiementEnRetard: false })).toBe('complète')
    expect(lectureAutorisée({ étape: 'tronquee' })).toBe('essentiel')
    expect(lectureAutorisée({ étape: 'suspendue', manuelle: false })).toBe('aucune')
  })
})

describe('libelléDÉtape', () => {
  it('nomme chaque étape en minuscules, pour la police mono des labels', () => {
    expect(libelléDÉtape({ étape: 'essai', parution: 2, parutions: 3 })).toBe('essai · parution 2 sur 3')
    expect(libelléDÉtape({ étape: 'abonnee', source: 'offerte', paiementEnRetard: false })).toBe('accès offert')
    expect(libelléDÉtape({ étape: 'tronquee' })).toBe('fin d’essai · l’essentiel seul')
    expect(libelléDÉtape({ étape: 'abonnee', source: 'stripe', paiementEnRetard: false })).toBe('abonnée')
    expect(libelléDÉtape({ étape: 'abonnee', source: 'hors-stripe', paiementEnRetard: false })).toBe('abonnée · hors stripe')
    expect(libelléDÉtape({ étape: 'abonnee', source: 'stripe', paiementEnRetard: true })).toBe('abonnée · paiement en retard')
    expect(libelléDÉtape({ étape: 'suspendue', manuelle: true })).toBe('suspendue par l’opératrice')
    expect(libelléDÉtape({ étape: 'suspendue', manuelle: false })).toBe('suspendue · essai terminé')
    expect(libelléDÉtape({ étape: 'hors-parcours', raison: 'pas encore activée' })).toBe('hors parcours · pas encore activée')
  })
})

describe('dateLongueDeParis', () => {
  it('écrit la date en toutes lettres, en heure de Paris', () => {
    // 23 h 30 UTC le 4 octobre : déjà le 5 à Paris.
    expect(dateLongueDeParis(new Date('2026-10-04T23:30:00Z'))).toBe('5 octobre 2026')
  })
})

describe('offre et parutions réglées (19 octobre 2026)', () => {
  it('quatre parutions complètes : l’essentiel à J+28, suspension à J+35', () => {
    const quatre = (jour: string) => étapeDuParcours(entrée(jour, { organisation: org({ parutionsDEssai: 4 }) }))
    expect(quatre('2026-10-26')).toEqual({ étape: 'essai', parution: 4, parutions: 4 })
    expect(quatre('2026-11-02')).toEqual({ étape: 'tronquee' })
    expect(quatre('2026-11-09')).toEqual({ étape: 'suspendue', manuelle: false })
  })

  it('un accès offert ne se ferme jamais, quel que soit le calendrier ou Stripe', () => {
    expect(étapeDuParcours(entrée('2027-06-01', { organisation: org({ offre: 'gratuite' }) }))).toEqual({
      étape: 'abonnee',
      source: 'offerte',
      paiementEnRetard: false,
    })
    expect(
      étapeDuParcours(entrée('2027-06-01', { organisation: org({ état: 'abonnee', offre: 'gratuite', activéeLe: null }), abonnement: { état: 'canceled' } })).étape,
    ).toBe('abonnee')
    // Une suspension posée à la main prime toujours.
    expect(étapeDuParcours(entrée('2026-10-05', { organisation: org({ état: 'suspendue', offre: 'gratuite' }) })).étape).toBe('suspendue')
  })
})

describe('étapeVueDuPrescripteur', () => {
  it('ne dit au prescripteur que quatre mots, jamais le détail', async () => {
    const { étapeVueDuPrescripteur } = await import('@/lib/domaine/prescripteurs')
    expect(étapeVueDuPrescripteur({ étape: 'hors-parcours', raison: 'aucune date d’activation' })).toBe('en préparation')
    expect(étapeVueDuPrescripteur({ étape: 'essai', parution: 2, parutions: 4 })).toBe('en essai')
    expect(étapeVueDuPrescripteur({ étape: 'abonnee', source: 'offerte', paiementEnRetard: false })).toBe('abonnée')
    expect(étapeVueDuPrescripteur({ étape: 'abonnee', source: 'stripe', paiementEnRetard: true })).toBe('abonnée')
    expect(étapeVueDuPrescripteur({ étape: 'tronquee' })).toBe('essai terminé')
    expect(étapeVueDuPrescripteur({ étape: 'suspendue', manuelle: true })).toBe('essai terminé')
  })
})
