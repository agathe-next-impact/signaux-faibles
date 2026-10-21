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
}

/** Ce qu'on garde d'une lecture pour la comparer à la suivante. */
export type Gel = { readonly empreinte: string; readonly phrases: readonly string[] }

export type Navigateur = {
  lire: (url: string) => Promise<{ statut: number; texte: string }>
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

async function lireParHttp(url: string, options: Required<Pick<OptionsDeCollecte, 'tailleExtrait' | 'délaiMs' | 'fetch'>>): Promise<{ état: string; texte: string }> {
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
    const texte = versTexte(await réponse.text()).slice(0, options.tailleExtrait)
    return texte.length >= 200 ? { état: 'ouverte', texte } : { état: 'vide', texte }
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
        let { état, texte } = await lireParHttp(url, { tailleExtrait, délaiMs, fetch: fetchRéel })
        if (état !== 'ouverte') {
          const n = await auNavigateur()
          if (n) {
            try {
              const lu = await n.lire(url)
              const t = lu.texte.trim().slice(0, tailleExtrait)
              if (t.length >= 200) {
                état = 'ouverte-navigateur'
                texte = t
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
        return { url, état, luLe, texte, empreinte, nouveautés, changée }
      }),
      options.parallèle ?? 6,
    )
  } finally {
    if (navigateur) await navigateur.fermer().catch(() => {})
  }
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
          return { statut: réponse?.status() ?? 0, texte: texte.replace(/\n{3,}/g, '\n\n') }
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
