import { and, desc, eq, gte, inArray, isNotNull, isNull, lt, ne, sql } from 'drizzle-orm'
import { base, type Base } from '@/lib/base/client'
import { protéger } from '@/lib/base/erreurs'
import { courriers, lecteurs, onboardingRuns, onboardings, organisations } from '@/lib/base/schema'
import {
  CRÉNEAUX_COWORK_PAR_SEMAINE,
  déciderDuBudget,
  dépenseDuMois,
  domaineDuSite,
  étatMontré,
  lundiDeParis,
  nomComparable,
  type DécisionDeBudget,
  type DemandeContrôlée,
  type ÉtatDeRun,
} from '@/lib/domaine/onboarding'

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

export type TâcheDOnboarding = 'balayage' | 'premiere_lettre' | 'onboarding'

/** Ce que le portail demande à un run en plus de sa tâche (lot 6, 2 novembre 2026). */
export type ConsigneDuRun = 'sans-validation' | 'activation'

const lireLaConsigne = (valeur: string | null): ConsigneDuRun | null => (valeur === 'sans-validation' || valeur === 'activation' ? valeur : null)

/** La fin d'un run, et ce qu'il faut savoir pour enchaîner (lot 6) : sa tâche, sa consigne, s'il a été lancé du portail. */
export type ConclusionDeRun =
  | { readonly sorte: 'conclu'; readonly état: ÉtatDeRun; readonly tâche: TâcheDOnboarding; readonly consigne: ConsigneDuRun | null; readonly lancéParLePortail: boolean }
  | { readonly sorte: 'déjà-conclu' }
  | { readonly sorte: 'inconnu' }

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
    /** Le run Trigger.dev, pour le moteur (lot 5). */
    readonly runTrigger?: string | null
    readonly plafondUsd: number
    readonly budgetUsd: number | null
    readonly débutDuMois: Date
    readonly maintenant: Date
    /**
     * La ligne réservée par le portail quand l'opératrice a lancé le run (lot 2),
     * reçue par l'entrée `lancement` du workflow : le début la reprend au lieu
     * d'en créer une, et son plafond déjà compté ne l'est pas deux fois.
     */
    readonly lancement?: string | null
  },
  db: Base = base(),
): Promise<OuvertureDeRun> {
  return protéger('ouverture d’un run d’onboarding', () =>
    db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext('budget-des-onboardings'))`)
      await tx.insert(onboardings).values({ slug: entrée.slug, crééPar: 'tache' }).onConflictDoNothing({ target: onboardings.slug })
      const [onboarding] = await tx.select({ id: onboardings.id }).from(onboardings).where(eq(onboardings.slug, entrée.slug)).limit(1)
      if (!onboarding) throw new Error(`onboarding ${entrée.slug} introuvable après création`)

      // Un lancement du portail encore en attente de son début : on le reprend.
      const [réservé] = entrée.lancement
        ? await tx
            .select({ id: onboardingRuns.id })
            .from(onboardingRuns)
            .where(
              and(
                eq(onboardingRuns.id, entrée.lancement),
                eq(onboardingRuns.onboardingId, onboarding.id),
                eq(onboardingRuns.tâche, entrée.tâche),
                inArray(onboardingRuns.état, ['demande', 'lance']),
                isNull(onboardingRuns.fin),
              ),
            )
            .limit(1)
        : []

      const duMois = await tx
        .select({ état: onboardingRuns.état, coûtUsd: onboardingRuns.coûtUsd, plafondUsd: onboardingRuns.plafondUsd, début: onboardingRuns.début, fin: onboardingRuns.fin, crééLe: onboardingRuns.crééLe, runGithub: onboardingRuns.runGithub, tentative: onboardingRuns.tentative, id: onboardingRuns.id, onboardingId: onboardingRuns.onboardingId })
        .from(onboardingRuns)
        .where(réservé ? and(gte(onboardingRuns.crééLe, entrée.débutDuMois), ne(onboardingRuns.id, réservé.id)) : gte(onboardingRuns.crééLe, entrée.débutDuMois))
      const budget = déciderDuBudget({ dépenséUsd: dépenseDuMois(duMois, entrée.maintenant), plafondUsd: entrée.plafondUsd, budgetUsd: entrée.budgetUsd })

      if (réservé) {
        const refusé = budget.sorte === 'refusé'
        await tx
          .update(onboardingRuns)
          .set({
            état: refusé ? 'refuse' : 'en_cours',
            runGithub: entrée.runGithub,
            tentative: entrée.tentative,
            lien: entrée.lien,
            ...(entrée.runTrigger ? { runTrigger: entrée.runTrigger } : {}),
            plafondUsd: entrée.plafondUsd,
            début: entrée.maintenant,
            ...(refusé ? { fin: entrée.maintenant, coûtUsd: 0 } : {}),
          })
          .where(eq(onboardingRuns.id, réservé.id))
        await tx.update(onboardings).set({ misÀJourLe: entrée.maintenant }).where(eq(onboardings.id, onboarding.id))
        return { sorte: refusé ? 'refusé' : 'ouvert', onboardingId: onboarding.id, runId: réservé.id, budget }
      }

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
          runTrigger: entrée.runTrigger ?? null,
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
): Promise<ConclusionDeRun> {
  return protéger('conclusion d’un run d’onboarding', async () => {
    const [run] = await db
      .select({
        id: onboardingRuns.id,
        état: onboardingRuns.état,
        fin: onboardingRuns.fin,
        onboardingId: onboardingRuns.onboardingId,
        tâche: onboardingRuns.tâche,
        consigne: onboardingRuns.consigne,
        lancéPar: onboardingRuns.lancéPar,
      })
      .from(onboardingRuns)
      .innerJoin(onboardings, eq(onboardings.id, onboardingRuns.onboardingId))
      .where(and(eq(onboardingRuns.id, entrée.runId), eq(onboardings.slug, entrée.slug)))
      .limit(1)
    if (!run) return { sorte: 'inconnu' }
    if (run.fin) return { sorte: 'déjà-conclu' }
    const état: ÉtatDeRun = run.état === 'bloque' ? 'bloque' : entrée.issue
    await db.update(onboardingRuns).set({ état, fin: entrée.maintenant, coûtUsd: entrée.coûtUsd }).where(eq(onboardingRuns.id, run.id))
    await db.update(onboardings).set({ misÀJourLe: entrée.maintenant }).where(eq(onboardings.id, run.onboardingId))
    return { sorte: 'conclu', état, tâche: run.tâche, consigne: lireLaConsigne(run.consigne), lancéParLePortail: run.lancéPar !== null }
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
    /**
     * `cowork` : le rapport vient d'une commande `/onboarding-*` (lot 4), qui
     * n'a pas de run à annoncer. L'onboarding est alors créé s'il manque, ou
     * rattaché à la demande Cowork du formulaire de même nom, encore sans ligne
     * du registre : la commande ne connaît que le slug du registre, posé au §3.
     * Un onboarding qui existe garde son exécuteur : l'activation et
     * l'ouverture de l'espace rapportent aussi sur les onboardings de l'API.
     */
    readonly exécuteur?: 'cowork' | null
  },
  db: Base = base(),
): Promise<'rapporté' | 'inconnu' | 'créé' | 'rattaché'> {
  return protéger('rapport d’un onboarding', () =>
    db.transaction(async (tx) => {
      let [onboarding] = await tx.select({ id: onboardings.id }).from(onboardings).where(eq(onboardings.slug, entrée.slug)).limit(1)
      let issue: 'rapporté' | 'créé' | 'rattaché' = 'rapporté'
      if (!onboarding && entrée.exécuteur === 'cowork') {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext('demandes-d-onboarding'))`)
        const candidates = entrée.nom
          ? (
              await tx
                .select({ id: onboardings.id, nom: onboardings.nom })
                .from(onboardings)
                .where(and(eq(onboardings.exécuteur, 'cowork'), isNull(onboardings.registreNotion)))
            ).filter((c) => c.nom && nomComparable(c.nom) === nomComparable(entrée.nom!))
          : []
        if (candidates.length === 1) {
          await tx.update(onboardings).set({ slug: entrée.slug }).where(eq(onboardings.id, candidates[0]!.id))
          onboarding = { id: candidates[0]!.id }
          issue = 'rattaché'
        } else {
          const [créé] = await tx
            .insert(onboardings)
            .values({ slug: entrée.slug, exécuteur: 'cowork', crééPar: 'cowork', crééLe: entrée.maintenant, misÀJourLe: entrée.maintenant })
            .returning({ id: onboardings.id })
          onboarding = créé
          issue = 'créé'
        }
      }
      if (!onboarding) return 'inconnu'
      await tx
        .update(onboardings)
        .set({
          misÀJourLe: entrée.maintenant,
          ...(entrée.statut !== null ? { statutRapporté: entrée.statut, statutRapportéLe: entrée.maintenant } : {}),
          // La ligne du registre existe : c'est elle qui porte la demande, le
          // portail efface la sienne (décision 1 du 1er novembre 2026).
          ...(entrée.registre !== null ? { registreNotion: entrée.registre, intake: null } : {}),
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
      return issue
    }),
  )
}

