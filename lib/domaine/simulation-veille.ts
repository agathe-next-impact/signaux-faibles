import { lundiDeLaSemaine } from '@/lib/domaine/semaines'
import type { Grille } from '@/lib/domaine/strategie'
import type { LigneDeCarte, ObservationDeCarte } from '@/lib/domaine/simulation'

/**
 * Ce que la veille a compté pour chaque carte de la simulation (16 novembre
 * 2026, lot 3b). Pur : des faits étiquetés en entrée, des comptes en sortie.
 * Une carte est une catégorie de faits (une famille de la grille, restreinte
 * au besoin à un cadre, ou toutes les ruptures) ; sa fréquence est le nombre
 * de semaines où la veille en a relevé au moins un, et son dernier fait est
 * cité par sa date, sa source et sa lettre, jamais par son texte.
 */

/** La profondeur de l'historique lu : six mois de lettres. */
export const SEMAINES_D_HISTORIQUE = 26

export type FaitDeSimulation = {
  readonly dateÉdition: string
  readonly date: string
  readonly édition: string
  readonly source: string
  /** La veille de la lettre (`Écosystème`, `Concurrentiel`), ou `null` pour une lettre unique. */
  readonly famille: string | null
  readonly axe: number | null
  readonly pestel: string | null
  readonly porter: string | null
  readonly impact: string
  readonly rupture: boolean
}

const veilleDe = (f: string | null) => {
  const n = (f ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  return n.startsWith('eco') ? 'ecosysteme' : n.startsWith('conc') ? 'concurrentiel' : null
}

const JOUR_MS = 86_400_000

/** Le nombre de semaines entre le premier fait et le dernier, bornes comprises ; 0 sans fait. */
export function semainesDHistorique(faits: readonly Pick<FaitDeSimulation, 'dateÉdition'>[]): number {
  if (faits.length === 0) return 0
  const lundis = faits.map((f) => lundiDeLaSemaine(f.dateÉdition)).sort()
  const écart = Date.parse(`${lundis[lundis.length - 1]}T00:00:00Z`) - Date.parse(`${lundis[0]}T00:00:00Z`)
  return Math.min(SEMAINES_D_HISTORIQUE, Math.round(écart / (7 * JOUR_MS)) + 1)
}

/** Un fait entre-t-il dans la catégorie de la carte ? Une famille ambiguë ou inconnue ne compte rien. */
function relève(fait: FaitDeSimulation, carte: LigneDeCarte, grille: Pick<Grille, 'familles'>): boolean {
  if (carte.rupture === true) return fait.rupture
  if (carte.famille == null || fait.axe !== carte.famille) return false
  const candidates = grille.familles.filter((f) => f.numéro === carte.famille && (carte.veille == null || f.veille === carte.veille))
  if (candidates.length !== 1) return false
  const veille = veilleDe(fait.famille)
  const seule = grille.familles.filter((f) => f.numéro === carte.famille).length === 1
  // Une lettre unique ne porte pas de veille : son fait revient à la famille quand le numéro n'existe qu'une fois.
  if (veille !== candidates[0]!.veille && !(veille === null && seule)) return false
  if (carte.cadre && fait.pestel !== carte.cadre && fait.porter !== carte.cadre) return false
  return true
}

export function observationsDesCartes(
  cartes: readonly LigneDeCarte[],
  faits: readonly FaitDeSimulation[],
  grille: Pick<Grille, 'familles'>,
): readonly ObservationDeCarte[] {
  return cartes.map((carte) => {
    const siens = faits.filter((f) => relève(f, carte, grille))
    const dernier = [...siens].sort((a, b) => b.dateÉdition.localeCompare(a.dateÉdition) || b.date.localeCompare(a.date))[0]
    return {
      clé: carte.clé,
      semaines: new Set(siens.map((f) => lundiDeLaSemaine(f.dateÉdition))).size,
      faits: siens.length,
      dernier: dernier ? { date: dernier.date, source: dernier.source, édition: dernier.édition } : null,
    }
  })
}

/** Les dimensions PESTEL où la veille a relevé au moins un fait FORT. */
export function dimensionsExposées(faits: readonly Pick<FaitDeSimulation, 'pestel' | 'impact'>[]): readonly string[] {
  return [...new Set(faits.flatMap((f) => (f.impact === 'FORT' && f.pestel ? [f.pestel] : [])))].sort()
}
