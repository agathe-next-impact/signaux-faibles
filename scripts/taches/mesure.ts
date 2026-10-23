/**
 * Ce qu'une exécution a coûté, lu dans le message `result` du SDK Agent et
 * jamais recalculé à la main : `total_cost_usd` et `modelUsage`, qui sépare
 * l'agent principal (Opus ou Sonnet) du lecteur (Haiku).
 *
 * La clé API sert aussi aux évaluations : le total de la console mêle les deux.
 * `mesure.json` est donc la seule référence du coût des tâches.
 */

export type UsageDuModèle = {
  readonly jetonsEntrée: number
  readonly jetonsSortie: number
  readonly cacheLu: number
  readonly cacheÉcrit: number
  readonly recherchesWeb: number
  readonly coûtUsd: number
}

export type Mesure = {
  readonly tâche: string
  readonly organisation: string | null
  readonly date: string
  readonly issue: string
  readonly duréeMs: number
  readonly tours: number
  readonly coûtTotalUsd: number
  readonly plafondUsd: number
  readonly parModèle: Readonly<Record<string, UsageDuModèle>>
  readonly organisationsTraitées: readonly string[]
  readonly pagesNotionCréées: number
}

type ModèleBrut = {
  inputTokens?: number
  outputTokens?: number
  cacheReadInputTokens?: number
  cacheCreationInputTokens?: number
  webSearchRequests?: number
  costUSD?: number
}

export type RésultatBrut = {
  subtype?: string
  duration_ms?: number
  num_turns?: number
  total_cost_usd?: number
  modelUsage?: Record<string, ModèleBrut>
}

export function lireLaMesure(
  résultat: RésultatBrut,
  contexte: {
    tâche: string
    organisation: string | null
    date: Date
    plafondUsd: number
    organisationsTraitées: Iterable<string>
    pagesNotionCréées: number
  },
): Mesure {
  const parModèle: Record<string, UsageDuModèle> = {}
  for (const [modèle, u] of Object.entries(résultat.modelUsage ?? {})) {
    parModèle[modèle] = {
      jetonsEntrée: u.inputTokens ?? 0,
      jetonsSortie: u.outputTokens ?? 0,
      cacheLu: u.cacheReadInputTokens ?? 0,
      cacheÉcrit: u.cacheCreationInputTokens ?? 0,
      recherchesWeb: u.webSearchRequests ?? 0,
      coûtUsd: u.costUSD ?? 0,
    }
  }
  return {
    tâche: contexte.tâche,
    organisation: contexte.organisation,
    date: contexte.date.toISOString(),
    issue: résultat.subtype ?? 'inconnue',
    duréeMs: résultat.duration_ms ?? 0,
    tours: résultat.num_turns ?? 0,
    coûtTotalUsd: résultat.total_cost_usd ?? 0,
    plafondUsd: contexte.plafondUsd,
    parModèle,
    organisationsTraitées: [...new Set(contexte.organisationsTraitées)].sort(),
    pagesNotionCréées: contexte.pagesNotionCréées,
  }
}

const entier = (n: number) => n.toLocaleString('fr-FR')
const dollars = (n: number) => `${n.toFixed(2).replace('.', ',')} $`

/** Le résumé du job GitHub (`$GITHUB_STEP_SUMMARY`), en Markdown. */
export function résuméDeLaMesure(mesure: Mesure): string {
  const lignes = [
    `## Tâche « ${mesure.tâche} »${mesure.organisation ? `, organisation ${mesure.organisation}` : ''}`,
    '',
    `- Issue : ${mesure.issue}`,
    `- Date : ${mesure.date}`,
    `- Durée : ${Math.round(mesure.duréeMs / 60_000)} min, ${mesure.tours} tours`,
    `- Coût total : **${dollars(mesure.coûtTotalUsd)}** (plafond ${dollars(mesure.plafondUsd)})`,
    `- Organisations traitées : ${mesure.organisationsTraitées.length ? mesure.organisationsTraitées.join(', ') : 'aucune relevée'}`,
    `- Pages Notion créées : ${mesure.pagesNotionCréées}`,
    '',
    '| Modèle | Entrée | Sortie | Cache lu | Cache écrit | Recherches web | Coût |',
    '|---|---:|---:|---:|---:|---:|---:|',
    ...Object.entries(mesure.parModèle).map(
      ([modèle, u]) =>
        `| ${modèle} | ${entier(u.jetonsEntrée)} | ${entier(u.jetonsSortie)} | ${entier(u.cacheLu)} | ${entier(u.cacheÉcrit)} | ${u.recherchesWeb} | ${dollars(u.coûtUsd)} |`,
    ),
    '',
  ]
  return lignes.join('\n')
}