/**
 * L'onboarding d'un slug, créé s'il manque (lot 5) : quand l'opératrice passe
 * une organisation « à onboarder » dans l'admin Payload sans avoir rempli le
 * formulaire du portail, le lancement a besoin d'une ligne à réserver.
 */
export async function assurerUnOnboarding(
  entrée: { readonly slug: string; readonly nom: string | null; readonly crééPar: string; readonly maintenant: Date },
  db: Base = base(),
): Promise<'créé' | 'existant'> {
  return protéger('création d’un onboarding manquant', async () => {
    const créés = await db
      .insert(onboardings)
      .values({ slug: entrée.slug, nom: entrée.nom, crééPar: entrée.crééPar, crééLe: entrée.maintenant, misÀJourLe: entrée.maintenant })
      .onConflictDoNothing({ target: onboardings.slug })
      .returning({ id: onboardings.id })
    return créés.length > 0 ? 'créé' : 'existant'
  })
}

// ── Lancement depuis le portail (lot 2, 1er novembre 2026) ───────────────────

export type RéservationDeLancement =
  | { readonly sorte: 'réservé'; readonly runId: string; readonly budget: DécisionDeBudget }
  | { readonly sorte: 'budget-atteint'; readonly budget: DécisionDeBudget }
  | { readonly sorte: 'en-cours' | 'inconnu' | 'cowork' }

