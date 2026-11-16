/**
 * Publication automatique des synthèses stratégiques et des marchés et niches
 * (15 novembre 2026, demande de l'opératrice : « les marchés et niches et vues
 * trimestrielles et mensuelles doivent être publiées automatiquement sans
 * validation dans l'admin »). Ce qui passe la porte est publié à l'écriture :
 * plus aucun geste « Publier » n'est attendu pour qu'un client le lise.
 *
 * `PUBLICATION_AUTOMATIQUE` (facultative) : `non` rend le circuit d'avant, où
 * tout s'écrit en proposition et attend le bouton « Publier ». Toute autre
 * valeur, ou son absence, publie.
 *
 * Le retrait reste le geste de l'opératrice, et la production le respecte : une
 * période qu'elle a retirée reste retirée quand elle est réécrite (une synthèse
 * re-postée, un trimestre re-mesuré), jusqu'à ce qu'elle la publie de nouveau.
 */

export type ÉtatÀLaProduction = 'propose' | 'publie' | 'retire'

/** Lit la variable : seul `non` (casse et blancs ignorés) coupe la publication automatique. */
export function lireLaPublicationAutomatique(valeur: string | undefined): boolean {
  return (valeur ?? '').trim().toLowerCase() !== 'non'
}

/**
 * L'état des lignes neuves d'une période, d'après le réglage et l'état des
 * lignes qu'elles remplacent : en proposition sans publication automatique,
 * retirées si l'opératrice avait retiré la période, publiées sinon.
 */
export function étatÀLaProduction(entrée: { readonly automatique: boolean; readonly étatsRemplacés: readonly string[] }): ÉtatÀLaProduction {
  if (!entrée.automatique) return 'propose'
  if (entrée.étatsRemplacés.includes('retire')) return 'retire'
  return 'publie'
}

/** Une période qui attend encore un geste : des lignes en proposition, aucune retirée. */
export function attendUnePublication(états: readonly string[]): boolean {
  return états.includes('propose') && !états.includes('retire')
}
