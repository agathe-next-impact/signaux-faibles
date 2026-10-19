/**
 * Le client de l'API lemlist, et le seul module qui lui parle.
 *
 * Deux gestes seulement, parce que le portail n'a que deux choses à dire à
 * lemlist sur un prospect : **arrêter la séquence** quand il ouvre son espace
 * (une relance « avez-vous vu votre lettre ? » après l'activation est une faute),
 * et **tenir à jour ses variables** (`sfStatut`), que les séquences et les
 * filtres lemlist lisent. Tout le reste, l'ajout des contacts aux campagnes et
 * le lancement, reste à la tâche de prospection, par le connecteur lemlist de
 * Cowork : le portail n'ajoute jamais personne à une campagne.
 *
 * La séquence est arrêtée en marquant le lead **intéressé dans la campagne**
 * (`POST /campaigns/{campagne}/leads/{email}/interested`, vérifié dans la
 * documentation de l'API le 19 octobre 2026) : c'est le geste que lemlist
 * reconnaît pour « ce prospect a répondu, ne plus relancer », il garde le lead
 * et son historique dans la campagne, et la route accepte l'adresse. Les
 * variables s'écrivent par l'identifiant du lead
 * (`PATCH /leads/{lead}/variables?nom=valeur`), que le webhook `emailsSent`
 * apporte ; sans lui, rien ne peut être écrit, et la synchronisation retente le
 * lendemain.
 *
 * Authentification : Basic, identifiant vide, la clé API en mot de passe. La
 * clé est lue dans `process.env` par l'appelant et passée ici : une page du
 * portail n'a pas à tomber parce que le compte lemlist n'est pas configuré.
 *
 * Aucune adresse n'est journalisée ; les erreurs ne portent qu'un code.
 */

export type ClientLemlist = {
  /** Marque le lead intéressé dans la campagne, ce qui arrête sa séquence. */
  readonly arrêterLaSéquence: (campagne: string, email: string) => Promise<RésultatLemlist>
  /** Écrit des variables personnalisées sur le lead. */
  readonly écrireVariables: (lead: string, variables: Readonly<Record<string, string>>) => Promise<RésultatLemlist>
}

export type RésultatLemlist = { readonly ok: true } | { readonly ok: false; readonly code: string }

export const BASE_API_LEMLIST = 'https://api.lemlist.com/api'

/** Le délai au-delà duquel on n'attend plus lemlist : l'appel est retenté le lendemain. */
const DÉLAI_MS = 8_000

export function clientLemlist(
  cléApi: string,
  appeler: typeof fetch = fetch,
  baseUrl: string = BASE_API_LEMLIST,
): ClientLemlist {
  const autorisation = `Basic ${Buffer.from(`:${cléApi}`).toString('base64')}`

  async function requête(méthode: 'POST' | 'PATCH', chemin: string): Promise<RésultatLemlist> {
    try {
      const réponse = await appeler(`${baseUrl}${chemin}`, {
        method: méthode,
        headers: { authorization: autorisation, accept: 'application/json' },
        signal: AbortSignal.timeout(DÉLAI_MS),
      })
      if (réponse.ok) return { ok: true }
      return { ok: false, code: `lemlist-${réponse.status}` }
    } catch {
      return { ok: false, code: 'lemlist-réseau' }
    }
  }

  return {
    arrêterLaSéquence: (campagne, email) =>
      requête('POST', `/campaigns/${encodeURIComponent(campagne)}/leads/${encodeURIComponent(email)}/interested`),
    écrireVariables: (lead, variables) => {
      const paramètres = new URLSearchParams()
      for (const [nom, valeur] of Object.entries(variables)) paramètres.set(nom, valeur)
      return requête('PATCH', `/leads/${encodeURIComponent(lead)}/variables?${paramètres.toString()}`)
    },
  }
}

/**
 * Le client configuré par l'environnement, ou `null` quand `LEMLIST_API_KEY`
 * n'est pas posée : la prospection est alors tenue dans Postgres seulement, et
 * rien ne part vers lemlist. Lu dans `process.env`, comme le secret Stripe.
 */
export function clientLemlistConfiguré(): ClientLemlist | null {
  const clé = process.env['LEMLIST_API_KEY']
  return clé ? clientLemlist(clé) : null
}
