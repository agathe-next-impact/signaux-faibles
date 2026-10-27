/**
 * L'offre, telle qu'Agathe l'a décidée le 17 octobre 2026, prix relevés le
 * 23 octobre 2026 (`docs/decision-portail-moteur.md`, section « L'offre »). Le seul endroit où
 * ses chiffres sont écrits dans le code : un écran qui les recopierait
 * finirait par afficher un ancien prix.
 */
export const PRIX_MENSUEL_HT = 149
/**
 * Les deux prix publics sont un **tarif early adopter**, ouvert à toute inscription
 * jusqu'à cette date incluse (décision de l'opératrice du 27 octobre 2026). Les
 * pages vitrines l'annoncent avec cette date, écrite ici et nulle part ailleurs.
 * Ne pas confondre avec le **tarif fondateur** (`offre = fondateur`,
 * `PRIX_FONDATEUR_HT`), réservé par l'opératrice à une organisation nommée et
 * jamais affiché.
 */
export const FIN_DU_TARIF_EARLY_ADOPTER = '2026-12-31'
/**
 * Le prix mensuel annoncé pour les inscriptions après `FIN_DU_TARIF_EARLY_ADOPTER`
 * (décision du 27 octobre 2026). Annoncé seulement : le montant facturé reste
 * celui des prix Stripe, qu'il faudra créer et poser le 1er janvier 2027.
 */
export const PRIX_MENSUEL_APRÈS_EARLY_ADOPTER_HT = 290
/** L'annuel qui lui répond, par la même règle de dix mois payés. */
export const PRIX_ANNUEL_APRÈS_EARLY_ADOPTER_HT = PRIX_MENSUEL_APRÈS_EARLY_ADOPTER_HT * 10

/** La date de fin du tarif early adopter, à la française : « 31 décembre 2026 ». */
export function finDuTarifEarlyAdopter(): string {
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' }).format(
    new Date(`${FIN_DU_TARIF_EARLY_ADOPTER}T12:00:00Z`),
  )
}

/** Dix mois payés : « deux mois offerts », la règle tenue depuis l'offre du 17 octobre. */
export const PRIX_ANNUEL_HT = 1490
/**
 * Le tarif fondateur : réservé par l'opératrice à une organisation nommée
 * (`offre = fondateur`), mensuel seul, jamais affiché sur une page publique.
 * Il s'appelait « early adopter » jusqu'au 27 octobre 2026 ; ce nom désigne
 * désormais les prix publics jusqu'au 31 décembre 2026.
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
/** TVA applicable aux deux formules (offre du 17 octobre 2026). */
export const TAUX_DE_TVA = 0.2

/** Un montant en euros, à la française : « 178,80 », « 1 788 », « 124,17 ». */
export function enEuros(montant: number): string {
  const arrondi = Math.round(montant * 100) / 100
  return arrondi.toLocaleString('fr-FR', {
    minimumFractionDigits: Number.isInteger(arrondi) ? 0 : 2,
    maximumFractionDigits: 2,
  })
}

/** Le montant toutes taxes comprises d'un prix hors taxes. */
export function prixTTC(prixHT: number): number {
  return Math.round(prixHT * (1 + TAUX_DE_TVA) * 100) / 100
}

/** L'annuel ramené au mois : la seule comparaison que le lecteur fait de tête. */
export function équivalentMensuelDeLAnnuel(): number {
  return Math.round((PRIX_ANNUEL_HT / 12) * 100) / 100
}
