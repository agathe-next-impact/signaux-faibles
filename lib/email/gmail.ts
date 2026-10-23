import { composerCourriel, corpsDeParagraphes, dateDuJour, type Courriel } from '@/lib/email/gabarit'
import { createSign } from 'node:crypto'
import { env } from '@/lib/env'

/**
 * Envoi du lien d'accès, et dépôt des brouillons commerciaux, par l'API Gmail
 * de Google Workspace.
 *
 * Pas de SMTP : l'authentification basique est arrêtée pour Workspace depuis le
 * 14 mars 2025. L'identité est un compte de service avec délégation à l'échelle
 * du domaine, autorisée pour trois portées (`PORTÉES_GMAIL`), chacune demandée
 * dans son propre jeton, pour deux usages :
 *
 *   · le portail emprunte la boîte émettrice dédiée (`GMAIL_EXPEDITEUR`), en
 *     `gmail.send` (envois) et `gmail.compose` (brouillons commerciaux) ;
 *   · les tâches planifiées (`scripts/taches/`) empruntent la boîte de
 *     l'opératrice (`GMAIL_BOITE_OPERATRICE`), en `gmail.compose` (brouillons)
 *     et `gmail.metadata` (en-têtes des messages envoyés, jamais leur corps),
 *     plus `gmail.send` pour le seul envoi permis, vers l'opératrice.
 *
 * Le jeton d'accès Google est obtenu par un JWT auto-signé plutôt que par une
 * bibliothèque cliente : c'est une trentaine de lignes, cela évite une
 * dépendance lourde, et cela reste lisible.
 */

const PORTÉE = 'https://www.googleapis.com/auth/gmail.send'

/**
 * Les trois portées délégées au compte de service (23 octobre 2026), chacune
 * demandée dans son propre jeton.
 */
export const PORTÉES_GMAIL = {
  envoi: PORTÉE,
  brouillons: 'https://www.googleapis.com/auth/gmail.compose',
  métadonnées: 'https://www.googleapis.com/auth/gmail.metadata',
} as const

/**
 * Les brouillons (23 octobre 2026) : les courriers commerciaux ne partent plus,
 * ils sont déposés en brouillon dans la boîte émettrice, relus puis envoyés à la
 * main. La création d'un brouillon demande `gmail.compose`, que `gmail.send`
 * n'accorde pas. Le jeton est demandé **par portée** : un seul jeton portant les
 * deux serait refusé en entier tant que `gmail.compose` n'est pas autorisée dans
 * la délégation, et le lien d'accès cesserait de partir.
 */
