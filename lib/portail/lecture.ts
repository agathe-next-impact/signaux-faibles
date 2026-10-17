import { cache } from 'react'
import { sourceAccès } from '@/lib/auth/source-acces'
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
 *
 * Trois bornes tiennent le coût et la promesse du mode `notion` :
 *   · **`SOURCE_ACCES=notion` n'ouvre jamais Postgres**, ici comme pour
 *     l'appartenance : c'est l'interrupteur de retour en arrière ;
 *   · la lecture est **bornée à 400 ms** : au-delà (base en reprise de veille,
 *     réseau lent), la lecture complète est servie plutôt que de faire attendre
 *     la page ;
 *   · elle est **mémoïsée par requête** (`cache` de React) : le layout et la
 *     page la demandent tous deux, une seule lecture a lieu.
 */
export type Lecture = {
  readonly lecture: 'complète' | 'essentiel' | 'aucune'
  /** L'étape calculée, ou `null` quand la lecture complète vient d'un doute ou de l'opérateur. */
  readonly étape: Étape | null
}

const COMPLÈTE: Lecture = { lecture: 'complète', étape: null }

/** Au-delà, la lecture complète est servie : une page ne doit pas attendre la base. */
export const DÉLAI_DE_LECTURE_MS = 400

const DÉLAI_DÉPASSÉ = Symbol('délai dépassé')

export async function lectureDeLEspace(espace: {
  readonly organisationId: string
  readonly enOpérateur: boolean
}): Promise<Lecture> {
  if (espace.enOpérateur) return COMPLÈTE
  return lectureMémoïsée(espace.organisationId)
}

const lectureMémoïsée = cache(async (organisationId: string): Promise<Lecture> => {
  if (!baseConfigurée() || sourceAccès() === 'notion') return COMPLÈTE
  const espace = { organisationId }
  try {
    let minuterie: ReturnType<typeof setTimeout> | undefined
    const délai = new Promise<typeof DÉLAI_DÉPASSÉ>((résoudre) => {
      minuterie = setTimeout(() => résoudre(DÉLAI_DÉPASSÉ), DÉLAI_DE_LECTURE_MS)
    })
    const entrée = await Promise.race([lireEntréeDuParcours(organisationId), délai]).finally(() =>
      clearTimeout(minuterie),
    )
    if (entrée === DÉLAI_DÉPASSÉ) {
      console.warn(`[lecture] parcours lu en plus de ${DÉLAI_DE_LECTURE_MS} ms pour ${organisationId}, lecture complète servie.`)
      return COMPLÈTE
    }
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
})
