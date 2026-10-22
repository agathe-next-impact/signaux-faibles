/**
 * Les requêtes types du référentiel, lancées par l'outil de recherche côté API
 * (programme du 22 octobre 2026, §3, étape 2).
 *
 * Un seul appel court, qui ne rédige rien : le modèle lance les requêtes,
 * ouvre ce qu'il faut pour dater et rend une liste de résultats, chacun avec
 * son URL. Les URL que l'outil a réellement ouvertes sont relevées dans la
 * réponse : une URL citée qui n'y figure pas n'entre pas dans le dossier.
 */
import type Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import type { RéférentielUnique } from '@/lib/moteur/referentiel'

export type RésultatDeRecherche = {
  readonly axe: number
  readonly titre: string
  readonly url: string
  readonly date: string | null
  readonly extrait: string
}

export type Recherche = {
  readonly résultats: readonly RésultatDeRecherche[]
  /** Combien de résultats le modèle a rendus avant que le programme ne retienne ceux dont l'URL a été ouverte. */
  readonly rendus?: number
  /** Pourquoi la dernière réponse s'est arrêtée (`end_turn`, `max_tokens`, …). */
  readonly arrêt?: string | null
  readonly urlsOuvertes: readonly string[]
  readonly recherches: number
  readonly usage: unknown
  readonly modèle: string
}

const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/

/** Un résultat rendu : les champs trop longs sont coupés, une date mal formée devient nulle, jamais le résultat n'est perdu pour si peu. */
const schémaDUnRésultat = z.object({
  axe: z.coerce.number().int().min(1),
  titre: z.string().transform((t) => t.slice(0, 200)),
  url: z.string().min(8),
  date: z
    .string()
    .nullable()
    .optional()
    .transform((d) => (d && DATE_ISO.test(d.trim().slice(0, 10)) ? d.trim().slice(0, 10) : null)),
  extrait: z
    .string()
    .optional()
    .transform((e) => (e ?? '').slice(0, 600)),
})

export const MODÈLE_DE_RECHERCHE = 'claude-opus-5-5'

export function normaliserUrl(u: string): string {
  return u
    .trim()
    .replace(/[.,;:)\]]+$/, '')
    .replace(/^http:\/\//, 'https://')
    .replace(/^https:\/\/www\./, 'https://')
    .replace(/\/$/, '')
    .toLowerCase()
}

function urlsOuvertesDans(content: readonly unknown[]): string[] {
  const urls = new Set<string>()
  for (const bloc of content as Array<Record<string, unknown>>) {
    if (bloc['type'] === 'web_search_tool_result' || bloc['type'] === 'web_fetch_tool_result') {
      const contenu = bloc['content']
      const éléments = Array.isArray(contenu) ? contenu : [contenu]
      for (const é of éléments as Array<Record<string, unknown>>) {
        const url = (é?.['url'] ?? (é?.['content'] as Record<string, unknown> | undefined)?.['url']) as string | undefined
        if (typeof url === 'string') urls.add(url)
      }
    }
  }
  return [...urls]
}

function texteDe(content: readonly unknown[]): string {
  return (content as Array<{ type?: string; text?: string }>)
    .filter((b) => b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text as string)
    .join('\n')
}

/**
 * Lit le JSON que le modèle rend, résultat par résultat : un résultat mal formé
 * est écarté seul, les autres restent. Une URL que l'outil n'a pas ouverte
 * n'entre pas dans le dossier.
 */
