'use server'

import { headers } from 'next/headers'
import { env } from '@/lib/env'
import { composerLienDAccès } from '@/lib/auth/jeton'
import { lireAccèsActifParEmail } from '@/lib/auth/source-acces'
import { composerCourrierDAccès, envoyerMessage } from '@/lib/email/gmail'
import {
  autoriserLEnvoi,
  avecDuréeMinimale,
  empreinte,
  origineDe,
  PLANCHER_DE_RÉPONSE_MS,
} from '@/lib/portail/debit'

export type RésultatEnvoi = { readonly état: 'repos' | 'envoyé' | 'erreur' }

/**
 * Renvoie son lien à une personne.
 *
 * La réponse est **la même** que l'adresse soit connue ou non : le formulaire
 * ne doit pas permettre de savoir qui est client. Seules les défaillances
 * techniques se distinguent, parce qu'elles appellent une action de la part du
 * visiteur — réessayer. Le temps de réponse aussi est le même, à un plancher
 * près (`avecDuréeMinimale`), et un envoi refusé par la limitation de débit
 * répond exactement comme un envoi fait.
 *
 * Le portail ne fait que recomposer le lien à partir de l'identifiant que
 * Notion conserve en clair. Le secret de signature ne quitte jamais le portail.
 * Les journaux ne portent jamais l'adresse en clair : une empreinte suffit à
 * rapprocher deux lignes.
 */
export async function envoyerMonLien(
  _précédent: RésultatEnvoi,
  formulaire: FormData,
): Promise<RésultatEnvoi> {
  const saisi = formulaire.get('email')
  const email = typeof saisi === 'string' ? saisi.trim().toLowerCase() : ''

  if (email.length === 0 || !email.includes('@')) return { état: 'envoyé' }

  return avecDuréeMinimale(PLANCHER_DE_RÉPONSE_MS, async () => {
    const marque = empreinte(email)

    try {
      const accès = await lireAccèsActifParEmail(email)

      if (!accès?.email) {
        // Le visiteur ne doit pas savoir si l'adresse est connue. L'opérateur,
        // lui, doit pouvoir distinguer « personne n'a demandé de lien » de
        // « la demande a échoué en silence » : sans cette ligne, une base mal
        // renseignée est indiscernable d'un envoi réussi.
        console.warn(`[lien] aucun accès actif pour ${marque} : rien envoyé.`)
        return { état: 'envoyé' }
      }

      // Le compteur ne compte que les envois réels, une fois la ligne trouvée.
      // Une adresse refusée répond exactement comme une adresse servie.
      const débit = autoriserLEnvoi(email, origineDe(await headers()))
      if (!débit.autorisé) {
        console.warn(`[lien] demande ${marque} refusée par la limitation de débit (${débit.motif}).`)
        return { état: 'envoyé' }
      }

      const lien = composerLienDAccès(
        accès.identifiant,
        env().ACCES_SECRET_HMAC,
        env().PORTAIL_URL,
      )
      const courrier = composerCourrierDAccès(accès.nom, lien)
      await envoyerMessage({ ...courrier, destinataire: accès.email })

      console.info(`[lien] envoyé à ${marque} (${accès.slug}).`)
      return { état: 'envoyé' }
    } catch (erreur) {
      // Le visiteur voit qu'il peut réessayer ; l'opérateur voit ce que Google
      // ou Notion a répondu. Le lien lui-même n'est jamais journalisé.
      console.error(
        `[lien] échec de la demande ${marque} : ` +
          (erreur instanceof Error ? erreur.message : String(erreur)),
      )
      return { état: 'erreur' }
    }
  })
}
