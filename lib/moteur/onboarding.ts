/**
 * Le référentiel unique d'une organisation neuve (programme du 22 octobre 2026,
 * palier 4) : de son site et, s'il existe, du référentiel de sa filière, en
 * trois temps mesurés séparément.
 *
 *   1. le site : la page d'accueil et les pages qu'elle met en avant (offres,
 *      tarifs, qui nous sommes, métiers), lues en code ;
 *   2. l'écosystème : une recherche web courte qui nomme les concurrents, les
 *      administrations, les fédérations et les sources à suivre, avec leurs
 *      URL réelles telles que l'outil les a ouvertes ;
 *   3. le référentiel : un appel en sortie structurée, relu par
 *      `lireRéférentielUnique` avant d'être gardé.
 *
 * La fonction n'écrit nulle part. Pour un client existant qui a deux
 * référentiels Notion, c'est `convertirLesRéférentiels` qui s'applique.
 */
import type Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { collecterLesSources, versTexte, type Navigateur } from '@/lib/moteur/collecte'
import { coûtDe } from '@/lib/moteur/cout'
import type { Usage } from '@/lib/moteur/redaction'
import { lireRéférentielUnique, schémaDuRéférentielUnique, écrireRéférentielUnique, type RéférentielUnique } from '@/lib/moteur/referentiel'

export const MODÈLE_D_ONBOARDING = 'claude-opus-5-5'

export type EntréeDOnboarding = {
  readonly organisation: string
  readonly site: string | null
  readonly filière: string | null
  readonly référentielDeFilière: string | null
  readonly fiche: string | null
}

export type Étape = { readonly nom: string; readonly usage: Usage; readonly recherches: number; readonly coût: number; readonly duréeMs: number }

export type RéférentielDérivé = {
  readonly markdown: string
  readonly référentiel: RéférentielUnique
  readonly fiche: string
  readonly pagesDuSite: ReadonlyArray<{ url: string; état: string }>
  readonly étapes: readonly Étape[]
  readonly coût: number
}

const MOTS_DE_PAGE_UTILE = /tarif|prix|offre|formule|propos|qui-sommes|equipe|métier|metier|service|catalogue|solution|produit|comment|methode|garantie|conform|client|secteur|expertise|atelier|prescri/i
const PAGES_DU_SITE_MAX = 8

function usageDe(u: unknown): Usage {
  const r = (u ?? {}) as { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null }
  return { entrée: r.input_tokens ?? 0, sortie: r.output_tokens ?? 0, cacheLecture: r.cache_read_input_tokens ?? 0, cacheÉcriture: r.cache_creation_input_tokens ?? 0 }
}

function sommeDesUsages(usages: readonly unknown[]): Usage {
  return usages.map(usageDe).reduce((t, u) => ({ entrée: t.entrée + u.entrée, sortie: t.sortie + u.sortie, cacheLecture: t.cacheLecture + u.cacheLecture, cacheÉcriture: t.cacheÉcriture + u.cacheÉcriture }), { entrée: 0, sortie: 0, cacheLecture: 0, cacheÉcriture: 0 })
}

