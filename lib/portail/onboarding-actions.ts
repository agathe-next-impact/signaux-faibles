'use server'

import { notFound, redirect } from 'next/navigation'
import { exigerOpérateur } from '@/lib/auth/appartenance'
import type { Geste } from '@/lib/domaine/onboarding'
import { lancerDepuisLePortail, type IssueDuLancement } from '@/lib/portail/onboarding'

/**
 * Le geste de l'opératrice sur un onboarding (lot 2 de
 * `docs/proposition-onboarding-admin.md`, 1er novembre 2026), depuis
 * `/espaces/onboardings` ou la section « Onboarding » de la fiche. La garde
 * passe d'abord, par `exigerOpérateur`, avant toute lecture et tout appel à
 * GitHub ; `tests/architecture.test.ts` tient l'ordre. Le résultat revient à
 * l'écran par l'URL, en un code que l'écran traduit.
 */

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const GESTES: readonly Geste[] = ['referentiels', 'premiere-lettre', 'relancer']

export async function lancerUneÉtapeDOnboarding(données: FormData): Promise<void> {
  const slug = données.get('slug')
  const geste = données.get('geste')
  const retour = données.get('retour') === 'fiche' ? 'fiche' : 'liste'
  if (typeof slug !== 'string' || !SLUG.test(slug)) notFound()
  if (typeof geste !== 'string' || !(GESTES as readonly string[]).includes(geste)) notFound()
  const accès = await exigerOpérateur()

  let issue: IssueDuLancement | 'échec'
  try {
    issue = await lancerDepuisLePortail({ slug, geste: geste as Geste, opératrice: accès.nom })
  } catch (erreur) {
    console.error(`[onboarding] ${slug} : lancement impossible (${erreur instanceof Error ? erreur.message : String(erreur)}).`)
    issue = 'échec'
  }
  console.info(`[onboarding] ${accès.nom} : ${slug}, ${geste}, ${issue}.`)
  const code = encodeURIComponent(issue)
  redirect(
    retour === 'fiche'
      ? `/espaces/abonnements/${encodeURIComponent(slug)}?onboarding=${code}&section=onboarding#onboarding`
      : `/espaces/onboardings?lancement=${code}&slug=${encodeURIComponent(slug)}#${encodeURIComponent(slug)}`,
  )
}
