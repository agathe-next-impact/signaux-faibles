/**
 * Les normalisations de texte partagées par le domaine et le validateur.
 *
 * Jusqu'au 14 octobre 2026, `sansAccent` existait en trois exemplaires
 * (document, mentions, lint) qui différaient sur l'apostrophe typographique, et
 * la reconnaissance de la rubrique de cadrage en deux. Une convention lue par
 * deux parseurs doit vivre à un seul endroit, sans quoi le validateur accepte
 * ce que l'écran détache, ou l'inverse.
 */

/** Minuscules, sans accent, apostrophe typographique ramenée à l'apostrophe droite. */
export function sansAccent(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replaceAll('’', "'")
    .toLowerCase()
}

/**
 * Reconnaît la rubrique d'ajustements du cadrage à son titre.
 *
 * C'est le seul signal disponible : le cadrage vit dans le corps de la note, et
 * aucune propriété Notion ne le marque. La reconnaissance est une convention
 * avec les tâches Cowork, tenue lâche sur l'habillage (accents, casse, mots
 * autour) et stricte sur le mot : « cadrage » en entier. « Recadrage du
 * marché » est un titre d'actualité, pas une rubrique de périmètre, et il
 * resterait dans la lettre. Si le titre était reformulé au point de perdre le
 * mot, la section **réapparaîtrait dans la lettre** : une panne visible, pas
 * une disparition silencieuse.
 */
export function estTitreDeCadrage(titre: string): boolean {
  return /\bcadrage\b/.test(sansAccent(titre))
}
