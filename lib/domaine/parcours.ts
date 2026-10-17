import { lundiDeLaSemaine } from '@/lib/domaine/semaines'

/**
 * Le parcours d'une organisation : où elle en est de l'essai, et ce qu'on lui
 * doit cette semaine.
 *
 * L'offre (décision d'Agathe du 17 octobre 2026, `docs/decision-portail-moteur.md`)
 * en fixe la forme :
 *
 *   · trois parutions complètes, la semaine de l'activation (J0) puis les deux
 *     suivantes (J+7, J+14) : c'est l'essai ;
 *   · la quatrième semaine (J+21), sans abonnement, une parution réduite à
 *     « L'essentiel » de chaque lettre, avec une invitation à s'abonner ;
 *   · au-delà, sans abonnement, l'espace est suspendu.
 *
 * **Rien de cela n'est stocké.** L'étape se calcule à chaque fois à partir de la
 * date d'activation, de l'état de l'organisation et de l'état que Stripe donne
 * à son abonnement. Une étape écrite en base finirait par contredire Stripe, et
 * c'est précisément la forme des incidents de septembre : un même état tenu à
 * deux endroits.
 *
 * Les semaines se comptent en **semaines ISO, en heure de Paris** : une
 * organisation activée un vendredi reçoit sa deuxième parution le lundi suivant
 * si elle paraît le lundi, pas sept jours plus tard. C'est la semaine de
 * parution qui compte, pas l'écart en jours.
 */

/** Les états d'abonnement Stripe qui ouvrent l'espace. */
const ÉTATS_ABONNÉS = new Set(['trialing', 'active', 'past_due'])

/** Parutions complètes de l'essai : J0, J+7, J+14. */
export const PARUTIONS_D_ESSAI = 3

export type ÉtatOrganisation = 'demande' | 'generation' | 'essai' | 'abonnee' | 'suspendue' | 'ecartee' | 'test'

export type Étape =
  /** Une parution complète de l'essai ; `parution` vaut 1, 2 ou 3. */
  | { readonly étape: 'essai'; readonly parution: 1 | 2 | 3 }
  /** La semaine qui suit l'essai, sans abonnement : « L'essentiel » seul. */
  | { readonly étape: 'tronquee' }
  /**
   * Abonnée. `stripe` : un abonnement Stripe ouvert. `hors-stripe` : les clients
   * historiques, importés à l'état `abonnee` sans ligne `abonnements`, qui
   * reçoivent leurs lettres comme avant (`docs/schema-donnees.md`).
   */
  | { readonly étape: 'abonnee'; readonly source: 'stripe' | 'hors-stripe'; readonly paiementEnRetard: boolean }
  /** Au-delà de J+21 sans abonnement, ou suspendue à la main (qui prime sur Stripe). */
  | { readonly étape: 'suspendue' }
  /** Pas encore dans le parcours (demande, génération), écartée, ou de test. */
  | { readonly étape: 'hors-parcours'; readonly raison: string }

export type EntréeDuParcours = {
  readonly organisation: {
    readonly état: ÉtatOrganisation
    /** Fixe J0. */
    readonly activéeLe: Date | null
  }
  /** L'état de l'abonnement tel que Stripe le donne, ou `null` s'il n'y en a pas. */
  readonly abonnement: { readonly état: string } | null
  /** Aujourd'hui, en heure de Paris, au format `AAAA-MM-JJ`. */
  readonly aujourdHui: string
}

const JOUR_MS = 24 * 60 * 60 * 1000

/** La date de Paris d'un instant, au format `AAAA-MM-JJ`. */
export function dateDeParis(instant: Date): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant)
}

/** Nombre de semaines ISO entre deux dates de Paris ; 0 la même semaine. */
export function semainesÉcoulées(depuis: string, jusquÀ: string): number {
  const écart = Date.parse(`${lundiDeLaSemaine(jusquÀ)}T00:00:00Z`) - Date.parse(`${lundiDeLaSemaine(depuis)}T00:00:00Z`)
  return Math.round(écart / (7 * JOUR_MS))
}

