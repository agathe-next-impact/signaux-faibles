import { baseConfigurée } from '@/lib/base/client'
import { lireEntréeDuParcours } from '@/lib/base/parcours'
import { aujourdHuiÀParis } from '@/lib/domaine/calendrier'
import { étapeDuParcours, lectureAutorisée, type Étape } from '@/lib/domaine/parcours'

/**
 * Ce qu'un espace a le droit de montrer aujourd'hui : tout, « L'essentiel »
 * seul, ou rien (offre du 17 octobre 2026, palier 1c).
 *
 * C'est le seul endroit qui transforme l'état d'une organisation en droit de
 * lecture ; les écrans ne font qu'obéir (`exigerLecture`, `exigerLectureComplète`
 * dans `lib/auth/appartenance.ts`).
 *
 * **En cas de doute, la lecture reste complète**, et c'est délibéré : c'est le
 * comportement d'avant le palier 1c, celui des clients historiques. Base non
 * configurée, base injoignable, organisation absente de Postgres : rien de cela
 * ne doit couper un lecteur qui lisait hier. Le doute est journalisé ; seule une
 * étape calculée sur des données lues peut restreindre.
 *
 * L'opérateur garde toujours la lecture complète : il visite l'espace pour
 * vérifier ce que le client recevrait, et un bandeau signale déjà sa visite.
 */
export type Lecture = {
  readonly lecture: 'complète' | 'essentiel' | 'aucune'
  /** L'étape calculée, ou `null` quand la lecture complète vient d'un doute ou de l'opérateur. */
  readonly étape: Étape | null
}

const COMPLÈTE: Lecture = { lecture: 'complète', étape: null }

export async function lectureDeLEspace(espace: {
  readonly organisationId: string
  readonly enOpérateur: boolean
}): Promise<Lecture> {
  if (espace.enOpérateur || !baseConfigurée()) return COMPLÈTE
  try {
    const entrée = await lireEntréeDuParcours(espace.organisationId)
    if (!entrée) return COMPLÈTE
    const étape = étapeDuParcours({ ...entrée, aujourdHui: aujourdHuiÀParis() })
    return { lecture: lectureAutorisée(étape), étape }
  } catch (erreur) {
    console.warn(
      `[lecture] parcours illisible pour ${espace.organisationId}, lecture complète servie : ` +
        `${erreur instanceof Error ? erreur.message : String(erreur)}`,
    )
    return COMPLÈTE
  }
}
