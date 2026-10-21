'use server'

import { headers } from 'next/headers'
import { after } from 'next/server'
import { envoyerCourrier } from '@/lib/portail/courriers'
import { autoriserLaDemandeDeDémo, empreinte, origineDe } from '@/lib/portail/debit'
import {
  composerCourrierDeDémo,
  lireLaDemande,
  type ChampDeDémo,
  type DemandeDeDémo,
} from '@/lib/portail/demo'

export type RésultatDemande =
  | { readonly état: 'repos' }
  | { readonly état: 'envoyée' }
  | { readonly état: 'invalide'; readonly champs: readonly ChampDeDémo[]; readonly valeurs: DemandeDeDémo }
  | { readonly état: 'erreur'; readonly valeurs: DemandeDeDémo }

/**
 * Fait partir une demande de démonstration vers l'opératrice.
 *
 * Un robot qui remplit le champ piège et une demande freinée par la limitation
 * de débit reçoivent la même réponse qu'une demande partie : leur dire non les
 * inviterait à changer de méthode. Seule une défaillance technique se
 * distingue, parce que la personne peut alors réessayer. Les journaux portent
 * l'empreinte de l'adresse, jamais l'adresse.
 */
export async function demanderUneDémo(
  _précédent: RésultatDemande,
  formulaire: FormData,
): Promise<RésultatDemande> {
  const lecture = lireLaDemande(formulaire)
  if (lecture.sorte === 'piège') {
    console.warn('[démo] champ piège rempli : rien envoyé.')
    return { état: 'envoyée' }
  }
  if (lecture.sorte === 'invalide') {
    return { état: 'invalide', champs: lecture.champs, valeurs: lecture.valeurs }
  }

  const { demande } = lecture
  const marque = empreinte(demande.email)

  const débit = autoriserLaDemandeDeDémo(demande.email, origineDe(await headers()))
  if (!débit.autorisé) {
    console.warn(`[démo] demande ${marque} refusée par la limitation de débit (${débit.motif}).`)
    return { état: 'envoyée' }
  }

  try {
    await envoyerCourrier({
      message: composerCourrierDeDémo(demande),
      sorte: 'demande_demo',
      déclencheur: 'demo',
      organisation: null,
      lecteurId: null,
      unique: false,
      planifier: after,
    })
    console.info(`[démo] demande ${marque} transmise.`)
    return { état: 'envoyée' }
  } catch (erreur) {
    console.error(
      `[démo] échec de la demande ${marque} : ` +
        (erreur instanceof Error ? erreur.message : String(erreur)),
    )
    return { état: 'erreur', valeurs: demande }
  }
}