/**
 * Réserve la ligne d'un run **avant** l'appel à GitHub, comme `envoyerCourrier`
 * réserve avant Gmail : un double clic trouve la réservation et s'arrête. Sous
 * le même verrou que le début d'un run, pour que le budget décidé ici et celui
 * décidé au début ne se croisent pas. Un run sans fin et sans trois heures de
 * silence (`étatMontré`) est en cours, qu'il vienne du portail ou de GitHub.
 */
export async function réserverUnLancement(
  entrée: {
    readonly slug: string
    readonly tâche: TâcheDOnboarding
    readonly plafondUsd: number
    readonly budgetUsd: number | null
    readonly débutDuMois: Date
    readonly opératrice: string
    /** Ce que le portail demande au run en plus de sa tâche (lot 6) ; nul pour un run ordinaire. */
    readonly consigne?: ConsigneDuRun | null
    readonly maintenant: Date
  },
  db: Base = base(),
): Promise<RéservationDeLancement> {
  return protéger('réservation d’un lancement d’onboarding', () =>
    db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext('budget-des-onboardings'))`)
      const [onboarding] = await tx.select({ id: onboardings.id, exécuteur: onboardings.exécuteur }).from(onboardings).where(eq(onboardings.slug, entrée.slug)).limit(1)
      if (!onboarding) return { sorte: 'inconnu' }
      if (onboarding.exécuteur === 'cowork') return { sorte: 'cowork' }
      const ouverts = await tx
        .select({ état: onboardingRuns.état, début: onboardingRuns.début, fin: onboardingRuns.fin, crééLe: onboardingRuns.crééLe })
        .from(onboardingRuns)
        .where(and(eq(onboardingRuns.onboardingId, onboarding.id), isNull(onboardingRuns.fin)))
      if (ouverts.some((r) => ['demande', 'lance', 'en_cours'].includes(étatMontré(r, entrée.maintenant)))) return { sorte: 'en-cours' }

      const duMois = await tx
        .select({ état: onboardingRuns.état, coûtUsd: onboardingRuns.coûtUsd, plafondUsd: onboardingRuns.plafondUsd, début: onboardingRuns.début, fin: onboardingRuns.fin, crééLe: onboardingRuns.crééLe })
        .from(onboardingRuns)
        .where(gte(onboardingRuns.crééLe, entrée.débutDuMois))
      const budget = déciderDuBudget({ dépenséUsd: dépenseDuMois(duMois, entrée.maintenant), plafondUsd: entrée.plafondUsd, budgetUsd: entrée.budgetUsd })
      if (budget.sorte === 'refusé') return { sorte: 'budget-atteint', budget }

      const [run] = await tx
        .insert(onboardingRuns)
        .values({ onboardingId: onboarding.id, tâche: entrée.tâche, état: 'demande', plafondUsd: entrée.plafondUsd, lancéPar: entrée.opératrice, consigne: entrée.consigne ?? null })
        .returning({ id: onboardingRuns.id })
      if (!run) throw new Error('lancement non réservé')
      await tx.update(onboardings).set({ misÀJourLe: entrée.maintenant }).where(eq(onboardings.id, onboarding.id))
      return { sorte: 'réservé', runId: run.id, budget }
    }),
  )
}

/**
 * Conclut la réservation selon la réponse de GitHub : `lance` (avec le run
 * GitHub quand il est connu), ou `echec` avec le code, fin posée et coût nul :
 * rien n'a tourné. Ne touche qu'une ligne encore en `demande`.
 */
export async function conclureUnLancement(
  entrée:
    | { readonly runId: string; readonly sorte: 'lancé'; readonly runGithub: number | null; readonly lien: string | null; readonly runTrigger?: string | null; readonly maintenant: Date }
    | { readonly runId: string; readonly sorte: 'échec'; readonly codeHttp: number | null; readonly maintenant: Date },
  db: Base = base(),
): Promise<void> {
  await protéger('conclusion d’un lancement d’onboarding', async () => {
    const où = and(eq(onboardingRuns.id, entrée.runId), eq(onboardingRuns.état, 'demande'))
    if (entrée.sorte === 'lancé') {
      await db.update(onboardingRuns).set({ état: 'lance', runGithub: entrée.runGithub, lien: entrée.lien, runTrigger: entrée.runTrigger ?? null }).where(où)
    } else {
      await db.update(onboardingRuns).set({ état: 'echec', codeHttp: entrée.codeHttp, fin: entrée.maintenant, coûtUsd: 0 }).where(où)
    }
  })
}

// ── La demande enregistrée depuis le portail (lot 3, 1er novembre 2026) ─────

export type EnregistrementDeDemande =
  | { readonly sorte: 'enregistrée'; readonly onboardingId: string }
  | { readonly sorte: 'doublon'; readonly par: 'slug' | 'nom' | 'site'; readonly slug: string; readonly où: 'onboarding' | 'organisation' }
  | { readonly sorte: 'créneaux-cowork'; readonly pris: number }

/**
 * Enregistre une demande, sans rien lancer (décision 4 : le lancement est un
 * second geste). Avant d'écrire, sous un verrou : le slug libre parmi les
 * onboardings et les organisations, le même nom ou le même domaine nulle part
 * (accents et casse ignorés), et pour Cowork un créneau libre dans la semaine
 * ISO de Paris. L'anti-doublon contre le registre Notion reste celui de la
 * tâche, qui seule le lit.
 */
export async function enregistrerUneDemande(
  entrée: { readonly demande: DemandeContrôlée; readonly opératrice: string; readonly maintenant: Date },
  db: Base = base(),
): Promise<EnregistrementDeDemande> {
  const d = entrée.demande
  return protéger('enregistrement d’une demande d’onboarding', () =>
    db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext('demandes-d-onboarding'))`)
      const [existants, orgs] = await Promise.all([
        tx.select({ slug: onboardings.slug, nom: onboardings.nom, site: onboardings.site, exécuteur: onboardings.exécuteur, crééLe: onboardings.crééLe }).from(onboardings),
        tx.select({ slug: organisations.slug, nom: organisations.nom, site: organisations.urlSite }).from(organisations),
      ])
      const nom = nomComparable(d.nom)
      const domaine = domaineDuSite(d.site)
      for (const [où, lignes] of [['onboarding', existants], ['organisation', orgs]] as const) {
        for (const l of lignes) {
          if (l.slug === d.slug) return { sorte: 'doublon', par: 'slug', slug: l.slug, où }
          if (l.nom && nomComparable(l.nom) === nom) return { sorte: 'doublon', par: 'nom', slug: l.slug, où }
          if (domaine && domaineDuSite(l.site) === domaine) return { sorte: 'doublon', par: 'site', slug: l.slug, où }
        }
      }
      if (d.exécuteur === 'cowork') {
        const semaine = lundiDeParis(entrée.maintenant)
        const pris = existants.filter((l) => l.exécuteur === 'cowork' && lundiDeParis(l.crééLe) === semaine).length
        if (pris >= CRÉNEAUX_COWORK_PAR_SEMAINE) return { sorte: 'créneaux-cowork', pris }
      }
      const [ligne] = await tx
        .insert(onboardings)
        .values({
          slug: d.slug,
          nom: d.nom,
          site: d.site,
          exécuteur: d.exécuteur,
          intake: { ...d.intake },
          crééPar: entrée.opératrice,
          crééLe: entrée.maintenant,
          misÀJourLe: entrée.maintenant,
        })
        .returning({ id: onboardings.id })
      if (!ligne) throw new Error('demande non enregistrée')
      return { sorte: 'enregistrée', onboardingId: ligne.id }
    }),
  )
}

