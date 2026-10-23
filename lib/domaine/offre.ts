/**
 * L'offre, telle qu'Agathe l'a décidée le 17 octobre 2026
 * (`docs/decision-portail-moteur.md`, section « L'offre »). Le seul endroit où
 * ses chiffres sont écrits dans le code : un écran qui les recopierait
 * finirait par afficher un ancien prix.
 */
export const PRIX_MENSUEL_HT = 89
export const PRIX_ANNUEL_HT = 890
/** Tarif réservé par l'opératrice à une organisation nommée (`offre = early_adopter`), mensuel seul. */
export const PRIX_EARLY_ADOPTER_HT = 29
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

/** Un montant en euros, à la française : « 106,80 », « 1 068 », « 74,17 ». */
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
