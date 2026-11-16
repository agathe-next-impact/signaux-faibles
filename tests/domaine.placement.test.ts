import { describe, expect, it } from 'vitest'
import { libelléDÉtape, étapeDuParcours, type EntréeDuParcours } from '@/lib/domaine/parcours'
import {
  aperçuDuPlacement,
  ciblesPossibles,
  cléDeCible,
  courrierAttendu,
  estUneCléDeCible,
  j0PourLaCible,
  lireUneCible,
  prochaineÉchéance,
  raisonDuRefus,
  refusDeProlonger,
  refusDuPlacement,
  semaineDuParcours,
  suiteDuHorsParcours,
  étapeDeLaCible,
  type LigneDuParcours,
} from '@/lib/domaine/placement'

const essai = (activéeLe: Date | null, parutionsDEssai: number, aujourdHui: string, extras: Partial<EntréeDuParcours['organisation']> = {}): EntréeDuParcours => ({
  organisation: { état: 'essai', activéeLe, offre: 'standard', parutionsDEssai, ...extras },
  abonnement: null,
  aujourdHui,
})

// Un lundi, un jeudi, un dimanche, et les deux semaines de changement d'heure.
const JOURS = ['2026-11-16', '2026-11-19', '2026-11-22', '2026-10-25', '2027-03-28', '2026-12-31']

describe('placer à une étape : le J0 rendu redonne l’étape visée', () => {
  for (let parutions = 1; parutions <= 8; parutions++) {
    it(`avec ${parutions} parution(s) complète(s), pour chaque cible et chaque jour`, () => {
      for (const aujourdHui of JOURS) {
        for (const cible of ciblesPossibles(parutions)) {
          const j0 = j0PourLaCible(cible, parutions, aujourdHui)
          const obtenue = étapeDuParcours(essai(j0, parutions, aujourdHui))
          expect(obtenue, `${cléDeCible(cible)} le ${aujourdHui}`).toEqual(étapeDeLaCible(cible, parutions))
        }
      }
    })
  }

  it('J0 n’est jamais posé après aujourd’hui', () => {
    for (const aujourdHui of JOURS) {
      for (const cible of ciblesPossibles(4)) {
        expect(j0PourLaCible(cible, 4, aujourdHui).toISOString().slice(0, 10) <= aujourdHui).toBe(true)
      }
    }
  })

  it('le cas du 16 novembre 2026 : Suneido (4 parutions) et Heritech (3) à la parution réduite', () => {
    expect(j0PourLaCible({ sorte: 'tronquee' }, 4, '2026-11-16').toISOString().slice(0, 10)).toBe('2026-10-19')
    expect(j0PourLaCible({ sorte: 'tronquee' }, 3, '2026-11-16').toISOString().slice(0, 10)).toBe('2026-10-26')
  })
})

describe('les clés de cible', () => {
  it('lit les parutions, la dernière, la réduite et la suspension', () => {
    expect(lireUneCible('essai-2', 3)).toEqual({ sorte: 'essai', parution: 2 })
    expect(lireUneCible('derniere', 3)).toEqual({ sorte: 'essai', parution: 3 })
    expect(lireUneCible('derniere', 2)).toEqual({ sorte: 'essai', parution: 2 })
    expect(lireUneCible('tronquee', 2)).toEqual({ sorte: 'tronquee' })
    expect(lireUneCible('suspendue', 2)).toEqual({ sorte: 'suspendue' })
  })

  it('refuse une parution au-delà de l’essai, une clé inconnue, autre chose qu’une chaîne', () => {
    expect(lireUneCible('essai-4', 3)).toBeNull()
    expect(lireUneCible('essai-0', 3)).toBeNull()
    expect(lireUneCible('essai-9', 8)).toBeNull()
    expect(lireUneCible('abonnee', 3)).toBeNull()
    expect(lireUneCible(2, 3)).toBeNull()
    expect(estUneCléDeCible('essai-4')).toBe(true)
    expect(estUneCléDeCible('essai-4; drop')).toBe(false)
  })

  it('chaque cible possible se relit par sa clé', () => {
    for (const cible of ciblesPossibles(5)) expect(lireUneCible(cléDeCible(cible), 5)).toEqual(cible)
  })
})

