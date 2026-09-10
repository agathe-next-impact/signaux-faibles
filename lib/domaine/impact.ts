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
  /**
   * Le rang de l'axe dans le référentiel, détaché du titre pour être composé en
   * indice. `null` quand le titre n'en porte pas.
   */
  readonly numéro: number | null
  /** `null` quand le suffixe est absent ou non reconnu : aucun badge n'est affiché. */
  readonly niveau: NiveauImpact | null
}

/**
 * Le rang qu'un caractère de numérotation porte, ou `null`.
 *
 * Les référentiels numérotent les axes avec des chiffres cerclés — ① à ⑳ —,
 * que les polices de la charte ne dessinent pas : le navigateur va les chercher
 * dans une police de secours, et le titre se retrouve composé en deux fontes.
 * On lit donc le rang, et l'affichage le recompose en indice.
 */
function rangDUnCaractère(caractère: string): number | null {
  const point = caractère.codePointAt(0)
  if (point === undefined) return null
  if (point === 0x24ea) return 0 // ⓪
  if (point >= 0x2460 && point <= 0x2473) return point - 0x2460 + 1 // ① à ⑳
  if (point >= 0x2776 && point <= 0x277f) return point - 0x2776 + 1 // ❶ à ❿
  if (point >= 0x2780 && point <= 0x2789) return point - 0x2780 + 1 // ➀ à ➉
  return null
}

/**
 * Détache le numéro de tête d'un titre d'axe.
 *
 * Un chiffre nu ne compte pas : « 5G et réseaux » garde son nom entier. Il faut
 * un caractère de numérotation, ou un chiffre suivi d'un point ou d'une
 * parenthèse — une marque que l'on écrit exprès pour numéroter.
 */
export function détacherLeNuméro(titre: string): {
  readonly numéro: number | null
  readonly reste: string
} {
  const nettoyé = titre.trim()
  const premier = [...nettoyé][0]

  if (premier) {
    const rang = rangDUnCaractère(premier)
    if (rang !== null) {
      const reste = nettoyé.slice(premier.length).replace(/^[\s.)—–-]+/, '').trim()
      // Un titre réduit à son numéro n'a pas de nom : on le garde entier plutôt
      // que d'afficher un axe anonyme.
      if (reste.length > 0) return { numéro: rang, reste }
      return { numéro: null, reste: nettoyé }
    }
  }

  const marqué = /^(\d{1,2})[.)]\s+(\S.*)$/.exec(nettoyé)
  if (marqué?.[1] && marqué[2]) {
    return { numéro: Number(marqué[1]), reste: marqué[2].trim() }
  }

  return { numéro: null, reste: nettoyé }
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

    const sansSuffixe = nettoyé.slice(0, position).trim()
    // Un titre réduit à son seul suffixe n'a pas de nom d'axe : on garde le
    // titre entier plutôt que de produire une section anonyme.
    if (sansSuffixe.length === 0) return { axe: nettoyé, numéro: null, niveau: null }

    const { numéro, reste } = détacherLeNuméro(sansSuffixe)
    return { axe: reste, numéro, niveau }
  }

  const { numéro, reste } = détacherLeNuméro(nettoyé)
  return { axe: reste, numéro, niveau: null }
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
