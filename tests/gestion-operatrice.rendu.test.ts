import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Parcours, Résumé, Section, VeilleHebdomadaire } from '@/components/gestion-operatrice'
import { AperçuDeSérie, CetteSemaine, RetourDeSérie } from '@/components/serie-operatrice'
import type { LigneDAbonnement } from '@/lib/base/situation'
import type { VeilleListée } from '@/lib/base/veilles'
import { aperçuDeLaSérie, lireUnLot, semaineDuParcours } from '@/lib/domaine/placement'

// Le lundi 16 novembre 2026, à Paris : le jour où Suneido et Heritech ont été
// calées à la main sur la parution réduite.
const AUJOURD_HUI = new Date('2026-11-16T09:00:00Z')

const ligne = (extras: Partial<LigneDAbonnement> = {}): LigneDAbonnement => ({
  slug: 'heritech',
  nom: 'Heritech',
  état: 'essai',
  activéeLe: new Date('2026-11-02T06:00:00Z'),
  essaiOuvertLe: new Date('2026-10-28T10:00:00Z'),
  relectureRequise: false,
  offre: 'standard',
  parutionsDEssai: 3,
  abonnement: null,
  lecteursActifs: 2,
  ...extras,
})

const rendre = (élément: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(élément)
const texte = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/\s+/g, ' ')

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(AUJOURD_HUI)
})
afterEach(() => {
  vi.useRealTimers()
})

describe('la section « Parcours » de la fiche', () => {
  it('le résumé en tête dit l’étape, ce qui vient, les lecteurs et la santé', () => {
    const lu = texte(rendre(createElement(Résumé, { ligne: ligne(), archivéeLe: null, santé: 'aucun défaut' })))
    expect(lu).toContain('essai · parution 3 sur 3')
    expect(lu).toContain('fin d’essai · l’essentiel seul, le 23 novembre 2026')
    expect(lu).toContain('2 sur 3')
    expect(lu).toContain('aucun défaut')
    const archivée = texte(rendre(createElement(Résumé, { ligne: null, archivéeLe: new Date('2026-11-13T10:00:00Z'), santé: null })))
    expect(archivée).toContain('archivée le 13 novembre 2026')
  })

  it('propose chaque étape de l’essai, sans rien écrire', () => {
    const html = rendre(createElement(Parcours, { ligne: ligne(), statut: null, cibleDemandée: undefined }))
    const lu = texte(html)
    for (const clé of ['essai-1', 'essai-2', 'essai-3', 'tronquee', 'suspendue']) expect(html).toContain(`value="${clé}"`)
    expect(html).not.toContain('value="essai-4"')
    // Rien n'est écrit par ce formulaire : il demande l'aperçu.
    expect(html).toContain('method="get"')
    expect(lu).not.toContain('Confirmer le placement')
  })

  it('montre l’effet avant de confirmer : J0, lecture, brouillon, suite, lecteurs', () => {
    const html = rendre(createElement(Parcours, { ligne: ligne(), statut: null, cibleDemandée: 'tronquee' }))
    const lu = texte(html)
    expect(lu).toContain('fin d’essai · l’essentiel seul · J0 au 26/10/2026 · l’essentiel seul, dès maintenant')
    expect(lu).toContain('brouillon « parution réduite » par lecteur actif')
    expect(lu).toContain('Ensuite : suspendue · essai terminé, le 23 novembre 2026')
    expect(lu).toContain('2 lecteurs actifs concernés')
    expect(lu).toContain('Confirmer le placement')
    expect(html).toContain('name="cible" value="tronquee"')
  })

  it('une étape hors de l’essai n’a ni aperçu ni confirmation', () => {
    const lu = texte(rendre(createElement(Parcours, { ligne: ligne({ parutionsDEssai: 2 }), statut: null, cibleDemandée: 'essai-3' })))
    expect(lu).toContain('Cette étape n’existe pas dans son essai')
    expect(lu).not.toContain('Confirmer le placement')
  })

  it('un essai sans J0 dit ce qu’il attend, et se place quand même', () => {
    const lu = texte(rendre(createElement(Parcours, { ligne: ligne({ activéeLe: null }), statut: null, cibleDemandée: undefined })))
    expect(lu).toContain('première lettre publiée')
    expect(lu).toContain('Voir l’effet')
    // Prolonger reste montré, grisé, avec sa raison.
    expect(lu).toContain('prolonger l’essai · indisponible')
    expect(lu).toContain('J0 n’est pas encore posé')
  })

  it('un abonnement Stripe ouvert : placer est grisé, avec sa raison, même si une étape est demandée', () => {
    const abonnée = ligne({ abonnement: { état: 'active', formule: 'mensuelle', périodeFin: null, abonnementStripe: 'sub_1' } })
    const html = rendre(createElement(Parcours, { ligne: abonnée, statut: null, cibleDemandée: 'tronquee' }))
    const lu = texte(html)
    expect(lu).toContain('placer · indisponible')
    expect(lu).toContain('Un abonnement Stripe est ouvert')
    expect(lu).not.toContain('Confirmer le placement')
    expect(html).not.toContain('name="placer"')
  })

  it('accès offert et organisation suspendue : la raison dit quoi faire', () => {
    expect(texte(rendre(createElement(Parcours, { ligne: ligne({ état: 'abonnee', offre: 'gratuite' }), statut: null, cibleDemandée: undefined })))).toContain(
      'Repasser l’offre en standard',
    )
    expect(texte(rendre(createElement(Parcours, { ligne: ligne({ état: 'suspendue' }), statut: null, cibleDemandée: undefined })))).toContain('la réactiver d’abord')
  })

  it('placer une abonnée hors Stripe le dit avant de confirmer', () => {
    const lu = texte(rendre(createElement(Parcours, { ligne: ligne({ état: 'abonnee', activéeLe: null }), statut: null, cibleDemandée: 'derniere' })))
    expect(lu).toContain('abonnée hors Stripe : la placer la fait entrer dans le parcours d’essai')
    expect(lu).toContain('Confirmer le placement')
    const [effet] = aperçuDeLaSérie(lireUnLot('placer:derniere')!, [ligne({ état: 'abonnee', activéeLe: null })], '2026-11-16')
    expect(effet).toMatchObject({ possible: true })
    expect(effet && effet.possible ? effet.effet : '').toContain('quitte « abonnée hors Stripe »')
  })

  it('aucune adresse ni identifiant d’accès dans le rendu', () => {
    const html = rendre(createElement(Parcours, { ligne: ligne(), statut: null, cibleDemandée: 'tronquee' }))
    expect(html).not.toMatch(/@[a-z0-9-]+\.[a-z]{2,}/i)
  })
})

