/**
 * Les outils que ce dépôt donne aux tâches, en plus du web et de Notion.
 *
 * Trois serveurs MCP en cours de processus (`createSdkMcpServer`) :
 *
 *   · « Gmail » : `create_draft`, `list_drafts`, `send_message` et
 *     `list_sent_messages`, sur la boîte de l'opératrice
 *     (`GMAIL_BOITE_OPERATRICE`). Les deux premiers noms sont ceux que citent
 *     les pages de tâches. **Aucun outil n'envoie à un client** : `send_message`
 *     n'a qu'un destinataire possible, l'opératrice, et c'est le seul chemin de
 *     ce fichier qui envoie. Un brouillon ne part jamais d'ici : la relecture
 *     reste humaine. `list_sent_messages` ne lit que les en-têtes (portée
 *     `gmail.metadata`, qui refuse la recherche `q`).
 *   · « Portail » : `appeler_portail`, limité à `/api/veille/*` et
 *     `/api/acces/ouvrir`. Il ajoute lui-même `ACTIVATION_SECRET` : le jeton
 *     n'entre jamais dans le contexte du modèle, et il est masqué s'il revenait
 *     dans une réponse.
 *   · « Veille » : `tirer_identifiant`, 32 caractères hexadécimaux d'un
 *     générateur cryptographique, pour la ligne « Accès » que l'onboarding crée
 *     (§3.7bis) ; la tâche le tirait avec Bash, que la garde ne permet plus.
 *     `lire_sources` lit en code un lot d'URL et `synthese_de_collecte`
 *     condense les grilles et les faits des collecteurs (23 octobre 2026).
 *
 * `Gmail__deposer_courriel` compose un courriel client par le portail et le
 * dépose en brouillon sans que le HTML passe par le modèle (23 octobre 2026) :
 * la première lettre Heritech en avait recopié 210 000 caractères.
 *
 * Les secrets sont lus par `executer.ts` et passés ici ; ce fichier ne lit pas
 * l'environnement.
 */
import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk'
import { randomBytes } from 'node:crypto'
import { join, resolve } from 'node:path'
import { z } from 'zod'
import { adresseDeRéponseSûre, composerMessage, jetonDeDélégation, PORTÉES_GMAIL } from '@/lib/email/gmail'
import { lireLesUrls } from '../collecte/lire-sources'
import { synthétiser } from '../collecte/synthese'
import { cheminDuPortail, SERVEURS } from './garde'

/** La seule adresse à laquelle une tâche envoie réellement un courriel. */
export const DESTINATAIRE_OPÉRATRICE = 'agathe@signauxfaibles.io'

const API_GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me/'
const PLAFOND_RÉPONSE = 100_000

export type CompteGoogle = { readonly email: string; readonly clePrivée: string }

export type ConfigurationDesOutils = {
  readonly portail: string
  readonly jetonPortail: string | null
  readonly compteGoogle: CompteGoogle | null
  readonly boîte: string | null
  readonly nomExpéditeur: string
  readonly journal: (ligne: string) => void
  /** Ce que le run relève pour sa mesure : les organisations nommées au portail. */
  readonly relevé: { readonly organisations: Set<string> }
  /** Le dossier de travail du run, où `lire_sources` et `synthese_de_collecte` écrivent. */
  readonly espace?: string
  /** Injectables pour les tests. */
  readonly fetch?: typeof fetch
  readonly jetonGoogle?: (portée: string) => Promise<string>
}

type Résultat = { content: { type: 'text'; text: string }[]; isError?: boolean }

const texte = (valeur: unknown): Résultat => ({
  content: [{ type: 'text', text: typeof valeur === 'string' ? valeur : JSON.stringify(valeur, null, 2) }],
})
const erreur = (message: string): Résultat => ({ content: [{ type: 'text', text: message }], isError: true })

/** Masque un secret qui reviendrait dans un texte. */
export function masquer(texteBrut: string, secrets: readonly (string | null | undefined)[]): string {
  let sortie = texteBrut
  for (const secret of secrets) if (secret && secret.length >= 8) sortie = sortie.split(secret).join('[secret masqué]')
  return sortie
}

