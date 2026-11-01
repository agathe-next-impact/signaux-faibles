import { and, desc, eq, gte, inArray, isNull, sql } from 'drizzle-orm'
import { base, type Base } from '@/lib/base/client'
import { protéger } from '@/lib/base/erreurs'
import { courriers, lecteurs, onboardingRuns, onboardings, organisations } from '@/lib/base/schema'
import { déciderDuBudget, dépenseDuMois, type DécisionDeBudget, type ÉtatDeRun } from '@/lib/domaine/onboarding'

/**
 * Le suivi des onboardings (lot 1 de `docs/proposition-onboarding-admin.md`,
 * 1er novembre 2026, migration 0019) : seul écrivain et seul lecteur des tables
 * `onboardings` et `onboarding_runs`, appelé par la seule orchestration
 * `lib/portail/onboarding.ts` et, pour les tableaux de l'opératrice, derrière
 * la garde de `lib/auth/appartenance.ts`. `tests/architecture.test.ts` le tient.
 *
 * Rien ici ne lit une adresse : le raccord à l'espace se fait par le slug, et
 * l'ouverture se constate par un compte de lecteurs actifs et la date du
 * dernier lien d'accès parti.
 */

export type TâcheDOnboarding = 'balayage' | 'premiere_lettre'

export type OuvertureDeRun = {
  /** `refusé` : le budget du mois ne permet pas ce run, qui est consigné sans être lancé. */
  readonly sorte: 'ouvert' | 'déjà-ouvert' | 'refusé'
  readonly onboardingId: string
  readonly runId: string
  readonly budget: DécisionDeBudget
}

/**
 * Le début d'un run, rapporté par le harnais. Crée l'onboarding du slug s'il
 * n'existe pas, puis décide du budget du mois **dans la même transaction**,
 * sous un verrou : deux runs qui commencent ensemble ne passent pas tous deux
 * sous la barre. Un run GitHub déjà connu (même identifiant, même tentative) est
 * rendu tel quel : un harnais qui relance son appel ne double rien.
 */
