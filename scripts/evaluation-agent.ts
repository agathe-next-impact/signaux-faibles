/**
 * Évaluation « agent complet » : la même lettre, produite par un agent Claude Code
 * facturé à l'API, pour mesurer honnêtement l'écart avec la tâche Cowork.
 *
 *   pnpm evaluation:agent [--organisation konica] [--veille ecosysteme] [--effort high]
 *        [--parallele 2] [--max-tours 400] [--budget 40] [--couverture 0.8] [--faits-min 6]
 *        [--relances 2] [--date-edition AAAA-MM-JJ] [--a-blanc]
 *
 * Ce que ce script partage avec `evaluation-lettres.ts` : les entrées
 * (`evaluation/entrees/`), le prompt (préambule « agent » puis les étapes 1 à 3
 * de la page « Tâche Lettres de veille »), les portes de collecte, le
 * validateur de production, le gabarit courriel et le rapport. Ce qui change :
 * le modèle n'est plus appelé par l'API Messages avec deux outils serveur, il
 * tourne dans une session Claude Code (SDK Agent) avec un espace de travail sur
 * disque, la lecture et l'écriture de fichiers, la recherche web, la lecture
 * d'une page et le navigateur de la session (`scripts/lire-page.mjs`) pour les
 * sources qui se ferment aux robots. C'est, à Notion et Gmail près, le poste de
 * travail de la tâche Cowork ; la différence de qualité restante tient alors au
 * modèle et au prompt, pas aux outils.
 *
 * Ce que l'agent ne peut pas faire, et le code le lui refuse (`canUseTool`) :
 * écrire hors de son espace de travail, lancer une autre commande que la lecture
 * d'une page, appeler une adresse du portail. Il n'a ni Notion, ni Gmail, ni
 * Postgres. La session enfant est authentifiée par `EVALUATION_API_KEY` et par
 * rien d'autre : l'environnement de la session Claude Code (compte, jeton,
 * `ANTHROPIC_BASE_URL`) n'est pas transmis, et le script s'arrête si la session
 * enfant annonce une autre source d'authentification que la clé.
 */
import { query, type CanUseTool, type Options, type SDKMessage } from '@anthropic-ai/claude-agent-sdk'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  ENTRÉES,
  FAMILLES,
  MODÈLES,
  PORTAIL_URL,
  RACINE,
  SORTIES,
  aujourdHui,
  blocDynamique,
  blocStatique,
  cléDÉvaluation,
  enParallèle,
  horodatageDeSortie,
  lireArguments,
  lireDossier,
  lirePortes,
  messageDeRelance,
  mesurerLesPortes,
  organisationsDisponibles,
  préambule,
  réglerLeMandataire,
  urlsNommées,
  valider,
  écrireLaLettre,
  écrireRapport,
  étapesDeProduction,
  type Dossier,
  type Ligne,
  type MesureDesPortes,
  type Portes,
  type Résultat,
  type Veille,
} from './evaluation-lettres'

const LIRE_PAGE = join(RACINE, 'scripts', 'lire-page.mjs')
const OUTILS = ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash', 'WebFetch', 'WebSearch'] as const
const MODÈLE = MODÈLES.opus

type OptionsAgent = {
  organisations: string[]
  veilles: Veille[]
  effort: 'low' | 'medium' | 'high' | 'xhigh'
  parallèle: number
  maxTours: number
  budget: number
  àBlanc: boolean
  dateÉdition: string
  portes: Portes
}

function lireOptions(argv: string[]): OptionsAgent {
  const { valeurs, drapeaux } = lireArguments(argv)
  const liste = <T extends string>(clé: string, défaut: T[], admis: readonly T[]): T[] => {
    const brut = valeurs.get(clé)
    if (!brut) return défaut
    const choisis = brut.split(',').map((v) => v.trim()) as T[]
    for (const c of choisis) if (!admis.includes(c)) throw new Error(`Valeur inconnue pour --${clé} : ${c}`)
    return choisis
  }
  const disponibles = organisationsDisponibles()
  return {
    organisations: liste('organisation', ['konica'].filter((o) => disponibles.includes(o)), disponibles),
    veilles: liste<Veille>('veille', ['ecosysteme', 'concurrentielle'], ['ecosysteme', 'concurrentielle']),
    effort: liste('effort', ['high'], ['low', 'medium', 'high', 'xhigh'])[0] ?? 'high',
    parallèle: Number(valeurs.get('parallele') ?? 2),
    maxTours: Number(valeurs.get('max-tours') ?? 400),
    // Plafond par lettre, en dollars : l'agent s'arrête net au-delà, la lettre est alors jugée telle quelle.
    budget: Number(valeurs.get('budget') ?? 40),
    àBlanc: drapeaux.has('a-blanc'),
    dateÉdition: valeurs.get('date-edition') ?? aujourdHui(),
    portes: lirePortes(valeurs),
  }
}