export function lireLesRésultats(texte: string, urlsOuvertes: Iterable<string>): { retenus: RésultatDeRecherche[]; rendus: number } {
  const json = /\{[\s\S]*\}/.exec(texte)?.[0]
  let liste: unknown[] = []
  if (json) {
    try {
      const brut = (JSON.parse(json) as { resultats?: unknown }).resultats
      if (Array.isArray(brut)) liste = brut
    } catch {
      // Réponse tronquée : on garde les résultats complets qui précèdent la coupure.
      liste = [...json.matchAll(/\{[^{}]*"url"[^{}]*\}/g)].flatMap((m) => {
        try {
          return [JSON.parse(m[0]) as unknown]
        } catch {
          return []
        }
      })
    }
  }
  const ouvertes = new Set([...urlsOuvertes].map(normaliserUrl))
  const lus = liste.flatMap((élément) => {
    const lu = schémaDUnRésultat.safeParse(élément)
    return lu.success ? [lu.data as RésultatDeRecherche] : []
  })
  const vus = new Set<string>()
  const retenus = lus.filter((r) => {
    const clé = normaliserUrl(r.url)
    if (!ouvertes.has(clé) || vus.has(clé)) return false
    vus.add(clé)
    return true
  })
  return { retenus, rendus: liste.length }
}

/**
 * Lance les requêtes types de tous les axes dans la période, en un appel
 * (avec les tours `pause_turn` que les outils serveur imposent).
 */
export async function lancerLesRequêtes(
  anthropic: Anthropic,
  référentiel: RéférentielUnique,
  période: { début: string; fin: string },
  options: { modèle?: string; maxRecherches?: number; maxLectures?: number } = {},
): Promise<Recherche> {
  const requêtes = référentiel.axes.flatMap((axe) => axe.requêtes.map((r) => ({ axe: axe.numéro, nom: axe.nom, requête: r })))
  const modèle = options.modèle ?? MODÈLE_DE_RECHERCHE
  if (requêtes.length === 0) return { résultats: [], urlsOuvertes: [], recherches: 0, usage: null, modèle }

  const système =
    `Tu es l'étape de recherche d'un programme de veille. Tu lances chaque requête type listée, ` +
    `pour la période du ${période.début} au ${période.fin}, et tu rends UNIQUEMENT un objet JSON ` +
    `{"resultats":[{"axe":n,"titre":"…","url":"…","date":"AAAA-MM-JJ ou null","extrait":"…"}]} : ` +
    `au plus trente résultats, un par page pertinente et datée dans la période (ou juste avant, si c'est une échéance à venir), ` +
    `l'URL exacte telle que l'outil l'a donnée, la date de publication si elle est lisible, et un extrait fidèle de 250 caractères au plus, sans guillemet doublé ni retour à la ligne. ` +
    `Aucune page que tu n'as pas vue par l'outil, aucun commentaire, aucune rédaction : le programme rédige ensuite.`
  const utilisateur = requêtes.map((r) => `axe ${r.axe} (${r.nom}) : ${r.requête}`).join('\n')

  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: 'user', content: utilisateur }]
  const outils = [
    { type: 'web_search_20260209', name: 'web_search', max_uses: options.maxRecherches ?? Math.min(40, requêtes.length * 2) },
    { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: options.maxLectures ?? 20, max_content_tokens: 6_000 },
  ]
  const urls = new Set<string>()
  let recherches = 0
  const usages: unknown[] = []
  let réponse: Anthropic.Beta.BetaMessage | null = null
  for (let tour = 0; tour < 20; tour += 1) {
    réponse = await anthropic.beta.messages
      .stream({
        model: modèle,
        max_tokens: 20_000,
        system: système,
        messages,
        tools: outils,
      } as unknown as Parameters<typeof anthropic.beta.messages.stream>[0])
      .finalMessage()
    usages.push(réponse.usage)
    recherches += (réponse.usage as { server_tool_use?: { web_search_requests?: number } }).server_tool_use?.web_search_requests ?? 0
    for (const u of urlsOuvertesDans(réponse.content)) urls.add(u)
    if (réponse.stop_reason === 'pause_turn') {
      messages.push({ role: 'assistant', content: réponse.content })
      continue
    }
    break
  }
  if (!réponse) throw new Error('Recherche : aucune réponse.')

  const { retenus, rendus } = lireLesRésultats(texteDe(réponse.content), urls)
  return { résultats: retenus, rendus, arrêt: réponse.stop_reason, urlsOuvertes: [...urls], recherches, usage: usages, modèle }
}
