/**
 * Une tâche planifiée du dispositif, exécutée sur l'API Claude.
 *
 *   pnpm tache <lettres|reconciliation|revue|balayage|premiere-lettre> [--organisation <slug>]
 *   pnpm tache controle
 *
 * Le prompt est le pointeur de la tâche en service (`pointeurs.ts`) : il dit
 * d'ouvrir une page Notion, et c'est la page qui fait foi. Ce fichier n'ajoute
 * aucune règle métier ; ses consignes de harnais disent la date de Paris, la
 * délégation de la lecture des sources au sous-agent `lecteur` (Haiku) et de la
 * collecte par familles au sous-agent `collecteur` (Sonnet), les outils
 * disponibles, la manière d'économiser le contexte, et l'interdiction d'écrire
 * un secret.
 *
 * Ce que la session peut faire est tenu par `garde.ts` ; Gmail, le portail et
 * l'identifiant d'accès sont les outils de `outils.ts` ; Notion est le serveur
 * MCP hébergé (`https://mcp.notion.com/mcp`), authentifié par `NOTION_MCP_TOKEN`.
 *
 * Authentification par `ANTHROPIC_API_KEY` seule : le script s'arrête si la
 * session annonce une autre source. Les autres secrets ne sont pas transmis à
 * la session enfant ; ils restent dans ce processus, et tout ce qui est écrit
 * sur disque (transcription, journal, mesure, compte rendu) est passé au masque.
 *
 * Variables lues (et elles seules : pas `env()` du portail, pour ne pas exiger
 * les secrets Stripe ou Postgres) : ANTHROPIC_API_KEY, NOTION_MCP_TOKEN,
 * ACTIVATION_SECRET, GOOGLE_COMPTE_SERVICE_JSON, GMAIL_BOITE_OPERATRICE,
 * PORTAIL_URL, GMAIL_NOM_EXPEDITEUR, TACHES_SORTIES, GITHUB_STEP_SUMMARY.
 */
import { query, type AgentDefinition, type CanUseTool, type McpServerConfig, type Options, type SDKMessage } from '@anthropic-ai/claude-agent-sdk'
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { lireCompteDeServiceJSON } from '@/lib/email/gmail'
import { contrôler } from './controle'
import { décisionPour, dossierDesRéponsesPersistées, nomDOutilNotion, SERVEURS, SOUS_AGENT_COLLECTEUR, SOUS_AGENT_LECTEUR, type ContexteDeGarde } from './garde'
import { lireLaMesure, résuméDeLaMesure, type RésultatBrut } from './mesure'
import { décrireLaSonde, SERVEUR_NOTION, sonderLeServeurNotion } from './notion-mcp'
import { masquer, serveursDesOutils, type CompteGoogle, type ConfigurationDesOutils } from './outils'
import { promptDeLaTâche, slugValide, TÂCHES, type Tâche } from './pointeurs'

export const RACINE = resolve(fileURLToPath(new URL('../..', import.meta.url)))
export const LIRE_PAGE = join(RACINE, 'scripts', 'lire-page.mjs')
export { SERVEUR_NOTION }

/** Modèle et plafond de chaque tâche (décisions du 23 octobre 2026). */
export const PARAMÈTRES: Readonly<Record<Tâche, { readonly modèle: string; readonly plafondUsd: number }>> = {
  lettres: { modèle: 'claude-opus-5-5', plafondUsd: 60 },
  'premiere-lettre': { modèle: 'claude-opus-5-5', plafondUsd: 40 },
  balayage: { modèle: 'claude-opus-5-5', plafondUsd: 30 },
  revue: { modèle: 'claude-opus-5-5', plafondUsd: 10 },
  reconciliation: { modèle: 'claude-sonnet-5-5', plafondUsd: 5 },
}
const EFFORT = 'high'
const MODÈLE_LECTEUR = 'claude-haiku-5-5'
const MODÈLE_COLLECTEUR = 'claude-sonnet-5-5'

// ── Variables ────────────────────────────────────────────────────────────────

