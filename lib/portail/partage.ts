'use server'

import { notFound, redirect } from 'next/navigation'
import { exigerOpérateur } from '@/lib/auth/appartenance'
import { réglerLePartage, type RésultatDuPartage } from '@/lib/base/prescripteurs'

/**
 * L'accord de partage d'une organisation recommandée avec son prescripteur
 * (24 octobre 2026), depuis le tableau des prescripteurs de l'opératrice.
 *
 * L'opératrice le pose après l'accord du client : son prescripteur voit alors
 * le nom de l'organisation et son étape, rien d'autre. Le slug vient du
 * formulaire, donc du navigateur : la garde passe d'abord, par `exigerOpérateur`,
 * avant toute écriture ; `tests/architecture.test.ts` tient l'ordre.
 */
export async function réglerLePartageAvecLePrescripteur(données: FormData): Promise<void> {
  const slug = données.get('slug')
  const partage = données.get('partage')
  if (typeof slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) notFound()
  if (partage !== 'oui' && partage !== 'non') notFound()
  const accès = await exigerOpérateur()

  let sorte: RésultatDuPartage['sorte'] | 'échec'
  try {
    sorte = (await réglerLePartage(slug, partage === 'oui')).sorte
  } catch (erreur) {
    console.error(`[partage] ${slug} : impossible (${erreur instanceof Error ? erreur.message : String(erreur)}).`)
    sorte = 'échec'
  }
  console.info(`[partage] ${accès.nom} : ${slug}, partage ${partage}, ${sorte}.`)
  // `redirect` lève une exception de contrôle : hors de tout `try`.
  redirect(`/espaces/prescripteurs?partage=${encodeURIComponent(sorte)}&slug=${encodeURIComponent(slug)}`)
}
