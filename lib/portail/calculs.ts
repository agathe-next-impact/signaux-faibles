import {
  benchmarkDesFiches,
  entitésDuBenchmark,
  indiceDeCycle,
  périodesDuCycle,
  type Benchmark,
  type Grille,
  type IndiceDeCycle,
  type ParamètresDuCycle,
} from '@/lib/domaine/strategie'
import { compterLesAnnonces, fichesChiffrées, FAMILLES_ENTRANTS, type DemandeBodacc } from '@/lib/registres'

/**
 * Les calculs de la synthèse trimestrielle (outils stratégiques, lot 7) :
 * l'indice de cycle de vie (BODACC) et le benchmark (API Recherche
 * d'entreprises, sur les SIREN de la grille). Le portail les fait lui-même, au
 * moment où la revue les lit (`GET /api/veille/calculs`) puis quand elle poste
 * la synthèse : le modèle n'écrit que l'interprétation.
 *
 * Deux API publiques et gratuites, sans clé, appelées dans un budget de temps :
 * ce qui ne répond pas à l'échéance vaut n.d., jamais une erreur. Une synthèse
 * n'est jamais refusée pour un chiffre.
 */

export const BUDGET_DES_CALCULS_MS = 20_000
/** Plafond par appel BODACC : quatre comptes en parallèle. */
const BUDGET_DU_COMPTE_MS = 6_000

export type Dépendances = {
  readonly f?: typeof fetch
  readonly attente?: (ms: number) => Promise<unknown>
  readonly maintenant?: () => number
}

export type Calculs = { readonly indice: IndiceDeCycle | null; readonly benchmark: Benchmark }

async function compter(demande: DemandeBodacc, f: typeof fetch): Promise<number | null> {
  try {
    return await compterLesAnnonces(demande, f, AbortSignal.timeout(BUDGET_DU_COMPTE_MS))
  } catch {
    return null
  }
}

/**
 * L'indice et le benchmark à la date `fin` (la fin de la fenêtre de la
 * synthèse). Sans paramètres du cycle, l'indice n'est pas calculé : il
 * demande les départements et le texte d'activité du référentiel.
 */
export async function calculer(
  entrée: { readonly grille: Grille; readonly organisation: string; readonly fin: string; readonly cycle: ParamètresDuCycle | null },
  dépendances: Dépendances = {},
): Promise<Calculs> {
  const f = dépendances.f ?? fetch
  const maintenant = dépendances.maintenant ?? Date.now
  const échéance = maintenant() + BUDGET_DES_CALCULS_MS
  const calculéLe = new Date(maintenant()).toISOString()

  const indice = (async () => {
    if (!entrée.cycle) return null
    const { courante, précédente } = périodesDuCycle(entrée.fin)
    const base = { departements: entrée.cycle.départements, texte: entrée.cycle.texte }
    const [entrées, sorties, entréesAvant, sortiesAvant] = await Promise.all([
      compter({ ...base, depuis: courante.du, jusqua: courante.au, familles: FAMILLES_ENTRANTS }, f),
      compter({ ...base, depuis: courante.du, jusqua: courante.au, familles: ['collective'] }, f),
      compter({ ...base, depuis: précédente.du, jusqua: précédente.au, familles: FAMILLES_ENTRANTS }, f),
      compter({ ...base, depuis: précédente.du, jusqua: précédente.au, familles: ['collective'] }, f),
    ])
    return indiceDeCycle(entrée.cycle, entrée.fin, { entrées, sorties, entréesAvant, sortiesAvant }, calculéLe)
  })()

  const entités = entitésDuBenchmark(entrée.grille, entrée.organisation)
  const fiches = fichesChiffrées(
    entités.map((e) => e.siren),
    { f, ...(dépendances.attente ? { attente: dépendances.attente } : {}), échéance, maintenant },
  )

  const [i, chiffres] = await Promise.all([indice, fiches])
  return { indice: i, benchmark: benchmarkDesFiches(entités, chiffres, entrée.organisation, calculéLe) }
}
