/**
 * Évaluation des modèles sur de vraies lettres, hors de tout compte de production.
 *
 *   pnpm evaluation:lettres generer [--organisation infralliance] [--veille ecosysteme]
 *                                    [--modele opus|sonnet] [--conception agentique|pipeline]
 *                                    [--effort high] [--parallele 4] [--a-blanc]
 *   pnpm evaluation:lettres valider --sortie evaluation/sorties/<horodatage>
 *
 * Ce que le script ne touche jamais : Notion (rien n'y est lu ni écrit), le
 * portail, Postgres, Gmail, l'abonnement Max. Il lit `evaluation/entrees/`
 * (exporté une fois, à la main, depuis Notion ; dossier ignoré par git) et
 * écrit `evaluation/sorties/<horodatage>/`. La clé API vient de
 * `EVALUATION_API_KEY` (ou `ANTHROPIC_API_KEY` sur un poste), celle d'une
 * organisation d'évaluation à part ; la variable `ANTHROPIC_BASE_URL` d'une
 * session Claude Code est ignorée, pour qu'un run ne parte jamais sur le quota
 * de la session.
 *
 * Deux conceptions sont mesurées. « agentique » : le modèle cherche et lit le
 * web lui-même, avec les outils serveur de recherche et de lecture ; chaque URL
 * citée doit avoir été ouverte pendant le run. « pipeline » : le code collecte
 * les sources nommées par le référentiel, les gèle sur disque, et le modèle
 * rédige en un seul appel à partir de ces extraits.
 *
 * Le prompt est celui de la production : les étapes 1 à 3 de la page Notion
 * « Tâche — Lettres de veille » (collecte, autocontrôle, tri, rédaction),
 * recopiées telles quelles ; seules les étapes que le portail ou Notion
 * tiennent (sélection du jour, publication, lint, envoi) sont remplacées par
 * ce script. Le validateur de production (`contrôlerLaLettre`) et le gabarit
 * courriel (`composerLettre`) jugent le résultat.
 */
import Anthropic from '@anthropic-ai/sdk'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { axesDuDocument, construireDocument, faitsDe } from '@/lib/domaine/document'
import { markdownVersBlocs } from '@/lib/domaine/markdown'
import { composerLettre } from '@/lib/email/lettre'
import { contrôlerLaLettre, type Rapport } from '@/lib/portail/lint'

// ── Constantes ───────────────────────────────────────────────────────────────

const RACINE = process.cwd()
const ENTRÉES = join(RACINE, 'evaluation', 'entrees')
const SORTIES = join(RACINE, 'evaluation', 'sorties')
const SOURCES = join(RACINE, 'evaluation', 'sources')
const PORTAIL_URL = 'https://www.signauxfaibles.io'
const DESTINATAIRE = 'agathe@signauxfaibles.io'
const ORGANISATIONS_PAR_DÉFAUT = ['infralliance', 'konica']

const MODÈLES = { opus: 'claude-opus-5-5', sonnet: 'claude-sonnet-5-5' } as const
type CléModèle = keyof typeof MODÈLES
type Conception = 'agentique' | 'pipeline'
type Veille = 'ecosysteme' | 'concurrentielle'

/** Dollars par million de jetons, tarifs API du 6 octobre 2026. */
const TARIFS: Record<string, { entrée: number; sortie: number; cacheLecture: number; cacheÉcriture: number }> = {
  'claude-opus-5-5': { entrée: 4, sortie: 20, cacheLecture: 0.2, cacheÉcriture: 5 },
  'claude-sonnet-5-5': { entrée: 2, sortie: 10, cacheLecture: 0.2, cacheÉcriture: 2.5 },
}
/** Dollars par recherche web côté serveur ; tarif à vérifier sur la page officielle. */
const TARIF_RECHERCHE = 0.01

const FAMILLES: Record<Veille, { famille: string; libellé: string }> = {
  ecosysteme: { famille: 'Écosystème', libellé: 'Écosystème' },
  concurrentielle: { famille: 'Concurrentiel', libellé: 'Concurrentiel' },
}

// ── Options de ligne de commande ─────────────────────────────────────────────

type Options = {
  commande: 'generer' | 'valider'
  organisations: string[]
  veilles: Veille[]
  modèles: CléModèle[]
  conceptions: Conception[]
  effort: 'low' | 'medium' | 'high' | 'xhigh'
  parallèle: number
  àBlanc: boolean
  sortie: string | null
  dateÉdition: string
}

function lireOptions(argv: string[]): Options {
  const [commande = 'generer', ...reste] = argv
  if (commande !== 'generer' && commande !== 'valider') {
    throw new Error(`Commande inconnue : ${commande}. Attendu : generer ou valider.`)
  }
  const valeurs = new Map<string, string>()
  const drapeaux = new Set<string>()
  for (let i = 0; i < reste.length; i += 1) {
    const mot = reste[i] ?? ''
    if (!mot.startsWith('--')) continue
    const suivant = reste[i + 1]
    if (suivant !== undefined && !suivant.startsWith('--')) {
      valeurs.set(mot.slice(2), suivant)
      i += 1
    } else {
      drapeaux.add(mot.slice(2))
    }
  }
  const liste = <T extends string>(clé: string, défaut: T[], admis: readonly T[]): T[] => {
    const brut = valeurs.get(clé)
    if (!brut) return défaut
    const choisis = brut.split(',').map((v) => v.trim()) as T[]
    for (const c of choisis) if (!admis.includes(c)) throw new Error(`Valeur inconnue pour --${clé} : ${c}`)
    return choisis
  }
  const organisationsDisponibles = existsSync(ENTRÉES)
    ? readdirSync(ENTRÉES, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)
    : []
  // Périmètre décidé le 22 octobre 2026 : Konica Minolta et Infralliance. Les autres
  // organisations exportées restent accessibles par --organisation.
  const organisationsParDéfaut = ORGANISATIONS_PAR_DÉFAUT.filter((o) => organisationsDisponibles.includes(o))
  return {
    commande,
    organisations: liste('organisation', organisationsParDéfaut, organisationsDisponibles),
    veilles: liste<Veille>('veille', ['ecosysteme', 'concurrentielle'], ['ecosysteme', 'concurrentielle']),
    modèles: liste<CléModèle>('modele', ['opus', 'sonnet'], ['opus', 'sonnet']),
    conceptions: liste<Conception>('conception', ['agentique'], ['agentique', 'pipeline']),
    effort: liste('effort', ['high'], ['low', 'medium', 'high', 'xhigh'])[0] ?? 'high',
    parallèle: Number(valeurs.get('parallele') ?? 4),
    àBlanc: drapeaux.has('a-blanc'),
    sortie: valeurs.get('sortie') ?? null,
    dateÉdition: valeurs.get('date-edition') ?? aujourdHui(),
  }
}

