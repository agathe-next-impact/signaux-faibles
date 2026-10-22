/**
 * La collecte des sources nommées, en code et sans modèle (programme du
 * 22 octobre 2026, §3, étape 2).
 *
 * Chaque URL du référentiel est ouverte par HTTP, puis par le navigateur de la
 * machine pour celles qui refusent les robots ou se rendent en JavaScript ; le
 * texte utile est extrait, découpé en phrases, comparé au gel précédent : les
 * phrases nouvelles sont les « nouveautés », ce que le modèle lira en premier.
 * Aucune décision éditoriale ici : le code dit ce qui a changé, pas ce qui
 * compte.
 */
import { createHash } from 'node:crypto'
import type { RéférentielUnique } from '@/lib/moteur/referentiel'

export type ÉtatDeSource = 'ouverte' | 'ouverte-navigateur' | `http-${number}` | `type-${string}` | 'delai' | 'reseau' | 'vide'

export type Lecture = {
  readonly url: string
  readonly état: string
  readonly luLe: string
  readonly texte: string
  readonly empreinte: string
  /** Les phrases qui n'étaient pas dans le gel précédent ; toutes si pas de gel. */
  readonly nouveautés: readonly string[]
  /** `null` sans gel précédent. */
  readonly changée: boolean | null
  /** Les liens de la page qui mènent à un article du même site : de quoi suivre une page d'index. */
  readonly liens?: readonly Lien[]
}

export type Lien = { readonly url: string; readonly texte: string }

/** Un article que mène à lire une page d'index, daté par ses propres métadonnées. */
export type Article = {
  /** L'URL de la source nommée dont il vient. */
  readonly source: string
  readonly url: string
  readonly titre: string
  /** AAAA-MM-JJ, lue dans la page ; jamais devinée. */
  readonly date: string
  readonly extrait: string
}

/** Ce qu'on garde d'une lecture pour la comparer à la suivante. */
export type Gel = { readonly empreinte: string; readonly phrases: readonly string[] }

export type Navigateur = {
  lire: (url: string) => Promise<{ statut: number; texte: string; liens?: readonly Lien[] }>
  fermer: () => Promise<void>
}

export type OptionsDeCollecte = {
  /** Gel précédent par URL ; vide à la première parution. */
  readonly gel?: ReadonlyMap<string, Gel>
  /** Ouvre un navigateur de repli ; `null` pour s'en passer. */
  readonly ouvrirNavigateur?: () => Promise<Navigateur | null>
  readonly tailleExtrait?: number
  readonly parallèle?: number
  readonly délaiMs?: number
  /** Pour les tests : remplace `fetch`. */
  readonly fetch?: typeof fetch
}

export const TAILLE_D_EXTRAIT = 8_000

export function empreinteDe(texte: string): string {
  return createHash('sha256').update(texte).digest('hex').slice(0, 16)
}

/** Le texte utile d'une page HTML ou d'un flux, sans script ni balise. */
export function versTexte(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|head|nav|footer|aside)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|li|h[1-6]|tr|section|article|item|entry|title|description|summary|content)>/gi, '\n')
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;|&rsquo;/g, '’')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/[ \t]+/g, ' ')
    .split('\n')
    .map((ligne) => ligne.trim())
    .filter((ligne) => ligne.length > 0)
    .join('\n')
}

