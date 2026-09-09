'use server'

import { env } from '@/lib/env'
import { composerLienDAccès } from '@/lib/auth/jeton'
import { lireAccèsActifParEmail } from '@/lib/notion/acces'
import { composerCourrierDAccès, envoyerMessage } from '@/lib/email/gmail'

export type RésultatEnvoi = { readonly état: 'repos' | 'envoyé' | 'erreur' }

/**
 * Renvoie son lien à une personne.
 *
 * La réponse est **la même** que l'adresse soit connue ou non : le formulaire
 * ne doit pas permettre de savoir qui est client. Seules les défaillances
 * techniques se distinguent, parce qu'elles appellent une action de la part du
 * visiteur — réessayer.
 *
 * Le portail ne fait que recomposer le lien à partir de l'identifiant que
 * Notion conserve en clair. Le secret de signature ne quitte jamais le portail.
 */
export async function envoyerMonLien(
  _précédent: RésultatEnvoi,
  formulaire: FormData,
): Promise<RésultatEnvoi> {
  const saisi = formulaire.get('email')
  const email = typeof saisi === 'string' ? saisi.trim().toLowerCase() : ''

  if (email.length === 0 || !email.includes('@')) return { état: 'envoyé' }

  try {
    const accès = await lireAccèsActifParEmail(email)

    if (accès?.email) {
      const lien = composerLienDAccès(
        accès.identifiant,
        env().ACCES_SECRET_HMAC,
        env().PORTAIL_URL,
      )
      const courrier = composerCourrierDAccès(accès.nom, lien)
      await envoyerMessage({ ...courrier, destinataire: accès.email })
    }

    return { état: 'envoyé' }
  } catch {
    // Ni l'adresse ni la cause ne sont journalisées ici : le monitoring de la
    // plateforme voit l'exception, le visiteur voit qu'il peut réessayer.
    return { état: 'erreur' }
  }
}
