/**
 * La tâche « controle » : vérifie, en lecture seule, que tout ce dont les tâches
 * ont besoin répond, AVANT tout essai réel. Rien n'est écrit ni envoyé, nulle
 * part.
 *
 *   1. Variables : présentes ou absentes (jamais leur valeur).
 *   2. Portail : GET /api/veille/etat?notifier=0, par le même chemin que
 *      l'outil `appeler_portail` (le paramètre `notifier=0` n'envoie aucun
 *      courriel).
 *   3. Gmail : pour chaque autorisation déléguée, un jeton demandé au nom de
 *      `GMAIL_BOITE_OPERATRICE`, puis une lecture que seule cette autorisation
 *      permet (`gmail.compose` : un brouillon listé ; `gmail.metadata` : un
 *      message envoyé listé). `gmail.send` : le jeton seul, sans envoi.
 *   4. Notion, en deux temps. D'abord la sonde du serveur MCP hébergé
 *      (`notion-mcp.ts`) : une requête `initialize` avec le jeton, dont le
 *      refus est lu dans la réponse de Notion elle-même, code, message et
 *      `request_id`, avec le remède qui va avec. Puis, si le serveur a ouvert,
 *      une courte session d'agent sur Sonnet, dont la garde ne permet que les
 *      outils de lecture du serveur hébergé. Les outils exposés par le serveur
 *      sont lus dans le message d'ouverture de la session ; l'agent lit la page
 *      « Pointeurs », la page de la tâche Lettres et interroge la vue « Veilles
 *      actives », et rend un compte, sans recopier de contenu. Un jeton refusé
 *      par la sonde ne lance pas la session : elle ne pourrait rien lire.
 *
 * Le résultat va dans le résumé du job, sans aucun secret.
 */
import type { Options } from '@anthropic-ai/claude-agent-sdk'
import { jetonDeDélégation, PORTÉES_GMAIL } from '@/lib/email/gmail'
import {
  déroulerLaSession,
  environnementDeLaSession,
  écrireLeRésuméDuJob,
  LIRE_PAGE,
  lireLesSecrets,
  optionsDeGarde,
  ouvrirLesSorties,
  réponsesPersistéesDe,
  serveurNotion,
  valeursSecrètes,
  variable,
} from './executer'
import { nomDOutilNotion, OUTILS_NOTION_ÉCRITURE, OUTILS_NOTION_LECTURE, SERVEURS } from './garde'
import { lireLaMesure } from './mesure'
import { décrireLaSonde, sonderLeServeurNotion } from './notion-mcp'
import { appelerLePortail, type ConfigurationDesOutils } from './outils'

const PAGE_POINTEURS = '3d6fe829ce7181fd8c0cf634d4f8c6c2'
const PAGE_LETTRES = '3d5fe829ce718107af65f4fccf8089ab'
const VUE_VEILLES_ACTIVES = 'view://3d6fe829-ce71-8125-8754-000cfdee5a38'
const VARIABLES = ['ANTHROPIC_API_KEY', 'NOTION_MCP_TOKEN', 'ACTIVATION_SECRET', 'GOOGLE_COMPTE_SERVICE_JSON', 'GMAIL_BOITE_OPERATRICE', 'PORTAIL_URL'] as const

type Ligne = { readonly contrôle: string; readonly ok: boolean; readonly détail: string }

/** Le sens d'un refus de Google, sans rien recopier d'autre que son code. */
export function lireLeRefusDeGoogle(message: string): string {
  if (message.includes('unauthorized_client')) return 'unauthorized_client : autorisation absente pour cette portée'
  if (message.includes('invalid_grant')) return 'invalid_grant : adresse non réelle ou hors de l’organisation'
  const statut = /\((\d{3})\)/.exec(message)?.[1] ?? /répondu (\d{3})/.exec(message)?.[1]
  return statut ? `refus ${statut}` : 'refus non qualifié (voir le journal)'
}

