/**
 * La sonde du serveur Notion MCP hébergé, avant toute session d'agent.
 *
 * Les six premières exécutions du workflow (23 au 25 octobre 2026) ont toutes
 * échoué au même endroit : le serveur refusait l'en-tête `Authorization` à
 * l'ouverture de la session, et le seul endroit où on le lisait était la ligne
 * « erreur rapportée » du contrôle, tronquée à 300 caractères et recopiée par
 * un modèle. Le code envoyait pourtant le jeton tel quel : la cause était la
 * nature du jeton, pas le chemin qu'il prenait.
 *
 * La sonde fait la même chose que le SDK, une requête `initialize` JSON-RPC
 * avec le jeton en `Bearer`, et lit la réponse de Notion elle-même, pour la
 * qualifier sans modèle et sans frais. Deux refus se distinguent nettement, et
 * ne se corrigent pas au même endroit :
 *
 *   - 401 `unauthorized` (`token_invalid`) : la valeur du secret n'est pas un
 *     jeton Notion (coquille, troncature au collage, jeton révoqué). Même
 *     réponse qu'avec un jeton inventé.
 *   - 403 `restricted_resource` (« This token cannot access Notion MCP. ») :
 *     Notion reconnaît le jeton, mais ce n'est pas un jeton MCP. C'est ce que
 *     rend un secret d'intégration interne (`ntn_…`, celui du portail) posé à
 *     la place d'un jeton créé par « New MCP token » dans le portail
 *     développeur, par un propriétaire de l'espace, sur le plan Business.
 *
 * Rien de ce que la sonde rend ne contient le jeton : le code, le message et le
 * `request_id` de Notion, c'est tout ce qui va dans le résumé du job.
 */

export const SERVEUR_NOTION = 'https://mcp.notion.com/mcp'
const DÉLAI_MS = 10_000

export type SondeNotion =
  | { readonly ok: true; readonly détail: string }
  | {
      readonly ok: false
      readonly statut: number | null
      readonly code: string | null
      readonly message: string | null
      readonly requestId: string | null
      readonly remède: string
    }

type ErreurNotion = {
  object?: unknown
  status?: unknown
  code?: unknown
  message?: unknown
  request_id?: unknown
  additional_data?: { reason?: unknown }
}

const REMÈDES = {
  invalide:
    'la valeur du secret NOTION_MCP_TOKEN n’est pas un jeton Notion valide (coquille, troncature au collage, ou jeton révoqué) : la recopier depuis le portail développeur de Notion',
  restreint:
    'Notion reconnaît le jeton mais il n’ouvre pas le serveur MCP : ce n’est pas un jeton MCP. Un secret d’intégration interne (ntn_…, celui du portail) ne convient pas ; un propriétaire de l’espace crée un jeton « New MCP token » dans le portail développeur (plan Business ou Enterprise) et le pose dans le secret NOTION_MCP_TOKEN',
  sansJeton: 'aucun jeton n’a été transmis au serveur',
} as const

function lireLErreur(corps: string): ErreurNotion | null {
  try {
    const e = JSON.parse(corps) as ErreurNotion
    return e && typeof e === 'object' ? e : null
  } catch {
    return null
  }
}

const chaîne = (v: unknown): string | null => (typeof v === 'string' && v ? v : null)

/** Qualifie un refus du serveur à partir de son statut et de son corps, sans rien recopier d'autre. */
export function lireLeRefusDeNotion(statut: number, corps: string): Extract<SondeNotion, { ok: false }> {
  const e = lireLErreur(corps)
  const code = chaîne(e?.code)
  const message = chaîne(e?.message)
  const requestId = chaîne(e?.request_id)
  const raison = chaîne(e?.additional_data?.reason)
  let remède: string
  if (statut === 401 && !e) remède = REMÈDES.sansJeton
  else if (statut === 401 || raison === 'token_invalid') remède = REMÈDES.invalide
  else if (statut === 403 && code === 'restricted_resource') remède = REMÈDES.restreint
  else remède = `refus ${statut}${code ? ` ${code}` : ''} non qualifié : voir le message de Notion`
  return { ok: false, statut, code, message, requestId, remède }
}

/** Le nom et la version du serveur dans une réponse `initialize`, en JSON ou en flux d'événements. */
function lireLeServeur(corps: string): string | null {
  const candidats = corps.includes('data:')
    ? corps
        .split('\n')
        .filter((l) => l.startsWith('data:'))
        .map((l) => l.slice(5).trim())
    : [corps]
  for (const c of candidats) {
    try {
      const r = JSON.parse(c) as { result?: { serverInfo?: { name?: unknown; version?: unknown }; protocolVersion?: unknown } }
      const info = r.result?.serverInfo
      if (info && typeof info.name === 'string') return `${info.name}${typeof info.version === 'string' ? ` ${info.version}` : ''}`
      if (typeof r.result?.protocolVersion === 'string') return `protocole ${r.result.protocolVersion}`
    } catch {
      // pas du JSON : on passe au suivant
    }
  }
  return null
}

/** Une ligne lisible pour le résumé du job, sans secret. */
export function décrireLaSonde(sonde: SondeNotion): string {
  if (sonde.ok) return sonde.détail
  const notion = [sonde.statut !== null ? `HTTP ${sonde.statut}` : null, sonde.code, sonde.message ? `« ${sonde.message} »` : null].filter(Boolean).join(' ')
  return `${notion ? `${notion} ; ` : ''}${sonde.remède}${sonde.requestId ? ` (request_id ${sonde.requestId})` : ''}`
}

/**
 * Ouvre une session MCP avec le jeton, comme le SDK le fera, et la laisse là :
 * le serveur répond au premier message, c'est tout ce qu'on veut savoir.
 */
export async function sonderLeServeurNotion(jeton: string, f: typeof fetch = fetch): Promise<SondeNotion> {
  let réponse: Response
  try {
    réponse = await f(SERVEUR_NOTION, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${jeton}`,
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'signauxfaibles-taches', version: '1' } },
      }),
      signal: AbortSignal.timeout(DÉLAI_MS),
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return { ok: false, statut: null, code: null, message, requestId: null, remède: 'le serveur n’a pas répondu (réseau ou délai de dix secondes dépassé)' }
  }
  const corps = await réponse.text().catch(() => '')
  if (!réponse.ok) return lireLeRefusDeNotion(réponse.status, corps)
  const serveur = lireLeServeur(corps)
  return { ok: true, détail: serveur ? `session ouverte, serveur ${serveur}` : `session ouverte (statut ${réponse.status})` }
}