/** Une variable posée vide vaut une variable absente, comme `facultative` dans `lib/env.ts`. */
export function variable(nom: string): string | null {
  const valeur = process.env[nom]
  return valeur && valeur.trim() ? valeur.trim() : null
}

export type Secrets = {
  readonly cléApi: string | null
  readonly jetonNotion: string | null
  readonly jetonPortail: string | null
  readonly compteGoogle: CompteGoogle | null
  readonly erreurCompteGoogle: string | null
  readonly brutCompteGoogle: string | null
}

export function lireLesSecrets(): Secrets {
  const brutCompteGoogle = variable('GOOGLE_COMPTE_SERVICE_JSON')
  let compteGoogle: CompteGoogle | null = null
  let erreurCompteGoogle: string | null = null
  if (brutCompteGoogle) {
    try {
      compteGoogle = lireCompteDeServiceJSON(brutCompteGoogle)
    } catch (e) {
      erreurCompteGoogle = e instanceof Error ? e.message : String(e)
    }
  }
  return {
    cléApi: variable('ANTHROPIC_API_KEY'),
    jetonNotion: variable('NOTION_MCP_TOKEN'),
    jetonPortail: variable('ACTIVATION_SECRET'),
    compteGoogle,
    erreurCompteGoogle,
    brutCompteGoogle,
  }
}

/** Toutes les valeurs à ne jamais laisser sur disque. */
export function valeursSecrètes(secrets: Secrets): string[] {
  return [secrets.cléApi, secrets.jetonNotion, secrets.jetonPortail, secrets.brutCompteGoogle, secrets.compteGoogle?.clePrivée].filter(
    (v): v is string => Boolean(v),
  )
}

// ── Sorties ──────────────────────────────────────────────────────────────────

export type Sorties = {
  readonly dossier: string
  readonly espace: string
  readonly journal: (ligne: string) => void
  readonly écrire: (nom: string, contenu: string) => void
  readonly transcrire: (message: SDKMessage) => void
  readonly clore: () => void
}

export function ouvrirLesSorties(nom: string, secrets: readonly string[]): Sorties {
  const racine = variable('TACHES_SORTIES') ?? join(RACINE, 'sorties-taches')
  const horodatage = new Date().toISOString().replace(/[:.]/g, '-')
  const dossier = join(racine, `${nom}-${horodatage}`)
  const espace = join(dossier, 'espace')
  mkdirSync(espace, { recursive: true })
  const lignes: string[] = []
  const transcription: string[] = []
  const écrire = (fichier: string, contenu: string) => writeFileSync(join(dossier, fichier), masquer(contenu, secrets))
  return {
    dossier,
    espace,
    journal: (ligne) => {
      lignes.push(`${new Date().toISOString()} ${ligne}`)
      écrire('journal.txt', lignes.join('\n') + '\n')
    },
    écrire,
    transcrire: (message) => {
      transcription.push(JSON.stringify(message))
      if (transcription.length % 20 === 0) écrire('transcription.jsonl', transcription.join('\n') + '\n')
    },
    clore: () => écrire('transcription.jsonl', transcription.join('\n') + '\n'),
  }
}

export function écrireLeRésuméDuJob(markdown: string, secrets: readonly string[]): void {
  const fichier = variable('GITHUB_STEP_SUMMARY')
  if (fichier) appendFileSync(fichier, masquer(markdown, secrets) + '\n')
  else console.log(masquer(markdown, secrets))
}

// ── Session ──────────────────────────────────────────────────────────────────

/** L'environnement de la session enfant : sans aucun secret, sauf la clé API qui l'authentifie. */
/**
 * Le plafond, en jetons, d'une réponse d'outil MCP rendue telle quelle à l'agent.
 *
 * Au-delà du plafond par défaut, l'outil échoue (« exceeds maximum allowed
 * tokens ») : la page de la tâche Lettres (64 571 caractères) et la vue
 * « Veilles actives » (67 126) ont échoué ainsi au contrôle du 25 octobre 2026.
 * 80 000 jetons couvrent les plus longues avec de la marge. Au-delà d'une
 * cinquantaine de kilo-octets, le CLI range ensuite la réponse dans un fichier,
 * que la garde laisse relire (`dossierDesRéponsesPersistées`).
 */
