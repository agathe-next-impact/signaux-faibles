/**
 * L'onboarding vu par le portail (lot 1 de `docs/proposition-onboarding-admin.md`,
 * 1er novembre 2026). Fonctions pures : l'étape, ce qui la bloque, ce qui la clôt,
 * et la décision de budget.
 *
 * **L'étape n'est jamais stockée quand le portail peut la calculer**, comme
 * `étapeDuParcours` : l'entrée en essai, J0 et l'ouverture de l'espace sont des
 * faits qu'il voit dans Postgres. Les étapes d'avant (référentiels générés, puis
 * validés) ne vivent que dans le registre Notion, que le portail ne lit pas :
 * elles viennent du statut que la tâche rapporte. L'étape retenue est la plus
 * avancée des deux, si bien qu'un rapport en retard ne fait jamais reculer un
 * fait constaté.
 */

export const ÉTAPES_D_ONBOARDING = [
  'demande',
  'referentiels_generes',
  'referentiels_valides',
  'en_essai',
  'premiere_lettre_publiee',
  'espace_ouvert',
] as const

export type ÉtapeDOnboarding = (typeof ÉTAPES_D_ONBOARDING)[number]

export const LIBELLÉS_DES_ÉTAPES: Readonly<Record<ÉtapeDOnboarding, string>> = {
  demande: 'Demande enregistrée',
  referentiels_generes: 'Référentiels générés',
  referentiels_valides: 'Référentiels validés',
  en_essai: 'Première lettre produite, en essai',
  premiere_lettre_publiee: 'Première lettre publiée',
  espace_ouvert: 'Espace ouvert',
}

/** D'où le portail tient chaque étape : c'est ce que l'écran dit à côté d'elle. */
export type Provenance = 'rapportée' | 'constatée' | 'non-rapportée' | 'à-venir'

export type ÉtatDeRun = 'demande' | 'lance' | 'en_cours' | 'reussi' | 'bloque' | 'echec' | 'refuse'

export type EntréeDeLÉtape = {
  /** Statut du registre (1 à 6) rapporté par la tâche, `null` sans rapport. */
  readonly statutRapporté: number | null
  /** L'organisation du même slug dans Postgres, `null` tant que l'étape B ne l'a pas créée. */
  readonly organisation: {
    readonly état: string
    readonly activéeLe: Date | null
    readonly essaiOuvertLe: Date | null
  } | null
  readonly lecteursActifs: number
  /** Le dernier lien d'accès parti (`courriers`, sorte `lien_acces`, état `envoye`). */
  readonly dernierLienEnvoyéLe: Date | null
}

const rang = (étape: ÉtapeDOnboarding) => ÉTAPES_D_ONBOARDING.indexOf(étape)

/** Le statut du registre traduit en étape ; 4 à 6 disent au moins « première lettre produite ». */
export function étapeDuStatut(statut: number | null): ÉtapeDOnboarding | null {
  if (statut === null || !Number.isInteger(statut) || statut < 1 || statut > 6) return null
  if (statut === 1) return 'demande'
  if (statut === 2) return 'referentiels_generes'
  if (statut === 3) return 'referentiels_valides'
  return 'en_essai'
}

/** L'étape que le portail constate seul, sans rapport. */
export function étapeConstatée(entrée: EntréeDeLÉtape): ÉtapeDOnboarding | null {
  const o = entrée.organisation
  if (!o) return null
  if (o.activéeLe && entrée.lecteursActifs > 0 && entrée.dernierLienEnvoyéLe) return 'espace_ouvert'
  if (o.activéeLe) return 'premiere_lettre_publiee'
  // Une organisation créée par `POST /api/veille/organisations` (étape B) est
  // en essai ; une organisation déjà abonnée, ou entrée par prospection
  // (`demande`), l'a dépassée ou ne l'a pas encore atteinte au sens du registre.
  if (o.état === 'essai' || o.état === 'abonnee') return 'en_essai'
  return null
}

export type ÉtapeCalculée = {
  readonly étape: ÉtapeDOnboarding
  readonly rang: number
  readonly provenances: Readonly<Record<ÉtapeDOnboarding, Provenance>>
}

