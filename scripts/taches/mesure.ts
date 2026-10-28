import { coûtDe, TARIFS } from '../../lib/moteur/cout'

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
  /** Le coût des étapes des outils stratégiques, depuis leur premier appel au portail (lot 9). */
  readonly étapes: Readonly<Partial<Record<Étape, MesureDÉtape>>>
}

// ── Coût d'une étape (outils stratégiques, lot 9) ────────────────────────────
//
// Le message `result` ne donne que le total. Pour l'étiquetage (étape 4ter des
// lettres) et la synthèse (revue), on somme l'usage des réponses du modèle à
// partir de la première qui appelle la route de l'étape : c'est un majorant,
// qui compte aussi ce que la tâche fait après. Une réponse peut arriver en
// plusieurs messages qui recopient le même usage : on compte par identifiant.

export const ÉTAPES = ['etiquetage', 'synthese'] as const
export type Étape = (typeof ÉTAPES)[number]

/** La route qui ouvre chaque étape, telle que l'outil `appeler_portail` la reçoit. */
const ROUTES_DES_ÉTAPES: Readonly<Record<Étape, RegExp>> = {
  etiquetage: /^\/api\/veille\/faits\b/,
  synthese: /^\/api\/veille\/(syntheses|calculs|grille)\b/,
}

/** Le chemin seul : l'outil accepte aussi l'adresse complète du portail. */
const cheminSeul = (c: string) => c.trim().replace(/^https?:\/\/[^/]+/i, '')

/** Une réponse du modèle, réduite à ce que la mesure lit. */
export type RéponseDuModèle = {
  readonly id: string
  readonly modèle: string
  readonly usage: { readonly input_tokens?: number; readonly output_tokens?: number; readonly cache_read_input_tokens?: number | null; readonly cache_creation_input_tokens?: number | null } | null
  readonly appelsAuPortail: readonly string[]
}

export type MesureDÉtape = {
  /** Rang (à partir de 1) de la réponse qui a ouvert l'étape parmi les réponses de la session. */
  readonly ouverteÀLaRéponse: number
  readonly réponses: number
  readonly appels: number
  readonly parModèle: Readonly<Record<string, { readonly jetonsEntrée: number; readonly jetonsSortie: number; readonly cacheLu: number; readonly cacheÉcrit: number; readonly coûtUsd: number | null }>>
  /** `null` dès qu'un modèle de l'étape n'a pas de tarif connu : jamais le prix d'un autre modèle. */
  readonly coûtUsd: number | null
}

export function mesurerLesÉtapes(réponses: readonly RéponseDuModèle[]): Partial<Record<Étape, MesureDÉtape>> {
  const uniques: RéponseDuModèle[] = []
  const vues = new Map<string, number>()
  for (const r of réponses) {
    const i = vues.get(r.id)
    if (i === undefined) {
      vues.set(r.id, uniques.length)
      uniques.push(r)
    } else {
      // Même réponse, autre bloc : l'usage est recopié, les appels s'ajoutent.
      const déjà = uniques[i]!
      uniques[i] = { ...déjà, appelsAuPortail: [...déjà.appelsAuPortail, ...r.appelsAuPortail] }
    }
  }
  const étapes: Partial<Record<Étape, MesureDÉtape>> = {}
  for (const étape of ÉTAPES) {
    const route = ROUTES_DES_ÉTAPES[étape]
    const début = uniques.findIndex((r) => r.appelsAuPortail.some((c) => route.test(cheminSeul(c))))
    if (début < 0) continue
    const suite = uniques.slice(début)
    const parModèle: Record<string, { jetonsEntrée: number; jetonsSortie: number; cacheLu: number; cacheÉcrit: number; coûtUsd: number | null }> = {}
    for (const r of suite) {
      const m = (parModèle[r.modèle] ??= { jetonsEntrée: 0, jetonsSortie: 0, cacheLu: 0, cacheÉcrit: 0, coûtUsd: null })
      m.jetonsEntrée += r.usage?.input_tokens ?? 0
      m.jetonsSortie += r.usage?.output_tokens ?? 0
      m.cacheLu += r.usage?.cache_read_input_tokens ?? 0
      m.cacheÉcrit += r.usage?.cache_creation_input_tokens ?? 0
    }
    let total: number | null = 0
    for (const [modèle, m] of Object.entries(parModèle)) {
      const tarif = TARIFS[modèle]
      m.coûtUsd = tarif ? coûtDe(modèle, { entrée: m.jetonsEntrée, sortie: m.jetonsSortie, cacheLecture: m.cacheLu, cacheÉcriture: m.cacheÉcrit }, 0, tarif) : null
      total = total === null || m.coûtUsd === null ? null : total + m.coûtUsd
    }
    étapes[étape] = {
      ouverteÀLaRéponse: début + 1,
      réponses: suite.length,
      appels: suite.reduce((n, r) => n + r.appelsAuPortail.filter((c) => route.test(cheminSeul(c))).length, 0),
      parModèle,
      coûtUsd: total,
    }
  }
  return étapes
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
    réponses?: readonly RéponseDuModèle[]
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
    étapes: mesurerLesÉtapes(contexte.réponses ?? []),
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
    ...Object.entries(mesure.étapes).map(
      ([étape, m]) =>
        `- Étape « ${étape} » : ${m.coûtUsd === null ? 'coût n.d. (modèle sans tarif connu)' : `**${dollars(m.coûtUsd)}**`}, ${m.réponses} réponse(s) à partir de la ${m.ouverteÀLaRéponse}e, ${m.appels} appel(s) à sa route (majorant : compte aussi ce qui suit l’étape)`,
    ),
    '',
  ]
  return lignes.join('\n')
}
