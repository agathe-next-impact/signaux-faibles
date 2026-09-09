/**
 * Niveau d'impact d'une famille.
 *
 * Trois niveaux, pas quatre : c'est une règle de la charte, pas un choix
 * d'implémentation. Dans Notion le niveau est le *suffixe* du titre H2 d'une
 * famille (« Famille — FORT »). FAIBLE n'existe pas : un titre qui le porterait
 * encore est traité comme un suffixe inconnu, affiché tel quel et sans badge,
 * jamais converti en un autre niveau.
 */
export type NiveauImpact = 'FORT' | 'MOYEN' | 'RAS'

const NIVEAUX: readonly NiveauImpact[] = ['FORT', 'MOYEN', 'RAS']

/** Du plus fort au plus faible. Un suffixe inconnu passe en dernier. */
const RANG: Record<NiveauImpact, number> = { FORT: 0, MOYEN: 1, RAS: 2 }

export type TitreDeFamille = {
  /** Le titre débarrassé de son suffixe, ou le titre entier si le suffixe est inconnu. */
  readonly famille: string
  /** `null` quand le suffixe est absent ou non reconnu : aucun badge n'est affiché. */
  readonly niveau: NiveauImpact | null
}

/** Tirets acceptés comme séparateur de suffixe, cadratin en tête. */
const SÉPARATEURS = ['—', '–', '-']

/**
 * Lit le suffixe d'impact d'un titre H2 de famille.
 *
 * La tolérance porte sur la ponctuation et les espaces, jamais sur le mot :
 * seuls FORT, MOYEN et RAS donnent un niveau.
 */
export function lireTitreDeFamille(titre: string): TitreDeFamille {
  const nettoyé = titre.trim()

  for (const séparateur of SÉPARATEURS) {
    const position = nettoyé.lastIndexOf(séparateur)
    if (position <= 0) continue

    const suffixe = nettoyé.slice(position + séparateur.length).trim()
    const niveau = NIVEAUX.find((candidat) => candidat === suffixe.toUpperCase())
    if (!niveau) continue

    const famille = nettoyé.slice(0, position).trim()
    // Un titre réduit à son seul suffixe n'a pas de nom de famille : on garde
    // le titre entier plutôt que de produire une section anonyme.
    if (famille.length === 0) return { famille: nettoyé, niveau: null }

    return { famille, niveau }
  }

  return { famille: nettoyé, niveau: null }
}

/** Ordre de tri des familles par impact décroissant. */
export function rangDImpact(niveau: NiveauImpact | null): number {
  return niveau === null ? NIVEAUX.length : RANG[niveau]
}

/**
 * Trie des familles par impact décroissant, en conservant l'ordre d'origine
 * à l'intérieur d'un même niveau : c'est celui que la note a voulu.
 */
export function trierParImpact<T extends { readonly niveau: NiveauImpact | null }>(
  familles: readonly T[],
): T[] {
  return familles
    .map((famille, position) => ({ famille, position }))
    .sort((a, b) => {
      const écart = rangDImpact(a.famille.niveau) - rangDImpact(b.famille.niveau)
      return écart !== 0 ? écart : a.position - b.position
    })
    .map((entrée) => entrée.famille)
}
