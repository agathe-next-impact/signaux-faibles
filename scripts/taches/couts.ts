/**
 * Le coût de chaque run, rapporté au portail (16 novembre 2026, demande de
 * l'opératrice).
 *
 * `mesure.json` ne vivait que dans l'artefact du job GitHub, trente jours :
 * seuls les runs d'onboarding laissaient leur coût au portail. Ici, le harnais
 * poste la mesure de **tout** run, une fois la session finie, et le portail en
 * tire le total du mois, par tâche et par organisation (`/espaces/couts`).
 *
 * C'est le code qui rapporte, jamais le modèle : l'outil `appeler_portail`
 * refuse cette route. Et rapporter ne fait jamais échouer un run : un portail
 * injoignable ou une réponse inattendue s'écrivent au journal, la mesure reste
 * dans l'artefact.
 */
import type { Mesure } from './mesure'
import type { RunGithub } from './onboarding'
import { appelerLePortail, CHEMIN_DES_COÛTS, type ConfigurationDesOutils } from './outils'

export type RapportDeCoût = 'enregistré' | 'déjà-enregistré' | 'non-rapporté'

/** Ce que le portail reçoit : la mesure sans le détail des étapes, qui ne sert qu'aux évaluations. */
export function corpsDuCoût(mesure: Mesure, run: RunGithub | null) {
  return {
    mesure: {
      tâche: mesure.tâche,
      organisation: mesure.organisation,
      date: mesure.date,
      issue: mesure.issue,
      duréeMs: Math.max(0, Math.round(mesure.duréeMs)),
      tours: Math.max(0, Math.round(mesure.tours)),
      coûtTotalUsd: mesure.coûtTotalUsd,
      plafondUsd: mesure.plafondUsd,
      parModèle: mesure.parModèle,
      organisationsTraitées: mesure.organisationsTraitées,
    },
    run,
  }
}

export async function rapporterLeCoût(configuration: ConfigurationDesOutils, mesure: Mesure, run: RunGithub | null): Promise<RapportDeCoût> {
  try {
    const r = await appelerLePortail(configuration, 'POST', CHEMIN_DES_COÛTS, corpsDuCoût(mesure, run))
    if ('refus' in r) {
      configuration.journal(`coût du run : non rapporté (${r.refus})`)
      return 'non-rapporté'
    }
    if (r.statut === 201) return 'enregistré'
    if (r.statut === 200) return 'déjà-enregistré'
    configuration.journal(`coût du run : non rapporté, réponse ${r.statut} du portail`)
    return 'non-rapporté'
  } catch (e) {
    configuration.journal(`coût du run : non rapporté (${e instanceof Error ? e.message : String(e)})`)
    return 'non-rapporté'
  }
}
