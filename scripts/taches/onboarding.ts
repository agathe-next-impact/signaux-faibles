/**
 * Le suivi d'un onboarding par le harnais (lot 1 de
 * `docs/proposition-onboarding-admin.md`, 1er novembre 2026).
 *
 * Un run `balayage` ou `premiere-lettre` lancé sur une organisation dit au
 * portail quand il commence et quand il finit, avec son coût lu dans la mesure :
 * c'est le code qui le fait, pas le modèle, pour que le suivi ne dépende pas
 * d'une consigne suivie ou non. Au début, le portail décide du budget du mois
 * (`ONBOARDING_BUDGET_MENSUEL_USD`) : un refus arrête le run **avant** que la
 * session ne s'ouvre, donc sans rien dépenser. Un portail injoignable, lui,
 * n'arrête rien : le run part sans suivi, et le journal le dit.
 */
import { appelerLePortail, CHEMIN_DU_SUIVI, type ConfigurationDesOutils } from './outils'
import type { Tâche } from './pointeurs'

export const TÂCHES_D_ONBOARDING: readonly Tâche[] = ['balayage', 'premiere-lettre']

export { CHEMIN_DU_SUIVI }

/** Seuls les runs ciblés sur une organisation sont des onboardings ; le balayage du matin sans organisation n'en est pas un. */
export function estUnOnboarding(tâche: Tâche, organisation: string | null): organisation is string {
  return organisation !== null && TÂCHES_D_ONBOARDING.includes(tâche)
}

export type RunGithub = { readonly id: number; readonly tentative: number | null; readonly lien: string | null }

/** Le run GitHub Actions en cours, d'après les variables que GitHub pose ; `null` hors de GitHub. */
export function runDeGithub(env: Readonly<Record<string, string | undefined>> = process.env): RunGithub | null {
  const id = Number(env['GITHUB_RUN_ID'])
  if (!Number.isSafeInteger(id) || id <= 0) return null
  const tentative = Number(env['GITHUB_RUN_ATTEMPT'])
  const serveur = (env['GITHUB_SERVER_URL'] ?? '').replace(/\/$/, '')
  const dépôt = env['GITHUB_REPOSITORY'] ?? ''
  const lien = serveur === 'https://github.com' && /^[\w.-]+\/[\w.-]+$/.test(dépôt) ? `${serveur}/${dépôt}/actions/runs/${id}` : null
  return { id, tentative: Number.isSafeInteger(tentative) && tentative > 0 ? tentative : null, lien }
}

export type Début =
  | { readonly sorte: 'suivi'; readonly runId: string }
  | { readonly sorte: 'refusé'; readonly message: string }
  | { readonly sorte: 'non-suivi'; readonly raison: string }

const dollars = (n: unknown) => (typeof n === 'number' ? `${n.toFixed(2)} $` : 'n.c.')

export async function annoncerLeDébut(
  configuration: ConfigurationDesOutils,
  entrée: { readonly slug: string; readonly tâche: Tâche; readonly plafondUsd: number; readonly run: RunGithub | null },
): Promise<Début> {
  try {
    const r = await appelerLePortail(configuration, 'POST', CHEMIN_DU_SUIVI, {
      evenement: 'debut',
      slug: entrée.slug,
      tache: entrée.tâche,
      plafondUsd: entrée.plafondUsd,
      run: entrée.run,
    })
    if ('refus' in r) return { sorte: 'non-suivi', raison: r.refus }
    const corps = (() => {
      try {
        return JSON.parse(r.corps) as { état?: string; run?: string; budget?: { dépenséUsd?: number; budgetUsd?: number; plafondUsd?: number } }
      } catch {
        return null
      }
    })()
    if (r.statut === 409 && corps?.état === 'budget-atteint') {
      const b = corps.budget ?? {}
      return {
        sorte: 'refusé',
        message: `budget des onboardings atteint : ${dollars(b.dépenséUsd)} dépensés ce mois, plafond du run ${dollars(b.plafondUsd)}, budget ${dollars(b.budgetUsd)} (ONBOARDING_BUDGET_MENSUEL_USD). Relever le budget dans Vercel, ou attendre le mois suivant.`,
      }
    }
    if (r.statut === 201 && typeof corps?.run === 'string') return { sorte: 'suivi', runId: corps.run }
    return { sorte: 'non-suivi', raison: `réponse ${r.statut} du portail` }
  } catch (e) {
    return { sorte: 'non-suivi', raison: e instanceof Error ? e.message : String(e) }
  }
}

export async function annoncerLaFin(
  configuration: ConfigurationDesOutils,
  entrée: { readonly slug: string; readonly runId: string; readonly réussi: boolean; readonly coûtUsd: number | null },
): Promise<void> {
  try {
    const r = await appelerLePortail(configuration, 'POST', CHEMIN_DU_SUIVI, {
      evenement: 'fin',
      slug: entrée.slug,
      run: entrée.runId,
      issue: entrée.réussi ? 'reussi' : 'echec',
      coutUsd: entrée.coûtUsd,
    })
    if ('refus' in r) configuration.journal(`suivi d’onboarding : fin non rapportée (${r.refus})`)
    else if (r.statut !== 200) configuration.journal(`suivi d’onboarding : fin rapportée, réponse ${r.statut}`)
  } catch (e) {
    configuration.journal(`suivi d’onboarding : fin non rapportée (${e instanceof Error ? e.message : String(e)})`)
  }
}

/** La consigne de harnais d'un run d'onboarding : quand appeler l'outil de rapport, et rien d'autre. */
export function consigneDuSuivi(slug: string, serveur: string): string {
  return [
    `SUIVI DE L’ONBOARDING. Ce run est suivi par le portail pour l’organisation « ${slug} ». Appelle mcp__${serveur}__rapporter_onboarding :`,
    '· dès que tu as créé ou retrouvé la ligne du registre, avec son identifiant (registre) ;',
    '· chaque fois que tu fais passer le statut de la ligne, avec le numéro atteint (statut, de 1 à 6) ;',
    '· quand tu t’arrêtes sur une garde (statut attendu, porte, email manquant, ligne d’un autre exécuteur), avec le motif en une phrase (motif).',
    'Cet outil ne remplace aucune écriture dans Notion : la page fait foi, le portail ne fait que suivre. N’appelle pas /api/veille/onboardings par appeler_portail.',
  ].join('\n')
}
