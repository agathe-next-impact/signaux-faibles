/**
 * Le code de recommandation d'un prescripteur (24 octobre 2026,
 * `docs/prescripteurs.md`) : celui du lien `/demo?de=<code>`. Il n'est pas un
 * secret ; sa forme est celle de la contrainte `prescripteurs_code_forme`.
 * Fonction pure : la page `/demo` la lit sans ouvrir Postgres.
 */
export function codeDePrescripteurValide(code: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(code) && code.length >= 3 && code.length <= 40
}

/** Le paramètre d'adresse qui porte le code : `/demo?de=<code>`. */
export const PARAMÈTRE_DU_PRESCRIPTEUR = 'de'
