'use server'

import { notFound, redirect } from 'next/navigation'
import { exigerOpérateur } from '@/lib/auth/appartenance'
import { modifierLÉnoncéDuPilote, type RésultatDeLaModification } from '@/lib/portail/strategie'

/**
 * Retoucher un énoncé d'une synthèse avant de la publier, depuis la page de
 * relecture de l'opératrice (30 octobre 2026). C'est le même geste que
 * `PATCH /api/veille/syntheses` avec `element` : la porte de l'énoncé passe,
 * puis l'écriture, et une période dont une ligne est publiée est refusée.
 *
 * Le slug, la période et l'élément viennent du formulaire : la garde passe
 * d'abord, par `exigerOpérateur`, avant toute écriture ; `tests/architecture.test.ts`
 * tient l'ordre. Le résultat revient à la page par l'URL, en code que l'écran
 * traduit, avec l'ancre de l'élément retouché.
 */
export async function modifierUnÉnoncéDeSynthèse(données: FormData): Promise<void> {
  const slug = données.get('slug')
  const période = données.get('periode')
  const élément = données.get('element')
  const énoncé = données.get('enonce')
  const titre = données.get('titre')
  if (typeof slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) notFound()
  if (typeof période !== 'string' || !/^\d{4}-(\d{2}|T[1-4])$/.test(période)) notFound()
  if (typeof élément !== 'string' || !/^[0-9a-f-]{36}$/i.test(élément)) notFound()
  if (typeof énoncé !== 'string' || énoncé.length > 2000) notFound()
  if (titre !== null && (typeof titre !== 'string' || titre.length > 400)) notFound()

  const accès = await exigerOpérateur()
  let résultat: RésultatDeLaModification | { readonly sorte: 'échec' }
  try {
    résultat = await modifierLÉnoncéDuPilote({ slug, période, élément, énoncé, titre: typeof titre === 'string' ? titre : null })
  } catch (erreur) {
    console.error(`[relecture] ${slug} ${période} : modification impossible (${erreur instanceof Error ? erreur.message : String(erreur)}).`)
    résultat = { sorte: 'échec' }
  }
  console.info(`[relecture] ${accès.nom} : ${slug} ${période}, élément ${élément}, ${résultat.sorte}.`)
  const motif = résultat.sorte === 'refusé' ? `&motif=${encodeURIComponent(résultat.refus.map((r) => r.message).join(' ; '))}` : ''
  // `redirect` lève une exception de contrôle : hors de tout `try`.
  redirect(`/espaces/syntheses/${slug}/${période}?resultat=${encodeURIComponent(résultat.sorte)}&element=${élément}${motif}#${élément}`)
}