export type DemandeÀTransmettre = {
  readonly nom: string | null
  readonly site: string | null
  readonly objectifs: string | null
  readonly lecteurFinal: string | null
  readonly emailDuLecteurFinal: string | null
}

/**
 * La demande que le début d'un run transmet à la tâche, tant que la ligne du
 * registre n'est pas rapportée ; `null` ensuite, ou pour un onboarding né d'un
 * run. C'est la seule lecture de l'adresse du lecteur final, pour le seul
 * harnais, derrière le jeton du dispositif.
 */
export async function demandeÀTransmettre(slug: string, db: Base = base()): Promise<DemandeÀTransmettre | null> {
  return protéger('lecture d’une demande d’onboarding', async () => {
    const [l] = await db
      .select({ nom: onboardings.nom, site: onboardings.site, intake: onboardings.intake })
      .from(onboardings)
      .where(and(eq(onboardings.slug, slug), isNull(onboardings.registreNotion), isNotNull(onboardings.intake)))
      .limit(1)
    if (!l?.intake) return null
    const texteOuNul = (v: unknown) => (typeof v === 'string' && v ? v : null)
    return {
      nom: l.nom,
      site: l.site,
      objectifs: texteOuNul(l.intake['objectifs']),
      lecteurFinal: texteOuNul(l.intake['lecteurFinal']),
      emailDuLecteurFinal: texteOuNul(l.intake['emailDuLecteurFinal']),
    }
  })
}