export async function ouvrirUnRunDOnboarding(
  entrée: {
    readonly slug: string
    readonly tâche: TâcheDOnboarding
    readonly runGithub: number | null
    readonly tentative: number | null
    readonly lien: string | null
    readonly plafondUsd: number
    readonly budgetUsd: number | null
    readonly débutDuMois: Date
    readonly maintenant: Date
  },
  db: Base = base(),
): Promise<OuvertureDeRun> {
  return protéger('ouverture d’un run d’onboarding', () =>
    db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext('budget-des-onboardings'))`)
      await tx.insert(onboardings).values({ slug: entrée.slug, crééPar: 'tache' }).onConflictDoNothing({ target: onboardings.slug })
      const [onboarding] = await tx.select({ id: onboardings.id }).from(onboardings).where(eq(onboardings.slug, entrée.slug)).limit(1)
      if (!onboarding) throw new Error(`onboarding ${entrée.slug} introuvable après création`)

      const duMois = await tx
        .select({ état: onboardingRuns.état, coûtUsd: onboardingRuns.coûtUsd, plafondUsd: onboardingRuns.plafondUsd, début: onboardingRuns.début, fin: onboardingRuns.fin, crééLe: onboardingRuns.crééLe, runGithub: onboardingRuns.runGithub, tentative: onboardingRuns.tentative, id: onboardingRuns.id, onboardingId: onboardingRuns.onboardingId })
        .from(onboardingRuns)
        .where(gte(onboardingRuns.crééLe, entrée.débutDuMois))
      const budget = déciderDuBudget({ dépenséUsd: dépenseDuMois(duMois, entrée.maintenant), plafondUsd: entrée.plafondUsd, budgetUsd: entrée.budgetUsd })

      if (entrée.runGithub !== null) {
        const [connu] = await tx
          .select({ id: onboardingRuns.id, état: onboardingRuns.état })
          .from(onboardingRuns)
          .where(and(eq(onboardingRuns.runGithub, entrée.runGithub), entrée.tentative === null ? isNull(onboardingRuns.tentative) : eq(onboardingRuns.tentative, entrée.tentative)))
          .limit(1)
        // Un rejeu rend la décision déjà prise, jamais une nouvelle.
        if (connu) return { sorte: connu.état === 'refuse' ? 'refusé' : 'déjà-ouvert', onboardingId: onboarding.id, runId: connu.id, budget }
      }

      const refusé = budget.sorte === 'refusé'
      const [run] = await tx
        .insert(onboardingRuns)
        .values({
          onboardingId: onboarding.id,
          tâche: entrée.tâche,
          état: refusé ? 'refuse' : 'en_cours',
          runGithub: entrée.runGithub,
          tentative: entrée.tentative,
          lien: entrée.lien,
          plafondUsd: entrée.plafondUsd,
          début: entrée.maintenant,
          ...(refusé ? { fin: entrée.maintenant, coûtUsd: 0 } : {}),
        })
        .returning({ id: onboardingRuns.id })
      await tx.update(onboardings).set({ misÀJourLe: entrée.maintenant }).where(eq(onboardings.id, onboarding.id))
      if (!run) throw new Error('run non créé')
      return { sorte: refusé ? 'refusé' : 'ouvert', onboardingId: onboarding.id, runId: run.id, budget }
    }),
  )
}

/**
 * La fin d'un run : son issue et son coût, lus dans `mesure.json`. Un run déjà
 * conclu n'est pas réécrit ; un run que la tâche a dit bloqué le reste, même si
 * la session s'est terminée proprement (elle s'est arrêtée sur une garde).
 */
export async function conclureUnRunDOnboarding(
  entrée: { readonly slug: string; readonly runId: string; readonly issue: 'reussi' | 'echec'; readonly coûtUsd: number | null; readonly maintenant: Date },
  db: Base = base(),
): Promise<'conclu' | 'déjà-conclu' | 'inconnu'> {
  return protéger('conclusion d’un run d’onboarding', async () => {
    const [run] = await db
      .select({ id: onboardingRuns.id, état: onboardingRuns.état, fin: onboardingRuns.fin, onboardingId: onboardingRuns.onboardingId })
      .from(onboardingRuns)
      .innerJoin(onboardings, eq(onboardings.id, onboardingRuns.onboardingId))
      .where(and(eq(onboardingRuns.id, entrée.runId), eq(onboardings.slug, entrée.slug)))
      .limit(1)
    if (!run) return 'inconnu'
    if (run.fin) return 'déjà-conclu'
    const état: ÉtatDeRun = run.état === 'bloque' ? 'bloque' : entrée.issue
    await db.update(onboardingRuns).set({ état, fin: entrée.maintenant, coûtUsd: entrée.coûtUsd }).where(eq(onboardingRuns.id, run.id))
    await db.update(onboardings).set({ misÀJourLe: entrée.maintenant }).where(eq(onboardings.id, run.onboardingId))
    return 'conclu'
  })
}

/**
 * Ce que la tâche rapporte du registre, qu'elle seule lit : la ligne, le statut
 * atteint, la garde sur laquelle elle s'arrête. Un motif marque bloqué le run en
 * cours le plus récent ; un rapport de statut sans motif efface le motif d'avant.
 */
export async function rapporterUnOnboarding(
  entrée: {
    readonly slug: string
    readonly statut: number | null
    readonly registre: string | null
    readonly motif: string | null
    readonly nom: string | null
    readonly site: string | null
    readonly maintenant: Date
  },
  db: Base = base(),
): Promise<'rapporté' | 'inconnu'> {
  return protéger('rapport d’un onboarding', () =>
    db.transaction(async (tx) => {
      const [onboarding] = await tx.select({ id: onboardings.id }).from(onboardings).where(eq(onboardings.slug, entrée.slug)).limit(1)
      if (!onboarding) return 'inconnu'
      await tx
        .update(onboardings)
        .set({
          misÀJourLe: entrée.maintenant,
          ...(entrée.statut !== null ? { statutRapporté: entrée.statut, statutRapportéLe: entrée.maintenant } : {}),
          ...(entrée.registre !== null ? { registreNotion: entrée.registre } : {}),
          ...(entrée.nom !== null ? { nom: entrée.nom } : {}),
          ...(entrée.site !== null ? { site: entrée.site } : {}),
          ...(entrée.motif !== null ? { motifDeBlocage: entrée.motif } : entrée.statut !== null ? { motifDeBlocage: null } : {}),
        })
        .where(eq(onboardings.id, onboarding.id))
      if (entrée.motif !== null) {
        const [enCours] = await tx
          .select({ id: onboardingRuns.id })
          .from(onboardingRuns)
          .where(and(eq(onboardingRuns.onboardingId, onboarding.id), isNull(onboardingRuns.fin), inArray(onboardingRuns.état, ['en_cours', 'lance'])))
          .orderBy(desc(onboardingRuns.crééLe))
          .limit(1)
        if (enCours) await tx.update(onboardingRuns).set({ état: 'bloque' }).where(eq(onboardingRuns.id, enCours.id))
      }
      return 'rapporté'
    }),
  )
}

// ── Lectures ─────────────────────────────────────────────────────────────────

export type RunLu = {
  readonly id: string
  readonly tâche: TâcheDOnboarding
  readonly état: ÉtatDeRun
  readonly runGithub: number | null
  readonly lien: string | null
  readonly plafondUsd: number | null
  readonly coûtUsd: number | null
  readonly début: Date | null
  readonly fin: Date | null
  readonly crééLe: Date
}

export type OnboardingLu = {
  readonly id: string
  readonly slug: string
  readonly nom: string | null
  readonly site: string | null
  readonly exécuteur: 'api' | 'cowork'
  readonly registreNotion: string | null
  readonly statutRapporté: number | null
  readonly statutRapportéLe: Date | null
  readonly motifDeBlocage: string | null
  readonly crééLe: Date
  readonly misÀJourLe: Date
  /** L'organisation du même slug, si l'étape B l'a créée. */
  readonly organisation: { readonly nom: string; readonly état: string; readonly activéeLe: Date | null; readonly essaiOuvertLe: Date | null } | null
  readonly lecteursActifs: number
  readonly dernierLienEnvoyéLe: Date | null
  /** Les plus récents d'abord, dix au plus. */
  readonly runs: readonly RunLu[]
}

export const RUNS_MONTRÉS = 10

async function lire(filtre: { readonly slug: string } | null, db: Base): Promise<OnboardingLu[]> {
  const lignes = await db
    .select({
      onboarding: onboardings,
      organisationId: organisations.id,
      organisationNom: organisations.nom,
      organisationÉtat: organisations.état,
      activéeLe: organisations.activéeLe,
      essaiOuvertLe: organisations.essaiOuvertLe,
    })
    .from(onboardings)
    .leftJoin(organisations, eq(organisations.slug, onboardings.slug))
    .where(filtre ? eq(onboardings.slug, filtre.slug) : undefined)
    .orderBy(desc(onboardings.misÀJourLe))
  if (lignes.length === 0) return []

  const ids = lignes.map((l) => l.onboarding.id)
  const orgIds = lignes.flatMap((l) => (l.organisationId ? [l.organisationId] : []))
  const [runs, actifs, liens] = await Promise.all([
    db.select().from(onboardingRuns).where(inArray(onboardingRuns.onboardingId, ids)).orderBy(desc(onboardingRuns.crééLe)),
    orgIds.length
      ? db
          .select({ organisationId: lecteurs.organisationId, n: sql<number>`count(*)::int` })
          .from(lecteurs)
          .where(and(inArray(lecteurs.organisationId, orgIds), eq(lecteurs.actif, true), eq(lecteurs.tousLesEspaces, false)))
          .groupBy(lecteurs.organisationId)
      : Promise.resolve([]),
    orgIds.length
      ? db
          .select({ organisationId: courriers.organisationId, le: sql<Date | string | null>`max(${courriers.concluLe})` })
          .from(courriers)
          .where(and(inArray(courriers.organisationId, orgIds), eq(courriers.sorte, 'lien_acces'), eq(courriers.état, 'envoye')))
          .groupBy(courriers.organisationId)
      : Promise.resolve([]),
  ])

  const date = (v: Date | string | null | undefined) => (v ? (v instanceof Date ? v : new Date(v)) : null)
  return lignes.map((l) => {
    const o = l.onboarding
    const sesRuns = runs.filter((r) => r.onboardingId === o.id).slice(0, RUNS_MONTRÉS)
    return {
      id: o.id,
      slug: o.slug,
      nom: o.nom,
      site: o.site,
      exécuteur: o.exécuteur,
      registreNotion: o.registreNotion,
      statutRapporté: o.statutRapporté,
      statutRapportéLe: o.statutRapportéLe,
      motifDeBlocage: o.motifDeBlocage,
      crééLe: o.crééLe,
      misÀJourLe: o.misÀJourLe,
      organisation:
        l.organisationId && l.organisationNom && l.organisationÉtat
          ? { nom: l.organisationNom, état: l.organisationÉtat, activéeLe: l.activéeLe, essaiOuvertLe: l.essaiOuvertLe }
          : null,
      lecteursActifs: Number(actifs.find((a) => a.organisationId === l.organisationId)?.n ?? 0),
      dernierLienEnvoyéLe: date(liens.find((c) => c.organisationId === l.organisationId)?.le),
      runs: sesRuns.map((r) => ({
        id: r.id,
        tâche: r.tâche,
        état: r.état,
        runGithub: r.runGithub,
        lien: r.lien,
        plafondUsd: r.plafondUsd,
        coûtUsd: r.coûtUsd,
        début: r.début,
        fin: r.fin,
        crééLe: r.crééLe,
      })),
    }
  })
}

/**
 * Tous les onboardings, avec les runs du mois pour la dépense. Traverse les
 * clients : le seul appelant est `listerLesOnboardings`, qui vérifie le
 * privilège avant (`tests/architecture.test.ts`).
 */
export async function tableauDesOnboardings(débutDuMois: Date, db: Base = base()): Promise<{ readonly onboardings: OnboardingLu[]; readonly runsDuMois: RunLu[] }> {
  return protéger('lecture du tableau des onboardings', async () => {
    const [liste, duMois] = await Promise.all([lire(null, db), db.select().from(onboardingRuns).where(gte(onboardingRuns.crééLe, débutDuMois))])
    return {
      onboardings: liste,
      runsDuMois: duMois.map((r) => ({ id: r.id, tâche: r.tâche, état: r.état, runGithub: r.runGithub, lien: r.lien, plafondUsd: r.plafondUsd, coûtUsd: r.coûtUsd, début: r.début, fin: r.fin, crééLe: r.crééLe })),
    }
  })
}

/** L'onboarding d'un slug, pour la fiche de l'organisation ; `null` sans onboarding suivi. */
export async function onboardingDUnSlug(slug: string, db: Base = base()): Promise<OnboardingLu | null> {
  return protéger('lecture d’un onboarding', async () => (await lire({ slug }, db))[0] ?? null)
}
