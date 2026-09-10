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

/**
 * Le compte de service, quelle que soit la façon dont il a été fourni.
 *
 * Trois voies, de la plus sûre à la plus fragile. `GOOGLE_COMPTE_SERVICE_JSON`
 * porte le fichier de clé entier : il tient sur une ligne, ses retours à la
 * ligne y sont déjà échappés par le format JSON, et rien ne peut se perdre au
 * collage. C'est la voie à préférer. Les deux variables séparées restent
 * acceptées, mais elles exposent la clé aux mutilations d'un copier-coller.
 */
export function compteDeService(): { email: string; clePrivée: string } {
  const configuration = env()

  if (configuration.GOOGLE_COMPTE_SERVICE_JSON) {
    let fichier: { client_email?: unknown; private_key?: unknown }
    try {
      fichier = JSON.parse(configuration.GOOGLE_COMPTE_SERVICE_JSON) as typeof fichier
    } catch {
      throw new Error(
        "GOOGLE_COMPTE_SERVICE_JSON n'est pas du JSON valide. Y coller le contenu " +
          'entier du fichier de clé téléchargé depuis Google Cloud, accolades comprises.',
      )
    }

    if (typeof fichier.client_email !== 'string' || typeof fichier.private_key !== 'string') {
      throw new Error(
        'GOOGLE_COMPTE_SERVICE_JSON ne porte pas les champs client_email et ' +
          "private_key. Ce n'est pas un fichier de clé de compte de service.",
      )
    }

    return {
      email: fichier.client_email,
      clePrivée: normaliserClePrivée(fichier.private_key),
    }
  }

  const email = configuration.GOOGLE_COMPTE_SERVICE_EMAIL
  const clé = configuration.GOOGLE_COMPTE_SERVICE_CLE_PRIVEE
  if (!email || !clé) {
    throw new Error(
      'Aucun compte de service configuré : renseigner GOOGLE_COMPTE_SERVICE_JSON, ' +
        'ou GOOGLE_COMPTE_SERVICE_EMAIL et GOOGLE_COMPTE_SERVICE_CLE_PRIVEE.',
    )
  }

  return { email, clePrivée: normaliserClePrivée(clé) }
}

/** Alphabet du base64, plus le remplissage. */
const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/

/**
 * Reconstruit un PEM canonique à partir d'une valeur abîmée.
 *
 * La valeur traverse une console d'hébergement avant d'arriver ici, et elle en
 * ressort mutilée de plusieurs façons qui produisent toutes la même erreur
 * OpenSSL, `DECODER routines::unsupported`, laquelle ne dit rien de la cause.
 *
 * Plutôt que de rattraper chaque mutilation une à une, on extrait les deux
 * seules choses qui comptent — l'intitulé de l'armure et le corps en base64 —
 * et on réécrit un PEM propre. Cela absorbe d'un coup les guillemets copiés
 * avec la valeur, les `\n` littéraux, les fins de ligne Windows, la marque
 * d'ordre des octets, les espaces insécables, les retours à la ligne remplacés
 * par des espaces, et les longueurs de ligne fantaisistes.
 */
export function normaliserClePrivée(brute: string): string {
  // Marque d'ordre des octets, invisible mais fatale à OpenSSL.
  let clé = brute.replace(/^\uFEFF/, '').trim()

  for (const guillemet of ['"', "'"]) {
    if (clé.startsWith(guillemet) && clé.endsWith(guillemet) && clé.length > 1) {
      clé = clé.slice(1, -1).trim()
      break
    }
  }

  clé = clé.replaceAll('\\n', '\n').replaceAll('\r', '')

  // Valeur entièrement ré-encodée en base64, pour esquiver la question des
  // retours à la ligne.
  if (!clé.includes('-----')) {
    const décodée = Buffer.from(clé.replace(/\s/g, ''), 'base64').toString('utf8')
    if (décodée.includes('-----BEGIN')) clé = décodée.trim()
  }

  const armure = /-----BEGIN ([A-Z0-9 ]+)-----([\s\S]*?)-----END \1-----/.exec(clé)
  if (!armure) {
    throw new Error(
      "La clé privée du compte de service ne ressemble pas à un PEM : aucune paire " +
        '« -----BEGIN … ----- » / « -----END … ----- » cohérente. Coller le contenu ' +
        'du champ private_key du fichier JSON, sans les guillemets, ou mieux : ' +
        'renseigner GOOGLE_COMPTE_SERVICE_JSON avec le fichier entier.',
    )
  }

  const intitulé = armure[1] ?? ''
  // Tout ce qui n'est pas du base64 saute : espaces ordinaires ou insécables,
  // retours à la ligne, tabulations.
  const corps = (armure[2] ?? '').replace(/[^A-Za-z0-9+/=]/g, '')

  if (corps.length === 0 || !BASE64.test(corps)) {
    throw new Error(
      `La clé privée porte bien une armure « ${intitulé} », mais son corps n'est pas ` +
        `du base64 exploitable (${corps.length} caractères retenus). La valeur a été ` +
        'tronquée ou altérée au collage. Renseigner plutôt GOOGLE_COMPTE_SERVICE_JSON ' +
        'avec le fichier de clé entier.',
    )
  }

  // Réécriture canonique : lignes de 64 caractères, fin de ligne finale.
  const lignes = corps.match(/.{1,64}/g) ?? []
  return `-----BEGIN ${intitulé}-----\n${lignes.join('\n')}\n-----END ${intitulé}-----\n`
}

/** Décrit la forme d'une clé sans en révéler le contenu, pour le diagnostic. */
export function décrireClePrivée(clé: string): string {
  const armure = /-----BEGIN ([A-Z0-9 ]+)-----/.exec(clé)
  const corps = clé.replace(/-----[^-]+-----/g, '').replace(/\s/g, '')
  return `armure « ${armure?.[1] ?? 'absente'} », ${corps.length} caractères de corps`
}

function signerJWT(revendications: RevendicationsJWT, clésPrivée: string): string {
  const entête = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const corps = base64url(JSON.stringify(revendications))
  const àSigner = `${entête}.${corps}`

  let signature: Buffer
  try {
    signature = createSign('RSA-SHA256').update(àSigner).end().sign(clésPrivée)
  } catch (erreur) {
    // OpenSSL ne dit que « DECODER routines::unsupported ». On y ajoute ce que
    // l'on peut observer sans divulguer la clé : son armure et sa longueur.
    throw new Error(
      `OpenSSL refuse la clé privée du compte de service (${décrireClePrivée(clésPrivée)}). ` +
        'Le plus sûr est de renseigner GOOGLE_COMPTE_SERVICE_JSON avec le fichier de ' +
        "clé entier, plutôt que de recopier private_key. Cause d'origine : " +
        (erreur instanceof Error ? erreur.message : String(erreur)),
    )
  }
  return `${àSigner}.${base64url(signature)}`
}

async function obtenirJetonGoogle(): Promise<string> {
  const compte = compteDeService()
  const jwt = signerJWT(
    composerRevendications(compte.email, env().GMAIL_EXPEDITEUR),
    compte.clePrivée,
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
