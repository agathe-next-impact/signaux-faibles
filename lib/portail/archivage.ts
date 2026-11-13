import { archiverLOrganisation, désarchiverLOrganisation, slugDuRegistre, type RésultatDArchivage } from '@/lib/base/organisations'

/**
 * L'archivage d'une organisation (13 novembre 2026, à la demande de
 * l'opératrice) : la seule orchestration, que l'action de la fiche appelle après
 * `exigerOpérateur` (`lib/portail/archivage-actions.ts`) et que le crochet
 * `afterDelete` du registre Payload appelle quand une organisation y est
 * supprimée. Rien n'est effacé : la ligne garde son historique (courriers,
 * abonnements, synthèses), seuls `archivée_le`, l'activation des lecteurs et la
 * file changent (`archiverLOrganisation`, `lib/base/organisations.ts`).
 *
 * Tant que la double lecture dure (`SOURCE_ACCES=double`), Notion fait foi pour
 * les accès : une ligne « Accès » encore active rouvre son lecteur au prochain
 * import. Archiver ne touche pas à Notion ; la ligne s'y décoche à la main.
 */
export async function archiver(slug: string): Promise<RésultatDArchivage> {
  return archiverLOrganisation(slug)
}

export async function désarchiver(slug: string): Promise<RésultatDArchivage> {
  return désarchiverLOrganisation(slug)
}

/**
 * Archive l'organisation qu'une suppression du registre Payload laisse en base.
 * Ne lève jamais : la suppression Payload a déjà eu lieu, son échec ici est
 * journalisé et l'opératrice archive alors depuis la fiche.
 */
export async function archiverAprèsSuppressionDuRegistre(clé: string): Promise<RésultatDArchivage | 'sans-organisation' | 'échec'> {
  try {
    const slug = await slugDuRegistre(clé)
    if (!slug) return 'sans-organisation'
    const résultat = await archiverLOrganisation(slug)
    if (résultat.sorte !== 'archivée' && résultat.sorte !== 'déjà-archivée') {
      console.warn(`[registre] ${slug} : supprimée du registre Payload, non archivée dans le portail (${résultat.sorte}).`)
    }
    return résultat
  } catch (erreur) {
    console.error(`[registre] archivage après suppression impossible : ${erreur instanceof Error ? erreur.message : String(erreur)}`)
    return 'échec'
  }
}