// ── Espace de travail ────────────────────────────────────────────────────────

/** Le dossier de la lettre, posé en fichiers pour que l'agent le lise et le fouille comme la tâche Cowork lit Notion. */
function poserLeDossier(espace: string, dossier: Dossier): void {
  mkdirSync(espace, { recursive: true })
  if (dossier.fiche) writeFileSync(join(espace, 'fiche-organisation.md'), dossier.fiche)
  writeFileSync(join(espace, 'referentiel.md'), dossier.référentiel)
  writeFileSync(join(espace, 'dernieres-editions.json'), JSON.stringify(dossier.dernièresÉditions, null, 2))
  if (dossier.dernièreLettre) writeFileSync(join(espace, 'derniere-lettre-publiee.md'), dossier.dernièreLettre)
  writeFileSync(join(espace, 'sources-nommees.txt'), urlsNommées(dossier.référentiel).join('\n'))
}

function paramètresDAgent(espace: string): Record<string, unknown> {
  return {
    espaceDeTravail: espace,
    fichiersDuDossier: ['fiche-organisation.md', 'referentiel.md', 'dernieres-editions.json', 'derniere-lettre-publiee.md', 'sources-nommees.txt'],
    commandeNavigateur: `node ${LIRE_PAGE} <url> [caractères]`,
    fichierDeGrille: join(espace, 'grille.md'),
    fichierDeRéponse: join(espace, 'reponse.md'),
  }
}

// ── Garde des outils ─────────────────────────────────────────────────────────

const MOTIF_LIRE_PAGE = new RegExp(`^\\s*node\\s+${LIRE_PAGE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+(https?://\\S+)(\\s+\\d+)?\\s*$`)

function urlDeLirePage(commande: string): string | null {
  const m = MOTIF_LIRE_PAGE.exec(commande)
  return m?.[1] ?? null
}

function estDuPortail(url: string): boolean {
  try {
    const hôte = new URL(url).hostname
    return hôte === new URL(PORTAIL_URL).hostname || hôte.endsWith('.signauxfaibles.io') || hôte === 'signauxfaibles.io'
  } catch {
    return false
  }
}

/**
 * Ce que l'agent a le droit de faire, écrit à un seul endroit : lire et écrire
 * dans son espace, chercher et lire le web, ouvrir une page au navigateur.
 * La décision est posée deux fois dans la session, par le crochet `PreToolUse`
 * (consulté avant tout appel, quelles que soient les règles de permission) et
 * par `canUseTool` (consulté pour ce que les règles ne tranchent pas).
 */
function décisionPour(espace: string, outil: string, entrée: Record<string, unknown>): string | null {
  const dansLEspace = (chemin: unknown): boolean => typeof chemin === 'string' && (resolve(espace, chemin) + '/').startsWith(espace + '/')
  const horsPortail = (url: string): string | null => (estDuPortail(url) ? 'aucune adresse du portail signauxfaibles.io ne se lit pendant ce run' : null)
  switch (outil) {
    case 'Read':
    case 'Glob':
    case 'Grep':
    case 'WebSearch':
      return null
    case 'Write':
    case 'Edit':
      return dansLEspace(entrée['file_path']) ? null : `écriture hors de l'espace de travail ${espace}`
    case 'WebFetch':
      return horsPortail(String(entrée['url'] ?? ''))
    case 'Bash': {
      const url = urlDeLirePage(String(entrée['command'] ?? ''))
      return url ? horsPortail(url) : `seule la commande « node ${LIRE_PAGE} <url> [caractères] » est permise`
    }
    default:
      return `outil ${outil} hors de la liste permise`
  }
}

