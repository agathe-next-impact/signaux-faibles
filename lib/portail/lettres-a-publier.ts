import { cléDUneOrganisationÀGérer } from '@/lib/base/gestion'
import { sourceDocuments } from '@/lib/documents/source'
import { identifiantPayload } from '@/lib/payload/portail'
import type { LettreÀPublier } from '@/lib/payload/publication'
import { envoyerLaLettreAuxLecteurs, type BilanDEnvoi } from '@/lib/portail/parution'

/**
 * Les lettres qui attendent l'opératrice (1er novembre 2026, aperçu avant
 * envoi), et leur publication. Seule orchestration de `lib/payload/publication.ts` ;
 * ses appelants passent le privilège opérateur d'abord (`lireLaGestionDUneOrganisation`,
 * l'action `publierLaLettre`), et `tests/architecture.test.ts` le vérifie.
 *
 * En mode `notion`, rien n'attend ici : une lettre Notion part en brouillon Gmail
 * que l'opératrice envoie elle-même, après l'avoir lue dans l'espace.
 */
export async function lettresÀPublierDe(slug: string): Promise<LettreÀPublier[] | null> {
  if (sourceDocuments() !== 'payload') return null
  const clé = await cléDUneOrganisationÀGérer(slug)
  if (!clé) return []
  const { lettresÀPublier } = await import('@/lib/payload/publication')
  return lettresÀPublier(identifiantPayload(clé))
}

export type RésultatDeLaPublication =
  | { readonly sorte: 'publiée'; readonly envoi: BilanDEnvoi }
  | { readonly sorte: 'introuvable' }
  | { readonly sorte: 'hors-payload' }

/**
 * Publie la lettre, puis l'envoie aux lecteurs actifs (ou à la relecture tant que
 * `relecture_requise` est vrai), par le même envoi que le moteur. Une lettre déjà
 * publiée ou d'une autre organisation est `introuvable` : rien ne part deux fois.
 */
export async function publierEtEnvoyer(entrée: { readonly slug: string; readonly id: string }): Promise<RésultatDeLaPublication> {
  if (sourceDocuments() !== 'payload') return { sorte: 'hors-payload' }
  const clé = await cléDUneOrganisationÀGérer(entrée.slug)
  if (!clé) return { sorte: 'introuvable' }
  const organisationPayload = identifiantPayload(clé)
  const { publierUneLettre } = await import('@/lib/payload/publication')
  const lettre = await publierUneLettre({ id: entrée.id, organisationPayload })
  if (!lettre) return { sorte: 'introuvable' }
  const envoi = await envoyerLaLettreAuxLecteurs({
    organisationPayload,
    édition: { id: lettre.id, titre: lettre.titre, numéro: lettre.numéro ?? 0, dateÉdition: lettre.dateÉdition, périodeCouverte: lettre.périodeCouverte },
    markdown: lettre.markdown,
  })
  return { sorte: 'publiée', envoi }
}
