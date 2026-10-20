import { timingSafeEqual } from 'node:crypto'

/**
 * Lecture d'une livraison de webhook lemlist.
 *
 * Même forme que les webhooks Notion et Stripe : toute la décision est ici, en
 * fonction pure d'entrées explicites, et le route handler ne fait que les
 * entrées-sorties.
 *
 * **Ce qui authentifie la livraison.** lemlist ne signe pas ses webhooks ; il
 * renvoie dans chaque corps le `secret` posé à la création du webhook
 * (documentation de l'API, `POST /hooks`, vérifiée le 19 octobre 2026). Le
 * portail compare ce champ à `LEMLIST_WEBHOOK_SECRET`, en temps constant. Sans
 * secret configuré, toute livraison est refusée : une route ouverte accepterait
 * de n'importe qui des « désinscriptions » ou des « clics » inventés.
 *
 * Les champs lus sont ceux que lemlist documente pour un événement de campagne :
 * `_id` (activité, `act_…`), `type`, `createdAt`, `campaignId`, `leadId`,
 * `contactId`, `leadEmail`, `sequenceStep`. Une réponse venue d'un tiers
 * (`isThirdPartyReply`) n'a ni campagne ni lead : elle est sans effet.
 */

export type ÉvénementLemlist = {
  readonly activité: string
  readonly type: TypeSuivi
  readonly survenuLe: Date
  readonly campagne: string | null
  readonly lead: string | null
  readonly contact: string | null
  readonly email: string
  readonly étape: number | null
}

export type DécisionLemlist =
  | { readonly sorte: 'événement'; readonly événement: ÉvénementLemlist }
  /** Authentique, mais sans rapport avec la prospection : accuser réception. */
  | { readonly sorte: 'sans-effet'; readonly type: string }
  /** Authentique, mais inexploitable (champ absent) : accuser réception et le dire. */
  | { readonly sorte: 'inexploitable'; readonly type: string; readonly raison: string }
  /** À refuser : secret absent, faux, ou non configuré. */
  | { readonly sorte: 'refusée'; readonly raison: string }

/** Les événements que le journal de prospection retient. */
export const TYPES_SUIVIS = [
  'emailsSent',
  'emailsOpened',
  'emailsClicked',
  'emailsReplied',
  'emailsBounced',
  'emailsInterested',
  'emailsNotInterested',
  'emailsUnsubscribed',
  // Depuis le 30 mars 2026, une désinscription de contact n'émet plus
  // `emailsUnsubscribed` : `entityUnsubscribed` pour le contact entier,
  // `variableUnsubscribed` pour une seule de ses adresses (aide lemlist,
  // « Migrate from the legacy unsubscribe endpoints », phase 3).
  'entityUnsubscribed',
  'variableUnsubscribed',
] as const
export type TypeSuivi = (typeof TYPES_SUIVIS)[number]

const SUIVIS = new Set<string>(TYPES_SUIVIS)

function secretsÉgaux(reçu: string, attendu: string): boolean {
  const a = Buffer.from(reçu)
  const b = Buffer.from(attendu)
  return a.length === b.length && timingSafeEqual(a, b)
}

function chaîne(valeur: unknown): string | null {
  return typeof valeur === 'string' && valeur.length > 0 ? valeur : null
}

export function interpréterLivraisonLemlist(livraison: {
  readonly corps: unknown
  readonly secret: string | undefined
}): DécisionLemlist {
  if (!livraison.secret) return { sorte: 'refusée', raison: 'LEMLIST_WEBHOOK_SECRET absent' }
  if (typeof livraison.corps !== 'object' || livraison.corps === null) {
    return { sorte: 'refusée', raison: 'corps absent ou non objet' }
  }
  const corps = livraison.corps as Record<string, unknown>
  const reçu = chaîne(corps['secret'])
  if (!reçu || !secretsÉgaux(reçu, livraison.secret)) return { sorte: 'refusée', raison: 'secret absent ou différent' }

  const type = chaîne(corps['type']) ?? 'inconnu'
  if (!SUIVIS.has(type)) return { sorte: 'sans-effet', type }
  if (corps['isThirdPartyReply'] === true) return { sorte: 'sans-effet', type }

  const activité = chaîne(corps['_id'])
  if (!activité) return { sorte: 'inexploitable', type, raison: '_id absent' }
  const email = chaîne(corps['leadEmail']) ?? chaîne(corps['email'])
  if (!email || !email.includes('@')) return { sorte: 'inexploitable', type, raison: 'adresse du lead absente' }
  const créé = chaîne(corps['createdAt'])
  const survenuLe = créé ? new Date(créé) : new Date()
  const étapeBrute = corps['sequenceStep']
  const étape = typeof étapeBrute === 'number' && Number.isInteger(étapeBrute) ? étapeBrute : null

  return {
    sorte: 'événement',
    événement: {
      activité,
      type: type as TypeSuivi,
      survenuLe: Number.isNaN(survenuLe.getTime()) ? new Date() : survenuLe,
      campagne: chaîne(corps['campaignId']),
      lead: chaîne(corps['leadId']),
      contact: chaîne(corps['contactId']),
      email,
      étape,
    },
  }
}