/** Les liens de navigation d'une page d'accueil, du même hôte, ceux dont le chemin dit une offre ou une identité d'abord. */
export function pagesÀLire(html: string, accueil: string, max = PAGES_DU_SITE_MAX): string[] {
  const hôte = new URL(accueil).host
  const vus = new Set<string>([accueil.replace(/\/$/, '')])
  const trouvés: Array<{ url: string; note: number }> = []
  for (const m of html.matchAll(/<a\b[^>]*?\shref\s*=\s*["']([^"'#]+)(?:#[^"']*)?["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    let url: URL
    try {
      url = new URL(m[1]!.replace(/&amp;/g, '&'), accueil)
    } catch {
      continue
    }
    if (!/^https?:$/.test(url.protocol) || url.host !== hôte) continue
    const propre = `${url.origin}${url.pathname}`.replace(/\/$/, '')
    if (vus.has(propre) || /\.(png|jpe?g|svg|webp|gif|pdf|zip|xml|ico|css|js)$/i.test(url.pathname) || /(mentions|cgv|cgu|confidentialit|cookies|politique|connexion|login|panier|contact)/i.test(url.pathname)) continue
    vus.add(propre)
    const texte = versTexte(m[2]!).replace(/\s+/g, ' ').trim()
    trouvés.push({ url: propre, note: (MOTS_DE_PAGE_UTILE.test(url.pathname) ? 2 : 0) + (MOTS_DE_PAGE_UTILE.test(texte) ? 1 : 0) - url.pathname.split('/').length * 0.1 })
  }
  return trouvés.sort((a, b) => b.note - a.note).slice(0, max).map((t) => t.url)
}

/** Étape 1 : le site, lu en code. */
export async function lireLeSite(
  site: string,
  options: { fetch?: typeof fetch; ouvrirNavigateur?: () => Promise<Navigateur | null> } = {},
): Promise<Array<{ url: string; état: string; texte: string }>> {
  const fetchRéel = options.fetch ?? fetch
  const accueil = new URL(site).toString()
  const brut = await fetchRéel(accueil, { redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 (compatible; signauxfaibles/1.0)' } }).then(
    (r) => (r.ok ? r.text() : ''),
    () => '',
  )
  const urls = [accueil, ...(brut ? pagesÀLire(brut, accueil) : [])]
  const lectures = await collecterLesSources(
    { organisation: '', fiche: '', dossiersBruts: '', dossiers: [], axes: [{ numéro: 1, nom: 'site', sorte: 'thème', critères: '', sources: urls.map((url) => ({ libellé: url, url })), requêtes: [], acteurs: [] }] },
    { ouvrirNavigateur: options.ouvrirNavigateur, tailleExtrait: 7_000, fetch: options.fetch },
  )
  return lectures.map((l) => ({ url: l.url, état: l.état, texte: l.texte }))
}

/**
 * Étape 2 : la recherche d'écosystème. Un appel avec l'outil de recherche et
 * de lecture côté API ; il rend des notes (jamais le référentiel) où chaque
 * source est une page que l'outil a réellement ouverte.
 */
export async function chercherLÉcosystème(
  anthropic: Anthropic,
  entrée: EntréeDOnboarding,
  pages: ReadonlyArray<{ url: string; état: string; texte: string }>,
  options: { modèle?: string; maxRecherches?: number } = {},
): Promise<{ notes: string; urlsOuvertes: string[]; recherches: number; usages: unknown[] }> {
  const système =
    `Tu prépares le référentiel de veille d'une organisation. À partir de son site, tu cherches sur le web ce qu'un veilleur expert suivrait pour elle : ` +
    `ses concurrents directs et indirects (avec la page de leurs offres ou de leurs prix), les textes et administrations qui pèsent sur son activité ` +
    `(législation, autorité de contrôle, fédération, observatoire), ses prescripteurs, et les publications où se lisent les changements de son marché. ` +
    `Pour chaque candidat : son nom, son rôle, l'URL exacte de la page à relever (une page que tu as ouverte), et ce qu'on y relève. ` +
    `Écarte ce que tu n'as pas ouvert. Aucun référentiel : des notes sobres, regroupées par thème, avec les URL.`
  const utilisateur =
    `<organisation>${entrée.organisation}</organisation>\n<filiere>${entrée.filière ?? 'aucune'}</filiere>\n<fiche>${entrée.fiche ?? ''}</fiche>\n` +
    `<site>\n${pages.map((p) => `<page url="${p.url}" etat="${p.état}">\n${p.texte.slice(0, 5_000)}\n</page>`).join('\n')}\n</site>`
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: 'user', content: utilisateur }]
  const outils = [
    { type: 'web_search_20260209', name: 'web_search', max_uses: options.maxRecherches ?? 15 },
    { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 10, max_content_tokens: 6_000 },
  ]
  const urls = new Set<string>()
  const usages: unknown[] = []
  let recherches = 0
  let réponse: Anthropic.Beta.BetaMessage | null = null
  for (let tour = 0; tour < 15; tour += 1) {
    réponse = await anthropic.beta.messages
      .stream({ model: options.modèle ?? MODÈLE_D_ONBOARDING, max_tokens: 16_000, system: système, messages, tools: outils } as unknown as Parameters<typeof anthropic.beta.messages.stream>[0])
      .finalMessage()
    usages.push(réponse.usage)
    recherches += (réponse.usage as { server_tool_use?: { web_search_requests?: number } }).server_tool_use?.web_search_requests ?? 0
    for (const bloc of réponse.content as unknown as Array<Record<string, unknown>>) {
      if (bloc['type'] === 'web_search_tool_result' || bloc['type'] === 'web_fetch_tool_result') {
        const contenu = bloc['content']
        for (const é of (Array.isArray(contenu) ? contenu : [contenu]) as Array<Record<string, unknown>>) {
          const url = (é?.['url'] ?? (é?.['content'] as Record<string, unknown> | undefined)?.['url']) as string | undefined
          if (typeof url === 'string') urls.add(url)
        }
      }
    }
    if (réponse.stop_reason === 'pause_turn') {
      messages.push({ role: 'assistant', content: réponse.content })
      continue
    }
    break
  }
  if (!réponse) throw new Error('Recherche d’écosystème : aucune réponse.')
  const notes = (réponse.content as Array<{ type?: string; text?: string }>)
    .filter((b) => b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text as string)
    .join('\n')
  return { notes, urlsOuvertes: [...urls], recherches, usages }
}

