'use server'

import { notFound, redirect } from 'next/navigation'
import { exigerOpérateur } from '@/lib/auth/appartenance'
import type { RègleDIndicateur } from '@/lib/domaine/strategie'
import { modifierLIndicateurDuPilote, modifierLÉnoncéDuPilote, type RésultatDeLaModification } from '@/lib/portail/strategie'

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

/**
 * Retoucher la règle de comptage d'un indicateur de scénario avant publication
 * (16 novembre 2026, lot 2 des simulations) : la veille de sa famille, et la
 * règle que le portail applique aux faits étiquetés. Un seuil laissé vide rend
 * l'indicateur au comptage large. Les valeurs sont jugées par la porte du
 * domaine, sur la grille en vigueur ; ici, seule leur forme est tenue.
 *
 * Même ordre que la retouche d'un énoncé : la garde d'abord, par
 * `exigerOpérateur`, avant toute écriture.
 */
export async function modifierUnIndicateurDeSynthèse(données: FormData): Promise<void> {
  const slug = données.get('slug')
  const période = données.get('periode')
  const élément = données.get('element')
  const rang = Number(données.get('rang'))
  const texte = (nom: string): string | null => {
    const v = données.get(nom)
    return typeof v === 'string' && v.trim().length > 0 && v.length <= 800 ? v.trim() : null
  }
  if (typeof slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) notFound()
  if (typeof période !== 'string' || !/^\d{4}-T[1-4]$/.test(période)) notFound()
  if (typeof élément !== 'string' || !/^[0-9a-f-]{36}$/i.test(élément)) notFound()
  if (!Number.isInteger(rang) || rang < 0 || rang > 7) notFound()

  const seuil = texte('seuil')
  const entités = (texte('entites') ?? '')
    .split(';')
    .map((e) => e.trim())
    .filter((e) => e.length > 0)
  const règle =
    seuil === null
      ? null
      : ({
          ...(texte('cadre') ? { cadre: texte('cadre') } : {}),
          ...(entités.length > 0 ? { entités } : {}),
          ...(texte('mouvement') ? { mouvement: texte('mouvement') } : {}),
          exigence: texte('exigence') ?? 'tout',
          seuil: Number(seuil),
          sens: texte('sens') ?? 'apparition',
        } as RègleDIndicateur)

  const accès = await exigerOpérateur()
  let résultat: Awaited<ReturnType<typeof modifierLIndicateurDuPilote>> | { readonly sorte: 'échec' }
  try {
    résultat = await modifierLIndicateurDuPilote({ slug, période, élément, rang, veille: texte('veille'), règle })
  } catch (erreur) {
    console.error(`[relecture] ${slug} ${période} : indicateur non modifié (${erreur instanceof Error ? erreur.message : String(erreur)}).`)
    résultat = { sorte: 'échec' }
  }
  console.info(`[relecture] ${accès.nom} : ${slug} ${période}, élément ${élément}, indicateur ${rang + 1}, ${résultat.sorte}.`)
  const motif = résultat.sorte === 'refusé' ? `&motif=${encodeURIComponent(résultat.refus.map((r) => r.message).join(' ; '))}` : ''
  redirect(`/espaces/syntheses/${slug}/${période}?resultat=${encodeURIComponent(résultat.sorte)}&element=${élément}${motif}#${élément}`)
}
