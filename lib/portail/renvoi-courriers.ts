import { lireAbonnement } from '@/lib/base/abonnements'
import { organisationEtSesLecteurs, type SorteCourrier } from '@/lib/base/courriers'
import {
  composerCourrierDAbonnement,
  composerCourrierDeParcours,
  type SorteDAbonnement,
  type SorteDeParcours,
} from '@/lib/domaine/courriers-parcours'
import { adressePostale } from '@/lib/email/gmail'
import { préparerPourLesLecteurs, type CourrierPréparé } from '@/lib/portail/parcours-courriers'

/**
 * Le renvoi manuel d'un courrier commercial par l'opératrice (12 novembre 2026,
 * fiche d'une organisation, `/espaces/abonnements/[slug]`, section « Courriers »).
 *
 * Les courriers commerciaux (fin d'essai, rappel J+7, suspension, ce que dit
 * Stripe) ne sont préparés qu'une fois par organisation et par lecteur : un
 * brouillon supprimé sans envoi, un lecteur inscrit après coup ou un courrier à
 * redire n'avaient aucun chemin. Le renvoi en est un, et il ne contourne rien
 * d'autre que l'unicité :
 *   · **toujours un brouillon Gmail**, adressé au lecteur, que l'opératrice relit
 *     et envoie elle-même, comme le passage quotidien et le webhook Stripe ;
 *   · **le même contenu**, composé par les mêmes fonctions, sur l'état présent de
 *     l'organisation (offre, parutions d'essai, abonnement en copie Stripe) ;
 *   · **chaque lecteur revérifié par la façade d'accès** (`préparerPourLesLecteurs`) :
 *     un lecteur révoqué ne reçoit rien ;
 *   · **une ligne au journal**, déclencheur `operatrice`, clé `renvoi:<minute>`
 *     (`cléDeRenvoi`) : elle sort le brouillon de l'unicité du courrier d'origine,
 *     et un double clic dans la même minute n'en dépose pas deux (`déjà-envoyé`).
 *
 * Le privilège est vérifié par l'action (`renvoyerUnCourrier`,
 * `lib/portail/gestion-actions.ts`) avant l'appel ; `tests/architecture.test.ts`
 * tient l'ordre et le seul appelant.
 */

export const SORTES_DE_PARCOURS_RENVOYABLES = [
  'essai_rappel_j7',
  'essai_derniere_parution',
  'essai_tronquee',
  'essai_suspendu',
] as const satisfies readonly SorteDeParcours[]

export const SORTES_D_ABONNEMENT_RENVOYABLES = [
  'abonnement_confirme',
  'paiement_echec',
  'abonnement_renouvellement',
  'abonnement_resilie',
] as const satisfies readonly SorteDAbonnement[]

/** Les courriers commerciaux qu'un renvoi peut préparer : ni le lien d'accès (son propre bouton), ni les lettres, ni l'alerte. */
export const SORTES_RENVOYABLES: readonly (SorteDeParcours | SorteDAbonnement)[] = [
  ...SORTES_DE_PARCOURS_RENVOYABLES,
  ...SORTES_D_ABONNEMENT_RENVOYABLES,
]

export function estRenvoyable(sorte: string): sorte is SorteDeParcours | SorteDAbonnement {
  return (SORTES_RENVOYABLES as readonly string[]).includes(sorte)
}

function estDeParcours(sorte: SorteDeParcours | SorteDAbonnement): sorte is SorteDeParcours {
  return (SORTES_DE_PARCOURS_RENVOYABLES as readonly string[]).includes(sorte)
}

/** La clé d'un renvoi : la minute UTC de la demande. Deux demandes dans la même minute n'en font qu'une. */
export function cléDeRenvoi(maintenant: Date): string {
  return `renvoi:${maintenant.toISOString().slice(0, 16)}`
}

export type IssueDuRenvoi =
  | { readonly sorte: 'préparé'; readonly courriers: readonly CourrierPréparé[] }
  | { readonly sorte: 'organisation-inconnue' }
  | { readonly sorte: 'lecteur-inconnu' }
  | { readonly sorte: 'sans-abonnement' }

export async function renvoyerUnCourrierCommercial(entrée: {
  readonly organisationId: string
  readonly sorte: SorteDeParcours | SorteDAbonnement
  /** Un lecteur actif de l'organisation, ou `null` pour tous les lecteurs actifs. */
  readonly lecteurId: string | null
  readonly maintenant: Date
  readonly portailUrl: string
}): Promise<IssueDuRenvoi> {
  const organisation = await organisationEtSesLecteurs(entrée.organisationId)
  if (!organisation) return { sorte: 'organisation-inconnue' }
  const lecteurs = entrée.lecteurId ? organisation.lecteurs.filter((l) => l.id === entrée.lecteurId) : organisation.lecteurs
  if (entrée.lecteurId && lecteurs.length === 0) return { sorte: 'lecteur-inconnu' }

  const sorte = entrée.sorte
  let contenu: (prénomOuNom: string, destinataire: string) => { readonly sujet: string; readonly texte: string; readonly html: string }
  if (estDeParcours(sorte)) {
    contenu = (prénomOuNom, destinataire) =>
      composerCourrierDeParcours({
        sorte,
        prénomOuNom,
        destinataire,
        organisation: organisation.nom,
        slug: organisation.slug,
        portailUrl: entrée.portailUrl,
        parutions: organisation.parutionsDEssai,
        offre: organisation.offre,
        adressePostale: adressePostale(),
        aujourdHui: entrée.maintenant,
      })
  } else {
    // Un courrier d'abonnement parle de la formule et de l'échéance : sans copie
    // Stripe, il n'y a rien de vrai à écrire.
    const abonnement = await lireAbonnement(organisation.id)
    if (!abonnement) return { sorte: 'sans-abonnement' }
    const formule = abonnement.formule === 'mensuelle' || abonnement.formule === 'annuelle' ? abonnement.formule : null
    contenu = (prénomOuNom, destinataire) =>
      composerCourrierDAbonnement({
        sorte,
        prénomOuNom,
        destinataire,
        organisation: organisation.nom,
        slug: organisation.slug,
        portailUrl: entrée.portailUrl,
        formule,
        périodeFin: abonnement.périodeFin ?? null,
        adressePostale: adressePostale(),
        aujourdHui: entrée.maintenant,
      })
  }

  const courriers = await préparerPourLesLecteurs({
    organisation: { ...organisation, lecteurs },
    sorte: sorte satisfies SorteCourrier,
    clé: cléDeRenvoi(entrée.maintenant),
    déclencheur: 'operatrice',
    contenu,
  })
  for (const c of courriers) console.info(`[renvoi] ${c.slug} : ${c.sorte} → ${c.destinataire} : ${c.issue}`)
  return { sorte: 'préparé', courriers }
}