/** Les phrases d'un texte, normalisées pour la comparaison d'un gel à l'autre. */
export function phrasesDuTexte(texte: string): string[] {
  return texte
    .split(/(?<=[.!?…])\s+(?=[A-ZÀ-ÝŒ«"\d])|\n+/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p.length >= 25)
}

export function gelDe(lecture: Lecture): Gel {
  return { empreinte: lecture.empreinte, phrases: phrasesDuTexte(lecture.texte) }
}

const CHEMINS_SANS_ARTICLE = /\/(tag|tags|category|categories|categorie|author|auteur|page|feed|wp-json|search|recherche|contact|mentions-legales|politique|cgv|cgu|login|connexion)(\/|$)|\.(jpg|jpeg|png|gif|svg|webp|pdf|zip|css|js)(\?|$)/i

function hôteDe(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return null
  }
}

/**
 * Les liens d'une page qui ressemblent à des titres d'articles du même site :
 * texte d'au moins vingt-cinq caractères (un menu n'en porte pas), même hôte,
 * ni étiquette, ni auteur, ni pagination. Dans l'ordre de la page, qui range
 * d'ordinaire du plus récent au plus ancien.
 */
export function liensDe(html: string, base: string): Lien[] {
  const hôte = hôteDe(base)
  const vus = new Set<string>([base.replace(/#.*$/, '')])
  const liens: Lien[] = []
  for (const m of html.matchAll(/<a\b[^>]*?\shref\s*=\s*["']([^"'#]+)(?:#[^"']*)?["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    let url: string
    try {
      url = new URL(m[1]!.replace(/&amp;/g, '&'), base).toString()
    } catch {
      continue
    }
    if (!/^https?:/.test(url) || hôteDe(url) !== hôte || CHEMINS_SANS_ARTICLE.test(url) || vus.has(url)) continue
    const texte = versTexte(m[2]!).replace(/\s+/g, ' ').trim()
    if (texte.length < 25 || new URL(url).pathname.length < 6) continue
    vus.add(url)
    liens.push({ url, texte: texte.slice(0, 200) })
  }
  return liens
}

const ISO = /^(\d{4}-\d{2}-\d{2})/

/** La date de publication lue dans les métadonnées de la page ; `null` si la page n'en porte pas. */
export function dateDePublication(html: string): string | null {
  const candidats = [
    /<meta[^>]+(?:property|name|itemprop)=["'](?:article:published_time|og:published_time|datePublished|date|pubdate|publishdate|DC\.date\.issued)["'][^>]*content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name|itemprop)=["'](?:article:published_time|og:published_time|datePublished|date|pubdate|publishdate|DC\.date\.issued)["']/i,
    /"datePublished"\s*:\s*"([^"]+)"/i,
    /<time[^>]+datetime=["']([^"']+)["']/i,
  ]
  for (const motif of candidats) {
    const trouvé = ISO.exec(motif.exec(html)?.[1] ?? '')?.[1]
    if (trouvé && !Number.isNaN(Date.parse(trouvé))) return trouvé
  }
  return null
}

async function lireParHttp(url: string, options: Required<Pick<OptionsDeCollecte, 'tailleExtrait' | 'délaiMs' | 'fetch'>>): Promise<{ état: string; texte: string; liens?: Lien[]; html?: string }> {
  const contrôleur = new AbortController()
  const minuterie = setTimeout(() => contrôleur.abort(), options.délaiMs)
  try {
    const réponse = await options.fetch(url, {
      signal: contrôleur.signal,
      redirect: 'follow',
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; signauxfaibles-veille/1.0; +https://www.signauxfaibles.io)',
        accept: 'text/html,text/plain,application/rss+xml,application/atom+xml,application/xml,*/*',
        'accept-language': 'fr-FR,fr;q=0.9',
      },
    })
    if (!réponse.ok) return { état: `http-${réponse.status}`, texte: '' }
    const type = réponse.headers.get('content-type') ?? ''
    if (type && !/text\/|xml|json/.test(type)) return { état: `type-${type.split(';')[0]}`, texte: '' }
    const html = await réponse.text()
    const texte = versTexte(html).slice(0, options.tailleExtrait)
    return texte.length >= 200 ? { état: 'ouverte', texte, liens: liensDe(html, réponse.url || url), html } : { état: 'vide', texte }
  } catch (erreur) {
    return { état: erreur instanceof Error && erreur.name === 'AbortError' ? 'delai' : 'reseau', texte: '' }
  } finally {
    clearTimeout(minuterie)
  }
}

export async function enParallèle<T>(tâches: ReadonlyArray<() => Promise<T>>, limite: number): Promise<T[]> {
  const résultats: T[] = new Array<T>(tâches.length)
  let indice = 0
  const ouvriers = Array.from({ length: Math.max(1, Math.min(limite, tâches.length)) }, async () => {
    while (indice < tâches.length) {
      const i = indice
      indice += 1
      résultats[i] = await tâches[i]!()
    }
  })
  await Promise.all(ouvriers)
  return résultats
}

/**
 * Ouvre toutes les sources nommées du référentiel. Le navigateur n'est lancé
 * que si une source l'exige, et fermé à la fin quoi qu'il arrive.
 */
export async function collecterLesSources(référentiel: RéférentielUnique, options: OptionsDeCollecte = {}): Promise<Lecture[]> {
  const urls = [...new Set(référentiel.axes.flatMap((axe) => axe.sources.map((s) => s.url)))]
  const gel = options.gel ?? new Map<string, Gel>()
  const tailleExtrait = options.tailleExtrait ?? TAILLE_D_EXTRAIT
  const délaiMs = options.délaiMs ?? 20_000
  const fetchRéel = options.fetch ?? fetch
  let navigateur: Navigateur | null | undefined

  const auNavigateur = async (): Promise<Navigateur | null> => {
    if (navigateur !== undefined) return navigateur
    navigateur = options.ouvrirNavigateur ? await options.ouvrirNavigateur() : null
    return navigateur
  }

  try {
    return await enParallèle(
      urls.map((url) => async () => {
        const luLe = new Date().toISOString()
        const http = await lireParHttp(url, { tailleExtrait, délaiMs, fetch: fetchRéel })
        let { état, texte } = http
        let liens: readonly Lien[] | undefined = http.liens
        if (état !== 'ouverte') {
          const n = await auNavigateur()
          if (n) {
            try {
              const lu = await n.lire(url)
              const t = lu.texte.trim().slice(0, tailleExtrait)
              if (t.length >= 200) {
                état = 'ouverte-navigateur'
                texte = t
                liens = lu.liens
              } else état = `${état}+navigateur-${lu.statut || 'vide'}`
            } catch {
              état = `${état}+navigateur-erreur`
            }
          }
        }
        const empreinte = texte ? empreinteDe(texte) : ''
        const précédent = gel.get(url)
        const phrases = phrasesDuTexte(texte)
        const connues = new Set(précédent?.phrases ?? [])
        const nouveautés = précédent ? phrases.filter((p) => !connues.has(p)) : phrases
        const changée = état.startsWith('ouverte') ? (précédent ? précédent.empreinte !== empreinte : null) : null
        return { url, état, luLe, texte, empreinte, nouveautés, changée, ...(liens && liens.length > 0 ? { liens } : {}) }
      }),
      options.parallèle ?? 6,
    )
  } finally {
    if (navigateur) await navigateur.fermer().catch(() => {})
  }
}

export type OptionsDeSuivi = {
  /** Articles lus au plus par source (les plus récents de la page, dans la période). */
  readonly parSource?: number
  /** Liens essayés au plus par source avant de s'arrêter. */
  readonly essaisParSource?: number
  readonly tailleExtrait?: number
  readonly parallèle?: number
  readonly délaiMs?: number
  readonly fetch?: typeof fetch
}

/**
 * Suit les pages d'index : pour chaque source ouverte, les premiers liens qui
 * mènent à un article du même site sont lus, et seuls restent ceux que leurs
 * propres métadonnées datent dans la période (ou la veille de son début : un
 * fait de la veille éclaire l'échéance). Une page sans date lisible n'entre
 * pas : le programme ne devine pas une date. Aucune décision éditoriale.
 */
export async function suivreLesArticles(
  lectures: readonly Lecture[],
  période: { début: string; fin: string },
  options: OptionsDeSuivi = {},
): Promise<Article[]> {
  const parSource = options.parSource ?? 4
  const essais = options.essaisParSource ?? 8
  const tailleExtrait = options.tailleExtrait ?? 1_800
  const délaiMs = options.délaiMs ?? 15_000
  const fetchRéel = options.fetch ?? fetch
  const sources = new Set(lectures.map((l) => l.url))
  const dejaVus = new Set<string>(sources)
  const tâches: Array<() => Promise<Article | null>> = []
  for (const lecture of lectures) {
    if (!lecture.état.startsWith('ouverte')) continue
    for (const lien of (lecture.liens ?? []).filter((l) => !sources.has(l.url)).slice(0, essais)) {
      if (dejaVus.has(lien.url)) continue
      dejaVus.add(lien.url)
      const tâche = async (): Promise<Article | null> => {
        const http = await lireParHttp(lien.url, { tailleExtrait: 20_000, délaiMs, fetch: fetchRéel })
        if (http.état !== 'ouverte' || !http.html) return null
        const date = dateDePublication(http.html)
        if (!date || date > période.fin || date < reculerD(période.début, 1)) return null
        return { source: lecture.url, url: lien.url, titre: lien.texte, date, extrait: http.texte.slice(0, tailleExtrait) }
      }
      tâches.push(tâche)
    }
  }
  const lus = (await enParallèle(tâches, options.parallèle ?? 8)).filter((a): a is Article => a !== null)
  // Au plus `parSource` articles par source, les plus récents d'abord.
  const gardés = new Map<string, number>()
  return lus
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .filter((a) => {
      const n = gardés.get(a.source) ?? 0
      gardés.set(a.source, n + 1)
      return n < parSource
    })
}

function reculerD(iso: string, jours: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - jours)
  return d.toISOString().slice(0, 10)
}

/** Le navigateur de la machine (Chromium de Playwright), ou `null` s'il n'est pas disponible. */
export async function navigateurPlaywright(cheminChromium = process.env['CHROMIUM_PATH']): Promise<Navigateur | null> {
  try {
    const { chromium } = await import('@playwright/test')
    const navigateur = await chromium.launch(cheminChromium ? { executablePath: cheminChromium } : {})
    return {
      async lire(url) {
        const page = await navigateur.newPage({ locale: 'fr-FR' })
        try {
          const réponse = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 })
          await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})
          const texte = await page.evaluate(() => document.body?.innerText ?? '')
          const brutes = await page.evaluate(() => Array.from(document.querySelectorAll('a[href]')).map((a) => ({ url: (a as HTMLAnchorElement).href, texte: (a as HTMLElement).innerText })))
          const hôte = hôteDe(url)
          const liens = brutes
            .map((l) => ({ url: l.url.replace(/#.*$/, ''), texte: l.texte.replace(/\s+/g, ' ').trim().slice(0, 200) }))
            .filter((l) => /^https?:/.test(l.url) && hôteDe(l.url) === hôte && l.url !== url && !CHEMINS_SANS_ARTICLE.test(l.url) && l.texte.length >= 25 && new URL(l.url).pathname.length >= 6)
          return { statut: réponse?.status() ?? 0, texte: texte.replace(/\n{3,}/g, '\n\n'), liens: [...new Map(liens.map((l) => [l.url, l])).values()] }
        } finally {
          await page.close()
        }
      },
      fermer: () => navigateur.close(),
    }
  } catch {
    return null
  }
}

export type Couverture = { readonly nommées: number; readonly ouvertes: number; readonly taux: number; readonly fermées: readonly { url: string; état: string }[] }

export function couvertureDe(lectures: readonly Lecture[]): Couverture {
  const ouvertes = lectures.filter((l) => l.état.startsWith('ouverte')).length
  return {
    nommées: lectures.length,
    ouvertes,
    taux: lectures.length === 0 ? 1 : ouvertes / lectures.length,
    fermées: lectures.filter((l) => !l.état.startsWith('ouverte')).map((l) => ({ url: l.url, état: l.état })),
  }
}
