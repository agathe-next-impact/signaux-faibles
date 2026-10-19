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