export function étapeDeLOnboarding(entrée: EntréeDeLÉtape): ÉtapeCalculée {
  const rapportée = étapeDuStatut(entrée.statutRapporté)
  const constatée = étapeConstatée(entrée)
  const rangRapporté = rapportée ? rang(rapportée) : -1
  const rangConstaté = constatée ? rang(constatée) : -1
  const r = Math.max(0, rangRapporté, rangConstaté)
  const provenances = Object.fromEntries(
    ÉTAPES_D_ONBOARDING.map((é, i) => {
      // « Demande » est acquise dès que la ligne existe.
      if (i === 0) return [é, (rangRapporté >= 0 ? 'rapportée' : 'constatée') as Provenance]
      if (i <= rangConstaté && i >= rang('en_essai')) return [é, 'constatée' as Provenance]
      if (i <= rangRapporté) return [é, 'rapportée' as Provenance]
      if (i <= r) return [é, 'non-rapportée' as Provenance]
      return [é, 'à-venir' as Provenance]
    }),
  ) as Record<ÉtapeDOnboarding, Provenance>
  return { étape: ÉTAPES_D_ONBOARDING[r]!, rang: r, provenances }
}

/** Un run qui n'a rien dit depuis trois heures n'est plus « en cours » : même durée que la reprise d'un travail de la file. */
export const DURÉE_D_UN_RUN_SANS_NOUVELLES_MS = 3 * 60 * 60 * 1000

export type RunVu = {
  readonly état: ÉtatDeRun
  readonly début: Date | null
  readonly fin: Date | null
  readonly crééLe: Date
}

/** L'état qu'on montre : un run `en_cours` muet depuis trois heures est dit « sans nouvelles ». */
export function étatMontré(run: RunVu, maintenant: Date): ÉtatDeRun | 'sans_nouvelles' {
  if ((run.état === 'en_cours' || run.état === 'lance') && !run.fin) {
    const depuis = (run.début ?? run.crééLe).getTime()
    if (maintenant.getTime() - depuis > DURÉE_D_UN_RUN_SANS_NOUVELLES_MS) return 'sans_nouvelles'
  }
  return run.état
}

export const LIBELLÉS_DES_RUNS: Readonly<Record<ÉtatDeRun | 'sans_nouvelles', string>> = {
  demande: 'demandé',
  lance: 'lancé',
  en_cours: 'en cours',
  reussi: 'réussi',
  bloque: 'bloqué',
  echec: 'échec',
  refuse: 'refusé (budget)',
  sans_nouvelles: 'sans nouvelles',
}

/** Bloqué : la tâche a rapporté un motif, ou le dernier run a échoué ou été refusé. */
export function estBloqué(entrée: { readonly motifDeBlocage: string | null; readonly dernierRun: RunVu | null }, maintenant: Date): boolean {
  if (entrée.motifDeBlocage) return true
  if (!entrée.dernierRun) return false
  const état = étatMontré(entrée.dernierRun, maintenant)
  return état === 'echec' || état === 'bloque' || état === 'refuse' || état === 'sans_nouvelles'
}

/** Un onboarding dont l'espace est ouvert depuis plus de quatorze jours sort de la liste ; sa fiche le garde. */
export const JOURS_AVANT_CLÔTURE = 14

export function estClos(étape: ÉtapeDOnboarding, dernierLienEnvoyéLe: Date | null, maintenant: Date): boolean {
  if (étape !== 'espace_ouvert' || !dernierLienEnvoyéLe) return false
  return maintenant.getTime() - dernierLienEnvoyéLe.getTime() > JOURS_AVANT_CLÔTURE * 24 * 60 * 60 * 1000
}

// ── Budget (décision 5 du 1er novembre 2026 : bloquer, de façon paramétrable) ──

/** Le mois de Paris d'un instant, `AAAA-MM` : la fenêtre du budget. */
export function moisDeParis(instant: Date): string {
  const parties = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit' }).formatToParts(instant)
  const année = parties.find((p) => p.type === 'year')?.value ?? '0000'
  const mois = parties.find((p) => p.type === 'month')?.value ?? '00'
  return `${année}-${mois}`
}