/** Les trois temps, de bout en bout. */
export async function dériverLeRéférentiel(
  anthropic: Anthropic,
  entrée: EntréeDOnboarding,
  options: { modèle?: string; fetch?: typeof fetch; ouvrirNavigateur?: () => Promise<Navigateur | null>; journal?: (ligne: string) => void } = {},
): Promise<RéférentielDérivé> {
  const modèle = options.modèle ?? MODÈLE_D_ONBOARDING
  const journal = options.journal ?? (() => {})
  const étapes: Étape[] = []
  const vide: Usage = { entrée: 0, sortie: 0, cacheLecture: 0, cacheÉcriture: 0 }

  let t = Date.now()
  const pages = entrée.site ? await lireLeSite(entrée.site, { fetch: options.fetch, ouvrirNavigateur: options.ouvrirNavigateur }) : []
  étapes.push({ nom: 'site', usage: vide, recherches: 0, coût: 0, duréeMs: Date.now() - t })
  journal(`site : ${pages.filter((p) => p.état.startsWith('ouverte')).length}/${pages.length} pages ouvertes`)

  t = Date.now()
  const écosystème = await chercherLÉcosystème(anthropic, entrée, pages, { modèle })
  const usageRecherche = sommeDesUsages(écosystème.usages)
  étapes.push({ nom: 'écosystème', usage: usageRecherche, recherches: écosystème.recherches, coût: coûtDe(modèle, usageRecherche, écosystème.recherches), duréeMs: Date.now() - t })
  journal(`écosystème : ${écosystème.recherches} recherches, ${écosystème.urlsOuvertes.length} pages ouvertes par l'outil`)

  t = Date.now()
  const système =
    `Tu écris le référentiel unique d'une organisation pour un programme de veille hebdomadaire : dix à quinze axes, ` +
    `thématiques de l'écosystème puis sujets d'offre commerciale (jamais le nom d'une organisation, qui se suit en dossier), chacun avec ses sources nommées, ` +
    `ses requêtes types, ses acteurs et ses critères FORT et MOYEN. Les sources sont des URL de pages que le site ou la recherche d'écosystème ont réellement ouvertes ; ` +
    `n'invente aucune URL. Pars du référentiel de filière quand il existe et spécialise-le à l'organisation. La fiche tient en quatre à huit phrases.`
  const utilisateur =
    `<organisation>${entrée.organisation}</organisation>\n<site>${entrée.site ?? 'inconnu'}</site>\n<filiere>${entrée.filière ?? 'aucune'}</filiere>\n` +
    `<fiche_existante>${entrée.fiche ?? ''}</fiche_existante>\n<referentiel_de_filiere>\n${entrée.référentielDeFilière ?? 'aucun'}\n</referentiel_de_filiere>\n` +
    `<pages_du_site>\n${pages.map((l) => `<page url="${l.url}" etat="${l.état}">\n${l.texte}\n</page>`).join('\n')}\n</pages_du_site>\n` +
    `<recherche_d_ecosysteme>\n${écosystème.notes}\n</recherche_d_ecosysteme>\n<urls_ouvertes_par_la_recherche>\n${écosystème.urlsOuvertes.join('\n')}\n</urls_ouvertes_par_la_recherche>`
  const réponse = await anthropic.beta.messages.parse({
    model: modèle,
    max_tokens: 20_000,
    system: système,
    messages: [{ role: 'user', content: utilisateur }],
    output_format: zodOutputFormat(schémaDuRéférentielUnique),
  })
  const structuré = réponse.parsed_output
  if (!structuré) throw new Error(`Référentiel : aucune sortie structurée (${réponse.stop_reason}).`)
  const markdown = écrireRéférentielUnique(entrée.organisation, structuré)
  const référentiel = lireRéférentielUnique(markdown)
  const usageRédaction = usageDe(réponse.usage)
  étapes.push({ nom: 'référentiel', usage: usageRédaction, recherches: 0, coût: coûtDe(modèle, usageRédaction), duréeMs: Date.now() - t })
  journal(`référentiel : ${référentiel.axes.length} axes, ${référentiel.dossiers.length} dossiers`)

  return {
    markdown,
    référentiel,
    fiche: structuré.fiche,
    pagesDuSite: pages.map((p) => ({ url: p.url, état: p.état })),
    étapes,
    coût: étapes.reduce((s, e) => s + e.coût, 0),
  }
}
