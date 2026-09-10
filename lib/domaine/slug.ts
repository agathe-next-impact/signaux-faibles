/**
 * L'adresse d'un nom dans une URL.
 *
 * Sert aux axes comme aux acteurs. Dérivée du **nom** et de rien d'autre : ni
 * du numéro d'un axe, qui change quand le référentiel est réordonné, ni d'un
 * identifiant Notion, qui ne dirait rien au lecteur.
 *
 * Deux noms qui se réduiraient au même segment seraient indiscernables. Le cas
 * ne s'est pas présenté ; la page prend alors le premier, plutôt que d'échouer
 * devant le lecteur.
 */
export function enSlug(nom: string): string {
  return nom
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