// ── Portail ──────────────────────────────────────────────────────────────────

export type RéponseDuPortail = { readonly statut: number; readonly corps: string }

export async function appelerLePortail(
  configuration: ConfigurationDesOutils,
  méthode: string,
  chemin: string,
  corps: unknown,
  /** La réponse rendue au modèle est tronquée ; un outil qui la lit lui-même en prend davantage. */
  plafond: number = PLAFOND_RÉPONSE,
): Promise<RéponseDuPortail | { readonly refus: string }> {
  const cible = cheminDuPortail(méthode.toUpperCase(), chemin, configuration.portail)
  if ('refus' in cible) {
    configuration.journal(`refus Portail : ${cible.refus}`)
    return { refus: cible.refus }
  }
  if (!configuration.jetonPortail) return { refus: 'ACTIVATION_SECRET absent : appel impossible' }

  const avecCorps = méthode.toUpperCase() !== 'GET' && corps !== undefined && corps !== null
  const réponse = await (configuration.fetch ?? fetch)(cible.url, {
    method: méthode.toUpperCase(),
    // Une redirection retirerait l'en-tête ; on la rend plutôt que la suivre.
    redirect: 'manual',
    headers: {
      authorization: `Bearer ${configuration.jetonPortail}`,
      ...(avecCorps ? { 'content-type': 'application/json' } : {}),
    },
    ...(avecCorps ? { body: typeof corps === 'string' ? corps : JSON.stringify(corps) } : {}),
  })
  const brut = await réponse.text()
  configuration.journal(`Portail ${méthode.toUpperCase()} ${cible.url.pathname} → ${réponse.status}`)
  relever(configuration, cible.url, corps, brut)
  return { statut: réponse.status, corps: masquer(brut, [configuration.jetonPortail]).slice(0, plafond) }
}

/** Les organisations que le run a nommées au portail : un slug envoyé, ou la sélection du calendrier. */
function relever(configuration: ConfigurationDesOutils, url: URL, corps: unknown, réponse: string): void {
  const objet = typeof corps === 'string' ? (() => { try { return JSON.parse(corps) as unknown } catch { return null } })() : corps
  const slug = objet && typeof objet === 'object' ? (objet as Record<string, unknown>)['slug'] : undefined
  if (typeof slug === 'string' && slug) configuration.relevé.organisations.add(slug)
  if (url.pathname === '/api/veille/calendrier') {
    try {
      const parutions = (JSON.parse(réponse) as { parutions?: unknown }).parutions
      if (Array.isArray(parutions)) for (const p of parutions) if (typeof p === 'string') configuration.relevé.organisations.add(p)
    } catch {
      // une réponse illisible ne relève rien
    }
  }
}

// ── Gmail ────────────────────────────────────────────────────────────────────

function jetonGmail(configuration: ConfigurationDesOutils, portée: string): Promise<string> {
  if (configuration.jetonGoogle) return configuration.jetonGoogle(portée)
  if (!configuration.compteGoogle || !configuration.boîte) {
    return Promise.reject(new Error('GOOGLE_COMPTE_SERVICE_JSON ou GMAIL_BOITE_OPERATRICE absent : Gmail indisponible'))
  }
  return jetonDeDélégation(configuration.compteGoogle, configuration.boîte, portée)
}

async function appelerGmail(
  configuration: ConfigurationDesOutils,
  portée: string,
  méthode: 'GET' | 'POST',
  chemin: string,
  corps?: unknown,
): Promise<Record<string, unknown>> {
  const jeton = await jetonGmail(configuration, portée)
  const réponse = await (configuration.fetch ?? fetch)(API_GMAIL + chemin, {
    method: méthode,
    headers: { authorization: `Bearer ${jeton}`, ...(corps ? { 'content-type': 'application/json' } : {}) },
    ...(corps ? { body: JSON.stringify(corps) } : {}),
  })
  const brut = await réponse.text()
  if (!réponse.ok) throw new Error(`Gmail a répondu ${réponse.status} : ${brut.slice(0, 500)}`)
  return brut ? (JSON.parse(brut) as Record<string, unknown>) : {}
}

