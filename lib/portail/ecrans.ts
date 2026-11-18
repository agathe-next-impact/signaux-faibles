import { notFound } from 'next/navigation'
import type { ÉcranDésactivable } from '@/lib/domaine/ecrans-de-l-espace'
import { espaceDeLOrganisation } from '@/lib/portail/strategie'

/**
 * La garde d'un écran de l'espace que l'opératrice peut masquer (18 novembre
 * 2026, `lib/domaine/ecrans-de-l-espace.ts`). Appelée par chaque page de
 * `/[slug]` **après** `exigerLectureComplète` ou `exigerLecture`, jamais à leur
 * place : elle ne vérifie pas l'appartenance, elle ferme un écran que
 * l'appartenance ouvrait. `tests/architecture.test.ts` tient chaque appel.
 *
 * - Une session au privilège « Tous les espaces » passe toujours : l'opératrice
 *   prévisualise un écran masqué, et la coquille le lui signale.
 * - Pour un client, un écran masqué répond 404, comme une adresse inconnue.
 * - Dans le doute (base absente, lente, `SOURCE_ACCES=notion`), l'espace lu est
 *   `null` et rien n'est masqué : le comportement d'avant le réglage.
 *
 * La lecture est celle du rail (`espaceDeLOrganisation`), mémoïsée par requête :
 * aucune requête de plus pour la page.
 */
export async function exigerLÉcran(
  accès: { readonly organisationId: string; readonly tousLesEspaces: boolean },
  écran: ÉcranDésactivable,
): Promise<void> {
  if (accès.tousLesEspaces) return
  const espace = await espaceDeLOrganisation(accès.organisationId)
  if (espace?.écransMasqués.includes(écran)) notFound()
}