async function contrôlerGmail(compte: ConfigurationDesOutils['compteGoogle'], boîte: string | null, journal: (l: string) => void): Promise<Ligne[]> {
  if (!compte || !boîte) {
    return [{ contrôle: 'Gmail', ok: false, détail: 'GOOGLE_COMPTE_SERVICE_JSON ou GMAIL_BOITE_OPERATRICE absent ou illisible' }]
  }
  const essais: { nom: string; portée: string; lecture: string | null }[] = [
    { nom: 'gmail.compose', portée: PORTÉES_GMAIL.brouillons, lecture: 'drafts?maxResults=1' },
    { nom: 'gmail.metadata', portée: PORTÉES_GMAIL.métadonnées, lecture: 'messages?labelIds=SENT&maxResults=1' },
    { nom: 'gmail.send', portée: PORTÉES_GMAIL.envoi, lecture: null },
  ]
  const lignes: Ligne[] = []
  for (const essai of essais) {
    try {
      const jeton = await jetonDeDélégation(compte, boîte, essai.portée)
      if (!essai.lecture) {
        lignes.push({ contrôle: `Gmail ${essai.nom}`, ok: true, détail: 'jeton obtenu (aucun envoi)' })
        continue
      }
      const réponse = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${essai.lecture}`, { headers: { authorization: `Bearer ${jeton}` } })
      lignes.push({ contrôle: `Gmail ${essai.nom}`, ok: réponse.ok, détail: `jeton obtenu, lecture ${réponse.status}` })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      journal(`Gmail ${essai.nom} : ${message}`)
      lignes.push({ contrôle: `Gmail ${essai.nom}`, ok: false, détail: lireLeRefusDeGoogle(message) })
    }
  }
  return lignes
}

async function contrôlerLePortail(configuration: ConfigurationDesOutils): Promise<Ligne> {
  try {
    const r = await appelerLePortail(configuration, 'GET', '/api/veille/etat?notifier=0', undefined)
    if ('refus' in r) return { contrôle: 'Portail /api/veille/etat', ok: false, détail: r.refus }
    let défauts = ''
    try {
      const corps = JSON.parse(r.corps) as { défauts?: unknown[] }
      if (Array.isArray(corps.défauts)) défauts = `, ${corps.défauts.length} défaut(s) signalé(s) par le contrôle du soir`
    } catch {
      // corps non JSON : le statut suffit
    }
    return { contrôle: 'Portail /api/veille/etat?notifier=0', ok: r.statut === 200, détail: `statut ${r.statut}${défauts}` }
  } catch (e) {
    return { contrôle: 'Portail /api/veille/etat', ok: false, détail: e instanceof Error ? e.message : String(e) }
  }
}

const PROMPT_NOTION = `Tu vérifies, en lecture seule, l'accès à Notion d'une tâche planifiée. Tu ne modifies rien et tu ne recopies aucun contenu de page.

1. Lis la page ${PAGE_POINTEURS} (outil fetch du serveur notion). Relève son titre.
2. Lis la page ${PAGE_LETTRES} (outil fetch). Relève son titre, et si elle contient une section « Prompt de la tâche ».
3. Interroge la vue ${VUE_VEILLES_ACTIVES} (outil query-data-sources, en mode vue). Relève seulement le nombre de lignes rendues.

Si une réponse est trop longue et rangée dans un fichier, lis ce fichier avec Read ou cherches-y avec Grep : c'est permis pour ce fichier seulement.

Réponds par un seul bloc JSON, sans rien d'autre :
{"pointeurs":{"ok":true|false,"titre":"…"},"lettres":{"ok":true|false,"titre":"…","prompt":true|false},"vue":{"ok":true|false,"lignes":n},"erreurs":["message d'erreur exact de chaque outil en échec"]}`

type RéponseNotion = {
  pointeurs?: { ok?: boolean; titre?: string }
  lettres?: { ok?: boolean; titre?: string; prompt?: boolean }
  vue?: { ok?: boolean; lignes?: number }
  erreurs?: string[]
}

export function lireLaRéponseNotion(texte: string): RéponseNotion | null {
  const bloc = /\{[\s\S]*\}/.exec(texte)?.[0]
  if (!bloc) return null
  try {
    return JSON.parse(bloc) as RéponseNotion
  } catch {
    return null
  }
}

export async function contrôler(): Promise<number> {
  const secrets = lireLesSecrets()
  const masques = valeursSecrètes(secrets)
  const portail = variable('PORTAIL_URL') ?? 'https://www.signauxfaibles.io'
  const boîte = variable('GMAIL_BOITE_OPERATRICE')
  const sorties = ouvrirLesSorties('controle', masques)
  const lignes: Ligne[] = []

  for (const nom of VARIABLES) {
    const présente = variable(nom) !== null
    lignes.push({ contrôle: `Variable ${nom}`, ok: présente || nom === 'PORTAIL_URL', détail: présente ? 'présente' : nom === 'PORTAIL_URL' ? `absente, ${portail} par défaut` : 'absente' })
  }
  if (secrets.erreurCompteGoogle) lignes.push({ contrôle: 'GOOGLE_COMPTE_SERVICE_JSON', ok: false, détail: secrets.erreurCompteGoogle })

  const configuration: ConfigurationDesOutils = {
    portail,
    jetonPortail: secrets.jetonPortail,
    compteGoogle: secrets.compteGoogle,
    boîte,
    nomExpéditeur: 'Signaux faibles',
    journal: sorties.journal,
    relevé: { organisations: new Set() },
  }
  lignes.push(await contrôlerLePortail(configuration))
  lignes.push(...(await contrôlerGmail(secrets.compteGoogle, boîte, sorties.journal)))

  let serveurOuvert = false
  if (secrets.jetonNotion) {
    const sonde = await sonderLeServeurNotion(secrets.jetonNotion)
    serveurOuvert = sonde.ok
    sorties.journal(`serveur Notion MCP : ${décrireLaSonde(sonde)}`)
    lignes.push({ contrôle: 'Notion : jeton MCP accepté par le serveur', ok: sonde.ok, détail: décrireLaSonde(sonde) })
  }

  let coût = 0
  if (secrets.cléApi && secrets.jetonNotion && !serveurOuvert) {
    lignes.push({ contrôle: 'Notion : session de lecture', ok: false, détail: 'non lancée : le serveur refuse le jeton (voir la ligne précédente)' })
  } else if (secrets.cléApi && secrets.jetonNotion) {
    const options: Options = {
      cwd: sorties.espace,
      model: 'claude-sonnet-5-5',
      effort: 'low',
      // Read et Grep : seulement pour relire une réponse longue rangée par le CLI (garde).
      tools: ['ToolSearch', 'Read', 'Grep'],
      mcpServers: { [SERVEURS.notion]: serveurNotion(secrets.jetonNotion) },
      ...optionsDeGarde({ espace: sorties.espace, lirePage: LIRE_PAGE, portail, mode: 'lecture', réponsesPersistées: réponsesPersistéesDe(sorties.espace) }, sorties.journal),
      maxTurns: 20,
      maxBudgetUsd: 2,
      env: environnementDeLaSession(secrets.cléApi),
      ...(process.env['CLAUDE_CODE_EXECPATH'] ? { pathToClaudeCodeExecutable: process.env['CLAUDE_CODE_EXECPATH'] } : {}),
      stderr: (données) => sorties.journal(`cli: ${données.trimEnd()}`),
    }
    try {
      const issue = await déroulerLaSession(PROMPT_NOTION, options, sorties)
      coût = issue.résultat?.total_cost_usd ?? 0
      const serveur = issue.init?.serveurs.find((s) => s.name === SERVEURS.notion)
      lignes.push({ contrôle: 'Notion : connexion au serveur hébergé', ok: serveur?.status === 'connected', détail: serveur ? serveur.status : 'serveur absent de la session' })
      const outils = (issue.init?.outils ?? []).filter((o) => o.startsWith(`mcp__${SERVEURS.notion}__`)).map((o) => o.slice(`mcp__${SERVEURS.notion}__`.length))
      lignes.push({ contrôle: 'Notion : outils exposés', ok: outils.length > 0, détail: outils.length ? `${outils.length} : ${outils.sort().join(', ')}` : 'aucun' })
      // Le serveur nomme ses outils `fetch` avec un jeton MCP, `notion-fetch` en
      // OAuth : on compare sans le préfixe, comme la garde.
      const exposés = new Set(outils.map(nomDOutilNotion))
      for (const attendu of [...OUTILS_NOTION_LECTURE, ...OUTILS_NOTION_ÉCRITURE.filter((o) => o !== 'get-async-task')]) {
        lignes.push({ contrôle: `Notion : outil ${attendu}`, ok: exposés.has(attendu), détail: exposés.has(attendu) ? 'exposé' : 'absent' })
      }
      const réponse = lireLaRéponseNotion(issue.résultat?.result ?? '')
      if (!réponse) {
        lignes.push({ contrôle: 'Notion : lectures', ok: false, détail: `réponse de l’agent illisible (issue ${issue.résultat?.subtype ?? 'inconnue'})` })
      } else {
        lignes.push({ contrôle: 'Notion : page « Pointeurs »', ok: réponse.pointeurs?.ok === true, détail: réponse.pointeurs?.titre ?? 'non lue' })
        lignes.push({ contrôle: 'Notion : page de la tâche Lettres', ok: réponse.lettres?.ok === true && réponse.lettres.prompt === true, détail: `${réponse.lettres?.titre ?? 'non lue'}${réponse.lettres?.prompt ? ', prompt présent' : ', prompt non trouvé'}` })
        lignes.push({ contrôle: 'Notion : vue « Veilles actives »', ok: réponse.vue?.ok === true, détail: réponse.vue?.ok ? `${réponse.vue.lignes ?? '?'} ligne(s)` : 'non interrogée' })
        for (const e of réponse.erreurs ?? []) lignes.push({ contrôle: 'Notion : erreur rapportée', ok: false, détail: e.slice(0, 600) })
      }
      sorties.écrire(
        'mesure.json',
        JSON.stringify(lireLaMesure(issue.résultat ?? {}, { tâche: 'controle', organisation: null, date: new Date(), plafondUsd: 2, organisationsTraitées: [], pagesNotionCréées: issue.pagesNotionCréées }), null, 2) + '\n',
      )
    } catch (e) {
      lignes.push({ contrôle: 'Notion', ok: false, détail: e instanceof Error ? e.message : String(e) })
    }
  } else {
    lignes.push({ contrôle: 'Notion', ok: false, détail: 'ANTHROPIC_API_KEY ou NOTION_MCP_TOKEN absent : session non lancée' })
  }

  const ok = lignes.every((l) => l.ok)
  const tableau = [
    `## Contrôle avant essai : ${ok ? 'tout répond' : 'au moins un point en défaut'}`,
    '',
    '| Contrôle | État | Détail |',
    '|---|---|---|',
    ...lignes.map((l) => `| ${l.contrôle} | ${l.ok ? 'ok' : '**défaut**'} | ${l.détail.replace(/\|/g, '/').replace(/\n/g, ' ')} |`),
    '',
    `Coût de la session Notion : ${coût.toFixed(2).replace('.', ',')} $. Rien n’a été écrit ni envoyé.`,
    '',
  ].join('\n')
  sorties.écrire('controle.md', tableau)
  écrireLeRésuméDuJob(tableau, masques)
  return ok ? 0 : 1
}
