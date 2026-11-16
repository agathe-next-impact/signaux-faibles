import { coûtsEntre, enregistrerUnCoût, nomsDesOrganisations, type CoûtÀEnregistrer } from '@/lib/base/couts'
import { bornesDuMois, totauxDuMois, type RunMesuré, type TotauxDuMois } from '@/lib/domaine/couts'

/**
 * Le suivi du coût des tâches (16 novembre 2026) : seule orchestration de
 * `lib/base/couts.ts`.
 *
 *   · le harnais rapporte la mesure de chaque run (`POST /api/veille/couts`),
 *     une fois le run fini : c'est `recevoirUnCoût` ;
 *   · l'opératrice lit le mois sur `/espaces/couts`, derrière la garde de
 *     `listerLesCoûts` (`lib/auth/appartenance.ts`), et les tâches par
 *     `GET /api/veille/couts` : c'est `coûtsDuMois`.
 *
 * Rien n'est recalculé : le coût est celui que le SDK a rapporté au harnais.
 */

export async function recevoirUnCoût(coût: CoûtÀEnregistrer): Promise<{ readonly sorte: 'enregistré' | 'déjà-enregistré' }> {
  return enregistrerUnCoût(coût)
}

export type CoûtsDuMois = {
  readonly mois: string
  /** Du plus récent au plus ancien, pour l'écran. */
  readonly runs: readonly RunMesuré[]
  readonly totaux: TotauxDuMois
  /** Le nom de chaque organisation connue du portail, par slug. */
  readonly noms: Readonly<Record<string, string>>
}

export async function coûtsDuMois(mois: string): Promise<CoûtsDuMois> {
  const { début, fin } = bornesDuMois(mois)
  const runs = await coûtsEntre(début, fin)
  const totaux = totauxDuMois(runs)
  const noms = await nomsDesOrganisations(totaux.parOrganisation.map((o) => o.slug))
  return { mois, runs: [...runs].reverse(), totaux, noms: Object.fromEntries(noms) }
}
