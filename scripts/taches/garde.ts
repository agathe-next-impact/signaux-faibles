/**
 * Ce qu'une tâche planifiée a le droit de faire, écrit à un seul endroit.
 *
 * La décision est pure : un nom d'outil et son entrée donnent un refus motivé ou
 * rien. `executer.ts` la pose deux fois dans la session, par le crochet
 * `PreToolUse` (consulté avant tout appel) et par `canUseTool` (consulté pour ce
 * que les règles ne tranchent pas), comme `scripts/evaluation-agent.ts`.
 *
 * Tout ce qui n'est pas nommé ici est refusé : pas d'autre commande que la
 * lecture d'une page au navigateur, pas d'écriture hors du dossier de travail,
 * pas d'adresse du portail hors de l'outil `appeler_portail`, pas d'outil Notion
 * qui supprime, déplace ou change un schéma.
 */
import { resolve } from 'node:path'

/** Noms des serveurs MCP, tels qu'ils préfixent les outils (`mcp__<serveur>__<outil>`). */
export const SERVEURS = {
  notion: 'notion',
  // « Gmail » : les pages de tâches citent `mcp__Gmail__create_draft` et
  // `mcp__Gmail__list_drafts` ; garder ce nom évite de retoucher une page.
  gmail: 'Gmail',
  portail: 'Portail',
  veille: 'Veille',
} as const

/** Ce que les tâches lisent dans Notion. */
export const OUTILS_NOTION_LECTURE = ['notion-fetch', 'notion-search', 'notion-query-data-sources'] as const

/**
 * Ce que les tâches écrivent dans Notion : des pages (éditions, référentiels,
 * points de validation, lignes du registre et d'« Accès »), leurs propriétés et
 * leur contenu, et les vues liées de l'onboarding (§3.7). Jamais de suppression,
 * de déplacement, de duplication, de base créée ni de schéma modifié.
 */
export const OUTILS_NOTION_ÉCRITURE = ['notion-create-pages', 'notion-update-page', 'notion-create-view', 'notion-get-async-task'] as const

/** Le sous-agent qui lit les sources, sur Haiku. */
export const SOUS_AGENT_LECTEUR = 'lecteur'

/**
 * Le sous-agent qui collecte un lot de familles et écrit sa grille et ses
 * faits dans le dossier de travail, sur Sonnet (23 octobre 2026) : la collecte
 * de la première lettre Heritech, faite sur Opus, en avait coûté 34 $.
 */
export const SOUS_AGENT_COLLECTEUR = 'collecteur'

/** Les sous-agents permis ; leur modèle est fixé par leur définition. */
export const SOUS_AGENTS: readonly string[] = [SOUS_AGENT_LECTEUR, SOUS_AGENT_COLLECTEUR]

export type ContexteDeGarde = {
  /** Le dossier de travail temporaire du run : seul endroit où écrire. */
  readonly espace: string
  /** Chemin absolu de `scripts/lire-page.mjs`. */
  readonly lirePage: string
  /** L'origine du portail (`https://www.signauxfaibles.io`). */
  readonly portail: string
  /** `lecture` : la tâche « controle », qui ne touche à rien. */
  readonly mode: 'tâche' | 'lecture'
}

const échapper = (texte: string) => texte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** L'URL d'une commande `node <lire-page> <url> [caractères]`, sinon `null`. */
export function urlDeLirePage(commande: string, lirePage: string): string | null {
  const motif = new RegExp(`^\\s*node\\s+${échapper(lirePage)}\\s+(https?://[^\\s;&|<>\`$()]+)(\\s+\\d+)?\\s*$`)
  return motif.exec(commande)?.[1] ?? null
}

function estDuPortail(url: string, portail: string): boolean {
  try {
    const hôte = new URL(url).hostname
    const hôteDuPortail = new URL(portail).hostname
    return hôte === hôteDuPortail || hôte === 'signauxfaibles.io' || hôte.endsWith('.signauxfaibles.io')
  } catch {
    return false
  }
}

const MÉTHODES = new Set(['GET', 'POST', 'PATCH'])

/**
 * L'URL du portail qu'un appel vise, si le chemin est permis. Deux familles
 * seulement : `/api/veille/*` et `/api/acces/ouvrir`. Le chemin peut être donné
 * tel que la page l'écrit (adresse complète en `www.`) ou relatif.
 */