const PORTÉE_BROUILLONS = PORTÉES_GMAIL.brouillons
const AUDIENCE = 'https://oauth2.googleapis.com/token'
const ENVOI = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send'
const BROUILLONS = 'https://gmail.googleapis.com/gmail/v1/users/me/drafts'

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
  portée: string = PORTÉE,
): RevendicationsJWT {
  return {
    iss: compteDeService,
    sub: boîteEmpruntée,
    scope: portée,
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
    return lireCompteDeServiceJSON(configuration.GOOGLE_COMPTE_SERVICE_JSON)
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

/**
 * Le fichier de clé entier, tel que `GOOGLE_COMPTE_SERVICE_JSON` le porte. Exposé
 * pour les tâches planifiées, qui lisent leurs seules variables plutôt que tout
 * `env()` du portail.
 */
export function lireCompteDeServiceJSON(json: string): { email: string; clePrivée: string } {
  let fichier: { client_email?: unknown; private_key?: unknown }
  try {
    fichier = JSON.parse(json) as typeof fichier
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

async function obtenirJetonGoogle(portée: string = PORTÉE): Promise<string> {
  return jetonDeDélégation(compteDeService(), env().GMAIL_EXPEDITEUR, portée)
}

/**
 * Un jeton d'accès Google pour une portée, au nom d'une boîte du domaine. Le
 * refus garde le corps de la réponse de Google : il nomme `unauthorized_client`
 * (portée non déléguée) ou `invalid_grant` (boîte inconnue), sans secret.
 */
export async function jetonDeDélégation(
  compte: { email: string; clePrivée: string },
  boîte: string,
  portée: string,
): Promise<string> {
  const jwt = signerJWT(
    composerRevendications(compte.email, boîte, Math.floor(Date.now() / 1000), portée),
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
  /**
   * La version HTML, composée par le gabarit (`lib/email/gabarit.ts`). Avec
   * elle, le message part en `multipart/alternative` : le texte reste la partie
   * lue par les clients qui n'affichent pas le HTML, et par les filtres.
   */
  readonly html?: string
  /**
   * L'adresse à laquelle répondre, quand elle n'est pas l'expéditeur : la
   * personne qui demande une démonstration (`lib/portail/demo.ts`). Elle vient
   * d'un formulaire public : l'en-tête n'est posé que si elle est une adresse
   * simple, sans blanc ni retour à la ligne (`adresseDeRéponseSûre`), sinon il
   * est omis et la réponse retombe sur l'expéditeur.
   */
  readonly répondreÀ?: string
}

const ADRESSE_SIMPLE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/

/** L'adresse de réponse si elle est sûre à écrire dans un en-tête, sinon `null`. */
export function adresseDeRéponseSûre(adresse: string): string | null {
  return adresse.length <= 254 && ADRESSE_SIMPLE.test(adresse) ? adresse : null
}

/** Une partie MIME en base64, lignes de 76 caractères (RFC 2045). */
function partieBase64(typeDeContenu: string, contenu: string): string[] {
  const base64 = Buffer.from(contenu, 'utf8').toString('base64')
  return [
    `Content-Type: ${typeDeContenu}; charset="UTF-8"`,
    'Content-Transfer-Encoding: base64',
    '',
    ...(base64.match(/.{1,76}/g) ?? ['']),
  ]
}

/** Compose le message RFC 2822. Exposé pour être testé sans réseau. */
export function composerMessage(
  message: Message,
  expéditeur: string,
  nomExpéditeur: string,
): string {
  // Un brouillon peut n'avoir aucun destinataire (lettre d'un client dont
  // l'adresse manque encore) : l'en-tête To est alors omis, jamais posé vide.
  const entêtes = [
    `From: ${entêteEncodé(nomExpéditeur)} <${expéditeur}>`,
    ...(message.destinataire ? [`To: ${message.destinataire}`] : []),
    `Subject: ${entêteEncodé(message.sujet)}`,
    'MIME-Version: 1.0',
  ]
  const répondreÀ = message.répondreÀ ? adresseDeRéponseSûre(message.répondreÀ) : null
  if (répondreÀ) entêtes.splice(2, 0, `Reply-To: ${répondreÀ}`)
  if (!message.html) {
    return [...entêtes, ...partieBase64('text/plain', message.texte)].join('\r\n')
  }
  // Une frontière qui ne peut apparaître ni dans le base64 ni dans les en-têtes.
  const frontière = `=_signauxfaibles_${Buffer.from(message.sujet + message.destinataire).toString('hex').slice(0, 24)}`
  return [
    ...entêtes,
    `Content-Type: multipart/alternative; boundary="${frontière}"`,
    '',
    `--${frontière}`,
    ...partieBase64('text/plain', message.texte),
    `--${frontière}`,
    ...partieBase64('text/html', message.html),
    `--${frontière}--`,
    '',
  ].join('\r\n')
}

/**
 * Envoie un message et rend l'identifiant que Gmail lui donne, pour le journal
 * des courriers (`lib/portail/courriers.ts`, seul appelant hors de ce fichier).
 */
export async function envoyerMessage(message: Message): Promise<{ readonly idMessage: string | null }> {
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
    throw new ErreurDEnvoi(réponse.status, await réponse.text())
  }
  const corps = (await réponse.json().catch(() => null)) as { id?: unknown } | null
  return { idMessage: typeof corps?.id === 'string' ? corps.id : null }
}

/**
 * Dépose le message en brouillon dans la boîte émettrice, sans l'envoyer, et
 * rend l'identifiant du message que Gmail donne au brouillon. Même seul appelant
 * que `envoyerMessage` : `lib/portail/courriers.ts`, après la réservation.
 */
export async function créerBrouillon(message: Message): Promise<{ readonly idMessage: string | null }> {
  const configuration = env()
  const jeton = await obtenirJetonGoogle(PORTÉE_BROUILLONS)

  const réponse = await fetch(BROUILLONS, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${jeton}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        raw: base64url(
          composerMessage(
            message,
            configuration.GMAIL_EXPEDITEUR,
            configuration.GMAIL_EXPEDITEUR_NOM,
          ),
        ),
      },
    }),
  })

  if (!réponse.ok) {
    throw new ErreurDEnvoi(réponse.status, await réponse.text())
  }
  const corps = (await réponse.json().catch(() => null)) as { message?: { id?: unknown } } | null
  return { idMessage: typeof corps?.message?.id === 'string' ? corps.message.id : null }
}

/**
 * La boîte de l'opératrice, où les lettres attendent en brouillon d'être relues
 * et envoyées à la main (23 octobre 2026). Facultative et lue directement dans
 * l'environnement, comme `ADRESSE_POSTALE` : sans elle, `POST /api/veille/courriel`
 * rend le HTML comme avant et la tâche dépose le brouillon elle-même.
 */