function aujourdHui(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' })
}

// ── Entrées ──────────────────────────────────────────────────────────────────

type ÉditionPrécédente = {
  titre: string
  date: string
  numero: number | null
  periode: string
  dossiers: string
  action: string
  url: string
}

type Organisation = { slug: string; nom: string; registreNotion: string | null }

type Dossier = {
  organisation: string
  portail: Organisation
  veille: Veille
  /** Le nom client de la veille (Écosystème, Positionnement…), lu sur la dernière édition publiée. */
  libelléVeille: string
  fiche: string
  référentiel: string
  dernièresÉditions: ÉditionPrécédente[]
  dernièreLettre: string
  numéro: number
  période: { début: string; fin: string }
}

function lireTexte(chemin: string, obligatoire = true): string {
  if (!existsSync(chemin)) {
    if (obligatoire) throw new Error(`Entrée absente : ${chemin}. Exporter d'abord depuis Notion (docs/evaluation-modeles.md).`)
    return ''
  }
  return readFileSync(chemin, 'utf8')
}

function organisationDuPortail(dossier: string): Organisation {
  const chemin = join(ENTRÉES, 'organisations.json')
  const toutes = existsSync(chemin) ? (JSON.parse(readFileSync(chemin, 'utf8')) as Organisation[]) : []
  const clé = dossier.replace(/-/g, '').toLowerCase()
  const trouvée = toutes.find((o) => {
    const nom = o.nom.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/gi, '').toLowerCase()
    const slug = o.slug.replace(/-/g, '').toLowerCase()
    return slug.includes(clé) || clé.includes(slug) || nom.includes(clé) || (clé === 'petitevitrine' && nom.includes('vitrine'))
  })
  return trouvée ?? { slug: dossier, nom: dossier, registreNotion: null }
}

function lireDossier(organisation: string, veille: Veille, dateÉdition: string): Dossier {
  const base = join(ENTRÉES, organisation, veille)
  const référentiel = lireTexte(join(base, 'referentiel.md'))
  const fiche = lireTexte(join(ENTRÉES, organisation, 'fiche.md'), false)
  const brut = lireTexte(join(base, 'dernieres-editions.json'), false)
  const dernièresÉditions = brut ? (JSON.parse(brut) as ÉditionPrécédente[]) : []
  const dernièreLettre = lireTexte(join(base, 'derniere-lettre.md'), false)
  const plusRécente = dernièresÉditions[0]
  const numéro = (plusRécente?.numero ?? 0) + 1
  // Fenêtre nominale : depuis le lendemain de la dernière édition publiée, au moins
  // sept jours (une lettre de test produite le lendemain d'une parution couvrirait
  // sinon une journée), au plus quatorze.
  const depuisLaDernière = plusRécente?.date ? lendemain(plusRécente.date) : reculer(dateÉdition, 7)
  const auMoinsSeptJours = reculer(dateÉdition, 7)
  const auPlusQuatorze = reculer(dateÉdition, 14)
  let début = plusAncienne(depuisLaDernière, auMoinsSeptJours) ? depuisLaDernière : auMoinsSeptJours
  if (plusAncienne(début, auPlusQuatorze)) début = auPlusQuatorze
  const période = { début, fin: dateÉdition }
  return {
    organisation,
    portail: organisationDuPortail(organisation),
    veille,
    libelléVeille: libelléDeVeille(plusRécente?.url) ?? FAMILLES[veille].libellé,
    fiche,
    référentiel,
    dernièresÉditions,
    dernièreLettre,
    numéro,
    période,
  }
}

/** La propriété « Veille » de l'édition publiée, telle que le client la voit. */
function libelléDeVeille(url: string | undefined): string | null {
  if (!url) return null
  const chemin = join(ENTRÉES, 'editions-publiees.json')
  if (!existsSync(chemin)) return null
  const brut = JSON.parse(readFileSync(chemin, 'utf8')) as unknown
  const lignes = (Array.isArray(brut)
    ? brut
    : ((brut as Record<string, unknown>)['rows'] ?? (brut as Record<string, unknown>)['results'] ?? (brut as Record<string, unknown>)['data'] ?? [])) as Array<
    Record<string, unknown>
  >
  const identifiant = url.replace(/-/g, '').slice(-32)
  const ligne = lignes.find((l) => typeof l['url'] === 'string' && (l['url'] as string).replace(/-/g, '').endsWith(identifiant))
  return typeof ligne?.['Veille'] === 'string' ? (ligne['Veille'] as string) : null
}

function lendemain(date: string): string {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}
function reculer(date: string, jours: number): string {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - jours)
  return d.toISOString().slice(0, 10)
}
/** `true` si `a` est avant `b` : une fenêtre ne remonte jamais au-delà de quatorze jours. */
function plusAncienne(a: string, b: string): boolean {
  return a < b
}

