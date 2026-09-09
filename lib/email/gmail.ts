import { createSign } from 'node:crypto'
import { env } from '@/lib/env'

/**
 * Envoi du lien d'accès par l'API Gmail de Google Workspace.
 *
 * Pas de SMTP : l'authentification basique est arrêtée pour Workspace depuis le
 * 14 mars 2025. L'identité est un compte de service avec délégation à l'échelle
 * du domaine, autorisée pour la seule portée `gmail.send`, qui emprunte une
 * boîte émettrice dédiée.
 *
 * Le jeton d'accès Google est obtenu par un JWT auto-signé plutôt que par une
 * bibliothèque cliente : c'est une trentaine de lignes, cela évite une
 * dépendance lourde, et cela reste lisible.
 */

const PORTÉE = 'https://www.googleapis.com/auth/gmail.send'
const AUDIENCE = 'https://oauth2.googleapis.com/token'
const ENVOI = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send'

function base64url(valeur: string | Buffer): string {
  return (typeof valeur === 'string' ? Buffer.from(valeur, 'utf8') : valeur).toString(
    'base64url',
  )
}

export type RevendicationsJWT = {
  readonly iss: string
  readonly sub: string
  readonly scope: string
  readonly aud: string
  readonly iat: number
  readonly exp: number
}

/** Construit les revendications du JWT. Exposé pour être testé sans réseau. */
export function composerRevendications(
  compteDeService: string,
  boîteEmpruntée: string,
  maintenant: number = Math.floor(Date.now() / 1000),
): RevendicationsJWT {
  return {
    iss: compteDeService,
    sub: boîteEmpruntée,
    scope: PORTÉE,
    aud: AUDIENCE,
    iat: maintenant,
    // Google refuse au-delà d'une heure ; on reste en deçà.
    exp: maintenant + 3600,
  }
}

function signerJWT(revendications: RevendicationsJWT, clésPrivée: string): string {
  const entête = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const corps = base64url(JSON.stringify(revendications))
  const àSigner = `${entête}.${corps}`

  const signature = createSign('RSA-SHA256').update(àSigner).end().sign(clésPrivée)
  return `${àSigner}.${base64url(signature)}`
}

async function obtenirJetonGoogle(): Promise<string> {
  const configuration = env()
  const jwt = signerJWT(
    composerRevendications(
      configuration.GOOGLE_COMPTE_SERVICE_EMAIL,
      configuration.GMAIL_EXPEDITEUR,
    ),
    configuration.GOOGLE_COMPTE_SERVICE_CLE_PRIVEE,
  )

  const réponse = await fetch(AUDIENCE, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })

  if (!réponse.ok) {
    // Le corps de la réponse peut nommer la portée refusée : utile en recette,
    // et sans secret.
    throw new Error(
      `Google a refusé le jeton du compte de service (${réponse.status}) : ${await réponse.text()}`,
    )
  }

  const données = (await réponse.json()) as { access_token?: unknown }
  if (typeof données.access_token !== 'string') {
    throw new Error('Réponse de Google sans jeton d’accès exploitable.')
  }
  return données.access_token
}

/** Encode un en-tête non ASCII selon la RFC 2047. */
function entêteEncodé(valeur: string): string {
  // eslint-disable-next-line no-control-regex
  return /^[\x20-\x7E]*$/.test(valeur)
    ? valeur
    : `=?UTF-8?B?${Buffer.from(valeur, 'utf8').toString('base64')}?=`
}

export type Message = {
  readonly destinataire: string
  readonly sujet: string
  readonly texte: string
}

/** Compose le message RFC 2822. Exposé pour être testé sans réseau. */
export function composerMessage(
  message: Message,
  expéditeur: string,
  nomExpéditeur: string,
): string {
  const lignes = [
    `From: ${entêteEncodé(nomExpéditeur)} <${expéditeur}>`,
    `To: ${message.destinataire}`,
    `Subject: ${entêteEncodé(message.sujet)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(message.texte, 'utf8').toString('base64'),
  ]
  return lignes.join('\r\n')
}

export async function envoyerMessage(message: Message): Promise<void> {
  const configuration = env()
  const jeton = await obtenirJetonGoogle()

  const réponse = await fetch(ENVOI, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${jeton}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      raw: base64url(
        composerMessage(
          message,
          configuration.GMAIL_EXPEDITEUR,
          configuration.GMAIL_EXPEDITEUR_NOM,
        ),
      ),
    }),
  })

  if (!réponse.ok) {
    throw new Error(
      `L'envoi par Gmail a échoué (${réponse.status}) : ${await réponse.text()}`,
    )
  }
}

/** Le courrier qui porte le lien, premier envoi et renvoi confondus. */
export function composerCourrierDAccès(prénomOuNom: string, lien: string): Message {
  const salutation = prénomOuNom.trim().length > 0 ? `Bonjour ${prénomOuNom.trim()},` : 'Bonjour,'

  return {
    destinataire: '',
    sujet: 'Votre lien vers le portail signauxfaibles',
    texte: [
      salutation,
      '',
      'Voici votre lien personnel vers le portail. Il reste valable : vous pouvez',
      'le garder en favori et y revenir chaque semaine.',
      '',
      lien,
      '',
      'Ce lien vous est propre. Ne le transférez pas : la personne qui l’ouvrirait',
      'verrait vos éditions.',
      '',
      'signauxfaibles',
    ].join('\n'),
  }
}