export function boîteOpératrice(): string | null {
  const valeur = process.env['GMAIL_BOITE_OPERATRICE']?.trim()
  return valeur && adresseDeRéponseSûre(valeur) ? valeur : null
}

/**
 * Dépose une lettre, ou un courriel client composé par la même route, en
 * brouillon dans la boîte de l'opératrice, sans l'envoyer (23 octobre 2026).
 *
 * Avant, la route rendait le HTML et la tâche le recopiait dans
 * `create_draft` : 68 Ko par lettre écrits en sortie par le modèle, puis relus
 * à chacun de ses appels suivants. Ici le HTML ne quitte pas le portail.
 *
 * Ce n'est pas un courrier du portail : rien ne part, l'opératrice relit et
 * envoie, et la réconciliation du soir constate l'envoi dans la même boîte.
 * Il ne passe donc pas par le journal `courriers`. Seul appelant :
 * `app/api/veille/courriel/route.ts`, après le contrôle de la lettre.
 */
export async function déposerChezLOpératrice(
  message: Message,
  boîte: string,
  nomExpéditeur: string,
): Promise<{ readonly idBrouillon: string | null; readonly idMessage: string | null }> {
  const jeton = await jetonDeDélégation(compteDeService(), boîte, PORTÉE_BROUILLONS)

  const réponse = await fetch(BROUILLONS, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${jeton}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ message: { raw: base64url(composerMessage(message, boîte, nomExpéditeur)) } }),
  })

  if (!réponse.ok) {
    throw new ErreurDEnvoi(réponse.status, await réponse.text())
  }
  const corps = (await réponse.json().catch(() => null)) as { id?: unknown; message?: { id?: unknown } } | null
  return {
    idBrouillon: typeof corps?.id === 'string' ? corps.id : null,
    idMessage: typeof corps?.message?.id === 'string' ? corps.message.id : null,
  }
}

/** Un refus de Gmail, avec son statut HTTP : c'est lui seul que le journal garde. */
export class ErreurDEnvoi extends Error {
  override readonly name = 'ErreurDEnvoi'
  constructor(readonly statut: number, détail: string) {
    super(`L'envoi par Gmail a échoué (${statut}) : ${détail}`)
  }
}

/**
 * L'adresse postale de l'éditeur, en pied de chaque courriel client. Facultative
 * et lue directement dans l'environnement, comme les autres pièces qui ne
 * doivent faire tomber aucun envoi : sans elle, le pied s'arrête au crédit.
 */
export function adressePostale(): string | null {
  const valeur = process.env['ADRESSE_POSTALE']?.trim()
  return valeur ? valeur : null
}

/**
 * Le courrier qui porte le lien, premier envoi et renvoi confondus, au gabarit
 * de la charte (`lib/email/gabarit.ts`). La racine du portail est celle du lien
 * lui-même : aucune adresse codée en dur.
 */
export function composerCourrierDAccès(
  prénomOuNom: string,
  lien: string,
  options: { readonly destinataire?: string; readonly aujourdHui?: Date } = {},
): Message {
  const nom = prénomOuNom.trim()
  const salutation = nom.length > 0 ? `Bonjour ${nom},` : 'Bonjour,'
  const racine = (() => {
    try {
      return new URL(lien).origin
    } catch {
      return 'https://signauxfaibles.io'
    }
  })()
  const courriel: Courriel = {
    objet: 'Votre lien vers le portail signauxfaibles',
    préheader: 'Votre lien personnel vers vos lettres de veille, à garder en favori.',
    typeEnvoi: 'Accès',
    date: dateDuJour(options.aujourdHui),
    surtitre: 'Votre espace',
    titre: 'Votre lien personnel.',
    accroche: 'Il reste valable : gardez-le en favori.',
    salutation,
    corps: corpsDeParagraphes([
      'Voici votre lien personnel vers le portail Signaux Faibles. Il ouvre votre espace sans mot de passe et reste valable : vous pouvez le garder en favori et y revenir chaque semaine.',
      'Vos lettres y apparaissent dès leur parution, avec leurs archives et le suivi des acteurs.',
    ]),
    action: { libellé: 'Ouvrir mon espace', url: lien },
    réassurance: 'Ce lien vous est propre. Ne le transférez pas : la personne qui l’ouvrirait verrait vos éditions.',
    lienEnClair: true,
    pied: { sorte: 'accès', destinataire: options.destinataire ?? null },
    racine,
    adressePostale: adressePostale(),
  }

  return {
    destinataire: options.destinataire ?? '',
    sujet: courriel.objet,
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
    html: composerCourriel(courriel),
  }
}