function dateLongue(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Paris',
  })
}

// ── Prompt ───────────────────────────────────────────────────────────────────

/** Les étapes 1 à 3 du prompt de production, recopiées de la page Notion exportée. */
function étapesDeProduction(): string {
  const page = lireTexte(join(ENTRÉES, 'tache-lettres-de-veille.md'))
  const début = page.indexOf('ÉTAPE 1 — COLLECTE')
  const fin = page.indexOf('ÉTAPE 4 — PUBLICATION')
  if (début < 0 || fin < 0) throw new Error('La page « Tâche — Lettres de veille » exportée ne porte pas les étapes 1 à 4.')
  return `════════ ${page.slice(début, fin).trim()}`
}

function préambule(conception: Conception): string {
  const outils =
    conception === 'agentique'
      ? `OUTILS. Tu disposes de deux outils : la recherche web et la lecture d'une page par son
URL. « Ouvrir une source » veut dire la lire avec l'outil de lecture pendant ce run ;
une URL rendue par la recherche mais non lue n'a pas été ouverte. Toute URL citée dans la
lettre doit avoir été lue par l'outil de lecture pendant ce run. Les sources marquées
« ACCÈS NAVIGATEUR REQUIS » et celles qui refusent la lecture sont « non ouvertes », avec
la raison. Tu n'as ni navigateur, ni Gmail, ni la base « Extraits fournis » : ces deux
canaux d'entrée sont « non consultés pendant ce run », et la note de méthode le dit en
une ligne, sans rien inventer à leur place.`
      : `SOURCES. Tu n'as aucun outil. Les seules sources de ce run sont les extraits gelés
fournis plus bas, chacun avec son URL, sa date de lecture et son état. Une source absente
des extraits, ou présente avec un état d'échec, est « non ouverte pendant ce run », avec
la raison donnée par l'état. Tu ne cites jamais une URL qui n'est pas dans les extraits.
Tu n'as ni Gmail ni la base « Extraits fournis » : ces canaux sont « non consultés pendant
ce run », et la note de méthode le dit en une ligne.`

  return `Tu es l'agent de veille du cabinet Signaux faibles. Tu produis UNE édition : celle de
la veille désignée dans les paramètres, pour l'organisation désignée. Tu écris en
français.

Tu ne produis aucune donnée que tu n'as pas lue dans une page ouverte pendant ce run.

CE QUE CE RUN A DE PARTICULIER. C'est une édition de test, produite hors du dispositif :
elle ne sera ni publiée dans Notion ni affichée dans l'espace du client, elle sera relue
par la relectrice. Rien ne change pour autant à la rigueur : la lettre doit pouvoir
partir telle quelle. La sélection du jour, le numéro, la période et les dernières
éditions te sont DONNÉS dans les paramètres : tu ne recalcules rien (ce que l'étape 0 du
dispositif fait d'ordinaire par le portail). Tu ne publies rien dans Notion, tu ne mets à
jour aucun référentiel, tu n'appelles aucune route du portail et tu n'envoies rien : les
étapes 4 à 7 du dispositif sont tenues par le programme qui t'a lancé. Les propositions
de modification des référentiels vont dans la propriété « Amendements au référentiel »
de ta réponse et dans le bloc d'ajustements de la lettre, comme d'habitude.

${outils}

LA RÈGLE DE FRONTIÈRE s'applique : tu rédiges la veille désignée seulement ; l'autre
veille de la même organisation est produite dans un autre run. Les deux référentiels
peuvent être cités dans la fiche, mais seul celui fourni ci-dessous est le tien.

FORMAT DE LA RÉPONSE, obligatoire. Ta réponse finale se compose de deux blocs, et de rien
d'autre après le second :

<proprietes>
{ "titre": "Veille <Organisation> — <Veille> — <jour date>",
  "periodeCouverte": "…",
  "fenetreElargie": false,
  "dossiersOuvertsSuivis": "nom (compteur, précision) · nom (compteur) · …",
  "actionDeLaSemaine": "…",
  "amendementsAuReferentiel": "…" }
</proprietes>

<lettre>
…le corps de la lettre en Markdown…
</lettre>

Le JSON de <proprietes> est strict (guillemets doubles, pas de commentaire). Le titre
reprend la forme des titres des dernières éditions. « dossiersOuvertsSuivis » suit
EXACTEMENT le format « nom (compteur, précision) · nom (compteur) », les noms écrits
comme dans le corps de la lettre.

DIALECTE MARKDOWN DU CORPS, lu par le portail tel quel :
  · rubriques : titres de niveau 1 (« # L'essentiel », « # Actualités par axe », …) ;
  · axes : titres de niveau 2 « ## ① Nom de l'axe — FORT », « — MOYEN » ou « — RAS »,
    sous « # Actualités par axe » ; le tiret est un tiret cadratin (—) ;
  · ENCADRÉ (callout Notion) : chaque ligne du bloc commence par « > » ; un bloc par
    constat ; c'est là que vont la note de méthode, les RAS motivés, les sources non
    ouvertes, les requêtes non lancées, les réserves ;
  · paragraphes séparés par une ligne vide ; puces « - » ; listes « 1. » ;
  · gras **ainsi**, italique *ainsi*, liens [nom](URL) ;
  · le bloc « Ajustements du cadrage de cette veille » est suivi d'une ligne « --- » ;
  · aucun titre de niveau 3 dans « L'essentiel », aucun encadré ni tableau dedans.

Les étapes 1 à 3 du dispositif suivent, recopiées de la page « Tâche — Lettres de
veille » ; là où elles nomment une étape 0, 4, 4bis, 5 ou 6, un appel au portail, Notion,
Gmail ou la base « Extraits fournis », ce qui précède s'applique.

`
}