/** Les onboardings Cowork créés depuis le portail cette semaine ISO de Paris (la vue Notion « Créneaux Cowork » fait foi pour le reste). */
export async function créneauxCoworkPris(maintenant: Date, db: Base = base()): Promise<number> {
  return protéger('lecture des créneaux Cowork', async () => {
    const lignes = await db.select({ crééLe: onboardings.crééLe }).from(onboardings).where(eq(onboardings.exécuteur, 'cowork'))
    const semaine = lundiDeParis(maintenant)
    return lignes.filter((l) => lundiDeParis(l.crééLe) === semaine).length
  })
}

/** Trente jours au plus : une demande restée sans ligne du registre ne garde pas l'intake indéfiniment. */
export const JOURS_DE_L_INTAKE = 30

/** Efface l'intake des demandes de plus de trente jours ; rend le nombre de lignes effacées. Appelée par le passage quotidien. */
export async function effacerLesDemandesAnciennes(maintenant: Date, db: Base = base()): Promise<number> {
  return protéger('effacement des demandes anciennes', async () => {
    const limite = new Date(maintenant.getTime() - JOURS_DE_L_INTAKE * 24 * 60 * 60 * 1000)
    const effacées = await db
      .update(onboardings)
      .set({ intake: null })
      .where(and(isNotNull(onboardings.intake), lt(onboardings.crééLe, limite)))
      .returning({ id: onboardings.id })
    return effacées.length
  })
}