function gardeDesOutils(espace: string, journal: (ligne: string) => void): { canUseTool: CanUseTool; hooks: NonNullable<Options['hooks']> } {
  const canUseTool: CanUseTool = async (outil, entrée) => {
    const refus = décisionPour(espace, outil, entrée)
    if (refus) journal(`refus ${outil} : ${refus}`)
    return refus ? { behavior: 'deny', message: refus } : { behavior: 'allow' }
  }
  const hooks: NonNullable<Options['hooks']> = {
    PreToolUse: [
      {
        hooks: [
          async (input) => {
            if (input.hook_event_name !== 'PreToolUse') return {}
            const refus = décisionPour(espace, input.tool_name, (input.tool_input ?? {}) as Record<string, unknown>)
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

/** L'environnement de la session enfant : celui du poste, sans rien de la session Claude Code qui lance le script. */
function environnementDeLAgent(): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = {}
  for (const [clé, valeur] of Object.entries(process.env)) {
    if (/^(CLAUDE|CCR_|ANTHROPIC_|AI_AGENT|SESSION_INGRESS|CLOUDSDK_AUTH|GH_TOKEN|GITHUB_TOKEN|AWS_ACCESS|AWS_SECRET)/.test(clé)) continue
    env[clé] = valeur
  }
  env['ANTHROPIC_API_KEY'] = cléDÉvaluation()
  return env
}

// ── Un run d'agent ───────────────────────────────────────────────────────────

type Session = {
  sessionId: string | null
  texteFinal: string
  tours: number
  coût: number
  durée_ms: number
  stopReason: string | null
  modèleServi: string | null
  usage: Résultat['usage']
  urlsOuvertes: Set<string>
  urlsDemandées: Set<string>
}

function lireUsage(résultat: Record<string, unknown>, session: Session): void {
  const usage = (résultat['usage'] ?? {}) as Record<string, number | undefined>
  session.usage.entrée += usage['input_tokens'] ?? 0
  session.usage.sortie += usage['output_tokens'] ?? 0
  session.usage.cacheLecture += usage['cache_read_input_tokens'] ?? 0
  session.usage.cacheÉcriture += usage['cache_creation_input_tokens'] ?? 0
  const parModèle = (résultat['modelUsage'] ?? {}) as Record<string, { webSearchRequests?: number }>
  for (const [modèle, u] of Object.entries(parModèle)) {
    session.usage.recherches += u.webSearchRequests ?? 0
    session.modèleServi ??= modèle
  }
}

async function tourDAgent(
  prompt: string,
  options: Options,
  session: Session,
  écrireTranscription: (message: SDKMessage) => void,
  journal: (ligne: string) => void,
): Promise<void> {
  const enAttente = new Map<string, string>()
  const q = query({ prompt, options: session.sessionId ? { ...options, resume: session.sessionId } : options })
  for await (const message of q) {
    écrireTranscription(message)
    if (message.type === 'system' && message.subtype === 'init') {
      session.sessionId = message.session_id
      if (message.apiKeySource !== 'ANTHROPIC_API_KEY') {
        q.interrupt().catch(() => {})
        throw new Error(`la session enfant n'est pas authentifiée par la clé d'évaluation (source : ${message.apiKeySource}) ; arrêt avant tout appel`)
      }
      continue
    }
    if (message.type === 'assistant') {
      for (const bloc of message.message.content) {
        if (bloc.type !== 'tool_use') continue
        const entrée = (bloc.input ?? {}) as Record<string, unknown>
        const url = bloc.name === 'WebFetch' ? String(entrée['url'] ?? '') : bloc.name === 'Bash' ? urlDeLirePage(String(entrée['command'] ?? '')) : null
        if (url) {
          session.urlsDemandées.add(url)
          enAttente.set(bloc.id, url)
        }
        journal(`outil ${bloc.name} ${url ?? (bloc.name === 'WebSearch' ? String(entrée['query'] ?? '') : String(entrée['file_path'] ?? entrée['pattern'] ?? ''))}`)
      }
      continue
    }
    if (message.type === 'user' && Array.isArray(message.message.content)) {
      for (const bloc of message.message.content) {
        if (typeof bloc !== 'object' || bloc === null || (bloc as { type?: string }).type !== 'tool_result') continue
        const r = bloc as { tool_use_id: string; is_error?: boolean; content?: unknown }
        const url = enAttente.get(r.tool_use_id)
        if (!url) continue
        enAttente.delete(r.tool_use_id)
        const texte = typeof r.content === 'string' ? r.content : JSON.stringify(r.content ?? '')
        // Une page lue au navigateur n'est ouverte que si le navigateur a bien reçu une réponse 2xx.
        const ouverte = !r.is_error && !/^statut : [45]\d\d/m.test(texte) && !/\b(error|erreur)\b.{0,40}\b(fetch|403|404|429|5\d\d)\b/i.test(texte.slice(0, 200))
        if (ouverte) session.urlsOuvertes.add(url)
      }
      continue
    }
    if (message.type === 'result') {
      session.tours += message.num_turns
      session.coût += message.total_cost_usd
      session.durée_ms += message.duration_ms
      session.stopReason = message.subtype
      lireUsage(message as unknown as Record<string, unknown>, session)
      if (message.subtype === 'success') session.texteFinal = message.result
      else journal(`fin anormale : ${message.subtype}`)
    }
  }
}

async function produireParAgent(dossier: Dossier, répertoire: string, options: OptionsAgent): Promise<Résultat> {
  const espace = join(répertoire, 'espace')
  poserLeDossier(espace, dossier)
  const système = préambule('agent') + étapesDeProduction()
  const utilisateur = `${blocStatique(dossier)}\n\n${blocDynamique(dossier, options.dateÉdition, null, paramètresDAgent(espace))}`
  writeFileSync(join(répertoire, 'prompt-systeme.txt'), système)
  writeFileSync(join(répertoire, 'prompt-utilisateur.txt'), utilisateur)

  const lignesDeJournal: string[] = []
  const journal = (ligne: string) => {
    lignesDeJournal.push(`${new Date().toISOString()} ${ligne}`)
    writeFileSync(join(répertoire, 'journal.txt'), lignesDeJournal.join('\n'))
  }
  const transcription: string[] = []
  const écrireTranscription = (message: SDKMessage) => {
    transcription.push(JSON.stringify(message))
    if (transcription.length % 20 === 0) writeFileSync(join(répertoire, 'transcription.jsonl'), transcription.join('\n'))
  }

  const garde = gardeDesOutils(espace, journal)
  const optionsDeSession: Options = {
    cwd: espace,
    model: MODÈLE,
    effort: options.effort,
    systemPrompt: système,
    tools: [...OUTILS],
    // Pas d'`allowedTools` : une entrée nue y approuverait l'outil avant la garde.
    permissionMode: 'default',
    canUseTool: garde.canUseTool,
    hooks: garde.hooks,
    settingSources: [],
    maxTurns: options.maxTours,
    maxBudgetUsd: options.budget,
    env: environnementDeLAgent(),
    ...(process.env['CLAUDE_CODE_EXECPATH'] ? { pathToClaudeCodeExecutable: process.env['CLAUDE_CODE_EXECPATH'] } : {}),
    stderr: (données) => journal(`cli: ${données.trimEnd()}`),
  }

  const session: Session = {
    sessionId: null,
    texteFinal: '',
    tours: 0,
    coût: 0,
    durée_ms: 0,
    stopReason: null,
    modèleServi: null,
    usage: { entrée: 0, sortie: 0, cacheLecture: 0, cacheÉcriture: 0, recherches: 0 },
    urlsOuvertes: new Set(),
    urlsDemandées: new Set(),
  }

  const texteRendu = (): string => {
    const fichier = join(espace, 'reponse.md')
    return existsSync(fichier) ? readFileSync(fichier, 'utf8') : session.texteFinal
  }

  let relances = 0
  let mesure: MesureDesPortes | null = null
  try {
    await tourDAgent(utilisateur, optionsDeSession, session, écrireTranscription, journal)
    mesure = mesurerLesPortes(texteRendu(), dossier, session.urlsOuvertes, null, options.portes)
    while (!mesure.franchies && relances < options.portes.relances && session.stopReason === 'success' && session.coût < options.budget) {
      relances += 1
      journal(`relance ${relances} : ${mesure.manques.join(' ; ')}`)
      const consigne =
        messageDeRelance(mesure, relances, 'agent') +
        `\nRéécris ensuite le fichier ${join(espace, 'reponse.md')} en entier avec la réponse complète.`
      await tourDAgent(consigne, { ...optionsDeSession, maxBudgetUsd: Math.max(1, options.budget - session.coût) }, session, écrireTranscription, journal)
      mesure = mesurerLesPortes(texteRendu(), dossier, session.urlsOuvertes, null, options.portes)
    }
  } finally {
    writeFileSync(join(répertoire, 'transcription.jsonl'), transcription.join('\n'))
  }

  return {
    organisation: dossier.organisation,
    veille: dossier.veille,
    libelléVeille: dossier.libelléVeille,
    numéro: dossier.numéro,
    dateÉdition: options.dateÉdition,
    modèle: MODÈLE,
    conception: 'agent',
    effort: options.effort,
    tours: session.tours,
    relances,
    portes: mesure,
    stopReason: session.stopReason,
    modèleServi: session.modèleServi,
    usage: session.usage,
    coût: session.coût,
    durée_s: Math.round(session.durée_ms / 1000),
    urlsOuvertes: [...session.urlsOuvertes],
    urlsDemandées: [...session.urlsDemandées],
    texte: texteRendu(),
  }
}

// ── Orchestration ────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  await réglerLeMandataire()
  const options = lireOptions(process.argv.slice(2))
  if (!existsSync(LIRE_PAGE)) throw new Error(`${LIRE_PAGE} est absent : le navigateur de l'agent en dépend.`)
  const racine = join(SORTIES, horodatageDeSortie())
  mkdirSync(racine, { recursive: true })

  const travaux: Dossier[] = []
  for (const organisation of options.organisations) {
    for (const veille of options.veilles) {
      if (!existsSync(join(ENTRÉES, organisation, veille, 'referentiel.md'))) {
        process.stderr.write(`ignoré : ${organisation}/${veille} (pas de référentiel exporté)\n`)
        continue
      }
      travaux.push(lireDossier(organisation, veille, options.dateÉdition))
    }
  }
  process.stderr.write(`${travaux.length} lettres à produire par l'agent → ${racine}\n`)
  if (!options.àBlanc) cléDÉvaluation()

  const lignes: Ligne[] = []
  await enParallèle(
    travaux.map((dossier) => async () => {
      const répertoire = join(racine, dossier.organisation, dossier.veille, `${MODÈLE.replace('claude-', '')}-agent`)
      mkdirSync(répertoire, { recursive: true })
      if (options.àBlanc) {
        const espace = join(répertoire, 'espace')
        poserLeDossier(espace, dossier)
        const système = préambule('agent') + étapesDeProduction()
        const utilisateur = `${blocStatique(dossier)}\n\n${blocDynamique(dossier, options.dateÉdition, null, paramètresDAgent(espace))}`
        writeFileSync(join(répertoire, 'prompt-systeme.txt'), système)
        writeFileSync(join(répertoire, 'prompt-utilisateur.txt'), utilisateur)
        process.stderr.write(`à blanc : ${répertoire} (système ${système.length} car., utilisateur ${utilisateur.length} car., ${FAMILLES[dossier.veille].famille})\n`)
        return
      }
      process.stderr.write(`début ${dossier.organisation}/${dossier.veille} agent ${MODÈLE}\n`)
      try {
        const résultat = await produireParAgent(dossier, répertoire, options)
        const sortie = valider(résultat, null)
        écrireLaLettre(répertoire, résultat, sortie)
        lignes.push({ résultat, validation: sortie.validation, objet: sortie.objet, chemin: répertoire })
        process.stderr.write(
          `fin   ${dossier.organisation}/${dossier.veille} agent : ${sortie.validation.conforme ? 'conforme' : 'NON conforme'}, ` +
            `${sortie.validation.faits} faits, couverture ${Math.round((sortie.validation.couverture ?? 0) * 100)} %, ${résultat.relances} relance(s), ` +
            `${sortie.validation.urlsCitéesNonOuvertes.length} URL non ouvertes, ${résultat.coût.toFixed(2)} $, ${résultat.durée_s} s, ${résultat.tours} tours\n`,
        )
      } catch (erreur) {
        writeFileSync(join(répertoire, 'erreur.txt'), erreur instanceof Error ? `${erreur.message}\n${erreur.stack ?? ''}` : String(erreur))
        process.stderr.write(`ÉCHEC ${répertoire} : ${erreur instanceof Error ? erreur.message : String(erreur)}\n`)
      }
    }),
    options.parallèle,
  )

  if (!options.àBlanc) {
    écrireRapport(racine, lignes)
    process.stderr.write(`rapport : ${join(racine, 'rapport.md')}\n`)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((erreur: unknown) => {
    process.stderr.write(`${erreur instanceof Error ? erreur.message : String(erreur)}\n`)
    process.exit(1)
  })
}
