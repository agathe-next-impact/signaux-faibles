'use client'

import { useEffect } from 'react'
import { purgerLeCache } from '@/components/service-worker'

/**
 * Vide le cache hors ligne au chargement (fin d'essai, palier 1c).
 *
 * Les pages complètes lues pendant l'essai sont restées dans le cache du
 * service worker pour la lecture hors ligne. Dès que l'espace n'est plus en
 * lecture complète, elles doivent disparaître de l'appareil, comme à la
 * révocation d'un accès.
 */
export function PurgeHorsLigne() {
  useEffect(() => {
    void purgerLeCache()
  }, [])
  return null
}
