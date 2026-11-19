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
 * Les forfaits par nombre de lecteurs (19 novembre 2026, demande de
 * l'opératrice : « les forfaits d'abonnement doivent prévoir l'ajout
 * d'utilisateurs »). Le forfait de base reste celui de l'offre, trois lecteurs à
 * `PRIX_MENSUEL_HT` ; trois forfaits s'y ajoutent, à dix, cent et sans limite.
 * Chaque forfait a sa formule mensuelle et son annuelle (dix mois payés, la
 * même règle que le forfait de base), chacune sur son propre prix Stripe.
 *
 * Un lecteur est une personne qui a son lien d'accès : « utilisateur » dans la
 * demande, « lecteur » dans le portail. L'opérateur global n'est rattaché à
 * aucune organisation et n'entre dans aucun compte.
 */
export const FORFAITS = ['trois', 'dix', 'cent', 'illimite'] as const
export type Forfait = (typeof FORFAITS)[number]

export type DéfinitionDuForfait = {
  readonly clé: Forfait
  /** Lecteurs actifs au plus ; `null` : sans limite. */
  readonly lecteurs: number | null
  readonly prixMensuelHT: number
  /** « 3 lecteurs », « Lecteurs illimités ». */
  readonly libellé: string
}

export const DÉFINITIONS_DES_FORFAITS: Readonly<Record<Forfait, DéfinitionDuForfait>> = {
  trois: { clé: 'trois', lecteurs: 3, prixMensuelHT: PRIX_MENSUEL_HT, libellé: '3 lecteurs' },
  dix: { clé: 'dix', lecteurs: 10, prixMensuelHT: 199, libellé: '10 lecteurs' },
  cent: { clé: 'cent', lecteurs: 100, prixMensuelHT: 299, libellé: '100 lecteurs' },
  illimite: { clé: 'illimite', lecteurs: null, prixMensuelHT: 499, libellé: 'Lecteurs illimités' },
}

/** Le forfait de toute organisation qui n'en a pas d'autre : celui de l'offre d'origine. */
export const FORFAIT_DE_BASE: Forfait = 'trois'

export function estUnForfait(valeur: unknown): valeur is Forfait {
  return typeof valeur === 'string' && (FORFAITS as readonly string[]).includes(valeur)
}

/** Dix mois payés, comme le forfait de base. */
export function prixAnnuelDuForfaitHT(forfait: Forfait): number {
  return DÉFINITIONS_DES_FORFAITS[forfait].prixMensuelHT * 10
}

/** L'annuel d'un forfait ramené au mois. */
export function équivalentMensuelDuForfait(forfait: Forfait): number {
  return Math.round((prixAnnuelDuForfaitHT(forfait) / 12) * 100) / 100
}

/** Le plafond de lecteurs actifs d'un forfait ; `null` : sans limite. */
export function plafondDeLecteurs(forfait: Forfait): number | null {
  return DÉFINITIONS_DES_FORFAITS[forfait].lecteurs
}

/** Vrai si un lecteur de plus dépasserait le forfait. */
export function forfaitAtteint(forfait: Forfait, actifs: number): boolean {
  const plafond = plafondDeLecteurs(forfait)
  return plafond !== null && actifs >= plafond
}

/**
 * Le forfait qui fait foi pour une organisation. Stripe est la source de
 * vérité : un abonnement **ouvert** dont le prix porte un forfait l'emporte
 * (`abonnements.forfait`, écrit par le webhook) ; sinon, le forfait posé par
 * l'opératrice sur l'organisation (`organisations.forfait`, trois lecteurs par
 * défaut), qui sert aux essais, aux accès offerts, au tarif fondateur et aux
 * abonnements par virement. Un abonnement résilié ne garde pas son forfait.
 */
export function forfaitEnVigueur(entrée: {
  readonly forfaitPosé: Forfait
  readonly abonnement: { readonly ouvert: boolean; readonly forfait: Forfait | null } | null
}): Forfait {
  if (entrée.abonnement?.ouvert && entrée.abonnement.forfait) return entrée.abonnement.forfait
  return entrée.forfaitPosé
}

/** « 2 sur 10 », ou « 2 · illimité » : le compte des lecteurs actifs face au forfait. */
export function lecteursFaceAuForfait(actifs: number, forfait: Forfait): string {
  const plafond = plafondDeLecteurs(forfait)
  return plafond === null ? `${actifs} · illimité` : `${actifs} sur ${plafond}`
}

/**
 * Trois lecteurs actifs au plus : le plafond du forfait de base, que la vitrine
 * cite pour son prix d'entrée. Le plafond d'une organisation est celui de son
 * forfait (`forfaitEnVigueur`, `plafondDeLecteurs`), jamais cette constante.
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