// ── Lectures ─────────────────────────────────────────────────────────────────

export type RunLu = {
  readonly id: string
  readonly tâche: TâcheDOnboarding
  readonly état: ÉtatDeRun
  readonly runGithub: number | null
  readonly lien: string | null
  readonly runTrigger: string | null
  readonly plafondUsd: number | null
  readonly coûtUsd: number | null
  readonly début: Date | null
  readonly fin: Date | null
  readonly crééLe: Date
  readonly codeHttp: number | null
  readonly lancéPar: string | null
  readonly consigne: ConsigneDuRun | null
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
  readonly crééPar: string
  /** La demande du formulaire, tant qu'elle est gardée : objectifs et lecteur final par son nom, jamais l'adresse. */
  readonly demande: { readonly objectifs: string | null; readonly lecteurFinal: string | null; readonly avecAdresse: boolean } | null
  /** L'organisation du même slug, si l'étape B l'a créée. */
  readonly organisation: { readonly nom: string; readonly état: string; readonly activéeLe: Date | null; readonly essaiOuvertLe: Date | null } | null
  readonly lecteursActifs: number
  readonly dernierLienEnvoyéLe: Date | null
  /** Les plus récents d'abord, dix au plus. */
  readonly runs: readonly RunLu[]
}

export const RUNS_MONTRÉS = 10

const versLeRunLu = (r: typeof onboardingRuns.$inferSelect): RunLu => ({
  id: r.id,
  tâche: r.tâche,
  état: r.état,
  runGithub: r.runGithub,
  runTrigger: r.runTrigger,
  lien: r.lien,
  plafondUsd: r.plafondUsd,
  coûtUsd: r.coûtUsd,
  début: r.début,
  fin: r.fin,
  crééLe: r.crééLe,
  codeHttp: r.codeHttp,
  lancéPar: r.lancéPar,
  consigne: lireLaConsigne(r.consigne),
})

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
      crééPar: o.crééPar,
      demande: o.intake
        ? {
            objectifs: typeof o.intake['objectifs'] === 'string' ? o.intake['objectifs'] : null,
            lecteurFinal: typeof o.intake['lecteurFinal'] === 'string' ? o.intake['lecteurFinal'] : null,
            avecAdresse: typeof o.intake['emailDuLecteurFinal'] === 'string' && o.intake['emailDuLecteurFinal'] !== '',
          }
        : null,
      organisation:
        l.organisationId && l.organisationNom && l.organisationÉtat
          ? { nom: l.organisationNom, état: l.organisationÉtat, activéeLe: l.activéeLe, essaiOuvertLe: l.essaiOuvertLe }
          : null,
      lecteursActifs: Number(actifs.find((a) => a.organisationId === l.organisationId)?.n ?? 0),
      dernierLienEnvoyéLe: date(liens.find((c) => c.organisationId === l.organisationId)?.le),
      runs: sesRuns.map(versLeRunLu),
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
      runsDuMois: duMois.map(versLeRunLu),
    }
  })
}

/** L'onboarding d'un slug, pour la fiche de l'organisation ; `null` sans onboarding suivi. */
export async function onboardingDUnSlug(slug: string, db: Base = base()): Promise<OnboardingLu | null> {
  return protéger('lecture d’un onboarding', async () => (await lire({ slug }, db))[0] ?? null)
}

/**
 * Tous les onboardings, pour le contrôle du soir (lot 2) : il traverse les
 * clients derrière le jeton du dispositif, comme le reste de son contrôle. Seul
 * appelant `lib/portail/onboarding.ts` (`alertesDesOnboardings`).
 */
export async function onboardingsPourLeContrôle(db: Base = base()): Promise<OnboardingLu[]> {
  return protéger('lecture des onboardings pour le contrôle', () => lire(null, db))
}