export const PLAFOND_SORTIE_MCP = 80_000

export function environnementDeLaSession(cléApi: string): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = {}
  const exclus =
    /^(CLAUDE|CCR_|ANTHROPIC_|AI_AGENT|SESSION_INGRESS|CLOUDSDK_AUTH|GH_TOKEN|GITHUB_TOKEN|ACTIONS_|AWS_ACCESS|AWS_SECRET|NOTION|ACTIVATION_SECRET|CRON_SECRET|GOOGLE_|GMAIL_|EVALUATION_API_KEY|STRIPE|DATABASE_URL|LEMLIST)/
  for (const [clé, valeur] of Object.entries(process.env)) if (!exclus.test(clé)) env[clé] = valeur
  env['ANTHROPIC_API_KEY'] = cléApi
  env['MAX_MCP_OUTPUT_TOKENS'] = String(PLAFOND_SORTIE_MCP)
  return env
}

function garde(contexte: ContexteDeGarde, journal: (ligne: string) => void): { canUseTool: CanUseTool; hooks: NonNullable<Options['hooks']> } {
  const canUseTool: CanUseTool = async (outil, entrée) => {
    const refus = décisionPour(contexte, outil, entrée)
    if (refus) journal(`refus ${outil} : ${refus}`)
    return refus ? { behavior: 'deny', message: refus } : { behavior: 'allow' }
  }
  const hooks: NonNullable<Options['hooks']> = {
    PreToolUse: [
      {
        hooks: [
          async (input) => {
            if (input.hook_event_name !== 'PreToolUse') return {}
            const refus = décisionPour(contexte, input.tool_name, (input.tool_input ?? {}) as Record<string, unknown>)
            if (refus) journal(`refus ${input.tool_name} : ${refus}`)
            return {
              hookSpecificOutput: {
                hookEventName: 'PreToolUse',
                permissionDecision: refus ? 'deny' : 'allow',
                ...(refus ? { permissionDecisionReason: refus } : {}),
              },
            }
          },
        ],
      },
    ],
  }
  return { canUseTool, hooks }
}

/** Le dossier où le CLI de la session range ses réponses d'outil trop longues (`garde.ts`). */
export function réponsesPersistéesDe(espace: string): string {
  return dossierDesRéponsesPersistées(espace, join(homedir(), '.claude'))
}

export function optionsDeGarde(contexte: ContexteDeGarde, journal: (ligne: string) => void): Pick<Options, 'canUseTool' | 'hooks' | 'permissionMode' | 'settingSources'> {
  const g = garde(contexte, journal)
  // Pas d'`allowedTools` : une entrée nue y approuverait l'outil avant la garde.
  return { canUseTool: g.canUseTool, hooks: g.hooks, permissionMode: 'default', settingSources: [] }
}

export function serveurNotion(jeton: string): McpServerConfig {
  return { type: 'http', url: SERVEUR_NOTION, headers: { Authorization: `Bearer ${jeton}` } }
}

export type IssueDeSession = {
  readonly init: { readonly outils: readonly string[]; readonly serveurs: readonly { name: string; status: string }[] } | null
  readonly résultat: (RésultatBrut & { result?: string }) | null
  readonly pagesNotionCréées: number
}

