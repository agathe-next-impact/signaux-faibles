import { createHash, timingSafeEqual } from 'node:crypto'

/**
 * Ouvrir l'espace d'un lecteur à la fin de l'onboarding.
 *
 * L'étape 7 de `docs/onboarding-organisation.md` était le seul geste entièrement
 * manuel du dispositif, et c'est elle qui a produit les deux pannes des 10 et 11
 * septembre 2026 : un identifiant d'organisation recopié depuis la mauvaise page,
 * puis une ligne dupliquée dont l'identifiant d'accès n'avait pas été régénéré.
 * Elle se terminait en outre par une phrase qui n'engageait personne — « la
 * personne va sur recevoir mon lien » —, de sorte qu'un client activé pouvait
 * ne jamais recevoir son accès.
 *
 * Le partage des rôles ne change pas, parce qu'il est imposé :
 *
 * - **Cowork** crée la ligne « Accès — portail ». Il a le registre, l'identifiant
 *   de la ligne, le slug et l'email du lecteur ; le portail n'écrit jamais dans
 *   Notion et n'a pas accès au registre ;
 * - **le portail** compose et envoie le lien. Le secret HMAC ne le quitte
 *   jamais, donc personne d'autre ne peut le faire.
 *
 * Il manquait le raccord. C'est cette route : Cowork appelle le portail une
 * fois la ligne écrite, le portail envoie le lien et rend son diagnostic. Le
 * webhook Notion reste étranger à tout cela — il n'envoie jamais d'email, c'est
 * ce qui lui permet de répondre dans la fenêtre et de ne pas transformer une
 * rafale d'éditions en rafale de courriers.
 *
 * **La demande porte un email, jamais l'identifiant d'accès.** Cowork possède
 * pourtant ce dernier, puisqu'il vient de l'écrire. Mais il est le secret que
 * le portail signe : moins il circule, mieux le dispositif se porte. L'email
 * suffit à retrouver la ligne, et c'est de toute façon le seul champ dont
 * dépend l'envoi.
 */
export type DécisionActivation =
  /** `ACTIVATION_SECRET` absent : la route est fermée, et le dit. */
  | { readonly sorte: 'non-configurée' }
  /** À refuser en 401, sans préciser laquelle des causes. */
  | { readonly sorte: 'refusée'; readonly raison: string }
  /** Demande authentique : voici pour qui ouvrir. */
  | { readonly sorte: 'ouvrir'; readonly email: string }

/**
 * Décide du sort d'une demande d'ouverture.
 *
 * Toute la décision est ici, en fonction pure : le route handler ne fait que
 * les entrées-sorties. C'est ce qui rend les cas de refus testables sans
 * serveur, comme pour le webhook.
 *
 * La comparaison du jeton est en temps constant, et la longueur est égalisée
 * avant : `timingSafeEqual` lève sur deux tampons de tailles différentes, et
 * comparer les longueurs d'abord dirait combien de caractères viser.
 */
export function interpréterDemande(demande: {
  readonly brut: string
  readonly autorisation: string | null | undefined
  readonly secret: string | undefined
}): DécisionActivation {
  if (!demande.secret) return { sorte: 'non-configurée' }

  const porté = /^Bearer (.+)$/.exec(demande.autorisation ?? '')?.[1]
  if (!porté) return { sorte: 'refusée', raison: 'en-tête Authorization absent ou mal formé' }

  if (!égalEnTempsConstant(porté, demande.secret)) {
    return { sorte: 'refusée', raison: 'jeton invalide' }
  }

  let charge: unknown
  try {
    charge = JSON.parse(demande.brut)
  } catch {
    return { sorte: 'refusée', raison: 'corps illisible' }
  }

  const saisi = (charge as { email?: unknown })?.email
  const email = typeof saisi === 'string' ? saisi.trim().toLowerCase() : ''

  // Une adresse absente n'est pas un problème d'authentification, mais la
  // réponse reste un refus : il n'y a rien à ouvrir.
  if (email.length === 0 || !email.includes('@')) {
    return { sorte: 'refusée', raison: 'email absent ou invalide' }
  }

  return { sorte: 'ouvrir', email }
}

function égalEnTempsConstant(reçu: string, attendu: string): boolean {
  // Les deux chaînes n'ont pas forcément la même longueur, et `timingSafeEqual`
  // lève dans ce cas. Comparer les longueurs d'abord dirait combien de
  // caractères viser ; on compare donc des empreintes, qui font toujours
  // trente-deux octets, quelle que soit la taille de l'entrée.
  const empreinte = (valeur: string): Buffer =>
    createHash('sha256').update(valeur, 'utf8').digest()

  return timingSafeEqual(empreinte(reçu), empreinte(attendu))
}
