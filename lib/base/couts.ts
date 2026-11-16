import { and, asc, gte, inArray, lt } from 'drizzle-orm'
import { base, type Base } from '@/lib/base/client'
import { protéger } from '@/lib/base/erreurs'
import { coûtsDesRuns, organisations } from '@/lib/base/schema'
import type { RunMesuré } from '@/lib/domaine/couts'

/**
 * Le coût des runs (16 novembre 2026, migration 0027) : seul écrivain et seul
 * lecteur de `couts_des_runs`, appelé par la seule orchestration
 * `lib/portail/couts.ts`. `tests/architecture.test.ts` le tient.
 *
 * Des chiffres et des slugs : aucune adresse, aucun texte de lettre.
 */

export type CoûtÀEnregistrer = {
  readonly tâche: string
  readonly organisation: string | null
  readonly organisations: readonly string[]
  readonly issue: string
  readonly coûtUsd: number
  readonly plafondUsd: number | null
  readonly duréeMs: number | null
  readonly tours: number | null
  readonly parModèle: Record<string, unknown> | null
  readonly run: { readonly id: number; readonly tentative: number | null; readonly lien: string | null } | null
  readonly mesuréLe: Date
}

/**
 * Enregistre la mesure d'un run, une seule fois par run GitHub et par
 * tentative : un harnais relancé sur le même job ne double pas la dépense. Une
 * tentative absente vaut la première, sans quoi l'unicité ne tiendrait pas
 * (deux nuls ne se heurtent pas dans un index unique).
 */
export async function enregistrerUnCoût(coût: CoûtÀEnregistrer, db: Base = base()): Promise<{ readonly sorte: 'enregistré' | 'déjà-enregistré' }> {
  return protéger('enregistrement du coût d’un run', async () => {
    const lignes = await db
      .insert(coûtsDesRuns)
      .values({
        tâche: coût.tâche,
        organisation: coût.organisation,
        organisations: [...new Set(coût.organisations)].sort(),
        issue: coût.issue,
        coûtUsd: coût.coûtUsd,
        plafondUsd: coût.plafondUsd,
        duréeMs: coût.duréeMs,
        tours: coût.tours,
        parModèle: coût.parModèle,
        runGithub: coût.run?.id ?? null,
        tentative: coût.run ? (coût.run.tentative ?? 1) : null,
        lien: coût.run?.lien ?? null,
        origine: 'harnais',
        mesuréLe: coût.mesuréLe,
      })
      .onConflictDoNothing()
      .returning({ id: coûtsDesRuns.id })
    return { sorte: lignes.length > 0 ? 'enregistré' : 'déjà-enregistré' } as const
  })
}

/** Les runs mesurés dans un intervalle (début inclus, fin exclue), du plus ancien au plus récent. */
export async function coûtsEntre(début: Date, fin: Date, db: Base = base()): Promise<RunMesuré[]> {
  return protéger('lecture du coût des runs', async () => {
    const lignes = await db
      .select({
        tâche: coûtsDesRuns.tâche,
        organisation: coûtsDesRuns.organisation,
        organisations: coûtsDesRuns.organisations,
        issue: coûtsDesRuns.issue,
        coûtUsd: coûtsDesRuns.coûtUsd,
        plafondUsd: coûtsDesRuns.plafondUsd,
        duréeMs: coûtsDesRuns.duréeMs,
        tours: coûtsDesRuns.tours,
        runGithub: coûtsDesRuns.runGithub,
        lien: coûtsDesRuns.lien,
        origine: coûtsDesRuns.origine,
        mesuréLe: coûtsDesRuns.mesuréLe,
      })
      .from(coûtsDesRuns)
      .where(and(gte(coûtsDesRuns.mesuréLe, début), lt(coûtsDesRuns.mesuréLe, fin)))
      .orderBy(asc(coûtsDesRuns.mesuréLe))
    return lignes.map((l) => ({ ...l, organisations: Array.isArray(l.organisations) ? l.organisations.filter((s): s is string => typeof s === 'string') : [] }))
  })
}

/** Le nom des organisations que portent ces slugs ; un slug inconnu du portail est simplement absent. */
export async function nomsDesOrganisations(slugs: readonly string[], db: Base = base()): Promise<Map<string, string>> {
  if (slugs.length === 0) return new Map()
  return protéger('lecture du nom des organisations', async () => {
    const lignes = await db
      .select({ slug: organisations.slug, nom: organisations.nom })
      .from(organisations)
      .where(inArray(organisations.slug, [...slugs]))
    return new Map(lignes.map((l) => [l.slug, l.nom]))
  })
}