/** Déroule une session et rend son message `result` ; s'arrête si l'authentification n'est pas la clé API. */
export async function déroulerLaSession(prompt: string, options: Options, sorties: Sorties): Promise<IssueDeSession> {
  let init: IssueDeSession['init'] = null
  let résultat: IssueDeSession['résultat'] = null
  let pagesNotionCréées = 0
  const créationsEnAttente = new Map<string, number>()
  const q = query({ prompt, options })
  try {
    for await (const message of q) {
      sorties.transcrire(message)
      if (message.type === 'system' && message.subtype === 'init') {
        init = { outils: message.tools, serveurs: message.mcp_servers.map((s) => ({ name: s.name, status: s.status })) }
        sorties.journal(`session ${message.model}, serveurs MCP : ${init.serveurs.map((s) => `${s.name}=${s.status}`).join(', ')}`)
        if (message.apiKeySource !== 'ANTHROPIC_API_KEY') {
          q.interrupt().catch(() => {})
          throw new Error(`la session n'est pas authentifiée par ANTHROPIC_API_KEY (source : ${message.apiKeySource}) ; arrêt avant tout appel`)
        }
        continue
      }
      if (message.type === 'assistant') {
        for (const bloc of message.message.content) {
          if (bloc.type !== 'tool_use') continue
          sorties.journal(`outil ${bloc.name}`)
          if (bloc.name.startsWith(`mcp__${SERVEURS.notion}__`) && nomDOutilNotion(bloc.name.slice(`mcp__${SERVEURS.notion}__`.length)) === 'create-pages') {
            const pages = (bloc.input as { pages?: unknown[] } | undefined)?.pages
            créationsEnAttente.set(bloc.id, Array.isArray(pages) ? pages.length : 1)
          }
        }
        continue
      }
      if (message.type === 'user' && Array.isArray(message.message.content)) {
        for (const bloc of message.message.content) {
          if (typeof bloc !== 'object' || bloc === null || (bloc as { type?: string }).type !== 'tool_result') continue
          const r = bloc as { tool_use_id: string; is_error?: boolean }
          const n = créationsEnAttente.get(r.tool_use_id)
          if (n === undefined) continue
          créationsEnAttente.delete(r.tool_use_id)
          if (!r.is_error) pagesNotionCréées += n
        }
        continue
      }
      if (message.type === 'result') {
        résultat = message as unknown as RésultatBrut & { result?: string }
        sorties.journal(`fin : ${message.subtype}, ${message.num_turns} tours, ${message.total_cost_usd.toFixed(2)} $`)
      }
    }
  } finally {
    sorties.clore()
  }
  return { init, résultat, pagesNotionCréées }
}

// ── Une tâche ────────────────────────────────────────────────────────────────

const PARIS = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'full', timeStyle: 'short' })

