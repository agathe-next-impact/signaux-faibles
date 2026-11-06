/**
 * L'offre, telle qu'Agathe l'a décidée le 17 octobre 2026 et revue le
 * 6 novembre 2026 (`docs/decision-portail-moteur.md`, section « L'offre »). Le
 * seul endroit où ses chiffres sont écrits dans le code : un écran qui les
 * recopierait finirait par afficher un ancien prix.
 *
 * Depuis le 6 novembre 2026 : **259 € HT par mois**, par organisation, qui
 * comprend la création du référentiel et deux heures de prise en main. Une
 * seule formule publique, mensuelle : l'annuelle n'est plus proposée.
 */
export const PRIX_MENSUEL_HT = 259
/** La prise en main comprise dans l'abonnement, en heures. */
export const HEURES_DE_PRISE_EN_MAIN = 2
/**
 * Les frais de mise en place (6 novembre 2026) : **offerts aux early
 * adopters**, c'est-à-dire à toute inscription jusqu'à
 * `FIN_DU_TARIF_EARLY_ADOPTER` incluse, puis facturés une fois à ce montant.
 * Annoncés seulement : rien n'est encore facturé par Stripe à ce titre.
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

/** Un montant en euros, à la française : « 310,80 », « 1 790 », « 86,33 ». */
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
