/**
 * Le seul endroit du portail qui parle à GitHub (lot 2 de
 * `docs/proposition-onboarding-admin.md`, 1er novembre 2026) : déclencher le
 * workflow « Tâches planifiées (API Claude) » (`.github/workflows/taches.yml`)
 * pour une tâche d'onboarding, sur une organisation. Rien d'autre : le portail
 * ne lit ni les journaux ni les artefacts, le harnais lui rapporte ce qu'il faut.
 *
 * Jeton à granularité fine, limité à ce dépôt et à la permission « Actions :
 * lecture et écriture » (décision 2 du 1er novembre 2026), dans
 * `GITHUB_JETON_ACTIONS`, facultative : absente, le déclenchement est
 * « indisponible » et l'écran donne la commande à lancer à la main. Lue à
 * l'appel, jamais à l'import, et jamais écrite dans un journal ni une réponse.
 *
 * Seul appelant : `lib/portail/onboarding.ts`, après la garde de l'opératrice,
 * l'étape, le run en cours et le budget (`tests/architecture.test.ts`).
 */

export const DÉPÔT_DES_TÂCHES_PAR_DÉFAUT = 'agathe-next-impact/signaux-faibles'
export const BRANCHE_DES_TÂCHES_PAR_DÉFAUT = 'main'
export const FICHIER_DU_WORKFLOW = 'taches.yml'
/** La version de l'API REST demandée (documentation GitHub lue le 1er novembre 2026). */
export const VERSION_DE_L_API = '2026-03-10'
const DÉLAI_MS = 10_000

const vide = (v: string | undefined) => (v === undefined || v.trim() === '' ? undefined : v.trim())

export type ConfigurationGithub = { readonly jeton: string; readonly dépôt: string; readonly branche: string }

/**
 * La configuration lue dans l'environnement ; `null` sans jeton. Le dépôt et la
 * branche ont une valeur par défaut, réglable (`GITHUB_DEPOT_DES_TACHES`,
 * `GITHUB_BRANCHE_DES_TACHES`) pour un fork ou une branche d'essai.
 */
export function configurationGithub(env: Readonly<Record<string, string | undefined>> = process.env): ConfigurationGithub | null {
  const jeton = vide(env['GITHUB_JETON_ACTIONS'])
  if (!jeton) return null
  const dépôt = vide(env['GITHUB_DEPOT_DES_TACHES']) ?? DÉPÔT_DES_TÂCHES_PAR_DÉFAUT
  const branche = vide(env['GITHUB_BRANCHE_DES_TACHES']) ?? BRANCHE_DES_TÂCHES_PAR_DÉFAUT
  if (!/^[\w.-]+\/[\w.-]+$/.test(dépôt) || !/^[\w./-]+$/.test(branche)) return null
  return { jeton, dépôt, branche }
}

export type Déclenchement =
  | { readonly sorte: 'déclenché'; readonly runGithub: number | null; readonly lien: string | null }
  | { readonly sorte: 'échec'; readonly codeHttp: number | null }

/**
 * `POST /repos/{dépôt}/actions/workflows/taches.yml/dispatches`. GitHub répond
 * 200 avec l'identifiant du run dans la version d'API demandée ; un 204 sans
 * corps (version antérieure) vaut aussi déclenchement, sans identifiant : le
 * harnais le donnera au début. Toute autre réponse, ou l'absence de réponse en
 * dix secondes, est un échec, rendu par son seul code.
 */
export async function déclencherLeWorkflow(
  configuration: ConfigurationGithub,
  entrées: { readonly tache: 'balayage' | 'premiere-lettre'; readonly organisation: string; readonly lancement: string },
  faire: typeof fetch = fetch,
): Promise<Déclenchement> {
  let réponse: Response
  try {
    réponse = await faire(`https://api.github.com/repos/${configuration.dépôt}/actions/workflows/${FICHIER_DU_WORKFLOW}/dispatches`, {
      method: 'POST',
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${configuration.jeton}`,
        'content-type': 'application/json',
        'x-github-api-version': VERSION_DE_L_API,
        'user-agent': 'signauxfaibles-portail',
      },
      body: JSON.stringify({ ref: configuration.branche, inputs: entrées }),
      redirect: 'manual',
      signal: AbortSignal.timeout(DÉLAI_MS),
    })
  } catch {
    return { sorte: 'échec', codeHttp: null }
  }
  if (réponse.status === 204) return { sorte: 'déclenché', runGithub: null, lien: null }
  if (réponse.status !== 200) return { sorte: 'échec', codeHttp: réponse.status }
  const corps = (await réponse.json().catch(() => null)) as { workflow_run_id?: unknown; html_url?: unknown } | null
  const id = typeof corps?.workflow_run_id === 'number' && Number.isSafeInteger(corps.workflow_run_id) ? corps.workflow_run_id : null
  const lien = typeof corps?.html_url === 'string' && corps.html_url.startsWith('https://github.com/') ? corps.html_url : null
  return { sorte: 'déclenché', runGithub: id, lien }
}