/** Les consignes du harnais : l'environnement d'exécution, jamais une règle métier. */
export function consignesDuHarnais(maintenant: Date, portail: string): string {
  return [
    '# Environnement d’exécution (harnais)',
    '',
    `Nous sommes le ${PARIS.format(maintenant)}, heure de Paris. Travaille à cette date.`,
    '',
    'EXÉCUTEUR : API. Pour les onboardings, la page « Tâche — Onboarding d’une organisation » partage les lignes du registre entre Cowork et l’API par la propriété « Exécuteur » (règle « PARTAGE DES ONBOARDINGS ») : tu es l’exécuteur API.',
    '',
    'Tu tournes sur l’API Claude, lancé par GitHub Actions, sans personne pour te répondre. Ces consignes décrivent tes outils ; elles ne changent aucune règle des pages Notion, qui font foi.',
    '',
    `LECTURE DES SOURCES. Tu ne lis pas toi-même les pages des sources : confie-les au sous-agent « ${SOUS_AGENT_LECTEUR} » (outil Agent, subagent_type « ${SOUS_AGENT_LECTEUR} »), par lots de 1 à 10 URL, avec la question de l’axe et la période. Il rend, pour chaque URL, l’état de la page, son titre, sa date, les passages utiles recopiés mot pour mot, et à défaut la date la plus récente visible. Tu ne rouvres une page toi-même (WebFetch) que pour vérifier une citation que tu vas écrire. La recherche web (WebSearch) reste à toi.`,
    '',
    'OUTILS.',
    `· Notion : les outils du serveur « ${SERVEURS.notion} » (lire, chercher, interroger une base ou une vue, créer et modifier des pages, créer une vue liée). Supprimer, déplacer ou changer un schéma est refusé. Ils s’appellent mcp__${SERVEURS.notion}__fetch, search, query-data-sources, create-pages, update-page, create-view et get-async-task : une page qui écrit notion-fetch ou notion-create-pages désigne le même outil. La recherche IA (ai-search) n’est pas permise.`,
    `· Portail : mcp__${SERVEURS.portail}__appeler_portail(methode, chemin, corps), pour ${portail}/api/veille/* et /api/acces/ouvrir. Passe l’adresse telle que la page l’écrit ; l’outil ajoute lui-même l’autorisation, n’en écris aucune.`,
    `· Gmail : mcp__${SERVEURS.gmail}__create_draft (to, subject, body, htmlBody), mcp__${SERVEURS.gmail}__list_drafts, mcp__${SERVEURS.gmail}__send_message (à agathe@signauxfaibles.io seulement : tout autre destinataire est refusé) et mcp__${SERVEURS.gmail}__list_sent_messages (messages envoyés depuis une date, en-têtes seulement : pas de recherche par requête, pas de corps lisible ; filtre toi-même par destinataire et par objet).`,
    `· Courriels client : mcp__${SERVEURS.gmail}__deposer_courriel(demande, to). Il fait la mise en forme par POST /api/veille/courriel (la demande telle que la page l’écrit) ET dépose le brouillon : quand une page te dit de passer « html » et « texte » de la réponse dans create_draft, fais-le par cet outil, qui ne te rend pas le HTML. N’utilise create_draft avec htmlBody que si deposer_courriel échoue.`,
    `· Identifiant d’accès : mcp__${SERVEURS.veille}__tirer_identifiant.`,
    `· Sources en code : mcp__${SERVEURS.veille}__lire_sources(lot, urls) lit jusqu’à 30 URL en quatre minutes, écrit chaque page dans sources/<lot>/ et rend l’index du lot, une ligne de grille par source. mcp__${SERVEURS.veille}__synthese_de_collecte(dossier) condense les grilles et les faits d’un dossier de collecte en une synthèse par lettre.`,
    `· Navigateur : node ${LIRE_PAGE} <url> [caractères], seule commande Bash permise. Toute autre commande est refusée : si une page prescrit une commande Bash en repli, constate le refus et passe au repli suivant.`,
    '· Les documents de projet claude.ai (project_read, project_write) n’existent pas dans cet environnement : dis-le là où une page les demande.',
    '',
    `COLLECTE D’UNE PREMIÈRE LETTRE. Quand une page te demande de confier la collecte à des agents, famille par famille, confie chaque lot au sous-agent « ${SOUS_AGENT_COLLECTEUR} » (outil Agent, subagent_type « ${SOUS_AGENT_COLLECTEUR} ») : le référentiel et ses familles, la fenêtre, et le dossier où écrire (collecte/ du dossier de travail ; il y écrit grille/<lot>.md et faits/<lot>.md). Lance les lots en parallèle. Puis appelle synthese_de_collecte sur ce dossier : tu ne rédiges pas tant qu’une ligne est vide.`,
    '',
    'ÉCONOMIE DU CONTEXTE. Chaque appel relit tout ton contexte : ce que tu y fais entrer se paie à chaque tour suivant.',
    '· Rédige une lettre à la fois, depuis sa seule synthèse (synthese-<veille>.md), sans relire les grilles ni les faits de l’autre lettre.',
    '· Écris le corps une seule fois, dans un fichier du dossier de travail, puis publie-le ; corrige par remplacements ciblés, jamais en réécrivant la page entière.',
    '· Ne relis pas une page Notion déjà lue dans ce run.',
    '· Aucun appel d’outil ne doit durer plus de quatre minutes : au-delà, ton cache expire et tout ton contexte est réécrit. Découpe un lot de sources trop long.',
    '',
    'SECRETS. N’écris jamais un jeton, une clé ou un mot de passe dans un texte, une page, un courriel ou un fichier, même pour diagnostiquer une erreur.',
  ].join('\n')
}