describe('les refus, dits avant le clic', () => {
  it('place un essai ou une abonnée historique, rien d’autre', () => {
    expect(refusDuPlacement({ état: 'essai', offre: 'standard' }, false)).toBeNull()
    expect(refusDuPlacement({ état: 'abonnee', offre: 'fondateur' }, false)).toBeNull()
    for (const état of ['demande', 'generation', 'suspendue', 'ecartee', 'test'] as const) {
      expect(refusDuPlacement({ état, offre: 'standard' }, false)).toBe('pas-en-essai')
    }
  })

  it('Stripe ouvert puis accès offert, dans cet ordre', () => {
    expect(refusDuPlacement({ état: 'essai', offre: 'standard' }, true)).toBe('abonnée-stripe')
    expect(refusDuPlacement({ état: 'abonnee', offre: 'gratuite' }, false)).toBe('accès-offert')
    expect(refusDuPlacement({ état: 'abonnee', offre: 'gratuite' }, true)).toBe('abonnée-stripe')
  })

  it('chaque raison dit quoi faire, sans tiret cadratin', () => {
    const raisons = [
      raisonDuRefus('abonnée-stripe', 'essai'),
      raisonDuRefus('accès-offert', 'abonnee'),
      raisonDuRefus('pas-en-essai', 'suspendue'),
      raisonDuRefus('pas-en-essai', 'test'),
      raisonDuRefus('pas-en-essai', 'demande'),
    ]
    expect(new Set(raisons).size).toBe(5)
    for (const r of raisons) expect(r).not.toContain('—')
    expect(raisons[2]).toContain('réactiver')
  })

  it('prolonger demande un essai dont J0 est posé', () => {
    expect(refusDeProlonger({ état: 'essai', activéeLe: new Date() })).toBeNull()
    expect(refusDeProlonger({ état: 'essai', activéeLe: null })).toContain('J0')
    expect(refusDeProlonger({ état: 'abonnee', activéeLe: new Date() })).toContain('pas en essai')
  })
})

describe('prochaine échéance', () => {
  const J0 = new Date('2026-11-02T06:00:00Z')

  it('en essai : le lundi de la parution réduite', () => {
    expect(prochaineÉchéance(essai(J0, 3, '2026-11-04'))).toEqual({ le: '2026-11-23', étape: { étape: 'tronquee' } })
    expect(prochaineÉchéance(essai(J0, 3, '2026-11-18'))).toEqual({ le: '2026-11-23', étape: { étape: 'tronquee' } })
  })

  it('à la parution réduite : le lundi de la suspension', () => {
    expect(prochaineÉchéance(essai(J0, 3, '2026-11-25'))).toEqual({ le: '2026-11-30', étape: { étape: 'suspendue', manuelle: false } })
  })

  it('rien ne vient pour une suspendue, une abonnée, un accès offert, un essai sans J0', () => {
    expect(prochaineÉchéance(essai(J0, 3, '2026-12-02'))).toBeNull()
    expect(prochaineÉchéance(essai(null, 3, '2026-11-04'))).toBeNull()
    expect(prochaineÉchéance(essai(J0, 3, '2026-11-04', { offre: 'gratuite' }))).toBeNull()
    expect(prochaineÉchéance({ ...essai(J0, 3, '2026-11-04'), abonnement: { état: 'active' } })).toBeNull()
    expect(prochaineÉchéance(essai(J0, 3, '2026-11-04', { état: 'suspendue' }))).toBeNull()
  })

  it('un J0 dans le futur : l’entrée en essai', () => {
    expect(prochaineÉchéance(essai(new Date('2026-11-30T06:00:00Z'), 2, '2026-11-18'))).toEqual({
      le: '2026-11-30',
      étape: { étape: 'essai', parution: 1, parutions: 2 },
    })
  })
})

describe('le courrier attendu suit les règles du passage quotidien', () => {
  const J0 = new Date('2026-11-02T06:00:00Z')

  it('rappel à la deuxième parution d’un essai de trois au moins, dernière parution, réduite, première semaine de suspension', () => {
    expect(courrierAttendu(essai(J0, 3, '2026-11-03'))).toBeNull()
    expect(courrierAttendu(essai(J0, 3, '2026-11-10'))).toBe('essai_rappel_j7')
    expect(courrierAttendu(essai(J0, 3, '2026-11-17'))).toBe('essai_derniere_parution')
    expect(courrierAttendu(essai(J0, 3, '2026-11-24'))).toBe('essai_tronquee')
    expect(courrierAttendu(essai(J0, 3, '2026-12-01'))).toBe('essai_suspendu')
    expect(courrierAttendu(essai(J0, 3, '2026-12-08'))).toBeNull()
  })

  it('aucun pour une abonnée historique dont le calendrier reprend, ni sans J0', () => {
    expect(courrierAttendu(essai(J0, 3, '2026-11-24', { état: 'abonnee' }))).toBeNull()
    expect(courrierAttendu(essai(null, 3, '2026-11-24'))).toBeNull()
  })
})

