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

/**
 * Reconnaît la rubrique « L'essentiel » à son titre : « L'essentiel »,
 * « L’essentiel », « Essentiel », « L'essentiel de la semaine ».
 *
 * Deux lecteurs s'appuient sur elle et doivent la reconnaître de la même façon :
 * le validateur, qui borne la rubrique à huit lignes avant l'envoi, et la lettre
 * tronquée de l'essai (offre du 17 octobre 2026), qui n'en montre rien d'autre.
 * Si l'un acceptait un titre que l'autre refuse, une lettre conforme au
 * validateur pourrait arriver vide au prospect.
 */
export function estTitreDeLEssentiel(titre: string): boolean {
  return /^(l')?essentiel\b/.test(sansAccent(titre).trim())
}

/**
 * Les bornes de « L'essentiel » : huit lignes de 140 caractères au plus, une
 * ligne étant une puce ou un paragraphe non vide. Le validateur les fait
 * respecter avant l'envoi ; la lettre tronquée de l'essai ne montre rien au-delà.
 */
export const ESSENTIEL_LIGNES_MAX = 8
export const ESSENTIEL_CARACTÈRES_MAX = 140
