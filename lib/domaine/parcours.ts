import { lundiDeLaSemaine } from '@/lib/domaine/semaines'

/**
 * Le parcours d'une organisation : où elle en est de l'essai, et ce qu'on lui
 * doit cette semaine.
 *
 * L'offre (décision d'Agathe du 17 octobre 2026, `docs/decision-portail-moteur.md`)
 * en fixe la forme :
 *
 *   · deux parutions complètes, la semaine de l'activation (J0) puis la
 *     suivante (J+7) : c'est l'essai (trois jusqu'au 24 octobre 2026) ;
 *   · la troisième semaine (J+14), sans abonnement, une parution réduite à
 *     « L'essentiel » de chaque lettre, avec une invitation à s'abonner ;
 *   · au-delà, sans abonnement, l'espace est suspendu.
 *
 * Le nombre de parutions complètes est porté par chaque organisation
 * (`organisations.parutions_d_essai`) : les dates ci-dessus sont celles du
 * défaut.
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

/**
 * Parutions complètes de l'essai par défaut : J0, J+7 (24 octobre 2026 ; trois
 * auparavant). Le défaut de la colonne `organisations.parutions_d_essai` porte
 * la même valeur (migration 0011) : changer l'un sans l'autre ferait annoncer
 * par la vitrine un essai que la base n'accorde pas.
 */
export const PARUTIONS_D_ESSAI = 2

export type ÉtatOrganisation = 'demande' | 'generation' | 'essai' | 'abonnee' | 'suspendue' | 'ecartee' | 'test'

/** L'offre posée par l'opératrice (19 octobre 2026) : standard, early adopter, ou accès offert. */
export type Offre = 'standard' | 'early_adopter' | 'gratuite'

export type Étape =
  /** Une parution complète de l'essai ; `parution` va de 1 à `parutions`, le nombre réglé pour l'organisation. */
  | { readonly étape: 'essai'; readonly parution: number; readonly parutions: number }
  /** La semaine qui suit l'essai, sans abonnement : « L'essentiel » seul. */
  | { readonly étape: 'tronquee' }
  /**
   * Abonnée. `stripe` : un abonnement Stripe ouvert. `offerte` : l'accès est
   * offert (`offre = gratuite`), sans ligne Stripe ni fin d'essai. `hors-stripe` :
   * les clients historiques, importés à l'état `abonnee` sans ligne `abonnements`,
   * facturés hors ligne (`docs/schema-donnees.md`).
   */
  | {
      readonly étape: 'abonnee'
      readonly source: 'stripe' | 'hors-stripe' | 'offerte'
      readonly paiementEnRetard: boolean
    }
  /**
   * Au-delà de la parution réduite sans abonnement (`manuelle: false`), ou suspendue à la main
   * par l'opérateur (`manuelle: true`, qui prime sur Stripe).
   */
  | { readonly étape: 'suspendue'; readonly manuelle: boolean }
  /** Pas encore dans le parcours (demande, génération), écartée, ou de test. */
  | { readonly étape: 'hors-parcours'; readonly raison: string }

export type EntréeDuParcours = {
  readonly organisation: {
    readonly état: ÉtatOrganisation
    /** Fixe J0. */
    readonly activéeLe: Date | null
    readonly offre: Offre
    /** Parutions complètes de l'essai avant « L'essentiel » seul ; deux par défaut. */
    readonly parutionsDEssai: number
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
  if (organisation.état === 'suspendue') return { étape: 'suspendue', manuelle: true }
  if (organisation.état === 'ecartee') return { étape: 'hors-parcours', raison: 'écartée' }
  if (organisation.état === 'test') return { étape: 'hors-parcours', raison: 'organisation de test' }

  // L'accès offert (19 octobre 2026) l'emporte sur le calendrier comme sur
  // Stripe : rien ne se ferme, aucun courrier de fin d'essai ne part.
  if (organisation.offre === 'gratuite') return { étape: 'abonnee', source: 'offerte', paiementEnRetard: false }

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

  const parutions = organisation.parutionsDEssai
  const semaines = semainesÉcoulées(dateDeParis(organisation.activéeLe), aujourdHui)
  if (semaines < 0) return { étape: 'hors-parcours', raison: 'activation dans le futur' }
  if (semaines < parutions) return { étape: 'essai', parution: semaines + 1, parutions }
  if (semaines === parutions) return { étape: 'tronquee' }
  return { étape: 'suspendue', manuelle: false }
}

/**
 * Le libellé d'une étape, le même sur l'écran « Mon abonnement » du client et
 * sur le tableau de l'opératrice : une étape nommée de deux façons finirait par
 * se lire comme deux étapes. En minuscules, pour la police mono des labels.
 */
export function libelléDÉtape(étape: Étape): string {
  switch (étape.étape) {
    case 'essai':
      return `essai · parution ${étape.parution} sur ${étape.parutions}`
    case 'tronquee':
      return 'fin d’essai · l’essentiel seul'
    case 'abonnee':
      if (étape.paiementEnRetard) return 'abonnée · paiement en retard'
      if (étape.source === 'offerte') return 'accès offert'
      return étape.source === 'stripe' ? 'abonnée' : 'abonnée · hors stripe'
    case 'suspendue':
      return étape.manuelle ? 'suspendue par l’opératrice' : 'suspendue · essai terminé'
    case 'hors-parcours':
      return `hors parcours · ${étape.raison}`
  }
}

/** Une date en toutes lettres, en heure de Paris : « 5 octobre 2026 ». */
export function dateLongueDeParis(instant: Date): string {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'Europe/Paris' }).format(instant)
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