describe('les anciennes ancres de la fiche', () => {
  it('une section regroupée garde les ancres d’avant et affiche le message qui y revenait', () => {
    const html = rendre(
      createElement(Section, { id: 'cycle', anciens: ['decision', 'archivage'], titre: 'Cycle de vie', statut: { section: 'decision', message: 'Décision appliquée.' } } as never, 'contenu'),
    )
    expect(html).toContain('id="cycle"')
    expect(html).toContain('id="decision"')
    expect(html).toContain('id="archivage"')
    expect(html).toContain('Décision appliquée.')
    const ailleurs = rendre(createElement(Section, { id: 'outils', anciens: ['pilote'], titre: 'Outils', statut: { section: 'decision', message: 'Décision appliquée.' } } as never, 'contenu'))
    expect(ailleurs).not.toContain('Décision appliquée.')
  })
})

describe('la section « Veille hebdomadaire »', () => {
  const veille = (extras: Partial<VeilleListée> = {}): VeilleListée => ({
    id: 'v-1',
    slug: 'heritech',
    type: 'unique',
    libellé: 'Veille Heritech',
    jourParution: 4,
    heureParution: '06:30:00',
    cadence: 'hebdomadaire',
    numéroCourant: 7,
    état: 'active',
    referentielNotion: null,
    ...extras,
  })

  it('sans veille déclarée : dit où se règle le calendrier des tâches Notion', () => {
    const lu = texte(rendre(createElement(VeilleHebdomadaire, { slug: 'heritech', veilles: [], statut: null })))
    expect(lu).toContain('Aucune veille déclarée au portail')
    expect(lu).toContain('registre')
    expect(lu).not.toContain('Régler')
  })

  it('montre le numéro, la prochaine parution calculée, et le formulaire prérempli', () => {
    const html = rendre(createElement(VeilleHebdomadaire, { slug: 'heritech', veilles: [veille()], statut: null }))
    const lu = texte(html)
    expect(lu).toContain('dernier numéro attribué : 7')
    // Un jeudi, à partir du lundi 16 novembre : le 19.
    expect(lu).toContain('Prochaine parution : 19 novembre 2026, à 06:30')
    expect(html).toContain('name="heure" value="06:30"')
    expect(html).toMatch(/<option value="4" selected="">jeudi<\/option>/)
    expect(html).toContain('name="type" value="unique"')
  })

  it('une veille non active n’annonce aucune parution', () => {
    const lu = texte(rendre(createElement(VeilleHebdomadaire, { slug: 'heritech', veilles: [veille({ état: 'suspendue' })], statut: null })))
    expect(lu).toContain('aucune parution planifiée')
  })
})

