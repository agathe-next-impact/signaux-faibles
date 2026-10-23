import { sourceAccès } from '@/lib/auth/source-acces'
import { baseConfigurée } from '@/lib/base/client'
import { conclureCourrier, prévoirCourrier, type SorteCourrier } from '@/lib/base/courriers'
import { créerBrouillon, ErreurDEnvoi, envoyerMessage, type Message } from '@/lib/email/gmail'
import { empreinte } from '@/lib/portail/debit'

/**
 * Le seul chemin par lequel le portail envoie un courrier (18 octobre 2026).
 *
 * Il réserve la ligne du journal **avant** l'appel à Gmail, puis la conclut.
 * `tests/architecture.test.ts` vérifie que `envoyerMessage` n'est appelé
 * qu'ici, et que la réservation précède l'envoi dans le source.
 *
 * Deux régimes, selon ce qu'un journal indisponible doit empêcher :
 *   · **le lien d'accès et l'alerte du soir** partent même si le journal est
 *     indisponible (base non configurée, injoignable, `SOURCE_ACCES=notion`) :
 *     le journal est une trace, il ne doit pas priver un lecteur de son lien.
 *     La réservation est bornée à 300 ms et la conclusion peut être confiée à
 *     `after()` (`planifier`) : les routes qui envoient un lien répondent en un
 *     temps plancher commun aux adresses connues et inconnues (règle 8), et une
 *     base lente ne doit pas rendre l'écart mesurable ;
 *   · **les courriers de parcours** (`unique`) ne partent jamais sans leur
 *     ligne : c'est elle qui garantit qu'un client ne reçoit pas deux fois
 *     « votre essai se termine ». Leur réservation n'est **pas** bornée : une
 *     borne abandonnerait un INSERT qui aboutirait ensuite, et la ligne `prevu`
 *     orpheline ferait sauter le courrier au passage suivant, en silence. Sans
 *     journal, rien ne part, et c'est dit.
 *
 * **Les courriers commerciaux sont des brouillons** (23 octobre 2026) : fin
 * d'essai, rappel J+7, suspension, et tout ce que dit Stripe. `brouillon` les
 * dépose dans la boîte émettrice au lieu de les envoyer ; l'opératrice les relit
 * et les envoie elle-même. Ils restent `unique` : une ligne `brouillon` tient la
 * place, et un brouillon supprimé sans envoi n'est jamais recréé.
 *
 * `SOURCE_ACCES=notion` n'ouvre jamais Postgres : c'est l'interrupteur de retour
 * en arrière, ici comme pour l'appartenance.
 */

export type IssueDuCourrier =
  | { readonly sorte: 'envoyé'; readonly journalisé: boolean }
  | { readonly sorte: 'brouillon' }
  | { readonly sorte: 'déjà-envoyé' }
  | { readonly sorte: 'non-journalisable'; readonly raison: string }

export const DÉLAI_DE_RÉSERVATION_MS = 300

const DÉLAI_DÉPASSÉ = Symbol('délai dépassé')

export async function envoyerCourrier(courrier: {
  readonly message: Message
  readonly sorte: SorteCourrier
  readonly déclencheur: string
  readonly organisation: { readonly id: string } | { readonly registreNotion: string } | null
  readonly lecteurId: string | null
  /** Courrier de parcours : jamais sans journal, jamais deux fois. */
  readonly unique: boolean
  /** Déposé en brouillon Gmail, jamais envoyé ; réservé aux courriers `unique`. */
  readonly brouillon?: boolean
  /** La clé d'unicité d'un courrier commercial ; nulle pour les autres. */
  readonly clé?: string
  /**
   * Où exécuter la conclusion du journal, une fois le courrier parti : `after`
   * de `next/server` dans une route qui répond en temps plancher. Par défaut,
   * elle est attendue.
   */
  readonly planifier?: (tâche: () => Promise<void>) => void
}): Promise<IssueDuCourrier> {
  const marque = empreinte(courrier.message.destinataire)
  const journalPossible = baseConfigurée() && sourceAccès() !== 'notion'

  const brouillon = courrier.brouillon === true
  if (brouillon && !courrier.unique) throw new Error('un brouillon est toujours un courrier unique')

  if (!journalPossible && courrier.unique) {
    return { sorte: 'non-journalisable', raison: 'base non configurée ou SOURCE_ACCES=notion' }
  }

  let idCourrier: string | null = null
  if (journalPossible) {
    try {
      const insertion = prévoirCourrier({
        sorte: courrier.sorte,
        organisation: courrier.organisation,
        lecteurId: courrier.lecteurId,
        destinataireEmpreinte: marque,
        déclencheur: courrier.déclencheur,
        clé: courrier.clé ?? null,
      })
      let réservation: string | null | typeof DÉLAI_DÉPASSÉ
      if (courrier.unique) {
        réservation = await insertion
      } else {
        let minuterie: ReturnType<typeof setTimeout> | undefined
        const délai = new Promise<typeof DÉLAI_DÉPASSÉ>((résoudre) => {
          minuterie = setTimeout(() => résoudre(DÉLAI_DÉPASSÉ), DÉLAI_DE_RÉSERVATION_MS)
        })
        // Une insertion abandonnée au délai peut aboutir plus tard : son rejet
        // éventuel ne doit pas remonter sans gestionnaire.
        insertion.catch(() => {})
        réservation = await Promise.race([insertion, délai]).finally(() => clearTimeout(minuterie))
      }

      if (réservation === DÉLAI_DÉPASSÉ) throw new Error(`réservation au-delà de ${DÉLAI_DE_RÉSERVATION_MS} ms`)
      if (réservation === null) return { sorte: 'déjà-envoyé' }
      idCourrier = réservation
    } catch (erreur) {
      const raison = erreur instanceof Error ? erreur.message : String(erreur)
      if (courrier.unique) return { sorte: 'non-journalisable', raison }
      console.warn(`[courriers] ${courrier.sorte} pour ${marque} : journal indisponible (${raison}), envoi maintenu.`)
    }
  }

  let idMessage: string | null
  try {
    ;({ idMessage } = brouillon ? await créerBrouillon(courrier.message) : await envoyerMessage(courrier.message))
  } catch (erreur) {
    if (idCourrier) {
      const code = erreur instanceof ErreurDEnvoi ? `gmail-${erreur.statut}` : 'gmail-injoignable'
      await conclureCourrier(idCourrier, { état: 'echec', erreur: code }).catch(() => {})
    }
    throw erreur
  }

  if (idCourrier) {
    const id = idCourrier
    const conclusion = () =>
      conclureCourrier(id, { état: brouillon ? 'brouillon' : 'envoye', messageGmail: idMessage }).catch((erreur: unknown) => {
      // Le courrier est parti : une conclusion manquée laisse la ligne `prevu`,
      // ce qui se lit comme « tenté, issue inconnue ». On le dit dans le journal.
      console.warn(
        `[courriers] ${courrier.sorte} pour ${marque} envoyé, conclusion non écrite : ` +
          `${erreur instanceof Error ? erreur.message : String(erreur)}`,
      )
    })
    if (courrier.planifier) courrier.planifier(conclusion)
    else await conclusion()
  }
  return brouillon ? { sorte: 'brouillon' } : { sorte: 'envoyé', journalisé: idCourrier !== null }
}
