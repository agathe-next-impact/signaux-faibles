import type { Onglet } from '@/components/coquille'

/**
 * L'onglet courant, pour le rail comme pour le menu de pied.
 *
 * Un onglet reste allumé sur ses sous-chemins — la lettre ouverte garde
 * « Lettres » allumé, la semaine archivée garde « Archives ». La vue
 * d'ensemble fait exception : son chemin est le préfixe de tous les autres,
 * elle s'allumerait donc partout.
 */
export function estOngletCourant(onglet: Onglet, chemin: string): boolean {
  if (chemin === onglet.href) return true
  if (onglet.exact) return false
  return chemin.startsWith(`${onglet.href}/`)
}