export function cheminDuPortail(méthode: string, chemin: string, portail: string): { url: URL } | { refus: string } {
  if (!MÉTHODES.has(méthode)) return { refus: `méthode ${méthode} refusée : GET, POST ou PATCH` }
  if (/%2e|%2f|%5c|\\/i.test(chemin)) return { refus: 'chemin encodé refusé' }
  let url: URL
  try {
    url = new URL(chemin, portail)
  } catch {
    return { refus: 'chemin illisible' }
  }
  if (url.origin !== new URL(portail).origin) {
    return { refus: `hôte refusé : seul ${new URL(portail).host} est appelé (l'apex redirige et perdrait l'autorisation)` }
  }
  if (url.username || url.password || url.hash) return { refus: 'chemin refusé' }
  const permis = /^\/api\/veille\/[a-z][a-z-]*$/.test(url.pathname) || url.pathname === '/api/acces/ouvrir'
  if (!permis) return { refus: `chemin ${url.pathname} hors de /api/veille/* et /api/acces/ouvrir` }
  return { url }
}

/** Le refus motivé, ou `null` si l'outil est permis avec cette entrée. */
export function décisionPour(contexte: ContexteDeGarde, outil: string, entrée: Record<string, unknown>): string | null {
  const dansLEspace = (chemin: unknown): boolean =>
    typeof chemin === 'string' && (resolve(contexte.espace, chemin) + '/').startsWith(contexte.espace + '/')

  if (outil.startsWith('mcp__')) return décisionMcp(contexte, outil, entrée)

  if (contexte.mode === 'lecture') {
    return outil === 'ToolSearch' ? null : `outil ${outil} refusé : la tâche « controle » ne lit que Notion`
  }

  switch (outil) {
    case 'ToolSearch':
    case 'WebSearch':
      return null
    case 'WebFetch': {
      const url = String(entrée['url'] ?? '')
      return estDuPortail(url, contexte.portail) ? 'le portail ne se lit que par mcp__Portail__appeler_portail' : null
    }
    case 'Bash': {
      const url = urlDeLirePage(String(entrée['command'] ?? ''), contexte.lirePage)
      if (!url) return `seule la commande « node ${contexte.lirePage} <url> [caractères] » est permise`
      return estDuPortail(url, contexte.portail) ? 'le portail ne se lit que par mcp__Portail__appeler_portail' : null
    }
    case 'Agent':
    case 'Task': {
      if (!SOUS_AGENTS.includes(String(entrée['subagent_type']))) return `seuls les sous-agents ${SOUS_AGENTS.map((a) => `« ${a} »`).join(' et ')} sont permis`
      if (entrée['model'] !== undefined) return 'le modèle d’un sous-agent est fixé par sa définition'
      return null
    }
    case 'Read':
    case 'Write':
    case 'Edit':
      return dansLEspace(entrée['file_path']) ? null : `fichier hors du dossier de travail ${contexte.espace}`
    case 'Glob':
    case 'Grep':
      return entrée['path'] === undefined || dansLEspace(entrée['path']) ? null : `recherche hors du dossier de travail ${contexte.espace}`
    default:
      return `outil ${outil} hors de la liste permise`
  }
}

function décisionMcp(contexte: ContexteDeGarde, outil: string, entrée: Record<string, unknown>): string | null {
  const [, serveur, nom] = /^mcp__([^_]+(?:_[^_]+)*)__(.+)$/.exec(outil) ?? []
  if (!serveur || !nom) return `outil ${outil} illisible`

  if (serveur === SERVEURS.notion) {
    const lecture = (OUTILS_NOTION_LECTURE as readonly string[]).includes(nom)
    const écriture = (OUTILS_NOTION_ÉCRITURE as readonly string[]).includes(nom)
    if (contexte.mode === 'lecture') return lecture ? null : `outil Notion ${nom} refusé : la tâche « controle » ne fait que lire`
    if (!lecture && !écriture) return `outil Notion ${nom} hors de la liste permise`
    if (entrée['allow_deleting_content'] === true) return 'suppression de sous-pages ou de bases refusée'
    return null
  }

  if (contexte.mode === 'lecture') return `outil ${outil} refusé : la tâche « controle » ne lit que Notion`

  // Les outils Gmail, Portail et Veille sont ceux de ce dépôt (`outils.ts`) :
  // chacun tient sa propre règle (aucun envoi à un client, chemins du portail),
  // la garde vérifie seulement qu'on reste parmi eux.
  if (serveur === SERVEURS.gmail || serveur === SERVEURS.portail || serveur === SERVEURS.veille) return null
  return `serveur MCP ${serveur} hors de la liste permise`
}
