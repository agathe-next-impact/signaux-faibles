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
