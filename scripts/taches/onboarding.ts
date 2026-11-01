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

/**
 * L'identifiant de la réservation faite par le portail (lot 2), reçu par
 * l'entrée `lancement` du workflow dans `LANCEMENT` ; `null` pour un run lancé
 * à la main dans GitHub, ou une valeur qui n'est pas un uuid.
 */
export function lancementDuPortail(env: Readonly<Record<string, string | undefined>> = process.env): string | null {
  const valeur = (env['LANCEMENT'] ?? '').trim().toLowerCase()
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(valeur) ? valeur : null
}

/** La demande enregistrée dans le portail (lot 3), transmise au début tant que la ligne du registre n'existe pas. */
export type DemandeDuPortail = {
  readonly nom: string | null
  readonly site: string | null
  readonly objectifs: string | null
  readonly lecteurFinal: string | null
  readonly emailDuLecteurFinal: string | null
}

export type Début =
  | { readonly sorte: 'suivi'; readonly runId: string; readonly demande: DemandeDuPortail | null }
  | { readonly sorte: 'refusé'; readonly message: string }
  | { readonly sorte: 'non-suivi'; readonly raison: string }

const dollars = (n: unknown) => (typeof n === 'number' ? `${n.toFixed(2)} $` : 'n.c.')

export async function annoncerLeDébut(
  configuration: ConfigurationDesOutils,
  entrée: { readonly slug: string; readonly tâche: Tâche; readonly plafondUsd: number; readonly run: RunGithub | null; readonly lancement?: string | null },
): Promise<Début> {
  try {
    const r = await appelerLePortail(configuration, 'POST', CHEMIN_DU_SUIVI, {
      evenement: 'debut',
      slug: entrée.slug,
      tache: entrée.tâche,
      plafondUsd: entrée.plafondUsd,
      run: entrée.run,
      ...(entrée.lancement ? { lancement: entrée.lancement } : {}),
    })
    if ('refus' in r) return { sorte: 'non-suivi', raison: r.refus }
    const corps = (() => {
      try {
        return JSON.parse(r.corps) as { état?: string; run?: string; budget?: { dépenséUsd?: number; budgetUsd?: number; plafondUsd?: number }; demande?: unknown }
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
    if (r.statut === 201 && typeof corps?.run === 'string') return { sorte: 'suivi', runId: corps.run, demande: lireLaDemande(corps.demande) }
    return { sorte: 'non-suivi', raison: `réponse ${r.statut} du portail` }
  } catch (e) {
    return { sorte: 'non-suivi', raison: e instanceof Error ? e.message : String(e) }
  }
}

/** La demande telle que le portail l'envoie, champ par champ ; tout le reste est ignoré. */
function lireLaDemande(valeur: unknown): DemandeDuPortail | null {
  if (!valeur || typeof valeur !== 'object') return null
  const v = valeur as Record<string, unknown>
  const texte = (clé: string) => (typeof v[clé] === 'string' && (v[clé] as string).trim() ? (v[clé] as string).trim() : null)
  const demande = { nom: texte('nom'), site: texte('site'), objectifs: texte('objectifs'), lecteurFinal: texte('lecteurFinal'), emailDuLecteurFinal: texte('emailDuLecteurFinal') }
  return demande.nom && demande.site ? demande : null
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
export function consigneDuSuivi(slug: string, serveur: string, demande: DemandeDuPortail | null = null): string {
  return [
    ...(demande ? consigneDeLaDemande(slug, serveur, demande) : []),
    `SUIVI DE L’ONBOARDING. Ce run est suivi par le portail pour l’organisation « ${slug} ». Appelle mcp__${serveur}__rapporter_onboarding :`,
    '· dès que tu as créé ou retrouvé la ligne du registre, avec son identifiant (registre) ;',
    '· chaque fois que tu fais passer le statut de la ligne, avec le numéro atteint (statut, de 1 à 6) ;',
    '· quand tu t’arrêtes sur une garde (statut attendu, porte, email manquant, ligne d’un autre exécuteur), avec le motif en une phrase (motif).',
    'Cet outil ne remplace aucune écriture dans Notion : la page fait foi, le portail ne fait que suivre. N’appelle pas /api/veille/onboardings par appeler_portail.',
  ].join('\n')
}

/**
 * La demande enregistrée par l'opératrice dans le portail (lot 3) : la ligne du
 * registre n'existe peut-être pas encore. La tâche fait d'abord l'étape 1 de
 * l'onboarding avec ces valeurs, comme `/onboarding-demande`, sous les gardes de
 * la page Notion, qui fait foi, puis rapporte la ligne : le portail efface alors
 * sa copie.
 */
function consigneDeLaDemande(slug: string, serveur: string, d: DemandeDuPortail): string[] {
  const valeur = (v: string | null) => v ?? '(vide)'
  return [
    'DEMANDE ENREGISTRÉE DANS LE PORTAIL. L’opératrice a enregistré cette demande depuis son tableau ; la ligne du registre n’existe peut-être pas encore.',
    'Avant le reste de la tâche : cherche la ligne dans le registre « Organisations — pipeline et activation » (anti-doublon de l’étape 1 : même domaine ou même nom, accents et casse ignorés, toutes les lignes lues). Si elle existe, travaille sur elle. Sinon, crée-la comme l’étape 1 de « Tâche — Onboarding d’une organisation » (celle de /onboarding-demande), avec ces valeurs et elles seules :',
    `· Organisation : ${valeur(d.nom)}`,
    `· URL du site : ${valeur(d.site)}`,
    `· Objectifs de veille : ${d.objectifs ?? '(vide : à formuler par l’étape A, en point de validation)'}`,
    `· Lecteur final : ${valeur(d.lecteurFinal)}`,
    `· Email du lecteur final : ${valeur(d.emailDuLecteurFinal)}`,
    '· Statut : « 1 · Demande reçue » ; Exécuteur : « API » ; ▶ Générer les référentiels (A) : cochée.',
    `· Slug, quand le §3 le pose : « ${slug} », tel quel, pour que le portail retrouve l’organisation.`,
    `Puis appelle mcp__${serveur}__rapporter_onboarding avec l’identifiant de la ligne (registre) et le statut 1, avant de poursuivre. Si la garde 3.0 ou l’anti-doublon t’arrêtent, rapporte le motif et arrête-toi.`,
    '',
  ]
}

