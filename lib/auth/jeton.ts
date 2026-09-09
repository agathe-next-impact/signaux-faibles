import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Le lien d'accès persistant.
 *
 * Un lien par personne, valable tant qu'il n'est pas révoqué. Le jeton est
 * l'identifiant d'accès accompagné de sa signature HMAC-SHA256 ; le secret est
 * une variable d'environnement du portail et ne part jamais dans Notion, qui ne
 * connaît que l'identifiant en clair.
 *
 * Révoquer se fait donc de deux façons, sans toucher au secret : décocher
 * `Actif`, ou régénérer l'identifiant dans la base « Accès — portail ».
 */

const SÉPARATEUR = '.'

function base64url(données: Buffer): string {
  return données.toString('base64url')
}

function signature(identifiant: string, secret: string): Buffer {
  return createHmac('sha256', secret).update(identifiant, 'utf8').digest()
}

/** Compose le jeton d'un identifiant d'accès. */
export function signerJeton(identifiant: string, secret: string): string {
  if (identifiant.length === 0) {
    throw new Error("Impossible de signer un identifiant d'accès vide.")
  }
  const corps = base64url(Buffer.from(identifiant, 'utf8'))
  return `${corps}${SÉPARATEUR}${base64url(signature(identifiant, secret))}`
}

/**
 * Vérifie un jeton et rend l'identifiant d'accès qu'il porte, ou `null`.
 *
 * La comparaison est en temps constant. Toutes les causes d'échec — forme
 * invalide, signature fausse, jeton vide — rendent `null` sans distinction :
 * l'appelant n'a pas à savoir laquelle, et le visiteur non plus.
 */
export function vérifierJeton(jeton: string, secret: string): string | null {
  const morceaux = jeton.split(SÉPARATEUR)
  if (morceaux.length !== 2) return null

  const [corps, signatureReçue] = morceaux
  if (!corps || !signatureReçue) return null

  let identifiant: string
  try {
    identifiant = Buffer.from(corps, 'base64url').toString('utf8')
  } catch {
    return null
  }
  if (identifiant.length === 0) return null

  const attendue = signature(identifiant, secret)
  const reçue = Buffer.from(signatureReçue, 'base64url')

  // `timingSafeEqual` exige deux tampons de même longueur ; la comparaison des
  // longueurs ne révèle rien qu'un attaquant ne puisse déduire du format.
  if (reçue.length !== attendue.length) return null
  if (!timingSafeEqual(reçue, attendue)) return null

  return identifiant
}

/** L'URL complète à envoyer à une personne. */
export function composerLienDAccès(
  identifiant: string,
  secret: string,
  urlDuPortail: string,
): string {
  const jeton = signerJeton(identifiant, secret)
  return new URL(`/acces/${encodeURIComponent(jeton)}`, urlDuPortail).toString()
}
