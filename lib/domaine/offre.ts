/**
 * L'offre, telle qu'Agathe l'a décidée le 17 octobre 2026 et revue le
 * 6 novembre 2026 (`docs/decision-portail-moteur.md`, section « L'offre »). Le
 * seul endroit où ses chiffres sont écrits dans le code : un écran qui les
 * recopierait finirait par afficher un ancien prix.
 *
 * Depuis le 7 novembre 2026 : **149 € HT par mois** (259 € le seul 6 novembre,
 * ramené à 149 € le 7 à la demande de l'opératrice), par organisation, qui
 * comprend la création du référentiel et deux heures de prise en main. La
 * formule annuelle, retirée le 6 novembre, revient le 7 novembre 2026 (demande
 * de l'opératrice) : dix mois payés, deux mois offerts.
 */
export const PRIX_MENSUEL_HT = 149
/** Dix mois payés : « deux mois offerts », la règle tenue depuis l'offre du 17 octobre. */
export const PRIX_ANNUEL_HT = PRIX_MENSUEL_HT * 10
/** La prise en main comprise dans l'abonnement, en heures. */
export const HEURES_DE_PRISE_EN_MAIN = 2
/**
 * Les frais de mise en place (6 novembre 2026) : **offerts aux early
 * adopters**, c'est-à-dire à toute inscription jusqu'à
 * `FIN_DU_TARIF_EARLY_ADOPTER` incluse, puis facturés une fois à ce montant.
 * Facturés depuis le 7 novembre 2026 par la page de paiement Stripe, sur le
 * prix unique `STRIPE_PRIX_MISE_EN_PLACE`, quand `fraisDeMiseEnPlaceDus` le dit.
 */
export const FRAIS_DE_MISE_EN_PLACE_HT = 790
/**
 * La fin de la période early adopter, écrite ici et nulle part ailleurs
 * (décision de l'opératrice du 27 octobre 2026). Depuis le 6 novembre 2026,
 * elle ne porte plus sur le prix mensuel, le même pour tous, mais sur les frais
 * de mise en place, offerts jusqu'à cette date. Ne pas confondre avec le
 * **tarif fondateur** (`offre = fondateur`, `PRIX_FONDATEUR_HT`), réservé par
 * l'opératrice à une organisation nommée et jamais affiché.
 */
export const FIN_DU_TARIF_EARLY_ADOPTER = '2026-12-31'

/** Une date, en heure de Paris, au format `AAAA-MM-JJ`. */
function jourÀParis(date: Date): string {
  return new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

/**
 * Les frais de mise en place sont-ils dus à la souscription (7 novembre 2026) ?
 *
 * Seulement pour l'offre `standard` : un accès offert ne paie rien, un tarif
 * fondateur ne paie que son tarif. Seulement pour une organisation inscrite
 * **après** `FIN_DU_TARIF_EARLY_ADOPTER`, jour compté en heure de Paris : la
 * date d'inscription est celle de son entrée dans le portail (`créée_le`), qui
 * précède l'essai et ne bouge plus. Et jamais pour une organisation qui a déjà
 * eu un abonnement Stripe, même résilié : la mise en place a eu lieu, une
 * reprise ne la refacture pas.
 */
export function fraisDeMiseEnPlaceDus(entrée: {
  readonly offre: 'standard' | 'fondateur' | 'gratuite'
  readonly inscriteLe: Date
  readonly déjàAbonnée: boolean
}): boolean {
  if (entrée.offre !== 'standard' || entrée.déjàAbonnée) return false
  return jourÀParis(entrée.inscriteLe) > FIN_DU_TARIF_EARLY_ADOPTER
}

/** La date de fin de la période early adopter, à la française : « 31 décembre 2026 ». */
export function finDuTarifEarlyAdopter(): string {
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' }).format(
    new Date(`${FIN_DU_TARIF_EARLY_ADOPTER}T12:00:00Z`),
  )
}

/**
 * Le tarif fondateur : réservé par l'opératrice à une organisation nommée
 * (`offre = fondateur`), mensuel seul, jamais affiché sur une page publique.
 * Il s'appelait « early adopter » jusqu'au 27 octobre 2026 ; ce nom désigne
 * désormais les inscriptions faites jusqu'au 31 décembre 2026.
 */
export const PRIX_FONDATEUR_HT = 29
/** Pour un bon de commande, un virement, ou quand la souscription en ligne est indisponible. */
export const ADRESSE_D_ABONNEMENT = 'agathe@signauxfaibles.io'
/**
 * Trois lecteurs actifs au plus par organisation : c'est l'offre. Pour en
 * ajouter un, on en révoque un autre. L'opérateur global n'est rattaché à
 * aucune organisation et n'entre pas dans le compte.
 */
export const LECTEURS_ACTIFS_MAX = 3
/** TVA applicable (offre du 17 octobre 2026). */
export const TAUX_DE_TVA = 0.2

/** Un montant en euros, à la française : « 178,80 », « 1 790 », « 124,17 ». */
export function enEuros(montant: number): string {
  const arrondi = Math.round(montant * 100) / 100
  return arrondi.toLocaleString('fr-FR', {
    minimumFractionDigits: Number.isInteger(arrondi) ? 0 : 2,
    maximumFractionDigits: 2,
  })
}

/** L'annuel ramené au mois : la seule comparaison que le lecteur fait de tête. */
export function équivalentMensuelDeLAnnuel(): number {
  return Math.round((PRIX_ANNUEL_HT / 12) * 100) / 100
}

/** Le montant toutes taxes comprises d'un prix hors taxes. */
export function prixTTC(prixHT: number): number {
  return Math.round(prixHT * (1 + TAUX_DE_TVA) * 100) / 100
}