type Extrait = { url: string; état: string; lu_le: string; caractères: number; texte: string }

function messageUtilisateur(dossier: Dossier, dateÉdition: string, extraits: Extrait[] | null): string {
  const { famille } = FAMILLES[dossier.veille]
  const libellé = dossier.libelléVeille
  const paramètres = {
    organisation: dossier.portail.nom,
    slugDuPortail: dossier.portail.slug,
    veille: libellé,
    familleInterne: famille,
    numéroÀÉcrire: dossier.numéro,
    dateDÉdition: dateÉdition,
    dateDÉditionEnToutesLettres: dateLongue(dateÉdition),
    périodeNominale: `du ${dateLongue(dossier.période.début)} au ${dateLongue(dossier.période.fin)}`,
    aujourdHui: dateLongue(aujourdHui()),
    éditionNuméroUn: dossier.numéro === 1,
  }
  const parties = [
    `<parametres>\n${JSON.stringify(paramètres, null, 2)}\n</parametres>`,
    dossier.fiche ? `<fiche_organisation>\n${dossier.fiche}\n</fiche_organisation>` : '',
    `<referentiel>\n${dossier.référentiel}\n</referentiel>`,
    `<dernieres_editions>\n${JSON.stringify(dossier.dernièresÉditions, null, 2)}\n</dernieres_editions>`,
    dossier.dernièreLettre
      ? `<derniere_lettre_publiee>\n${dossier.dernièreLettre.slice(0, 60_000)}\n</derniere_lettre_publiee>`
      : '',
  ]
  if (extraits) {
    const blocs = extraits.map(
      (e, i) =>
        `<extrait n="${i + 1}" url="${e.url}" etat="${e.état}" lu_le="${e.lu_le}" caracteres="${e.caractères}">\n${e.texte}\n</extrait>`,
    )
    parties.push(`<sources_gelees>\n${blocs.join('\n\n')}\n</sources_gelees>`)
  }
  parties.push(
    `Produis maintenant l'édition n° ${dossier.numéro} de la veille « ${libellé} » de ${dossier.portail.nom}, ` +
      `datée du ${dateLongue(dateÉdition)}, en appliquant les étapes 1 à 3 puis le format de réponse.`,
  )
  return parties.filter((p) => p.length > 0).join('\n\n')
}

// ── Collecte gelée (conception pipeline) ─────────────────────────────────────