/**
 * Le premier instant du mois de Paris qui contient `instant`, en UTC. Paris est
 * à UTC+1 ou UTC+2 : minuit le 1er tombe la veille au soir en UTC.
 */
export function débutDuMoisDeParis(instant: Date): Date {
  const [année, mois] = moisDeParis(instant).split('-').map(Number) as [number, number]
  for (const décalage of [1, 2]) {
    const candidat = new Date(Date.UTC(année, mois - 1, 1, -décalage, 0, 0))
    if (moisDeParis(candidat) === moisDeParis(instant) && moisDeParis(new Date(candidat.getTime() - 1)) !== moisDeParis(instant)) return candidat
  }
  return new Date(Date.UTC(année, mois - 1, 1))
}

/**
 * Le budget mensuel des onboardings, lu dans `ONBOARDING_BUDGET_MENSUEL_USD`.
 * Absent ou vide : aucun blocage. Illisible ou négatif : aucun blocage non plus,
 * et l'appelant le journalise ; un réglage mal écrit ne doit pas arrêter tous
 * les onboardings sans qu'on sache pourquoi.
 */
export function lireLeBudget(valeur: string | undefined): { readonly budgetUsd: number | null; readonly illisible: boolean } {
  if (valeur === undefined || valeur.trim() === '') return { budgetUsd: null, illisible: false }
  const nombre = Number(valeur.trim().replace(',', '.'))
  if (!Number.isFinite(nombre) || nombre < 0) return { budgetUsd: null, illisible: true }
  return { budgetUsd: nombre, illisible: false }
}

export type DécisionDeBudget =
  | { readonly sorte: 'sans-budget'; readonly dépenséUsd: number }
  | { readonly sorte: 'accepté' | 'refusé'; readonly dépenséUsd: number; readonly budgetUsd: number; readonly plafondUsd: number }

/**
 * Un run n'est accepté que si ce qui est déjà dépensé ce mois, plus son propre
 * plafond, tient dans le budget : le plafond est la dépense maximale du run
 * (`maxBudgetUsd` du harnais), si bien que le budget ne peut pas être dépassé
 * par un run accepté. Les runs en cours sans coût connu comptent pour leur
 * plafond : deux lancements simultanés ne passent pas tous deux sous la barre.
 */
export function déciderDuBudget(entrée: { readonly dépenséUsd: number; readonly plafondUsd: number; readonly budgetUsd: number | null }): DécisionDeBudget {
  const dépenséUsd = arrondir(entrée.dépenséUsd)
  if (entrée.budgetUsd === null) return { sorte: 'sans-budget', dépenséUsd }
  const plafondUsd = arrondir(Math.max(0, entrée.plafondUsd))
  const sorte = dépenséUsd + plafondUsd <= entrée.budgetUsd + 1e-9 ? 'accepté' : 'refusé'
  return { sorte, dépenséUsd, budgetUsd: entrée.budgetUsd, plafondUsd }
}

/**
 * Ce que le mois a coûté : le coût mesuré, ou le plafond d'un run sans coût
 * encore en cours. Un run muet depuis trois heures ne compte plus pour son
 * plafond : il n'est plus en train de dépenser, et le compter bloquerait le mois.
 */
export function dépenseDuMois(
  runs: readonly (RunVu & { readonly coûtUsd: number | null; readonly plafondUsd: number | null })[],
  maintenant: Date,
): number {
  let total = 0
  for (const r of runs) {
    if (r.état === 'refuse') continue
    if (r.coûtUsd !== null) total += r.coûtUsd
    else {
      const état = étatMontré(r, maintenant)
      if (état === 'en_cours' || état === 'lance') total += r.plafondUsd ?? 0
    }
  }
  return arrondir(total)
}

const arrondir = (n: number) => Math.round(n * 10_000) / 10_000

export function formaterDollars(n: number): string {
  return `${new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)} $`
}
