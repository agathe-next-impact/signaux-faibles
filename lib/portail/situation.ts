import { sourceAccès } from '@/lib/auth/source-acces'
import { baseConfigurée } from '@/lib/base/client'
import { lireSituationDAbonnement, type SituationDAbonnement } from '@/lib/base/situation'

/**
 * La situation d'abonnement d'un espace, pour l'écran « Mon abonnement ».
 *
 * Même politique que la lecture (`lib/portail/lecture.ts`), sans la borne de
 * temps : l'écran est dédié, il peut attendre la base. Dans le doute (mode
 * `notion`, base absente ou injoignable), il rend `null` et l'écran le dit ;
 * il ne décide rien, c'est `exigerLecture` qui a déjà décidé du droit de lire.
 */
export async function situationDeLEspace(organisationId: string): Promise<SituationDAbonnement | null> {
  if (!baseConfigurée() || sourceAccès() === 'notion') return null
  try {
    return await lireSituationDAbonnement(organisationId)
  } catch (erreur) {
    console.warn(
      `[abonnement] situation illisible pour ${organisationId} : ` +
        `${erreur instanceof Error ? erreur.message : String(erreur)}`,
    )
    return null
  }
}

/**
 * Les lecteurs se gèrent depuis l'écran seulement quand Postgres fait foi
 * (`SOURCE_ACCES=postgres`), comme pour `POST /api/veille/lecteurs` : avant la
 * bascule, un lecteur créé ici seulement ne pourrait pas entrer, et une
 * révocation faite ici seulement ne fermerait rien. L'écran renvoie alors à
 * l'adresse d'abonnement.
 */
export function lecteursModifiables(): boolean {
  return baseConfigurée() && sourceAccès() === 'postgres'
}
