/**
 * Niveau d'impact d'un axe.
 *
 * Un « axe » est une section thématique du corps d'une note — le H2 « Marché
 * du travail — FORT ». À ne pas confondre avec la propriété Notion `Famille`,
 * clé de gestion interne à deux valeurs qui n'est jamais affichée.
 *
 * Trois niveaux, pas quatre : c'est une règle de la charte, pas un choix
 * d'implémentation. Dans Notion le niveau est le *suffixe* du titre H2 d'un
 * axe. FAIBLE n'existe pas : un titre qui le porterait encore est traité comme
 * un suffixe inconnu, affiché tel quel et sans badge, jamais converti en un
 * autre niveau.
 */
export type NiveauImpact = 'FORT' | 'MOYEN' | 'RAS'

const NIVEAUX: readonly NiveauImpact[] = ['FORT', 'MOYEN', 'RAS']

/** Du plus fort au plus faible. Un suffixe inconnu passe en dernier. */
const RANG: Record<NiveauImpact, number> = { FORT: 0, MOYEN: 1, RAS: 2 }

export type TitreDAxe = {
  /** Le titre débarrassé de son suffixe, ou le titre entier si le suffixe est inconnu. */
  readonly axe: string
  /** `null` quand le suffixe est absent ou non reconnu : aucun badge n'est affiché. */
  readonly niveau: NiveauImpact | null
}

/** Tirets acceptés comme séparateur de suffixe, cadratin en tête. */
const SÉPARATEURS = ['—', '–', '-']

/**
 * Lit le suffixe d'impact d'un titre H2 d'axe.
 *
 * La tolérance porte sur la ponctuation et les espaces, jamais sur le mot :
 * seuls FORT, MOYEN et RAS donnent un niveau.
 */
export function lireTitreDAxe(titre: string): TitreDAxe {
  const nettoyé = titre.trim()

  for (const séparateur of SÉPARATEURS) {
    const position = nettoyé.lastIndexOf(séparateur)
    if (position <= 0) continue

    const suffixe = nettoyé.slice(position + séparateur.length).trim()
    const niveau = NIVEAUX.find((candidat) => candidat === suffixe.toUpperCase())
    if (!niveau) continue

    const axe = nettoyé.slice(0, position).trim()
    // Un titre réduit à son seul suffixe n'a pas de nom d'axe : on garde le
    // titre entier plutôt que de produire une section anonyme.
    if (axe.length === 0) return { axe: nettoyé, niveau: null }

    return { axe, niveau }
  }

  return { axe: nettoyé, niveau: null }
}

/** Ordre de tri des axes par impact décroissant. */
export function rangDImpact(niveau: NiveauImpact | null): number {
  return niveau === null ? NIVEAUX.length : RANG[niveau]
}

/**
 * Trie des axes par impact décroissant, en conservant l'ordre d'origine à
 * l'intérieur d'un même niveau : c'est celui que la note a voulu.
 */
export function trierParImpact<T extends { readonly niveau: NiveauImpact | null }>(
  axes: readonly T[],
): T[] {
  return axes
    .map((axe, position) => ({ axe, position }))
    .sort((a, b) => {
      const écart = rangDImpact(a.axe.niveau) - rangDImpact(b.axe.niveau)
      return écart !== 0 ? écart : a.position - b.position
    })
    .map((entrée) => entrée.axe)
}

/**
 * Le libellé d'affichage d'un niveau.
 *
 * La charte nomme les badges autrement que Notion ne nomme les niveaux :
 * Notion écrit le suffixe `MOYEN`, la charte affiche « à surveiller ». C'est
 * une correspondance d'affichage, pas une conversion — les trois niveaux
 * restent trois, et « RAS » est un état à part entière qui se montre.
 */
export function libelléDImpact(niveau: NiveauImpact): string {
  switch (niveau) {
    case 'FORT':
      return 'signal fort'
    case 'MOYEN':
      return 'à surveiller'
    case 'RAS':
      return 'RAS'
  }
}