export const PROMPT_DU_LECTEUR = [
  'Tu lis des pages web pour un agent de veille. Tu reçois de 1 à 10 URL et la question d’un axe, avec la période. Tu ne rédiges rien d’autre que le relevé ci-dessous, en français, 1 500 mots au plus pour tout le lot.',
  '',
  'Pour chaque URL, dans l’ordre reçu :',
  '1. L’état de la page : ouverte, refusée, vide ou introuvable, avec le code HTTP quand tu l’as.',
  '2. Le titre, et la date de publication ou de mise à jour telle qu’elle est écrite sur la page.',
  '3. Les passages utiles à la question, RECOPIÉS MOT POUR MOT entre guillemets, chiffres, unités et dates compris. Ne reformule pas, ne résume pas un chiffre, ne déduis rien.',
  '4. Si rien n’est daté dans la période : la date la plus récente visible sur la page, recopiée telle quelle, et où elle figure. N’écris jamais « rien depuis le… » sans cette date relevée.',
  '',
  `Ouvre d’abord avec WebFetch. Si la page est refusée aux robots (403, 503, page vide ou rendue en JavaScript), ouvre-la au navigateur : node ${LIRE_PAGE} <url>. Aucune autre commande n’est permise. Une page que tu n’as pas pu ouvrir est dite non ouverte, avec la raison ; jamais muette.`,
].join('\n')

export const PROMPT_DU_COLLECTEUR = [
  'Tu collectes, pour un agent de veille, un lot de familles d’un référentiel. Tu écris en français, sans tiret cadratin. Tu ne rédiges pas la lettre : tu rends des lignes de grille et des faits sourcés.',
  '',
  'ORDRE.',
  `1. Lis le référentiel qu’on te nomme (mcp__${SERVEURS.notion}__fetch) et n’en garde que ton lot : sources nommées, requêtes types, entités du corpus, dossiers, échéances.`,
  `2. Ouvre d’abord toutes les sources nommées du lot en code : mcp__${SERVEURS.veille}__lire_sources(lot, urls), 30 URL au plus par appel. Ses lignes OUVERTE et NON OUVERTE vont telles quelles dans ta grille ; relance dans un second appel les lignes À RELANCER. Lis avec Read les seuls fichiers dont tu as besoin.`,
  `3. Lance chaque requête type, une par une (WebSearch), et requête chaque entité du corpus une par une. N’ouvre un résultat (WebFetch, ou node ${LIRE_PAGE} <url> s’il refuse les robots) que s’il peut porter un fait.`,
  '4. Requestionne chaque dossier ouvert à sa source primaire (registre public pour une procédure collective).',
  '5. Fenêtre : celle qu’on te donne. Une famille sans fait daté dans la fenêtre est élargie à 30 jours, puis 90 ; un fait antérieur entre comme « élément de contexte, non nouveau », daté, et l’élargissement est noté.',
  '',
  'RÈGLES. Une page non ouverte n’est jamais un RAS : NON OUVERTE et la raison. Un fait n’entre que si sa source a été ouverte pendant ce run, extrait recopié mot pour mot. Un RAS porte la date de la dernière publication trouvée. Tu n’écris jamais dans Notion ni dans Gmail.',
  '',
  'CE QUE TU ÉCRIS, dans le dossier qu’on te donne :',
  '· grille/<lot>.md : une table « | Référentiel | Section et famille | Élément | État | Détail | », une ligne par source nommée, requête, entité, dossier et échéance, état OUVERTE, REQUÊTÉE, FOURNIE ou NON OUVERTE, aucune ligne vide ; puis un titre « ## Élargissements ».',
  '· faits/<lot>.md : un bloc par fait, « ### titre » puis les lignes « - Référentiel : », « - Famille : », « - Date du fait : », « - Nouveau ou contexte : », « - Source : », « - Extrait : », « - Ce qui s’est passé : », « - Impact proposé : » (FORT, MOYEN ou RAS, avec le critère cité), « - Pour le client : », « - Acteurs nommés : ». Un RAS motivé est un bloc « ### RAS motivé : … ».',
  '',
  'Rends un rapport de 15 lignes au plus : comptes par état, faits nouveaux et de contexte par famille, élargissements, sources non ouvertes, échecs. Ne recopie pas les faits : ils sont dans le fichier.',
].join('\n')