describe('aperçu du placement', () => {
  it('dit J0, l’étape, la lecture, le courrier et l’échéance suivante', () => {
    const aperçu = aperçuDuPlacement({ sorte: 'tronquee' }, { offre: 'standard', parutionsDEssai: 3 }, '2026-11-16')
    expect(aperçu).toEqual({
      j0: '2026-10-26',
      étape: { étape: 'tronquee' },
      lecture: 'essentiel',
      courrier: 'essai_tronquee',
      échéance: { le: '2026-11-23', étape: { étape: 'suspendue', manuelle: false } },
    })
  })

  it('la suspension placée est la première semaine : son courrier est dû', () => {
    const aperçu = aperçuDuPlacement({ sorte: 'suspendue' }, { offre: 'standard', parutionsDEssai: 2 }, '2026-11-16')
    expect(aperçu).toMatchObject({ lecture: 'aucune', courrier: 'essai_suspendu', échéance: null })
  })
})

describe('la semaine du parcours', () => {
  const ligne = (slug: string, extras: Partial<LigneDuParcours>): LigneDuParcours => ({
    slug,
    nom: slug,
    état: 'essai',
    activéeLe: null,
    offre: 'standard',
    parutionsDEssai: 2,
    abonnement: null,
    ...extras,
  })

  it('range ce qui est dû cette semaine et ce qui change lundi', () => {
    const lignes = [
      ligne('reduite', { activéeLe: new Date('2026-11-02T06:00:00Z') }), // réduite cette semaine, suspendue lundi
      ligne('derniere', { activéeLe: new Date('2026-11-09T06:00:00Z') }), // dernière parution, réduite lundi
      ligne('debut', { activéeLe: new Date('2026-11-16T06:00:00Z') }), // parution 1 sur 2 : dernière lundi
      ligne('abonnee', { état: 'abonnee' }),
      ligne('sans-j0', {}),
      ligne('payee', { activéeLe: new Date('2026-11-02T06:00:00Z'), abonnement: { état: 'active' } }),
    ]
    const { cetteSemaine, lundiProchain } = semaineDuParcours(lignes, '2026-11-18')
    expect(cetteSemaine.map((m) => [m.slug, m.courrier])).toEqual([
      ['reduite', 'essai_tronquee'],
      ['derniere', 'essai_derniere_parution'],
    ])
    expect(lundiProchain.map((m) => [m.slug, libelléDÉtape(m.étape), m.courrier, m.le])).toEqual([
      ['reduite', 'suspendue · essai terminé', 'essai_suspendu', '2026-11-23'],
      ['derniere', 'fin d’essai · l’essentiel seul', 'essai_tronquee', '2026-11-23'],
      ['debut', 'essai · parution 2 sur 2', 'essai_derniere_parution', '2026-11-23'],
    ])
  })
})

describe('un hors parcours dit ce qu’il attend', () => {
  const hors = (raison: string) => ({ étape: 'hors-parcours', raison }) as const

  it('essai sans J0 : la première lettre publiée, ou un placement', () => {
    const suite = suiteDuHorsParcours(hors('aucune date d’activation'), { état: 'essai', activéeLe: null, essaiOuvertLe: new Date() })
    expect(suite).toContain('première lettre publiée')
    expect(suite).toContain('Envoyé')
  })

  it('prospection, futur, écartée, test, avant l’essai', () => {
    expect(suiteDuHorsParcours(hors('aucune date d’activation'), { état: 'essai', activéeLe: null, essaiOuvertLe: null })).toContain('première visite')
    expect(suiteDuHorsParcours(hors('activation dans le futur'), { état: 'essai', activéeLe: new Date('2026-12-07T06:00:00Z'), essaiOuvertLe: new Date() })).toContain('7 décembre 2026')
    expect(suiteDuHorsParcours(hors('écartée'), { état: 'ecartee', activéeLe: null, essaiOuvertLe: null })).toContain('Réactiver')
    expect(suiteDuHorsParcours(hors('organisation de test'), { état: 'test', activéeLe: null, essaiOuvertLe: null })).toContain('test')
    expect(suiteDuHorsParcours(hors('pas encore activée'), { état: 'demande', activéeLe: null, essaiOuvertLe: null })).toContain('onboarding')
  })

  it('rien à dire d’une organisation dans le parcours', () => {
    expect(suiteDuHorsParcours({ étape: 'tronquee' }, { état: 'essai', activéeLe: new Date(), essaiOuvertLe: new Date() })).toBeNull()
  })
})
