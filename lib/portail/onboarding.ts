import {
  conclureUnLancement,
  conclureUnRunDOnboarding,
  demandeÀTransmettre,
  effacerLesDemandesAnciennes,
  enregistrerUneDemande,
  onboardingDUnSlug,
  onboardingsPourLeContrôle,
  ouvrirUnRunDOnboarding,
  réserverUnLancement,
  rapporterUnOnboarding,
  type DemandeÀTransmettre,
  type EnregistrementDeDemande,
  type OnboardingLu,
  type OuvertureDeRun,
  type RunLu,
  type TâcheDOnboarding,
} from '@/lib/base/onboardings'
import { configurationGithub, déclencherLeWorkflow } from '@/lib/github/workflow'
import type { Défaut } from '@/lib/portail/etat'
import {
  alertesDUnOnboarding,
  contrôlerLaDemande,
  type ChampDeLaDemande,
  débutDuMoisDeParis,
  gesteDisponible,
  PLAFONDS_DES_TÂCHES,
  type Geste,
  type GesteDisponible,
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
    readonly lancement?: string | null
  },
  maintenant: Date = new Date(),
): Promise<OuvertureDeRun & { readonly demande: DemandeÀTransmettre | null }> {
  const ouverture = await ouvrirUnRunDOnboarding({ ...entrée, budgetUsd: budgetDesOnboardings(), débutDuMois: débutDuMoisDeParis(maintenant), maintenant })
  // La demande du formulaire (lot 3) part avec le début, tant que la ligne du
  // registre n'est pas rapportée : la tâche la recopie dans le registre.
  const demande = ouverture.sorte === 'refusé' ? null : await demandeÀTransmettre(entrée.slug)
  return { ...ouverture, demande }
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
  /** Le seul geste possible à cette étape (lot 2). */
  readonly geste: GesteDisponible
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
  const bloqué = estBloqué({ motifDeBlocage: onboarding.motifDeBlocage, dernierRun }, maintenant)
  return {
    onboarding,
    étape,
    bloqué,
    geste: gesteDisponible({ étape: étape.étape, exécuteur: onboarding.exécuteur, bloqué, dernierRun }),
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

// ── Lancer depuis le portail (lot 2, 1er novembre 2026) ──────────────────────

export type IssueDuLancement =
  | 'lancé'
  | 'indisponible'
  | 'inconnu'
  | 'geste-périmé'
  | 'en-cours'
  | 'cowork'
  | 'budget-atteint'
  | 'échec-github'

/** Vrai si le portail peut déclencher le workflow : l'écran montre sinon la commande à lancer à la main. */
export function lancementDisponible(): boolean {
  return configurationGithub() !== null
}

/**
 * Le geste de l'opératrice, dans l'ordre du §5 de la proposition : l'appelant a
 * vérifié le privilège (`exigerOpérateur`) ; ici, le jeton GitHub, l'étape
 * calculée qui doit être celle du bouton (un formulaire rejoué ne relance
 * rien), puis la réservation, qui refuse un run en cours et un budget dépassé,
 * **avant** l'appel à GitHub, enfin l'appel et sa conclusion. Le run porte
 * l'identifiant de la réservation dans l'entrée `lancement` du workflow : le
 * harnais la reprend au début.
 */
export async function lancerDepuisLePortail(
  entrée: { readonly slug: string; readonly geste: Geste; readonly opératrice: string },
  maintenant: Date = new Date(),
): Promise<IssueDuLancement> {
  const github = configurationGithub()
  if (!github) return 'indisponible'
  const lu = await onboardingDUnSlug(entrée.slug)
  if (!lu) return 'inconnu'
  const vue = vueDUnOnboarding(lu, maintenant)
  if (vue.geste.sorte !== 'geste') return vue.geste.raison === 'en-cours' ? 'en-cours' : vue.geste.raison === 'cowork' ? 'cowork' : 'geste-périmé'
  if (vue.geste.geste !== entrée.geste) return 'geste-périmé'

  const tâche = vue.geste.tâche
  const réservation = await réserverUnLancement({
    slug: entrée.slug,
    tâche: TÂCHES_SUIVIES[tâche]!,
    plafondUsd: PLAFONDS_DES_TÂCHES[tâche],
    budgetUsd: budgetDesOnboardings(),
    débutDuMois: débutDuMoisDeParis(maintenant),
    opératrice: entrée.opératrice,
    maintenant,
  })
  if (réservation.sorte !== 'réservé') return réservation.sorte

  let déclenchement: Awaited<ReturnType<typeof déclencherLeWorkflow>>
  try {
    déclenchement = await déclencherLeWorkflow(github, { tache: tâche, organisation: entrée.slug, lancement: réservation.runId })
  } catch {
    déclenchement = { sorte: 'échec', codeHttp: null }
  }
  if (déclenchement.sorte === 'échec') {
    await conclureUnLancement({ runId: réservation.runId, sorte: 'échec', codeHttp: déclenchement.codeHttp, maintenant })
    console.warn(`[onboarding] ${entrée.slug} : ${tâche} non déclenché (GitHub ${déclenchement.codeHttp ?? 'sans réponse'}).`)
    return 'échec-github'
  }
  await conclureUnLancement({ runId: réservation.runId, sorte: 'lancé', runGithub: déclenchement.runGithub, lien: déclenchement.lien, maintenant })
  return 'lancé'
}

/** Les alertes du contrôle du soir sur les onboardings (lot 2), en défauts rangés par slug. */
export async function alertesDesOnboardings(maintenant: Date = new Date()): Promise<Défaut[]> {
  const défauts: Défaut[] = []
  for (const o of await onboardingsPourLeContrôle()) {
    const vue = vueDUnOnboarding(o, maintenant)
    for (const a of alertesDUnOnboarding({ étape: vue.étape.étape, clos: vue.clos, misÀJourLe: o.misÀJourLe, dernierRun: o.runs[0] ?? null }, maintenant)) {
      défauts.push({ slug: o.slug, code: a.code, message: a.message })
    }
  }
  return défauts
}

// ── La demande du formulaire (lot 3, 1er novembre 2026) ──────────────────────

export type IssueDeLaDemande =
  | { readonly sorte: 'invalide'; readonly champs: readonly ChampDeLaDemande[] }
  | Exclude<EnregistrementDeDemande, { readonly sorte: 'enregistrée' }>
  | { readonly sorte: 'enregistrée'; readonly onboardingId: string; readonly slug: string }

/**
 * La porte puis l'écriture : `contrôlerLaDemande` avant `enregistrerUneDemande`
 * (`tests/architecture.test.ts` tient l'ordre). L'appelant a vérifié le
 * privilège. Rien n'est lancé : le geste « Générer les référentiels » suit.
 */
export async function enregistrerLaDemande(
  entrée: {
    readonly champs: { readonly nom: string; readonly site: string; readonly slug?: string; readonly objectifs?: string; readonly lecteurNom?: string; readonly lecteurEmail?: string; readonly exécuteur?: string }
    readonly opératrice: string
  },
  maintenant: Date = new Date(),
): Promise<IssueDeLaDemande> {
  const contrôle = contrôlerLaDemande(entrée.champs)
  if (contrôle.sorte === 'invalide') return contrôle
  const r = await enregistrerUneDemande({ demande: contrôle.demande, opératrice: entrée.opératrice, maintenant })
  return r.sorte === 'enregistrée' ? { ...r, slug: contrôle.demande.slug } : r
}

/** Pour le passage quotidien : l'intake de plus de trente jours est effacé. */
export function effacerLesDemandesExpirées(maintenant: Date = new Date()): Promise<number> {
  return effacerLesDemandesAnciennes(maintenant)
}