export function définitionDuCollecteur(): AgentDefinition {
  return {
    description: 'Collecte un lot de familles d’un référentiel et écrit sa grille et ses faits sourcés dans le dossier de travail.',
    prompt: PROMPT_DU_COLLECTEUR,
    // Les deux noms de la lecture Notion : `fetch` avec un jeton MCP, `notion-fetch` en OAuth.
    tools: ['WebSearch', 'WebFetch', 'Bash', 'Read', 'Write', `mcp__${SERVEURS.notion}__fetch`, `mcp__${SERVEURS.notion}__notion-fetch`, `mcp__${SERVEURS.veille}__lire_sources`],
    model: MODÈLE_COLLECTEUR,
  }
}

export function définitionDuLecteur(): AgentDefinition {
  return {
    description: 'Lit un lot de 1 à 10 pages web et rend, pour chacune, son état, sa date et les passages utiles recopiés mot pour mot.',
    prompt: PROMPT_DU_LECTEUR,
    tools: ['WebFetch', 'Bash'],
    model: MODÈLE_LECTEUR,
  }
}

async function exécuterUneTâche(tâche: Tâche, organisation: string | null): Promise<number> {
  const secrets = lireLesSecrets()
  const masques = valeursSecrètes(secrets)
  const portail = variable('PORTAIL_URL') ?? 'https://www.signauxfaibles.io'
  const boîte = variable('GMAIL_BOITE_OPERATRICE')
  if (!secrets.cléApi) throw new Error('ANTHROPIC_API_KEY absente')
  if (!secrets.jetonNotion) throw new Error('NOTION_MCP_TOKEN absent : les pages de tâches sont illisibles')

  const sorties = ouvrirLesSorties(organisation ? `${tâche}-${organisation}` : tâche, masques)
  const relevé = { organisations: new Set<string>(organisation ? [organisation] : []) }

  // Le serveur Notion est sondé avant d'ouvrir la session : un jeton refusé
  // laisserait l'agent sans ses pages, et le dirait à travers un modèle, après
  // coup. Ici le refus est nommé tout de suite, et rien n'est facturé.
  const sonde = await sonderLeServeurNotion(secrets.jetonNotion)
  sorties.journal(`serveur Notion MCP : ${décrireLaSonde(sonde)}`)
  if (!sonde.ok) {
    const échec = `le serveur Notion MCP refuse le jeton : ${décrireLaSonde(sonde)}`
    sorties.écrire('mesure.json', JSON.stringify(lireLaMesure({ subtype: 'erreur' }, { tâche, organisation, date: new Date(), plafondUsd: PARAMÈTRES[tâche].plafondUsd, organisationsTraitées: relevé.organisations, pagesNotionCréées: 0 }), null, 2) + '\n')
    sorties.clore()
    écrireLeRésuméDuJob(`## ${tâche} : non lancée\n\n**Échec** : ${échec}\n`, masques)
    return 1
  }

  if (!secrets.jetonPortail) sorties.journal('ACTIVATION_SECRET absent : le portail répondra par un refus')
  if (!secrets.compteGoogle || !boîte) sorties.journal(`Gmail indisponible : ${secrets.erreurCompteGoogle ?? 'GOOGLE_COMPTE_SERVICE_JSON ou GMAIL_BOITE_OPERATRICE absent'}`)

  const configuration: ConfigurationDesOutils = {
    portail,
    jetonPortail: secrets.jetonPortail,
    compteGoogle: secrets.compteGoogle,
    boîte,
    nomExpéditeur: variable('GMAIL_NOM_EXPEDITEUR') ?? 'Signaux faibles',
    journal: sorties.journal,
    relevé,
    espace: sorties.espace,
  }
  const contexte: ContexteDeGarde = { espace: sorties.espace, lirePage: LIRE_PAGE, portail, mode: 'tâche', réponsesPersistées: réponsesPersistéesDe(sorties.espace) }
  const { modèle, plafondUsd } = PARAMÈTRES[tâche]
  const maintenant = new Date()
  const prompt = promptDeLaTâche(tâche, organisation)
  sorties.écrire('prompt.txt', prompt)

  const options: Options = {
    cwd: sorties.espace,
    model: modèle,
    effort: EFFORT,
    systemPrompt: { type: 'preset', preset: 'claude_code', append: consignesDuHarnais(maintenant, portail) },
    tools: ['Agent', 'WebSearch', 'WebFetch', 'Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'ToolSearch'],
    agents: { [SOUS_AGENT_LECTEUR]: définitionDuLecteur(), [SOUS_AGENT_COLLECTEUR]: définitionDuCollecteur() },
    mcpServers: { [SERVEURS.notion]: serveurNotion(secrets.jetonNotion), ...serveursDesOutils(configuration) },
    ...optionsDeGarde(contexte, sorties.journal),
    maxBudgetUsd: plafondUsd,
    env: environnementDeLaSession(secrets.cléApi),
    ...(process.env['CLAUDE_CODE_EXECPATH'] ? { pathToClaudeCodeExecutable: process.env['CLAUDE_CODE_EXECPATH'] } : {}),
    stderr: (données) => sorties.journal(`cli: ${données.trimEnd()}`),
  }

  let issue: IssueDeSession = { init: null, résultat: null, pagesNotionCréées: 0 }
  let échec: string | null = null
  try {
    issue = await déroulerLaSession(prompt, options, sorties)
  } catch (e) {
    échec = e instanceof Error ? e.message : String(e)
    sorties.journal(`échec : ${échec}`)
  }

  const mesure = lireLaMesure(issue.résultat ?? { subtype: échec ? 'erreur' : 'inconnue' }, {
    tâche,
    organisation,
    date: maintenant,
    plafondUsd,
    organisationsTraitées: relevé.organisations,
    pagesNotionCréées: issue.pagesNotionCréées,
  })
  sorties.écrire('mesure.json', JSON.stringify(mesure, null, 2) + '\n')
  const compteRendu = issue.résultat?.result ?? ''
  if (compteRendu) sorties.écrire('compte-rendu.md', compteRendu + '\n')
  écrireLeRésuméDuJob(
    [résuméDeLaMesure(mesure), échec ? `**Échec** : ${échec}\n` : '', compteRendu ? `### Compte rendu de l’agent\n\n${compteRendu}\n` : ''].join('\n'),
    masques,
  )
  return !échec && issue.résultat?.subtype === 'success' ? 0 : 1
}

// ── Ligne de commande ────────────────────────────────────────────────────────

export function lireLaCommande(argv: readonly string[]): { tâche: Tâche | 'controle'; organisation: string | null } {
  const [premier, ...reste] = argv
  if (premier !== 'controle' && !(TÂCHES as readonly string[]).includes(premier ?? '')) {
    throw new Error(`usage : pnpm tache <${[...TÂCHES, 'controle'].join('|')}> [--organisation <slug>]`)
  }
  let organisation: string | null = null
  for (let i = 0; i < reste.length; i++) {
    if (reste[i] === '--organisation') {
      const valeur = (reste[i + 1] ?? '').trim()
      i++
      if (!valeur) continue
      if (!slugValide(valeur)) throw new Error(`slug d'organisation illisible : ${valeur}`)
      organisation = valeur
    } else {
      throw new Error(`argument inconnu : ${reste[i]}`)
    }
  }
  if (premier === 'controle' && organisation) throw new Error('la tâche « controle » ne prend pas d’organisation')
  return { tâche: premier as Tâche | 'controle', organisation }
}

async function main(): Promise<void> {
  const { tâche, organisation } = lireLaCommande(process.argv.slice(2))
  process.exitCode = tâche === 'controle' ? await contrôler() : await exécuterUneTâche(tâche, organisation)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : String(e))
    process.exitCode = 1
  })
}
