import { égalEnTempsConstant } from '@/lib/portail/activation'

/**
 * La garde commune des routes `/api/veille/*`.
 *
 * Ces routes servent le dispositif — la tâche Cowork qui écrit les lettres, la
 * réconciliation, le cron du soir — et jamais un navigateur. Elles partagent le
 * jeton que `POST /api/acces/ouvrir` accepte déjà (`ACTIVATION_SECRET`) : c'est
 * le seul secret que les tâches connaissent, et en ajouter un second doublerait
 * les endroits où il faut le coller sans rien protéger de plus. Le cron Vercel,
 * lui, présente `CRON_SECRET` ; les deux sont acceptés.
 *
 * Comme pour l'activation, le contrôle précède toute lecture de
 * l'environnement complet : un appelant anonyme ne doit pas pouvoir provoquer
 * une 500 et apprendre ce qui manque.
 */
export type DécisionCowork =
  | { readonly sorte: 'non-configurée' }
  | { readonly sorte: 'refusée'; readonly raison: string }
  | { readonly sorte: 'acceptée' }

export function vérifierJetonCowork(demande: {
  readonly autorisation: string | null | undefined
  readonly secrets: ReadonlyArray<string | undefined>
}): DécisionCowork {
  const valides = demande.secrets.filter((s): s is string => Boolean(s && s.length > 0))
  if (valides.length === 0) return { sorte: 'non-configurée' }

  const porté = /^Bearer (.+)$/.exec(demande.autorisation ?? '')?.[1]
  if (!porté) return { sorte: 'refusée', raison: 'en-tête Authorization absent ou mal formé' }

  // On compare à chaque secret sans court-circuit : le temps de réponse ne
  // doit pas dire lequel a été reconnu.
  let reconnu = false
  for (const secret of valides) {
    if (égalEnTempsConstant(porté, secret)) reconnu = true
  }

  return reconnu ? { sorte: 'acceptée' } : { sorte: 'refusée', raison: 'jeton invalide' }
}