const enTête = (message: unknown, nom: string): string => {
  const entêtes = ((message as { payload?: { headers?: { name: string; value: string }[] } })?.payload?.headers ?? [])
  return entêtes.find((e) => e.name.toLowerCase() === nom.toLowerCase())?.value ?? ''
}

export type Brouillon = { readonly to: readonly string[]; readonly subject: string; readonly body: string; readonly htmlBody?: string }

/** Dépose un brouillon. Ne l'envoie jamais : aucun appel à `/send` dans ce chemin. */
export async function créerBrouillon(configuration: ConfigurationDesOutils, brouillon: Brouillon): Promise<{ id: string; destinataires: number }> {
  if (!configuration.boîte) throw new Error('GMAIL_BOITE_OPERATRICE absent')
  for (const adresse of brouillon.to) if (!adresseDeRéponseSûre(adresse)) throw new Error('adresse de destinataire illisible')
  if (/[\r\n]/.test(brouillon.subject)) throw new Error('objet sur plusieurs lignes refusé')
  const brut = composerMessage(
    { destinataire: brouillon.to.join(', '), sujet: brouillon.subject, texte: brouillon.body, ...(brouillon.htmlBody ? { html: brouillon.htmlBody } : {}) },
    configuration.boîte,
    configuration.nomExpéditeur,
  )
  const réponse = await appelerGmail(configuration, PORTÉES_GMAIL.brouillons, 'POST', 'drafts', {
    message: { raw: Buffer.from(brut, 'utf8').toString('base64url') },
  })
  configuration.journal(`Gmail create_draft : ${brouillon.to.length} destinataire(s)`)
  return { id: String(réponse['id'] ?? ''), destinataires: brouillon.to.length }
}

/** Une réponse de mise en forme, telle que `POST /api/veille/courriel` la rend. */
type Composé = { état?: unknown; objet?: unknown; html?: unknown; texte?: unknown; octets?: unknown; avertissement?: unknown }

/**
 * Compose un courriel client par le portail (`POST /api/veille/courriel`, la
 * demande telle que la page de la tâche l'écrit) et le dépose en brouillon,
 * sans jamais le renvoyer au modèle : il ne reçoit que l'identifiant du
 * brouillon, l'objet et la taille. Une lettre non conforme (422) n'est pas
 * déposée : la réponse du portail est rendue telle quelle, pour correction de
 * la page. Rien n'est envoyé.
 */
export async function déposerUnCourriel(
  configuration: ConfigurationDesOutils,
  demande: Readonly<Record<string, unknown>>,
  to: readonly string[],
): Promise<Record<string, unknown>> {
  // Le brouillon est déposé ici : le portail n'a pas à le faire aussi.
  const { brouillon: _ignoré, ...sansBrouillon } = demande
  const r = await appelerLePortail(configuration, 'POST', '/api/veille/courriel', sansBrouillon, 2_000_000)
  if ('refus' in r) throw new Error(`Refusé : ${r.refus}`)
  let corps: Composé
  try {
    corps = JSON.parse(r.corps) as Composé
  } catch {
    throw new Error(`le portail a répondu ${r.statut} sans JSON lisible`)
  }
  if (r.statut !== 200 || corps.état !== 'composé' || typeof corps.html !== 'string' || typeof corps.texte !== 'string' || typeof corps.objet !== 'string') {
    return { brouillon: 'non déposé', statut: r.statut, réponse: corps }
  }
  const { id, destinataires } = await créerBrouillon(configuration, { to, subject: corps.objet, body: corps.texte, htmlBody: corps.html })
  return {
    brouillon: 'déposé',
    id,
    destinataires,
    objet: corps.objet,
    octets: corps.octets,
    ...(corps.avertissement ? { avertissement: corps.avertissement } : {}),
  }
}

export async function listerBrouillons(configuration: ConfigurationDesOutils, maximum: number) {
  const liste = await appelerGmail(configuration, PORTÉES_GMAIL.brouillons, 'GET', `drafts?maxResults=${maximum}`)
  const brouillons = (liste['drafts'] as { id: string }[] | undefined) ?? []
  const détails = []
  for (const { id } of brouillons) {
    const d = await appelerGmail(configuration, PORTÉES_GMAIL.brouillons, 'GET', `drafts/${encodeURIComponent(id)}?format=metadata`)
    const message = d['message']
    détails.push({ id, to: enTête(message, 'To'), subject: enTête(message, 'Subject'), date: enTête(message, 'Date') })
  }
  configuration.journal(`Gmail list_drafts : ${détails.length}`)
  return détails
}

