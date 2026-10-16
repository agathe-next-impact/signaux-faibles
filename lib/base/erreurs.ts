/**
 * Ce qu'une erreur Postgres a le droit de dire en sortant de `lib/base/`.
 *
 * Drizzle enveloppe chaque échec dans une `DrizzleQueryError` dont le message
 * est `Failed query: <requête> params: <valeurs>` : les valeurs sont celles de
 * la requête, c'est-à-dire un identifiant d'accès ou une adresse email. Les
 * routes et Next journalisent `erreur.message` ; laisser passer cette erreur
 * écrirait le secret du lien dans les journaux à chaque échec (relevé par la
 * relecture du 16 octobre 2026, vérifié sur PGlite).
 *
 * Le texte de l'erreur Postgres elle-même n'est pas plus sûr : « invalid input
 * syntax for type uuid: "…" » recopie la valeur fautive. On ne garde donc que
 * le code SQLSTATE (`42P01` table absente, `23505` unicité, `08…` connexion),
 * qui suffit à diagnostiquer et ne contient jamais une donnée.
 */
export class ErreurDeBase extends Error {
  override readonly name = 'ErreurDeBase'
  readonly code: string | null

  constructor(opération: string, code: string | null) {
    super(`[base] ${opération} en échec${code ? ` (SQLSTATE ${code})` : ''}.`)
    this.code = code
  }
}

function codeSql(erreur: unknown): string | null {
  for (let courante = erreur, profondeur = 0; courante && profondeur < 4; profondeur++) {
    const code = (courante as { code?: unknown }).code
    if (typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)) return code
    courante = (courante as { cause?: unknown }).cause
  }
  return null
}

/** Exécute une lecture ou une écriture, et ne laisse sortir qu'une erreur sans donnée. */
export async function protéger<T>(opération: string, requête: () => Promise<T>): Promise<T> {
  try {
    return await requête()
  } catch (erreur) {
    throw new ErreurDeBase(opération, codeSql(erreur))
  }
}
