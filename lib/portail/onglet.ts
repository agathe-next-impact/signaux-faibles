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

/** Le menu de pied ne porte jamais plus de trois éléments (décision du 25 octobre 2026). */
export const ÉLÉMENTS_DU_MENU_BAS = 3

/**
 * La répartition du menu de pied : les écrans posés directement dans la barre,
 * et ceux que le dernier élément, « Plus », ouvre.
 *
 * Tant que les écrans tiennent dans trois éléments (fin d'essai : un ou deux),
 * ils sont tous directs et « Plus » n'existe pas. Au-delà, les deux premiers du
 * rail restent directs, la vue d'ensemble et les lettres, et « Plus » porte tous
 * les autres, dans l'ordre du rail : aucun écran ne disparaît du mobile.
 */
export function répartirLeMenuBas(onglets: readonly Onglet[]): { directs: readonly Onglet[]; autres: readonly Onglet[] } {
  if (onglets.length <= ÉLÉMENTS_DU_MENU_BAS) return { directs: onglets, autres: [] }
  return { directs: onglets.slice(0, ÉLÉMENTS_DU_MENU_BAS - 1), autres: onglets.slice(ÉLÉMENTS_DU_MENU_BAS - 1) }
}

/**
 * Les onglets groupés par rubrique, pour les accordéons du rail et du menu de
 * pied (30 octobre 2026) : un groupe par suite d'onglets consécutifs de même
 * rubrique, dans l'ordre du rail. Un onglet sans rubrique (espace d'avant la
 * réorganisation) forme un groupe sans nom, rendu en liste simple.
 */
export type GroupeDOnglets = {
  readonly rubrique: string | null
  readonly onglets: readonly Onglet[]
}

export function grouperParRubrique(onglets: readonly Onglet[]): readonly GroupeDOnglets[] {
  const groupes: { rubrique: string | null; onglets: Onglet[] }[] = []
  for (const onglet of onglets) {
    const rubrique = onglet.rubrique ?? null
    const dernier = groupes.at(-1)
    if (dernier && dernier.rubrique === rubrique) dernier.onglets.push(onglet)
    else groupes.push({ rubrique, onglets: [onglet] })
  }
  return groupes
}

/** Un accordéon s'ouvre de lui-même sur la rubrique de l'écran courant. */
export function groupeCourant(groupe: GroupeDOnglets, chemin: string): boolean {
  return groupe.onglets.some((onglet) => estOngletCourant(onglet, chemin))
}