/**
 * Les messages envoyés depuis une date, en-têtes seulement. La portée
 * `gmail.metadata` refuse le paramètre `q` : on parcourt le libellé SENT, du plus
 * récent au plus ancien, et on s'arrête à la date demandée.
 */
export async function listerEnvoyés(configuration: ConfigurationDesOutils, depuis: string, plafond = 300) {
  const borne = Date.parse(`${depuis}T00:00:00Z`)
  if (Number.isNaN(borne)) throw new Error('date « depuis » illisible : AAAA-MM-JJ')
  const trouvés: { id: string; date: string; to: string; cc: string; subject: string }[] = []
  let page: string | undefined
  let lus = 0
  for (;;) {
    const liste = await appelerGmail(
      configuration,
      PORTÉES_GMAIL.métadonnées,
      'GET',
      `messages?labelIds=SENT&maxResults=50${page ? `&pageToken=${encodeURIComponent(page)}` : ''}`,
    )
    const messages = (liste['messages'] as { id: string }[] | undefined) ?? []
    let plusAncien = false
    for (const { id } of messages) {
      const m = await appelerGmail(
        configuration,
        PORTÉES_GMAIL.métadonnées,
        'GET',
        `messages/${encodeURIComponent(id)}?format=metadata&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Subject&metadataHeaders=Date`,
      )
      lus += 1
      const reçu = Number(m['internalDate'] ?? 0)
      if (reçu < borne) {
        plusAncien = true
        break
      }
      trouvés.push({ id, date: new Date(reçu).toISOString(), to: enTête(m, 'To'), cc: enTête(m, 'Cc'), subject: enTête(m, 'Subject') })
      if (lus >= plafond) break
    }
    page = liste['nextPageToken'] as string | undefined
    if (plusAncien || !page || lus >= plafond) break
  }
  configuration.journal(`Gmail list_sent_messages depuis ${depuis} : ${trouvés.length}`)
  return { messages: trouvés, tronqué: lus >= plafond }
}

/**
 * Le refus d'un envoi réel, ou `null`. Un destinataire absent vaut l'opératrice ;
 * toute autre adresse, même accompagnée de la sienne, est refusée.
 */
export function refusDEnvoi(to: string | readonly string[] | undefined): string | null {
  const destinataires = (typeof to === 'string' ? [to] : (to ?? [])).map((x) => x.trim().toLowerCase()).filter(Boolean)
  return destinataires.every((d) => d === DESTINATAIRE_OPÉRATRICE)
    ? null
    : `Refusé : seul ${DESTINATAIRE_OPÉRATRICE} reçoit un envoi réel. Pour un client, crée un brouillon (create_draft).`
}

/** Le seul envoi réel : à l'opératrice, et à elle seule. */
export async function envoyerÀLOpératrice(configuration: ConfigurationDesOutils, sujet: string, corps: string, html?: string) {
  if (!configuration.boîte) throw new Error('GMAIL_BOITE_OPERATRICE absent')
  if (/[\r\n]/.test(sujet)) throw new Error('objet sur plusieurs lignes refusé')
  const brut = composerMessage(
    { destinataire: DESTINATAIRE_OPÉRATRICE, sujet, texte: corps, ...(html ? { html } : {}) },
    configuration.boîte,
    configuration.nomExpéditeur,
  )
  const réponse = await appelerGmail(configuration, PORTÉES_GMAIL.envoi, 'POST', 'messages/send', {
    raw: Buffer.from(brut, 'utf8').toString('base64url'),
  })
  configuration.journal('Gmail send_message : opératrice')
  return { id: String(réponse['id'] ?? ''), to: DESTINATAIRE_OPÉRATRICE }
}

// ── Serveurs MCP ─────────────────────────────────────────────────────────────

