import {
  conclureUnRunDOnboarding,
  onboardingDUnSlug,
  ouvrirUnRunDOnboarding,
  rapporterUnOnboarding,
  type OnboardingLu,
  type OuvertureDeRun,
  type RunLu,
  type TâcheDOnboarding,
} from '@/lib/base/onboardings'
import {
  débutDuMoisDeParis,
  déciderDuBudget,
  dépenseDuMois,
  estBloqué,
  estClos,
  étapeDeLOnboarding,
  étatMontré,
  lireLeBudget,
  moisDeParis,
  type DécisionDeBudget,
  type ÉtapeCalculée,
  type ÉtatDeRun,
} from '@/lib/domaine/onboarding'

/**
 * L'orchestration du suivi des onboardings (lot 1 de
 * `docs/proposition-onboarding-admin.md`, 1er novembre 2026). Seule entrée
 * d'écriture de `lib/base/onboardings.ts`, appelée par la seule route
 * `POST /api/veille/onboardings`, derrière le jeton du dispositif.
 *
 * Le portail ne lance rien au lot 1 : il reçoit ce que le harnais des tâches
 * (`scripts/taches/executer.ts`) rapporte au début et à la fin d'un run
 * `balayage` ou `premiere-lettre` sur une organisation, et ce que la tâche
 * rapporte du registre par l'outil `rapporter_onboarding`. Au début, il décide
 * du budget du mois (décision 5 du 1er novembre 2026) : un refus arrête le run
 * avant que la session ne s'ouvre, donc avant toute dépense.
 */

/**
 * Le budget mensuel des onboardings. Variable facultative : absente ou vide,
 * rien n'est bloqué. Lue à chaque appel, pour qu'un changement dans Vercel
 * prenne effet au déploiement suivant sans autre geste.
 */
export function budgetDesOnboardings(): number | null {
  const lu = lireLeBudget(process.env['ONBOARDING_BUDGET_MENSUEL_USD'])
  if (lu.illisible) console.warn('[onboarding] ONBOARDING_BUDGET_MENSUEL_USD illisible : aucun blocage appliqué.')
  return lu.budgetUsd
}

export const TÂCHES_SUIVIES: Readonly<Record<string, TâcheDOnboarding>> = {
  balayage: 'balayage',
  'premiere-lettre': 'premiere_lettre',
}

export async function recevoirUnDébut(
  entrée: {
    readonly slug: string
    readonly tâche: TâcheDOnboarding
    readonly runGithub: number | null
    readonly tentative: number | null
    readonly lien: string | null
    readonly plafondUsd: number
  },
  maintenant: Date = new Date(),
): Promise<OuvertureDeRun> {
  return ouvrirUnRunDOnboarding({ ...entrée, budgetUsd: budgetDesOnboardings(), débutDuMois: débutDuMoisDeParis(maintenant), maintenant })
}

export function recevoirUneFin(
  entrée: { readonly slug: string; readonly runId: string; readonly issue: 'reussi' | 'echec'; readonly coûtUsd: number | null },
  maintenant: Date = new Date(),
) {
  return conclureUnRunDOnboarding({ ...entrée, maintenant })
}

export function recevoirUnRapport(
  entrée: {
    readonly slug: string
    readonly statut: number | null
    readonly registre: string | null
    readonly motif: string | null
    readonly nom: string | null
    readonly site: string | null
  },
  maintenant: Date = new Date(),
) {
  return rapporterUnOnboarding({ ...entrée, maintenant })
}

/** Pour `GET /api/veille/onboardings` : la tâche ou l'opératrice relisent ce que le portail a reçu. */
export function lireUnOnboarding(slug: string): Promise<OnboardingLu | null> {
  return onboardingDUnSlug(slug)
}

// ── Ce que les écrans montrent ───────────────────────────────────────────────

export type RunVuÀLÉcran = RunLu & { readonly montré: ÉtatDeRun | 'sans_nouvelles'; readonly duréeMs: number | null }

export type VueDOnboarding = {
  readonly onboarding: OnboardingLu
  readonly étape: ÉtapeCalculée
  readonly bloqué: boolean
  readonly clos: boolean
  readonly runs: readonly RunVuÀLÉcran[]
  readonly dernierRun: RunVuÀLÉcran | null
  readonly coûtTotalUsd: number
}

export function vueDUnOnboarding(onboarding: OnboardingLu, maintenant: Date): VueDOnboarding {
  const étape = étapeDeLOnboarding({
    statutRapporté: onboarding.statutRapporté,
    organisation: onboarding.organisation,
    lecteursActifs: onboarding.lecteursActifs,
    dernierLienEnvoyéLe: onboarding.dernierLienEnvoyéLe,
  })
  const runs = onboarding.runs.map((r) => ({
    ...r,
    montré: étatMontré(r, maintenant),
    duréeMs: r.début && r.fin ? r.fin.getTime() - r.début.getTime() : null,
  }))
  const dernierRun = runs[0] ?? null
  return {
    onboarding,
    étape,
    bloqué: estBloqué({ motifDeBlocage: onboarding.motifDeBlocage, dernierRun }, maintenant),
    clos: estClos(étape.étape, onboarding.dernierLienEnvoyéLe, maintenant),
    runs,
    dernierRun,
    coûtTotalUsd: Math.round(onboarding.runs.reduce((t, r) => t + (r.coûtUsd ?? 0), 0) * 10_000) / 10_000,
  }
}

export type TableauDesOnboardings = {
  readonly enCours: readonly VueDOnboarding[]
  readonly clos: readonly VueDOnboarding[]
  readonly mois: string
  readonly budget: DécisionDeBudget
}

/**
 * La liste de l'opératrice : bloqués d'abord, puis du moins avancé au plus
 * avancé, à étape égale le plus ancien d'abord. Le budget est dit pour un run
 * de plafond nul : ce qui reste avant que le prochain run ne soit refusé dépend
 * du plafond de sa tâche, que l'écran rappelle.
 */
export function vueDuTableau(données: { readonly onboardings: readonly OnboardingLu[]; readonly runsDuMois: readonly RunLu[] }, maintenant: Date): TableauDesOnboardings {
  const vues = données.onboardings.map((o) => vueDUnOnboarding(o, maintenant))
  const enCours = vues
    .filter((v) => !v.clos)
    .sort((a, b) => Number(b.bloqué) - Number(a.bloqué) || a.étape.rang - b.étape.rang || a.onboarding.misÀJourLe.getTime() - b.onboarding.misÀJourLe.getTime())
  const clos = vues.filter((v) => v.clos)
  const budget = déciderDuBudget({ dépenséUsd: dépenseDuMois(données.runsDuMois, maintenant), plafondUsd: 0, budgetUsd: budgetDesOnboardings() })
  return { enCours, clos, mois: moisDeParis(maintenant), budget }
}
