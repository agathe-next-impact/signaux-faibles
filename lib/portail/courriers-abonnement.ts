import { abonnementsAnnuelsÀÉchéance, organisationEtSesLecteurs } from '@/lib/base/courriers'
import { composerCourrierDAbonnement, courrierDuChangementDAbonnement } from '@/lib/domaine/courriers-parcours'
import { adressePostale } from '@/lib/email/gmail'
import { préparerPourLesLecteurs, type CourrierPréparé } from '@/lib/portail/parcours-courriers'

/**
 * Les courriers de l'abonnement (23 octobre 2026), tous déposés en brouillon
 * Gmail et envoyés par l'opératrice après relecture.
 *
 * Deux déclencheurs, chacun pour ce qu'il sait :
 *   · **le webhook Stripe**, après avoir appliqué un événement, pour ce qui
 *     change d'état (abonnement actif, paiement refusé, résiliation) : lui seul
 *     connaît l'état d'avant. Le brouillon est préparé dans `after()`, la
 *     réponse à Stripe n'attend pas Gmail ;
 *   · **le passage quotidien**, pour le renouvellement annuel, qui dépend de la
 *     date : trente jours avant l'échéance au plus tôt, une fois par échéance.
 *
 * La clé d'unicité (`courriers_commerciaux_unique`) tient chaque brouillon une
 * seule fois : l'abonnement pour la confirmation et la résiliation,
 * l'abonnement et l'échéance pour un paiement refusé et un renouvellement.
 */

/** Le rappel de renouvellement se prépare au plus tôt trente jours avant l'échéance annuelle. */
export const JOURS_AVANT_RENOUVELLEMENT = 30

const JOUR_MS = 24 * 60 * 60 * 1000

/** La clé d'un courrier lié à une période : l'abonnement et la date d'échéance. */
function cléDePériode(abonnementStripe: string, périodeFin: Date | null): string {
  return `${abonnementStripe}:${périodeFin ? périodeFin.toISOString().slice(0, 10) : 'sans-echeance'}`
}

/** Après un événement Stripe appliqué : le brouillon que le changement d'état appelle, s'il en appelle un. */
export async function préparerLeCourrierDuChangement(entrée: {
  readonly organisationId: string
  readonly abonnementStripe: string
  readonly étatPrécédent: string | null
  readonly état: string
  readonly formule: 'mensuelle' | 'annuelle' | null
  readonly périodeFin: Date | null
  readonly portailUrl: string
}): Promise<CourrierPréparé[]> {
  const sorte = courrierDuChangementDAbonnement(entrée.étatPrécédent, entrée.état)
  if (!sorte) return []
  const organisation = await organisationEtSesLecteurs(entrée.organisationId)
  if (!organisation) return []

  const préparés = await préparerPourLesLecteurs({
    organisation,
    sorte,
    clé: sorte === 'paiement_echec' ? cléDePériode(entrée.abonnementStripe, entrée.périodeFin) : entrée.abonnementStripe,
    déclencheur: 'stripe',
    contenu: (prénomOuNom, destinataire) =>
      composerCourrierDAbonnement({
        sorte,
        prénomOuNom,
        destinataire,
        organisation: organisation.nom,
        slug: organisation.slug,
        portailUrl: entrée.portailUrl,
        formule: entrée.formule,
        périodeFin: entrée.périodeFin,
        adressePostale: adressePostale(),
      }),
  })
  for (const c of préparés) console.info(`[abonnement] ${c.slug} : ${c.sorte} → ${c.destinataire} : ${c.issue}`)
  return préparés
}

/** Le passage quotidien : un brouillon de rappel par abonnement annuel qui arrive à échéance. */
export async function préparerLesRappelsDeRenouvellement(entrée: {
  readonly maintenant: Date
  readonly portailUrl: string
}): Promise<CourrierPréparé[]> {
  const àÉchéance = await abonnementsAnnuelsÀÉchéance({
    depuis: entrée.maintenant,
    jusquÀ: new Date(entrée.maintenant.getTime() + JOURS_AVANT_RENOUVELLEMENT * JOUR_MS),
  })
  const préparés: CourrierPréparé[] = []
  for (const { abonnementStripe, périodeFin, organisation } of àÉchéance) {
    préparés.push(
      ...(await préparerPourLesLecteurs({
        organisation,
        sorte: 'abonnement_renouvellement',
        clé: cléDePériode(abonnementStripe, périodeFin),
        contenu: (prénomOuNom, destinataire) =>
          composerCourrierDAbonnement({
            sorte: 'abonnement_renouvellement',
            prénomOuNom,
            destinataire,
            organisation: organisation.nom,
            slug: organisation.slug,
            portailUrl: entrée.portailUrl,
            formule: 'annuelle',
            périodeFin,
            adressePostale: adressePostale(),
          }),
      })),
    )
  }
  for (const c of préparés) console.info(`[abonnement] ${c.slug} : ${c.sorte} → ${c.destinataire} : ${c.issue}`)
  return préparés
}
