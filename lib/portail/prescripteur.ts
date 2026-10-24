import { sourceAccès } from '@/lib/auth/source-acces'
import { baseConfigurée } from '@/lib/base/client'
import { lireLEspacePrescripteur, type EspacePrescripteur } from '@/lib/base/prescripteurs'

/**
 * L'espace prescripteur d'une organisation, pour l'écran « Vos recommandations »
 * et le lien qui y mène depuis « Mon abonnement » (24 octobre 2026).
 *
 * Même politique que `situationDeLEspace` : dans le doute (mode `notion`, base
 * absente ou injoignable), `null`, et l'écran n'existe pas pour cette
 * organisation. L'identifiant reçu est la clé de cloisonnement de la session,
 * déjà vérifiée par `exigerLecture` : jamais un slug venu du navigateur.
 */
export async function espacePrescripteurDe(organisationId: string): Promise<EspacePrescripteur | null> {
  if (!baseConfigurée() || sourceAccès() === 'notion') return null
  try {
    return await lireLEspacePrescripteur(organisationId)
  } catch (erreur) {
    console.warn(
      `[prescripteur] espace illisible pour ${organisationId} : ` +
        `${erreur instanceof Error ? erreur.message : String(erreur)}`,
    )
    return null
  }
}