describe('le tableau : ce qui vient, et les gestes en série', () => {
  const lignes = [
    ligne({ slug: 'suneido', nom: 'Suneido', parutionsDEssai: 4, activéeLe: new Date('2026-10-19T06:00:00Z') }),
    ligne({ slug: 'heritech', nom: 'Heritech', parutionsDEssai: 3, activéeLe: new Date('2026-10-26T06:00:00Z') }),
    ligne({ slug: 'eclairion', nom: 'Eclairion', parutionsDEssai: 2, activéeLe: null }),
    ligne({ slug: 'payee', nom: 'Payée', abonnement: { état: 'active', formule: null, périodeFin: null, abonnementStripe: 'sub_9' } }),
  ]

  it('« Cette semaine » : les brouillons dus et les changements de lundi', () => {
    const lu = texte(rendre(createElement(CetteSemaine, { semaine: semaineDuParcours(lignes, '2026-11-16') })))
    expect(lu).toContain('Suneido fin d’essai · l’essentiel seul · parution réduite')
    expect(lu).toContain('Heritech fin d’essai · l’essentiel seul · parution réduite')
    expect(lu).toContain('lundi prochain, 23 novembre 2026')
    expect(lu).toContain('Suneido suspendue · essai terminé · espace suspendu')
    expect(lu).not.toContain('Eclairion')
    expect(lu).not.toContain('Payée')
  })

  it('« Cette semaine » ne s’affiche pas quand rien ne se joue', () => {
    expect(rendre(createElement(CetteSemaine, { semaine: semaineDuParcours([lignes[2]!, lignes[3]!], '2026-11-16') }))).toBe('')
  })

  it('l’aperçu d’une série dit l’effet par organisation et n’envoie que les possibles', () => {
    const lot = lireUnLot('placer:tronquee')!
    const html = rendre(createElement(AperçuDeSérie, { lot: 'placer:tronquee', libellé: 'Placer : parution réduite', effets: aperçuDeLaSérie(lot, lignes, '2026-11-16') }))
    const lu = texte(html)
    expect(lu).toContain('Suneido fin d’essai · l’essentiel seul · J0 au 19/10/2026')
    expect(lu).toContain('Heritech fin d’essai · l’essentiel seul · J0 au 26/10/2026')
    expect(lu).toContain('Eclairion fin d’essai · l’essentiel seul · J0 au 02/11/2026')
    expect(lu).toContain('Payée indisponible Un abonnement Stripe est ouvert')
    expect(lu).toContain('Confirmer pour 3 organisations')
    expect(html).toContain('name="lot" value="placer:tronquee"')
    for (const slug of ['suneido', 'heritech', 'eclairion']) expect(html).toContain(`name="o" value="${slug}"`)
    expect(html).not.toContain('name="o" value="payee"')
  })

  it('sans organisation cochée, ou sans geste possible : rien à confirmer', () => {
    const vide = texte(rendre(createElement(AperçuDeSérie, { lot: 'prolonger:1', libellé: 'Prolonger', effets: [] })))
    expect(vide).toContain('Aucune organisation cochée')
    expect(vide).not.toContain('Confirmer')
    const lot = lireUnLot('prolonger:1')!
    const refus = texte(rendre(createElement(AperçuDeSérie, { lot: 'prolonger:1', libellé: 'Prolonger', effets: aperçuDeLaSérie(lot, [lignes[2]!], '2026-11-16') })))
    expect(refus).toContain('J0 n’est pas encore posé')
    expect(refus).not.toContain('Confirmer')
  })

  it('le retour d’une série nomme les réglées et la raison de chaque refus', () => {
    const lu = texte(
      rendre(
        createElement(RetourDeSérie, {
          libellé: 'Placer : parution réduite',
          réglées: ['suneido', 'heritech'],
          refusées: [{ slug: 'payee', code: 'abonnée-stripe' }, { slug: 'x', code: 'inédit' }],
          messages: { 'abonnée-stripe': 'Un abonnement Stripe est ouvert.' },
        }),
      ),
    )
    expect(lu).toContain('2 organisations réglées (suneido, heritech)')
    expect(lu).toContain('payee Un abonnement Stripe est ouvert.')
    expect(lu).toContain('x Réglage refusé.')
  })
})
