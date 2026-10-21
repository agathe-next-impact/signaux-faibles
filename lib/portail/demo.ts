import { dateDuJour } from '@/lib/email/gabarit'
import { adresseDeRéponseSûre, type Message } from '@/lib/email/gmail'

/**
 * Les demandes de démonstration (21 octobre 2026).
 *
 * Le formulaire public `/demo` ne crée rien : ni organisation, ni lecteur, ni
 * prospection. Il fait partir un courrier vers l'opératrice, qui répond à la
 * personne depuis sa boîte (`Reply-To`), et c'est tout. Le courrier passe par
 * `envoyerCourrier` comme les autres, en sorte `demande_demo` : le journal
 * `courriers` en garde la trace, jamais l'adresse du demandeur.
 *
 * Ce courrier va à l'opératrice, pas à un client : il n'est pas mis à la
 * charte (`lib/email/gabarit.ts`), comme l'alerte du soir.
 */

export const ADRESSE_DES_DEMANDES_DE_DÉMO = 'agathe@signauxfaibles.io'

/** Le champ piège : invisible, un robot le remplit, une personne jamais. */
export const CHAMP_PIÈGE = 'site_web'

const LONGUEURS = { nom: 120, organisation: 160, site: 300, fonction: 120, message: 2_000 } as const

export type DemandeDeDémo = {
  readonly nom: string
  readonly email: string
  readonly organisation: string
  /** Le site de l'organisation, normalisé en `https://…` s'il était saisi sans protocole. */
  readonly site: string
  readonly fonction: string
  readonly message: string
}

export type ChampDeDémo = 'nom' | 'email' | 'organisation' | 'site' | 'fonction' | 'message'

export type LectureDeLaDemande =
  | { readonly sorte: 'valide'; readonly demande: DemandeDeDémo }
  | { readonly sorte: 'invalide'; readonly champs: readonly ChampDeDémo[]; readonly valeurs: DemandeDeDémo }
  | { readonly sorte: 'piège' }

/** Une ligne : blancs repliés, caractères de contrôle retirés. */
function uneLigne(valeur: FormDataEntryValue | null): string {
  if (typeof valeur !== 'string') return ''
  return valeur.replace(/[\u0000-\u001F\u007F]+/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Un texte libre : retours à la ligne gardés, autres caractères de contrôle retirés. */
function unTexte(valeur: FormDataEntryValue | null): string {
  if (typeof valeur !== 'string') return ''
  return valeur
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Le site saisi, en adresse `http(s)` complète, ou `null` s'il n'en est pas une.
 * « next-impact.digital » devient « https://next-impact.digital » : personne ne
 * tape le protocole. L'hôte doit porter un point, et rien d'autre qu'un site
 * web n'est admis (`javascript:`, `mailto:` sont refusés).
 */
export function siteDeLOrganisation(saisi: string): string | null {
  if (saisi.length === 0 || saisi.length > LONGUEURS.site || /\s/.test(saisi)) return null
  const complet = /^[a-z][a-z0-9+.-]*:/i.test(saisi) ? saisi : `https://${saisi}`
  let url: URL
  try {
    url = new URL(complet)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  if (url.username || url.password) return null
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(url.hostname)) return null
  return url.href.replace(/\/$/, '')
}

/**
 * Lit et contrôle le formulaire. Les champs obligatoires sont le nom,
 * l'adresse, l'organisation et son site ; la fonction et le message sont
 * facultatifs.
 * L'adresse doit être une adresse simple, celle qui pourra être posée en
 * `Reply-To` : une adresse refusée ici ne ferait que retomber, plus loin, sur
 * une réponse adressée à l'expéditeur du portail.
 */
export function lireLaDemande(formulaire: { get(nom: string): FormDataEntryValue | null }): LectureDeLaDemande {
  if (uneLigne(formulaire.get(CHAMP_PIÈGE)).length > 0) return { sorte: 'piège' }

  const valeurs: DemandeDeDémo = {
    nom: uneLigne(formulaire.get('nom')),
    email: uneLigne(formulaire.get('email')).toLowerCase(),
    organisation: uneLigne(formulaire.get('organisation')),
    site: uneLigne(formulaire.get('site')),
    fonction: uneLigne(formulaire.get('fonction')),
    message: unTexte(formulaire.get('message')),
  }

  const champs: ChampDeDémo[] = []
  if (valeurs.nom.length === 0 || valeurs.nom.length > LONGUEURS.nom) champs.push('nom')
  if (adresseDeRéponseSûre(valeurs.email) === null) champs.push('email')
  if (valeurs.organisation.length === 0 || valeurs.organisation.length > LONGUEURS.organisation) {
    champs.push('organisation')
  }
  const site = siteDeLOrganisation(valeurs.site)
  if (site === null) champs.push('site')
  if (valeurs.fonction.length > LONGUEURS.fonction) champs.push('fonction')
  if (valeurs.message.length > LONGUEURS.message) champs.push('message')

  return champs.length > 0 || site === null
    ? { sorte: 'invalide', champs, valeurs }
    : { sorte: 'valide', demande: { ...valeurs, site } }
}

/** Le courrier qui part vers l'opératrice. Répondre écrit au demandeur. */
export function composerCourrierDeDémo(demande: DemandeDeDémo, maintenant: Date = new Date()): Message {
  const lignes = [
    `Nouvelle demande de démonstration, reçue le ${dateDuJour(maintenant)} par le formulaire /demo.`,
    '',
    `Nom : ${demande.nom}`,
    `Adresse : ${demande.email}`,
    `Organisation : ${demande.organisation}`,
    `Site : ${demande.site}`,
    `Fonction : ${demande.fonction || 'non indiquée'}`,
    '',
    'Message :',
    demande.message || '(aucun message)',
    '',
    'Répondre à ce courriel écrit directement à la personne.',
  ]
  return {
    destinataire: ADRESSE_DES_DEMANDES_DE_DÉMO,
    sujet: `Demande de démo : ${demande.organisation}`,
    texte: lignes.join('\n'),
    répondreÀ: demande.email,
  }
}