const protéger = async (faire: () => Promise<unknown>): Promise<Résultat> => {
  try {
    return texte(await faire())
  } catch (e) {
    return erreur(e instanceof Error ? e.message : String(e))
  }
}

export function serveursDesOutils(configuration: ConfigurationDesOutils) {
  const gmail = createSdkMcpServer({
    name: SERVEURS.gmail,
    version: '1.0.0',
    tools: [
      tool(
        'create_draft',
        "Crée un brouillon Gmail dans la boîte de l'opératrice. Il n'est jamais envoyé : l'opératrice le relit et l'envoie elle-même. Ni cc ni bcc.",
        {
          to: z.union([z.string(), z.array(z.string())]).optional().describe('Destinataire(s) ; absent ou vide : brouillon sans destinataire'),
          subject: z.string(),
          body: z.string().describe('Version texte'),
          htmlBody: z.string().optional().describe('Version HTML, telle que la rend le portail'),
        },
        (a) =>
          protéger(() =>
            créerBrouillon(configuration, {
              to: (Array.isArray(a.to) ? a.to : a.to ? [a.to] : []).map((x) => x.trim()).filter(Boolean),
              subject: a.subject,
              body: a.body,
              ...(a.htmlBody ? { htmlBody: a.htmlBody } : {}),
            }),
          ),
      ),
      tool(
        'deposer_courriel',
        "Met un courriel client en forme par le portail (POST /api/veille/courriel, la demande telle que la page l'écrit : sorte « lettre », page, slug, organisation, objet ; ou sorte « message ») et le dépose en brouillon dans la boîte de l'opératrice. Le HTML ne t'est pas rendu : tu reçois l'identifiant du brouillon, l'objet et la taille. Une lettre non conforme n'est pas déposée et la réponse du portail t'est rendue. Rien n'est envoyé.",
        {
          demande: z.record(z.string(), z.unknown()).describe('Le corps de POST /api/veille/courriel'),
          to: z.union([z.string(), z.array(z.string())]).optional().describe('Destinataire(s) ; absent ou vide : brouillon sans destinataire'),
        },
        (a) =>
          protéger(() =>
            déposerUnCourriel(
              configuration,
              a.demande,
              (Array.isArray(a.to) ? a.to : a.to ? [a.to] : []).map((x) => x.trim()).filter(Boolean),
            ),
          ),
      ),
      tool(
        'list_drafts',
        "Liste les brouillons les plus récents de la boîte de l'opératrice (identifiant, destinataires, objet, date).",
        { maxResults: z.number().int().min(1).max(50).optional() },
        (a) => protéger(() => listerBrouillons(configuration, a.maxResults ?? 20)),
      ),
      tool(
        'send_message',
        `Envoie réellement un courriel à l'opératrice (${DESTINATAIRE_OPÉRATRICE}), et à elle seule : notifications de relecture, comptes rendus, alertes. Tout autre destinataire est refusé ; ce qui va à un client se dépose en brouillon.`,
        {
          to: z.union([z.string(), z.array(z.string())]).optional().describe(`Seule valeur admise : ${DESTINATAIRE_OPÉRATRICE}`),
          subject: z.string(),
          body: z.string(),
          htmlBody: z.string().optional(),
        },
        (a) => {
          const refus = refusDEnvoi(a.to)
          if (refus) {
            configuration.journal('refus Gmail send_message : destinataire autre que l’opératrice')
            return Promise.resolve(erreur(refus))
          }
          return protéger(() => envoyerÀLOpératrice(configuration, a.subject, a.body, a.htmlBody))
        },
      ),
      tool(
        'list_sent_messages',
        "Liste les messages ENVOYÉS de la boîte de l'opératrice depuis une date (AAAA-MM-JJ) : identifiant, date, destinataires, objet. En-têtes seulement : le corps n'est pas lisible, et aucune recherche par requête n'est possible. Filtre toi-même par destinataire et par objet.",
        { since: z.string().describe('AAAA-MM-JJ'), max: z.number().int().min(1).max(300).optional() },
        (a) => protéger(() => listerEnvoyés(configuration, a.since, a.max ?? 300)),
      ),
    ],
  })

  const portail = createSdkMcpServer({
    name: SERVEURS.portail,
    version: '1.0.0',
    tools: [
      tool(
        'appeler_portail',
        `Appelle le portail Signaux faibles (${configuration.portail}). Chemins admis : /api/veille/* et /api/acces/ouvrir, donnés tels que les pages les écrivent (adresse complète en www.) ou relatifs. L'autorisation est ajoutée par l'outil : n'en passe aucune. Rend le statut HTTP et le corps.`,
        {
          methode: z.enum(['GET', 'POST', 'PATCH']),
          chemin: z.string().describe('Par exemple /api/veille/calendrier ou https://www.signauxfaibles.io/api/veille/lint'),
          corps: z.unknown().optional().describe('Corps JSON, pour POST et PATCH'),
        },
        (a) =>
          protéger(async () => {
            const r = await appelerLePortail(configuration, a.methode, a.chemin, a.corps)
            if ('refus' in r) throw new Error(`Refusé : ${r.refus}`)
            return `statut : ${r.statut}\n\n${r.corps}`
          }),
      ),
    ],
  })

  const veille = createSdkMcpServer({
    name: SERVEURS.veille,
    version: '1.0.0',
    tools: [
      tool(
        'tirer_identifiant',
        "Tire un identifiant d'accès neuf : 32 caractères hexadécimaux d'un générateur cryptographique.",
        {},
        () => {
          configuration.journal('Veille tirer_identifiant')
          return Promise.resolve(texte(randomBytes(16).toString('hex')))
        },
      ),
      tool(
        'lire_sources',
        "Lit en code un lot de 1 à 30 URL (requête simple, puis navigateur pour celles qui refusent les robots), en quatre minutes au plus. Écrit le texte de chaque page ouverte dans sources/<lot>/NN-domaine.txt du dossier de travail et rend l'index du lot : une ligne de grille par source (OUVERTE avec la dernière date visible, NON OUVERTE avec la raison des deux essais, À RELANCER si l'échéance du lot est atteinte). Lis ensuite les fichiers utiles avec Read.",
        {
          lot: z.string().regex(/^[a-z0-9][a-z0-9-]{0,39}$/).describe('Nom court du lot, par exemple « concurrentiel-1 »'),
          urls: z.array(z.string().url()).min(1).max(30),
        },
        (a) =>
          protéger(async () => {
            const espace = configuration.espace
            if (!espace) throw new Error('dossier de travail inconnu')
            const urls = a.urls.filter((u) => !/(^|\.)signauxfaibles\.io$/.test(new URL(u).hostname))
            configuration.journal(`Veille lire_sources ${a.lot} : ${urls.length} URL`)
            const index = await lireLesUrls(urls, join(espace, 'sources', a.lot), { avecNavigateur: true, ...(configuration.fetch ? { fetch: configuration.fetch } : {}) })
            return `${index}\nFichiers : sources/${a.lot}/ dans le dossier de travail.`
          }),
      ),
      tool(
        'synthese_de_collecte',
        "Condense les grilles (grille/*.md) et les faits (faits/*.md) d'un dossier de collecte en une synthèse par lettre, synthese-concurrentiel.md et synthese-ecosysteme.md, écrites dans ce dossier. Rend les comptes ; signale les lignes de grille sans état, qui interdisent de rédiger.",
        { dossier: z.string().describe('Chemin du dossier de collecte, relatif au dossier de travail') },
        (a) =>
          protéger(async () => {
            const espace = configuration.espace
            if (!espace) throw new Error('dossier de travail inconnu')
            const cible = resolve(espace, a.dossier)
            if (!(cible + '/').startsWith(espace + '/')) throw new Error('dossier hors du dossier de travail')
            const { résumé, vides } = synthétiser(cible)
            configuration.journal(`Veille synthese_de_collecte : ${vides} ligne(s) vide(s)`)
            return vides ? `${résumé}\n${vides} ligne(s) de grille sans état : la collecte n'est pas terminée.` : résumé
          }),
      ),
    ],
  })

  return { [SERVEURS.gmail]: gmail, [SERVEURS.portail]: portail, [SERVEURS.veille]: veille }
}
