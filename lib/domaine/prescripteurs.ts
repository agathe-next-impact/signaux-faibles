import type { Étape } from '@/lib/domaine/parcours'

/**
 * Le code de recommandation d'un prescripteur (24 octobre 2026,
 * `docs/prescripteurs.md`) : celui du lien `/demo?de=<code>`. Il n'est pas un
 * secret ; sa forme est celle de la contrainte `prescripteurs_code_forme`.
 * Fonction pure : la page `/demo` la lit sans ouvrir Postgres.
 */
export function codeDePrescripteurValide(code: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(code) && code.length >= 3 && code.length <= 40
}

/** Le paramètre d'adresse qui porte le code : `/demo?de=<code>`. */
export const PARAMÈTRE_DU_PRESCRIPTEUR = 'de'

/**
 * Ce que le prescripteur lit de l'étape d'une organisation qu'il a recommandée,
 * et qui l'a accepté : quatre mots, jamais le détail (numéro de parution,
 * offre, source de l'abonnement, suspension posée à la main). Le détail est
 * une affaire entre le client et l'opératrice.
 */
export type ÉtapeVueDuPrescripteur = 'en préparation' | 'en essai' | 'abonnée' | 'essai terminé'

export function étapeVueDuPrescripteur(étape: Étape): ÉtapeVueDuPrescripteur {
  switch (étape.étape) {
    case 'hors-parcours':
      return 'en préparation'
    case 'essai':
      return 'en essai'
    case 'abonnee':
      return 'abonnée'
    case 'tronquee':
    case 'suspendue':
      return 'essai terminé'
  }
}