/**
 * États Stripe d'un paiement qui n'a jamais abouti : le premier prélèvement
 * attend (3D Secure) ou a expiré sans réussir. Ils ne disent rien d'une
 * résiliation, et ne doivent rien retirer à qui avait déjà accès.
 */
const ÉTATS_JAMAIS_ABOUTIS = new Set(['incomplete', 'incomplete_expired'])

export function étapeDuParcours({ organisation, abonnement, aujourdHui }: EntréeDuParcours): Étape {
  // Les décisions de l'opérateur priment sur Stripe : une organisation écartée
  // ou suspendue à la main le reste, qu'elle paie ou non. Une organisation de
  // test sort du parcours.
  if (organisation.état === 'suspendue') return { étape: 'suspendue' }
  if (organisation.état === 'ecartee') return { étape: 'hors-parcours', raison: 'écartée' }
  if (organisation.état === 'test') return { étape: 'hors-parcours', raison: 'organisation de test' }

  // Un abonnement Stripe ouvert l'emporte ensuite sur le calendrier : une
  // organisation qui paie n'est jamais suspendue par la date. `past_due` en fait
  // partie : Stripe relance le paiement pendant quelques jours, et couper l'espace
  // à la première carte refusée punirait un client qui n'a rien décidé.
  if (abonnement && ÉTATS_ABONNÉS.has(abonnement.état)) {
    return { étape: 'abonnee', source: 'stripe', paiementEnRetard: abonnement.état === 'past_due' }
  }

  // Un paiement jamais abouti vaut absence d'abonnement, pas résiliation.
  const abonnementFermé = abonnement !== null && !ÉTATS_JAMAIS_ABOUTIS.has(abonnement.état)

  switch (organisation.état) {
    case 'demande':
    case 'generation':
      return { étape: 'hors-parcours', raison: 'pas encore activée' }
    case 'abonnee':
      // Abonnée sans abonnement Stripe ouvert : un client historique, tant que sa
      // ligne Stripe n'est pas fermée (`canceled`, `unpaid`, `paused`). Un client
      // historique qui commence un paiement sans l'achever garde donc son accès.
      // S'il a résilié, il n'est plus abonné : le calendrier reprend.
      if (!abonnementFermé) return { étape: 'abonnee', source: 'hors-stripe', paiementEnRetard: false }
      break
    case 'essai':
      break
  }

  if (organisation.activéeLe === null) {
    // Un essai sans date d'activation n'a pas de J0 : on ne devine pas.
    return { étape: 'hors-parcours', raison: 'aucune date d’activation' }
  }

  const semaines = semainesÉcoulées(dateDeParis(organisation.activéeLe), aujourdHui)
  if (semaines < 0) return { étape: 'hors-parcours', raison: 'activation dans le futur' }
  if (semaines < PARUTIONS_D_ESSAI) return { étape: 'essai', parution: (semaines + 1) as 1 | 2 | 3 }
  if (semaines === PARUTIONS_D_ESSAI) return { étape: 'tronquee' }
  return { étape: 'suspendue' }
}

/**
 * Ce que l'étape permet de lire : tout, « L'essentiel » seul, ou rien.
 *
 * Une organisation hors parcours garde la lecture complète, y compris sur une
 * anomalie (essai sans date d'activation) : c'est le comportement d'avant le
 * palier 1c, et une donnée mal saisie ne doit pas couper un lecteur. L'anomalie
 * se voit dans `raison`, que le contrôle du soir pourra remonter.
 */
export function lectureAutorisée(étape: Étape): 'complète' | 'essentiel' | 'aucune' {
  switch (étape.étape) {
    case 'essai':
    case 'abonnee':
    case 'hors-parcours':
      return 'complète'
    case 'tronquee':
      return 'essentiel'
    case 'suspendue':
      return 'aucune'
  }
}