async function collecterSources(dossier: Dossier, date: string): Promise<Extrait[]> {
  const répertoire = join(SOURCES, dossier.organisation, dossier.veille, date)
  const manifeste = join(répertoire, 'manifeste.json')
  if (existsSync(manifeste)) return JSON.parse(readFileSync(manifeste, 'utf8')) as Extrait[]
  mkdirSync(répertoire, { recursive: true })

  const urls = [...new Set([...dossier.référentiel.matchAll(/https?:\/\/[^\s)\]>"']+/g)].map((m) => m[0].replace(/[.,;:]+$/, '')))]
    .filter((u) => !/notion\.(so|com)/.test(u))
    .slice(0, 60)

  const extraits: Extrait[] = []
  let n = 0
  for (const url of urls) {
    n += 1
    const extrait = await lireSource(url)
    extraits.push(extrait)
    writeFileSync(join(répertoire, `${String(n).padStart(2, '0')}.txt`), `${url}\n${extrait.état}\n\n${extrait.texte}`)
    process.stderr.write(`  source ${n}/${urls.length} ${extrait.état} ${url}\n`)
  }
  writeFileSync(manifeste, JSON.stringify(extraits, null, 2))
  return extraits
}

async function lireSource(url: string): Promise<Extrait> {
  const lu_le = new Date().toISOString()
  const contrôleur = new AbortController()
  const minuterie = setTimeout(() => contrôleur.abort(), 20_000)
  try {
    const réponse = await fetch(url, {
      signal: contrôleur.signal,
      redirect: 'follow',
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; signauxfaibles-evaluation/1.0)', accept: 'text/html,text/plain,*/*' },
    })
    const type = réponse.headers.get('content-type') ?? ''
    if (!réponse.ok) return { url, état: `http-${réponse.status}`, lu_le, caractères: 0, texte: '' }
    if (!/text\/|xml|json/.test(type)) return { url, état: `type-${type.split(';')[0]}`, lu_le, caractères: 0, texte: '' }
    const brut = await réponse.text()
    const texte = versTexte(brut).slice(0, 6_000)
    return { url, état: 'ouverte', lu_le, caractères: texte.length, texte }
  } catch (erreur) {
    const code = erreur instanceof Error && erreur.name === 'AbortError' ? 'delai' : 'reseau'
    return { url, état: code, lu_le, caractères: 0, texte: '' }
  } finally {
    clearTimeout(minuterie)
  }
}

function versTexte(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|head)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|li|h[1-6]|tr|section|article)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim()
}

// ── Appel du modèle ──────────────────────────────────────────────────────────

type Usage = {
  entrée: number
  sortie: number
  cacheLecture: number
  cacheÉcriture: number
  recherches: number
}

type Résultat = {
  organisation: string
  veille: Veille
  libelléVeille: string
  numéro: number
  dateÉdition: string
  modèle: string
  conception: Conception
  effort: string
  tours: number
  stopReason: string | null
  modèleServi: string | null
  usage: Usage
  coût: number
  durée_s: number
  urlsOuvertes: string[]
  urlsDemandées: string[]
  texte: string
}

/**
 * La clé se lit dans `EVALUATION_API_KEY` d'abord : un environnement cloud de
 * Claude Code refuse une variable nommée `ANTHROPIC_API_KEY` (« ne sera pas
 * utilisé pour authentifier les requêtes »), réservée à la session elle-même.
 * `ANTHROPIC_API_KEY` reste acceptée pour un lancement depuis un poste.
 */
function client(): Anthropic {
  const apiKey = process.env['EVALUATION_API_KEY'] || process.env['ANTHROPIC_API_KEY']
  if (!apiKey) {
    throw new Error(
      "EVALUATION_API_KEY est absente (ANTHROPIC_API_KEY aussi). Poser la clé d'une organisation " +
        "d'évaluation à part sous le nom EVALUATION_API_KEY ; le script refuse de partir sur un autre " +
        'identifiant, et ignore ANTHROPIC_BASE_URL.',
    )
  }
  return new Anthropic({ apiKey, baseURL: process.env['EVALUATION_BASE_URL'] ?? 'https://api.anthropic.com', maxRetries: 3 })
}

function ajouterUsage(total: Usage, u: unknown): void {
  const usage = (u ?? {}) as {
    input_tokens?: number
    output_tokens?: number
    cache_read_input_tokens?: number | null
    cache_creation_input_tokens?: number | null
    server_tool_use?: { web_search_requests?: number } | null
  }
  total.entrée += usage.input_tokens ?? 0
  total.sortie += usage.output_tokens ?? 0
  total.cacheLecture += usage.cache_read_input_tokens ?? 0
  total.cacheÉcriture += usage.cache_creation_input_tokens ?? 0
  total.recherches += usage.server_tool_use?.web_search_requests ?? 0
}

function coûtDe(modèle: string, usage: Usage): number {
  const t = TARIFS[modèle] ?? TARIFS['claude-opus-5-5']!
  return (
    (usage.entrée * t.entrée + usage.sortie * t.sortie + usage.cacheLecture * t.cacheLecture + usage.cacheÉcriture * t.cacheÉcriture) /
      1_000_000 +
    usage.recherches * TARIF_RECHERCHE
  )
}

function urlsDesBlocs(content: readonly unknown[], ouvertes: Set<string>, demandées: Set<string>): void {
  for (const bloc of content as Array<Record<string, unknown>>) {
    if (bloc['type'] === 'server_tool_use') {
      const input = bloc['input'] as { url?: string } | undefined
      if (input?.url) demandées.add(input.url)
    }
    if (bloc['type'] === 'web_fetch_tool_result') {
      const contenu = bloc['content'] as { type?: string; url?: string } | undefined
      if (contenu?.type === 'web_fetch_result' && contenu.url) ouvertes.add(contenu.url)
    }
  }
}

async function générer(
  anthropic: Anthropic,
  dossier: Dossier,
  modèle: string,
  conception: Conception,
  effort: Options['effort'],
  dateÉdition: string,
  extraits: Extrait[] | null,
): Promise<Résultat> {
  const système = préambule(conception) + étapesDeProduction()
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: 'user', content: messageUtilisateur(dossier, dateÉdition, extraits) }]
  const outils: unknown[] =
    conception === 'agentique'
      ? [
          {
            type: 'web_search_20260209',
            name: 'web_search',
            max_uses: 60,
            user_location: { type: 'approximate', country: 'FR', city: 'Paris', timezone: 'Europe/Paris' },
          },
          { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 90, max_content_tokens: 25_000 },
        ]
      : []

  const usage: Usage = { entrée: 0, sortie: 0, cacheLecture: 0, cacheÉcriture: 0, recherches: 0 }
  const ouvertes = new Set<string>()
  const demandées = new Set<string>()
  const début = Date.now()
  let tours = 0
  let réponse: Anthropic.Beta.BetaMessage | null = null

  while (tours < 40) {
    tours += 1
    const paramètres = {
      model: modèle,
      max_tokens: 40_000,
      system: [{ type: 'text', text: système, cache_control: { type: 'ephemeral' } }],
      messages,
      tools: outils,
      output_config: { effort },
    } as unknown as Parameters<typeof anthropic.beta.messages.stream>[0]
    réponse = await anthropic.beta.messages.stream(paramètres).finalMessage()
    ajouterUsage(usage, réponse.usage)
    urlsDesBlocs(réponse.content, ouvertes, demandées)
    if (réponse.stop_reason !== 'pause_turn') break
    messages.push({ role: 'assistant', content: réponse.content })
  }

  if (!réponse) throw new Error('Aucune réponse du modèle.')
  const texte = réponse.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')

  return {
    organisation: dossier.organisation,
    veille: dossier.veille,
    libelléVeille: dossier.libelléVeille,
    numéro: dossier.numéro,
    dateÉdition,
    modèle,
    conception,
    effort,
    tours,
    stopReason: réponse.stop_reason,
    modèleServi: réponse.model,
    usage,
    coût: coûtDe(modèle, usage),
    durée_s: Math.round((Date.now() - début) / 1000),
    urlsOuvertes: [...ouvertes],
    urlsDemandées: [...demandées],
    texte,
  }
}

// ── Validation et rendu ──────────────────────────────────────────────────────

type Propriétés = {
  titre: string
  periodeCouverte: string
  fenetreElargie: boolean
  dossiersOuvertsSuivis: string
  actionDeLaSemaine: string
  amendementsAuReferentiel: string
}

function séparer(texte: string): { propriétés: Propriétés | null; lettre: string; erreur: string | null } {
  const p = /<proprietes>([\s\S]*?)<\/proprietes>/i.exec(texte)
  const l = /<lettre>([\s\S]*?)<\/lettre>/i.exec(texte)
  let propriétés: Propriétés | null = null
  let erreur: string | null = null
  if (p?.[1]) {
    try {
      propriétés = JSON.parse(p[1].trim()) as Propriétés
    } catch (e) {
      erreur = `propriétés illisibles : ${e instanceof Error ? e.message : String(e)}`
    }
  } else {
    erreur = 'bloc <proprietes> absent'
  }
  const lettre = l?.[1]?.trim() ?? texte.replace(/<proprietes>[\s\S]*?<\/proprietes>/i, '').trim()
  if (!l) erreur = `${erreur ? `${erreur} ; ` : ''}bloc <lettre> absent, texte entier pris pour la lettre`
  return { propriétés, lettre, erreur }
}

function normaliserUrl(u: string): string {
  return u
    .trim()
    .replace(/[.,;:)\]]+$/, '')
    .replace(/^http:\/\//, 'https://')
    .replace(/^https:\/\/www\./, 'https://')
    .replace(/\/$/, '')
    .toLowerCase()
}

type Validation = {
  conforme: boolean
  ruptures: Rapport['ruptures']
  avertissements: Rapport['avertissements']
  axes: Rapport['aperçu']['axes']
  dossiers: number
  dossiersNommés: number
  faits: number
  mots: number
  urlsCitées: number
  urlsCitéesNonOuvertes: string[]
  erreurDeFormat: string | null
}

function valider(résultat: Résultat, extraits: Extrait[] | null): { validation: Validation; propriétés: Propriétés; lettre: string; html: string; texte: string; objet: string } {
  const { propriétés: lues, lettre, erreur } = séparer(résultat.texte)
  const propriétés: Propriétés = lues ?? {
    titre: `Veille ${résultat.organisation} — ${résultat.libelléVeille}`,
    periodeCouverte: '',
    fenetreElargie: false,
    dossiersOuvertsSuivis: '',
    actionDeLaSemaine: '',
    amendementsAuReferentiel: '',
  }
  const blocs = markdownVersBlocs(lettre)
  const rapport = contrôlerLaLettre({ titre: propriétés.titre, blocs, dossiersBruts: propriétés.dossiersOuvertsSuivis, numéro: résultat.numéro })
  const document = construireDocument(blocs)
  const axes = axesDuDocument(document)
  const faits = axes.flatMap((a) => faitsDe(a.blocs)).filter((b) => b.type === 'paragraphe').length

  const citées = [...new Set([...lettre.matchAll(/https?:\/\/[^\s)\]>"']+/g)].map((m) => normaliserUrl(m[0])))]
  const connues = new Set(
    (extraits ? extraits.filter((e) => e.état === 'ouverte').map((e) => e.url) : résultat.urlsOuvertes).map(normaliserUrl),
  )
  const nonOuvertes = citées.filter((u) => !connues.has(u) && !u.includes('signauxfaibles.io'))

  const organisation = organisationDuPortail(résultat.organisation)
  const modèleCourt = résultat.modèle.replace('claude-', '')
  const objet = `[TEST] ${propriétés.titre} · ${modèleCourt} · ${résultat.conception}`
  const { html, texte } = composerLettre({
    objet,
    édition: {
      pageId: 'evaluation',
      titre: propriétés.titre,
      veille: résultat.libelléVeille,
      numéro: résultat.numéro,
      dateÉdition: résultat.dateÉdition,
      périodeCouverte: propriétés.periodeCouverte ?? '',
    },
    blocs,
    slug: organisation.slug,
    organisation: organisation.nom,
    portailUrl: PORTAIL_URL,
    adressePostale: null,
  })

  return {
    validation: {
      conforme: rapport.conforme,
      ruptures: rapport.ruptures,
      avertissements: rapport.avertissements,
      axes: rapport.aperçu.axes,
      dossiers: rapport.aperçu.dossiers.length,
      dossiersNommés: rapport.aperçu.dossiers.filter((d) => d.nommé).length,
      faits,
      mots: lettre.split(/\s+/).filter((m) => m.length > 0).length,
      urlsCitées: citées.length,
      urlsCitéesNonOuvertes: nonOuvertes,
      erreurDeFormat: erreur,
    },
    propriétés,
    lettre,
    html,
    texte,
    objet,
  }
}

// ── Rapport ──────────────────────────────────────────────────────────────────

type Ligne = { résultat: Résultat; validation: Validation; objet: string; chemin: string }

function écrireRapport(racine: string, lignes: Ligne[]): void {
  const enTête =
    '| Organisation | Veille | Modèle | Conception | Conforme | Ruptures | Avertissements | Faits | Dossiers nommés | URL citées non ouvertes | Mots | Coût ($) | Durée | Tours |\n' +
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|\n'
  const corps = lignes
    .map(({ résultat: r, validation: v }) =>
      `| ${r.organisation} | ${r.veille} | ${r.modèle.replace('claude-', '')} | ${r.conception} | ${v.conforme ? 'oui' : 'NON'} | ` +
      `${v.ruptures.map((x) => x.code).join(', ') || '0'} | ${v.avertissements.map((x) => x.code).join(', ') || '0'} | ${v.faits} | ` +
      `${v.dossiersNommés}/${v.dossiers} | ${v.urlsCitéesNonOuvertes.length}/${v.urlsCitées} | ${v.mots} | ${r.coût.toFixed(2)} | ${Math.round(r.durée_s / 60)} min | ${r.tours} |`,
    )
    .join('\n')
  const total = lignes.reduce((s, l) => s + l.résultat.coût, 0)
  const grille = lignes
    .map(({ résultat: r, objet, chemin }) =>
      `- [ ] ${objet}\n  - publiable telle quelle : oui / non\n  - si non, ce qui manque (fait faux, source inventée, forme, ton, volume) : \n  - fichiers : ${chemin}\n  - modèle servi : ${r.modèleServi ?? '?'} ; arrêt : ${r.stopReason ?? '?'}`,
    )
    .join('\n')
  const texte =
    `# Évaluation des modèles sur lettres de test\n\n` +
    `Produit le ${new Date().toISOString()}. ${lignes.length} lettres, coût total estimé ${total.toFixed(2)} $ ` +
    `(tarifs API du 6 octobre 2026, recherche web comptée ${TARIF_RECHERCHE} $ l'unité, à vérifier).\n\n` +
    `## Mesures mécaniques\n\n${enTête}${corps}\n\n` +
    `« Faits » : paragraphes hors encadrés sous les axes. « URL citées non ouvertes » : URL présentes dans la lettre ` +
    `qui n'ont pas été lues par l'outil de lecture pendant le run (ou absentes des extraits gelés en pipeline) : ` +
    `c'est la mesure d'hallucination de source, à lire en premier.\n\n` +
    `## Grille de relecture à l'aveugle\n\n` +
    `Lire chaque lettre depuis son fichier courriel.html sans regarder le nom du modèle, puis cocher.\n\n${grille}\n`
  writeFileSync(join(racine, 'rapport.md'), texte)

  const lignesHtml = lignes
    .map(
      ({ résultat: r, validation: v, objet }) =>
        `<tr><td>${échapper(objet)}</td><td>${v.conforme ? 'oui' : '<b>non</b>'}</td><td>${échapper(v.ruptures.map((x) => x.code).join(', ') || '0')}</td>` +
        `<td>${échapper(v.avertissements.map((x) => x.code).join(', ') || '0')}</td><td>${v.faits}</td><td>${v.dossiersNommés}/${v.dossiers}</td>` +
        `<td>${v.urlsCitéesNonOuvertes.length}/${v.urlsCitées}</td><td>${v.mots}</td><td>${r.coût.toFixed(2)} $</td><td>${Math.round(r.durée_s / 60)} min</td></tr>`,
    )
    .join('')
  const html =
    `<!doctype html><html lang="fr"><meta charset="utf-8"><title>Récapitulatif des lettres de test</title>` +
    `<body style="font-family:sans-serif;font-size:14px;line-height:1.4"><h1 style="font-size:18px">Lettres de test : récapitulatif</h1>` +
    `<p>${lignes.length} lettres produites, coût total estimé ${total.toFixed(2)} $. Chaque lettre est arrivée dans un courriel séparé, sujet préfixé [TEST].</p>` +
    `<table border="1" cellpadding="6" style="border-collapse:collapse;font-size:13px"><tr><th>Lettre</th><th>Conforme</th><th>Ruptures</th><th>Avertissements</th><th>Faits</th><th>Dossiers nommés</th><th>URL citées non ouvertes</th><th>Mots</th><th>Coût</th><th>Durée</th></tr>${lignesHtml}</table>` +
    `<h2 style="font-size:16px">Comment lire</h2><ul><li><b>URL citées non ouvertes</b> : des sources citées que le modèle n'a pas lues pendant le run. C'est la mesure d'hallucination ; zéro est la cible.</li>` +
    `<li><b>Ruptures</b> : la lettre ne passerait pas le validateur du portail ; le tableau de bord serait vide ou faux.</li>` +
    `<li><b>Grille</b> : pour chaque lettre, « publiable telle quelle : oui / non », et sinon ce qui manque. C'est la seule mesure qui compte pour évacuer la relecture.</li></ul></body></html>`
  writeFileSync(join(racine, 'recapitulatif.html'), html)
}

function échapper(t: string): string {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// ── Orchestration ────────────────────────────────────────────────────────────

async function enParallèle<T>(tâches: Array<() => Promise<T>>, limite: number): Promise<T[]> {
  const résultats: T[] = []
  let indice = 0
  const ouvriers = Array.from({ length: Math.max(1, limite) }, async () => {
    while (indice < tâches.length) {
      const i = indice
      indice += 1
      résultats[i] = await tâches[i]!()
    }
  })
  await Promise.all(ouvriers)
  return résultats
}

async function commandeGenerer(options: Options): Promise<void> {
  const horodatage = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const racine = join(SORTIES, horodatage)
  mkdirSync(racine, { recursive: true })
  const anthropic = options.àBlanc ? null : client()

  const travaux: Array<{ dossier: Dossier; modèle: string; conception: Conception }> = []
  for (const organisation of options.organisations) {
    for (const veille of options.veilles) {
      const chemin = join(ENTRÉES, organisation, veille, 'referentiel.md')
      if (!existsSync(chemin)) {
        process.stderr.write(`ignoré : ${organisation}/${veille} (pas de référentiel exporté)\n`)
        continue
      }
      const dossier = lireDossier(organisation, veille, options.dateÉdition)
      for (const modèle of options.modèles) for (const conception of options.conceptions) travaux.push({ dossier, modèle: MODÈLES[modèle], conception })
    }
  }
  process.stderr.write(`${travaux.length} lettres à produire → ${racine}\n`)

  const extraitsParDossier = new Map<string, Extrait[]>()
  for (const { dossier, conception } of travaux) {
    if (conception !== 'pipeline') continue
    const clé = `${dossier.organisation}/${dossier.veille}`
    if (!extraitsParDossier.has(clé)) {
      process.stderr.write(`collecte gelée ${clé}\n`)
      extraitsParDossier.set(clé, await collecterSources(dossier, options.dateÉdition))
    }
  }

  const lignes: Ligne[] = []
  await enParallèle(
    travaux.map(({ dossier, modèle, conception }) => async () => {
      const extraits = conception === 'pipeline' ? (extraitsParDossier.get(`${dossier.organisation}/${dossier.veille}`) ?? []) : null
      const répertoire = join(racine, dossier.organisation, dossier.veille, `${modèle.replace('claude-', '')}-${conception}`)
      mkdirSync(répertoire, { recursive: true })
      const système = préambule(conception) + étapesDeProduction()
      const utilisateur = messageUtilisateur(dossier, options.dateÉdition, extraits)
      writeFileSync(join(répertoire, 'prompt-systeme.txt'), système)
      writeFileSync(join(répertoire, 'prompt-utilisateur.txt'), utilisateur)
      if (!anthropic) {
        process.stderr.write(`à blanc : ${répertoire} (système ${système.length} car., utilisateur ${utilisateur.length} car.)\n`)
        return
      }
      process.stderr.write(`début ${dossier.organisation}/${dossier.veille} ${modèle} ${conception}\n`)
      try {
        const résultat = await générer(anthropic, dossier, modèle, conception, options.effort, options.dateÉdition, extraits)
        writeFileSync(join(répertoire, 'reponse.json'), JSON.stringify({ ...résultat, texte: undefined }, null, 2))
        writeFileSync(join(répertoire, 'reponse-brute.md'), résultat.texte)
        const { validation, propriétés, lettre, html, texte, objet } = valider(résultat, extraits)
        writeFileSync(join(répertoire, 'lettre.md'), lettre)
        writeFileSync(join(répertoire, 'proprietes.json'), JSON.stringify(propriétés, null, 2))
        writeFileSync(join(répertoire, 'validation.json'), JSON.stringify(validation, null, 2))
        writeFileSync(join(répertoire, 'courriel.html'), html)
        writeFileSync(join(répertoire, 'courriel.txt'), texte)
        writeFileSync(join(répertoire, 'courriel.json'), JSON.stringify({ objet, destinataire: DESTINATAIRE }, null, 2))
        lignes.push({ résultat, validation, objet, chemin: répertoire })
        process.stderr.write(
          `fin   ${dossier.organisation}/${dossier.veille} ${modèle} ${conception} : ${validation.conforme ? 'conforme' : 'NON conforme'}, ` +
            `${validation.faits} faits, ${validation.urlsCitéesNonOuvertes.length} URL non ouvertes, ${résultat.coût.toFixed(2)} $, ${résultat.durée_s} s\n`,
        )
      } catch (erreur) {
        writeFileSync(join(répertoire, 'erreur.txt'), erreur instanceof Error ? `${erreur.message}\n${erreur.stack ?? ''}` : String(erreur))
        process.stderr.write(`ÉCHEC ${répertoire} : ${erreur instanceof Error ? erreur.message : String(erreur)}\n`)
      }
    }),
    options.parallèle,
  )

  if (anthropic) {
    écrireRapport(racine, lignes)
    process.stderr.write(`rapport : ${join(racine, 'rapport.md')}\n`)
  }
}

/** Rejoue validation et rendu sur une sortie existante (après une correction du convertisseur ou du validateur). */
function commandeValider(options: Options): void {
  if (!options.sortie) throw new Error('--sortie evaluation/sorties/<horodatage> est requis.')
  const racine = join(RACINE, options.sortie)
  const lignes: Ligne[] = []
  for (const organisation of readdirSync(racine, { withFileTypes: true }).filter((e) => e.isDirectory())) {
    for (const veille of readdirSync(join(racine, organisation.name), { withFileTypes: true }).filter((e) => e.isDirectory())) {
      for (const variante of readdirSync(join(racine, organisation.name, veille.name), { withFileTypes: true }).filter((e) => e.isDirectory())) {
        const répertoire = join(racine, organisation.name, veille.name, variante.name)
        if (!existsSync(join(répertoire, 'reponse.json'))) continue
        const résultat = JSON.parse(readFileSync(join(répertoire, 'reponse.json'), 'utf8')) as Résultat
        résultat.texte = readFileSync(join(répertoire, 'reponse-brute.md'), 'utf8')
        const extraits = résultat.conception === 'pipeline' ? lireExtraitsGelés(résultat) : null
        const { validation, propriétés, lettre, html, texte, objet } = valider(résultat, extraits)
        writeFileSync(join(répertoire, 'lettre.md'), lettre)
        writeFileSync(join(répertoire, 'proprietes.json'), JSON.stringify(propriétés, null, 2))
        writeFileSync(join(répertoire, 'validation.json'), JSON.stringify(validation, null, 2))
        writeFileSync(join(répertoire, 'courriel.html'), html)
        writeFileSync(join(répertoire, 'courriel.txt'), texte)
        writeFileSync(join(répertoire, 'courriel.json'), JSON.stringify({ objet, destinataire: DESTINATAIRE }, null, 2))
        lignes.push({ résultat, validation, objet, chemin: répertoire })
      }
    }
  }
  écrireRapport(racine, lignes)
  process.stderr.write(`${lignes.length} lettres revalidées ; rapport : ${join(racine, 'rapport.md')}\n`)
}

function lireExtraitsGelés(résultat: Résultat): Extrait[] {
  const base = join(SOURCES, résultat.organisation, résultat.veille)
  if (!existsSync(base)) return []
  const dates = readdirSync(base).sort()
  const dernière = dates.at(-1)
  if (!dernière) return []
  const manifeste = join(base, dernière, 'manifeste.json')
  return existsSync(manifeste) ? (JSON.parse(readFileSync(manifeste, 'utf8')) as Extrait[]) : []
}

async function main(): Promise<void> {
  if (process.env['HTTPS_PROXY'] || process.env['https_proxy']) {
    // Node ne lit pas HTTPS_PROXY de lui-même : dans un environnement qui sort par un
    // mandataire (session Claude Code), fetch et le SDK passent par undici.
    const { EnvHttpProxyAgent, setGlobalDispatcher } = await import('undici')
    setGlobalDispatcher(new EnvHttpProxyAgent())
  }
  const options = lireOptions(process.argv.slice(2))
  if (options.commande === 'generer') await commandeGenerer(options)
  else commandeValider(options)
}

main().catch((erreur: unknown) => {
  process.stderr.write(`${erreur instanceof Error ? erreur.message : String(erreur)}\n`)
  process.exit(1)
})
